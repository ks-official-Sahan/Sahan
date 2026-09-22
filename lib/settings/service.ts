import "server-only";

import { cached } from "@/lib/cache/cached";
import { invalidate } from "@/lib/cache/invalidate";
import { forSettings } from "@/lib/cache/plan";
import { staticTags } from "@/lib/cache/tags";
import { kv } from "@/lib/cache/redis";
import { db } from "@/lib/db/prisma";
import { audit } from "@/lib/admin/audit";
import type { AuthUser } from "@/lib/auth/dal";
import { log } from "@/lib/log";
import {
  DEFAULT_SETTINGS,
  getSettingDefault,
  getSettingSchema,
  isPublicSetting,
  isSettingKey,
  type SettingKey,
  type SettingValueOf,
  validateSetting,
} from "./schema";

// Service layer for settings: read, write, cache and validate. Design:
// docs/plan/admin-cms-adr.md, section 16. Settings are stored in the database
// with Prisma, cached with unstable_cache and tags, and mirrored to KV so the
// proxy (which does no database work) can read maintenance and the IP
// allowlist. The KV mirror is written on every save; before the first save it
// simply has no value, and getKvSetting then returns null, which every reader
// (the proxy included) treats as the safe default: NOT in maintenance, and an
// empty allowlist (fail-open).

type SettingValue<K extends SettingKey> = SettingValueOf<K>;

/**
 * Read one setting, falling back to its default when not stored or invalid.
 * Not cached; use getSetting/getPublicSettings/getAllSettings for cached reads.
 */
async function readSettingRaw<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  if (!isSettingKey(key)) return getSettingDefault(key) as SettingValue<K>;

  try {
    const row = await db.setting.findUnique({ where: { key } });
    if (!row) return getSettingDefault(key) as SettingValue<K>;
    return validateSetting(key, row.value) as SettingValue<K>;
  } catch (err) {
    log.error("Failed to read setting", { key, error: String(err) });
    return getSettingDefault(key) as SettingValue<K>;
  }
}

/** One cached setting. Use in request handlers and Server Components. */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const fn = async () => readSettingRaw(key);
  return cached(fn, [`setting:${key}`], { tags: ["settings", `settings:${key}`] })();
}

/**
 * The subset safe to expose to layouts that feed client code, and to cache
 * broadly. Never includes a key outside publicSettingKeys, even if a caller
 * adds a new key to DEFAULT_SETTINGS and forgets to classify it
 * (isPublicSetting is the single source of truth). Exported uncached so it
 * can be unit tested without going through unstable_cache.
 */
export async function collectPublicSettings(): Promise<Partial<Record<SettingKey, unknown>>> {
  const result: Partial<Record<SettingKey, unknown>> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    if (isPublicSetting(key)) result[key] = await readSettingRaw(key);
  }
  return result;
}

/** Cached entry point for request handlers and Server Components. */
export async function getPublicSettings(): Promise<Partial<Record<SettingKey, unknown>>> {
  return cached(collectPublicSettings, ["settings:public"], { tags: ["settings:public"] })();
}

/** Every setting, for admin screens that hold a permission to see all of them. */
export async function collectAllSettings(): Promise<Record<SettingKey, unknown>> {
  const result: Record<SettingKey, unknown> = {} as Record<SettingKey, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    result[key] = await readSettingRaw(key);
  }
  return result;
}

export async function getAllSettings(): Promise<Record<SettingKey, unknown>> {
  return cached(collectAllSettings, ["settings:all"], { tags: ["settings"] })();
}

/**
 * Update a setting and audit the change in the same request. Callers must
 * already hold `manageSettings` (checked by lib/actions/settings.ts, never
 * here) — this function assumes the caller is authorized and only needs the
 * actor for the audit row and the `updatedById` column.
 */
export async function updateSetting<K extends SettingKey>(
  key: K,
  value: SettingValue<K>,
  actor: Pick<AuthUser, "id" | "email">
): Promise<void> {
  const schema = getSettingSchema(key);
  const validated = schema.parse(value) as SettingValue<K>;
  const before = await readSettingRaw(key);

  try {
    await db.setting.upsert({
      where: { key },
      create: { key, value: validated, updatedById: actor.id },
      update: { value: validated, updatedById: actor.id },
    });
  } catch (err) {
    log.error("Failed to update setting", { key, error: String(err) });
    throw err;
  }

  await mirrorSettingToKv(key, validated);

  await audit({
    action: "settings.updated",
    actor: { id: actor.id, email: actor.email },
    entityType: "Setting",
    entityId: key,
    before,
    after: validated,
  });

  const plan = forSettings();
  invalidate({ tags: [...new Set([`settings:${key}`, "settings", ...plan.tags])], paths: plan.paths });
}

/**
 * Mirror a setting value to KV. Only the keys the proxy reads without a
 * database (maintenance, the IP allowlist) are mirrored; every other key is
 * read from Postgres through the cached getSetting/getAllSettings.
 */
async function mirrorSettingToKv<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
  if (key !== "maintenance" && key !== "security.ipAllowlist") return;
  try {
    await kv.set(`setting:${key}`, value, { ttlSeconds: 3600 });
  } catch (err) {
    // KV failure is not fatal for the setting save; the proxy's safe default
    // applies until the mirror catches up (documented at the top of this file).
    log.warn("Failed to mirror setting to KV", { key, error: String(err) });
  }
}

/**
 * Re-mirror the KV-read settings from the database. Used by the "clear
 * cache" action to repair any drift between Postgres and KV (for example
 * after a KV outage during a save), and available for a manual resync.
 */
export async function syncSettingsToKv(): Promise<void> {
  const keysToMirror: SettingKey[] = ["maintenance", "security.ipAllowlist"];
  for (const key of keysToMirror) {
    try {
      const value = await readSettingRaw(key);
      await kv.set(`setting:${key}`, value, { ttlSeconds: 3600 });
    } catch (err) {
      log.error("Failed to sync setting to KV", { key, error: String(err) });
    }
  }
}

/**
 * KV-only read for the proxy: no database fallback, so a cache miss reads as
 * "not set" and the caller (proxy.ts) applies its own safe default.
 */
export async function getKvSetting<K extends SettingKey>(key: K): Promise<SettingValue<K> | null> {
  try {
    const value = await kv.get(`setting:${key}`);
    if (!value) return null;
    return validateSetting(key, value) as SettingValue<K>;
  } catch (err) {
    log.warn("Failed to read KV setting", { key, error: String(err) });
    return null;
  }
}

/** Invalidate every cache tag and repair the KV mirror. Backs the "clear cache" button. */
export async function clearAllCaches(): Promise<void> {
  invalidate({ tags: staticTags(), paths: [{ path: "/", type: "layout" }] });
  await syncSettingsToKv();
}
