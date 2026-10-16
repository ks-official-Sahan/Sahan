import "server-only";

import { randomUUID } from "node:crypto";

import { kv } from "@/lib/cache/redis";
import { runtimeSchema } from "@/lib/db/url";
import { log } from "@/lib/log";

import { type BackupConfig, backupConfigFromEnv, type BackupConfigResult } from "./config";
import { exportBackup } from "./export";
import { expiredBackups, MANIFEST_FILE } from "./format";
import { prismaBackupDb } from "./prisma-db";
import { deleteStoredBackups, listStoredBackups, objectKey, writeObject } from "./store";

// One backup run: lock, export, store the manifest, prune by retention,
// record the outcome. Called by the daily cron (app/api/cron/backup), the
// "Back up now" action (/admin/backups) and the CLI (scripts/backup.ts).

const LOCK_KEY = "backup:lock";
const STATUS_KEY = "backup:last";
/** Longer than any run can take; a crashed run frees the lock by itself. */
const LOCK_SECONDS = 15 * 60;
const STATUS_SECONDS = 90 * 24 * 60 * 60;
/** An unfinished backup older than this is a crashed run's leftovers. */
const STALE_INCOMPLETE_MS = 24 * 60 * 60 * 1000;
export const NOT_CONFIGURED = "Backups are not configured";

export type BackupTrigger = "cron" | "manual" | "cli";

export interface BackupStatus {
  ok: boolean;
  trigger: BackupTrigger;
  at: string;
  durationMs: number;
  id?: string;
  tables?: number;
  rows?: number;
  bytes?: number;
  pruned?: number;
  error?: string;
}

export function currentBackupConfig(env: Record<string, string | undefined> = process.env): BackupConfigResult {
  return backupConfigFromEnv(env, runtimeSchema(env));
}

export async function lastBackupStatus(): Promise<BackupStatus | null> {
  return kv.get<BackupStatus>(STATUS_KEY).catch(() => null);
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function runBackup(trigger: BackupTrigger, options: { timeoutMs?: number } = {}): Promise<BackupStatus> {
  const started = Date.now();
  const at = new Date(started).toISOString();
  const resolved = currentBackupConfig();
  if (!resolved.ok) return { ok: false, trigger, at, durationMs: 0, error: `${NOT_CONFIGURED}: ${resolved.problems.join("; ")}` };
  const { config } = resolved;

  const token = randomUUID();
  // Redis down: run anyway. A rare overlap costs a duplicate backup, never data.
  const locked = await kv.set(LOCK_KEY, token, { nx: true, ttlSeconds: LOCK_SECONDS }).catch(() => true);
  if (!locked) return { ok: false, trigger, at, durationMs: 0, error: "Another backup is already running." };

  let status: BackupStatus;
  try {
    const manifest = await exportBackup(prismaBackupDb, config, {
      timeoutMs: options.timeoutMs,
      put: (backupId, name, body, contentType) => writeObject(config.account, objectKey(config.prefix, backupId, name), body, contentType),
    });
    await writeObject(config.account, objectKey(config.prefix, manifest.id, MANIFEST_FILE), Buffer.from(JSON.stringify(manifest, null, 2)), "application/json");
    const pruned = await prune(config).catch((error) => {
      log.warn("backup prune failed", { error: message(error) });
      return 0;
    });
    status = {
      ok: true,
      trigger,
      at,
      durationMs: 0,
      id: manifest.id,
      tables: manifest.tables.length,
      rows: manifest.tables.reduce((sum, table) => sum + table.rows, 0),
      bytes: manifest.tables.reduce((sum, table) => sum + table.bytes, 0),
      pruned,
    };
  } catch (error) {
    log.error("backup failed", { trigger, error: message(error) });
    status = { ok: false, trigger, at, durationMs: 0, error: message(error) };
  } finally {
    const held = await kv.get<string>(LOCK_KEY).catch(() => null);
    if (held === token) await kv.del(LOCK_KEY).catch(() => 0);
  }
  status.durationMs = Date.now() - started;
  await kv.set(STATUS_KEY, status, { ttlSeconds: STATUS_SECONDS }).catch(() => false);
  return status;
}

/** Deletes backups past retention and crashed runs' leftovers. Returns how many backups went. */
async function prune(config: BackupConfig): Promise<number> {
  const stored = await listStoredBackups(config.account, config.prefix);
  const expired = new Set(expiredBackups(stored.filter((backup) => backup.complete).map((backup) => backup.id), config.retention));
  const cutoff = Date.now() - STALE_INCOMPLETE_MS;
  const doomed = stored.filter((backup) => expired.has(backup.id) || (!backup.complete && Date.parse(backup.createdAt) < cutoff));
  if (doomed.length > 0) await deleteStoredBackups(config.account, doomed);
  return doomed.length;
}
