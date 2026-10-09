import "server-only";

import { unstable_cache } from "next/cache";

import { kv } from "./redis";

// The only file that wraps Next's data cache. `unstable_cache` is documented as
// replaced by `use cache` in Next 16 (docs/plan/admin-cms-adr.md, D3, R1), so a
// later move to Cache Components changes this file and nothing else.
//
// A Redis (Upstash, or in-memory when unconfigured) read-through sits in
// front of `unstable_cache`. `unstable_cache` alone re-runs `fn` on every
// request in dev, and on every cold serverless start until its own cache
// warms, which is what made the first request after a restart slow enough to
// show the route's loading.tsx for longer than it should. Redis persists
// across both, so a warm key answers in one round trip instead of hitting
// the database. It is capped to a short TTL and purged by tag on
// `invalidate()` (see below), so it never outlives the data it caches by
// more than that cap even if the purge below is ever missed.

/** Safety net: ISR revalidates at least this often even without a publish. */
export const DEFAULT_REVALIDATE_SECONDS = 3600;

/** Upper bound on how long the Redis read-through layer may serve a value. */
const REDIS_CACHE_CAP_SECONDS = 300;

export function cacheKey(...parts: string[]): string[] {
  return ["sahan", ...parts];
}

function redisDataKey(keyParts: string[]): string {
  return cacheKey(...keyParts).join(":");
}

function redisTagVersionKey(tag: string): string {
  return `tagversion:${tag}`;
}

async function redisDataKeyFor(keyParts: string[], tags: string[]): Promise<string> {
  const versions = await Promise.all(tags.map((tag) => kv.get<number>(redisTagVersionKey(tag)).catch(() => null)));
  return redisDataKey([...keyParts, "tagversions", ...versions.map((version) => String(version ?? 0))]);
}

/**
 * Advances the Redis cache generation for `tag`. Old values expire naturally
 * under the short data TTL; no shared read/modify/write index can grow without
 * bound or lose concurrent cache-key registrations.
 */
export async function purgeRedisTag(tag: string): Promise<void> {
  await kv.incr(redisTagVersionKey(tag), REDIS_CACHE_CAP_SECONDS * 2);
}

/**
 * Caches an async read under `keyParts`, tagged for on-demand invalidation.
 * Never put a code-default fallback inside `fn`: throw instead and use
 * loadOrNull() outside, so a fallback is never cached.
 */
export function cached<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  options: { tags: string[]; revalidate?: number | false }
): (...args: Args) => Promise<Result> {
  const revalidate = options.revalidate ?? DEFAULT_REVALIDATE_SECONDS;
  const redisTtl = revalidate === false ? undefined : Math.min(revalidate, REDIS_CACHE_CAP_SECONDS);

  return unstable_cache(
    async (...args: Args) => {
      if (redisTtl) {
        const dataKey = await redisDataKeyFor(keyParts, options.tags);
        const hit = await kv.get<Result>(dataKey).catch(() => null);
        if (hit !== null) return hit;

        const result = await fn(...args);
        await kv.set(dataKey, result, { ttlSeconds: redisTtl }).catch(() => {});
        return result;
      }

      return fn(...args);
    },
    cacheKey(...keyParts),
    { tags: options.tags, revalidate }
  );
}
