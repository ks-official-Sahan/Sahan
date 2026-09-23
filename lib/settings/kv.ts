import { kv } from "@/lib/cache/redis";

import { validateSetting, type SettingKey, type SettingValueOf } from "./schema";

// KV mirror of the settings the proxy needs without a database (maintenance,
// the IP allowlist). Kept apart from ./service so proxy.ts never bundles
// Prisma, the audit writer or the auth layer. Reads are memoized per process
// for MEMO_TTL_MS, with in-flight de-duplication, so a burst of requests costs
// one KV round trip instead of one each; a save on this instance forgets the
// memo at once, other instances converge within MEMO_TTL_MS.

export const KV_MIRRORED_SETTINGS = ["maintenance", "security.ipAllowlist"] as const satisfies readonly SettingKey[];
export type KvMirroredSetting = (typeof KV_MIRRORED_SETTINGS)[number];

const MEMO_TTL_MS = 5_000;

type Entry = { at: number; value: Promise<unknown> };

// On globalThis so the proxy bundle and the app bundle share one memo in dev
// and on a single Node server.
const store = globalThis as unknown as { sahanKvSettingMemo?: Map<string, Entry> };
const memo = (store.sahanKvSettingMemo ??= new Map<string, Entry>());

export const kvSettingKey = (key: SettingKey) => `setting:${key}`;

async function load<K extends KvMirroredSetting>(key: K): Promise<SettingValueOf<K> | null> {
  try {
    const raw = await kv.get(kvSettingKey(key));
    if (raw === null || raw === undefined) return null;
    return validateSetting(key, raw);
  } catch {
    // A KV outage or a corrupt value reads as "not set"; the caller applies its safe default.
    return null;
  }
}

/** KV-only read with no database fallback: null means "not set", and the caller decides the default. */
export function readKvSetting<K extends KvMirroredSetting>(key: K, now = Date.now()): Promise<SettingValueOf<K> | null> {
  const hit = memo.get(key);
  if (hit && now - hit.at < MEMO_TTL_MS) return hit.value as Promise<SettingValueOf<K> | null>;
  const value = load(key);
  memo.set(key, { at: now, value });
  return value;
}

/** Writes the mirror with no expiry: an expired key would silently turn maintenance or the allowlist off. */
export async function writeKvSetting<K extends KvMirroredSetting>(key: K, value: SettingValueOf<K>): Promise<void> {
  memo.delete(key);
  await kv.set(kvSettingKey(key), value);
}

export function isKvMirrored(key: SettingKey): key is KvMirroredSetting {
  return (KV_MIRRORED_SETTINGS as readonly string[]).includes(key);
}
