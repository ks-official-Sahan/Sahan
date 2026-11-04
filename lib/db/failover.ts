// Which databases may serve a read, in order, and when to skip one.
//
// Writes only ever go to DATABASE_URL. Reads go to the first healthy entry of
// readSources(): the primary's read replica, then the primary, then (only
// with DB_FAILOVER=read-only) the backup's replica or the backup itself. A
// source that fails with a connection-level error is skipped for a cooldown.
// Nothing here copies data between databases: a backup that serves reads must
// already be kept in sync from the primary.
// Pure, so it is unit-tested; the Prisma wiring lives in prisma.ts.

import { isDbUnavailable } from "@/lib/data/prisma/errors";

import { sameDatabaseEndpoint, sourceUrl, type DbSource } from "./url";

type Env = Record<string, string | undefined>;

/** True when `source` is set and is not the same database as one already in `list`. */
function distinct(env: Env, source: DbSource, list: DbSource[]): boolean {
  const url = sourceUrl(env, source);
  if (!url) return false;
  return list.every((other) => !sameDatabaseEndpoint(url, sourceUrl(env, other)!));
}

/** True when reads may fall back to the backup database while the primary is down. */
export function readFailoverEnabled(env: Env = process.env): boolean {
  return env.DB_FAILOVER?.trim().toLowerCase() === "read-only" && Boolean(env.DATABASE_URL) && distinct(env, "backup", ["primary"]);
}

/**
 * The databases that may answer a read, in order. A URL that points at a
 * database already in the list (a "replica" that is the primary itself) is
 * dropped, so it never doubles the connections or hides an outage.
 */
export function readSources(env: Env = process.env): DbSource[] {
  if (!env.DATABASE_URL) return [];
  const list: DbSource[] = ["primary"];
  if (distinct(env, "replica", list)) list.unshift("replica");
  if (readFailoverEnabled(env)) {
    const backup: DbSource = distinct(env, "backupReplica", [...list, "backup"]) ? "backupReplica" : "backup";
    list.push(backup);
  }
  return list;
}

/** A failure that says the database could not answer, not that the query was wrong. */
export function isFailoverError(error: unknown): boolean {
  return isDbUnavailable(error);
}

export interface BreakerOptions {
  /** How long a failed source is skipped. Default 30_000. */
  cooldownMs?: number;
  now?: () => number;
}

/** Skips sources that failed recently. One instance per process. */
export class SourceBreaker {
  private readonly openUntil = new Map<DbSource, number>();
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(options: BreakerOptions = {}) {
    this.cooldownMs = options.cooldownMs ?? 30_000;
    // A monotonic clock: the request path may run inside a prerender, where
    // Cache Components reject Date.now().
    this.now = options.now ?? (() => performance.now());
  }

  isOpen(source: DbSource): boolean {
    return this.now() < (this.openUntil.get(source) ?? 0);
  }

  /** Records a failure; returns true when the source was healthy until now. */
  trip(source: DbSource): boolean {
    const wasOpen = this.isOpen(source);
    this.openUntil.set(source, this.now() + this.cooldownMs);
    return !wasOpen;
  }

  reset(source: DbSource): void {
    this.openUntil.delete(source);
  }

  /** Sources to try in order: healthy ones first, skipped ones last as a final resort. */
  order(sources: DbSource[]): DbSource[] {
    const healthy = sources.filter((source) => !this.isOpen(source));
    return healthy.length > 0 ? healthy : sources;
  }
}

/**
 * Runs `operation` on the first source in order that answers. A
 * connection-level failure trips that source and moves to the next; any other
 * error (a bad query, a missing row) is thrown at once.
 */
export async function runOnSources<T>(
  sources: DbSource[],
  breaker: SourceBreaker,
  operation: (source: DbSource) => Promise<T>,
  onTrip?: (source: DbSource, error: unknown) => void
): Promise<T> {
  const order = breaker.order(sources);
  let last: unknown;
  for (const source of order) {
    try {
      const result = await operation(source);
      breaker.reset(source);
      return result;
    } catch (error) {
      if (!isFailoverError(error)) throw error;
      if (breaker.trip(source)) onTrip?.(source, error);
      last = error;
    }
  }
  throw last;
}
