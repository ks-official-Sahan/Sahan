// Optional Redis cache in front of the Property Finder API. Pass a key-value
// store (any Upstash-compatible client through `redisKv`) and reads are served
// from it; pass null and every read goes straight to the API, so an app
// without Redis configured still works, only slower. Never throws on a cache
// failure: a broken cache degrades to the uncached path, never to an error.

/** The few calls the cache needs: Upstash Redis and most clients fit. */
export interface CacheKv {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  /** SET NX with expiry: true when this caller took the lock. */
  tryLock(key: string, ttlSeconds: number): Promise<boolean>;
}

/** Structural Upstash Redis shape, so the package needs no Redis dependency. */
export interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number; nx?: boolean }): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
}

/**
 * A CacheKv over an Upstash-style client, or null when there is no client:
 * the env guard. `prefix` keeps one Redis shared between apps apart.
 */
export function redisKv(redis: RedisLike | null | undefined, prefix = ""): CacheKv | null {
  if (!redis) return null;
  return {
    get: (key) => redis.get(prefix + key),
    set: (key, value, ttlSeconds) => redis.set(prefix + key, value, { ex: ttlSeconds }),
    del: (key) => redis.del(prefix + key),
    tryLock: async (key, ttlSeconds) => (await redis.set(prefix + key, "1", { ex: ttlSeconds, nx: true })) === "OK",
  };
}

export const LISTINGS_KEY = "pf-listings:all";
export const listingKey = (id: string) => `pf-listing:${id.toUpperCase()}`;

export interface PropertyFinderCacheOptions<T> {
  /** null turns caching off: every read calls the loaders directly. */
  kv: CacheKv | null;
  /** Loads every listing from the API (already transformed for the app). */
  loadAll: () => Promise<T[]>;
  /** Loads one listing; null when Property Finder has no such listing. */
  loadOne: (id: string) => Promise<T | null>;
  /** Seconds the full list is served from cache. Default 600. */
  listTtlSeconds?: number;
  /** Seconds one listing is served from cache. Default 3600. */
  itemTtlSeconds?: number;
  log?: { warn(message: string, detail?: unknown): void };
}

export interface PropertyFinderCache<T> {
  readonly enabled: boolean;
  /** Every listing: cached copy, else the API (cached on success), else []. */
  allListings(): Promise<T[]>;
  /** One listing by Property Finder id, cached the same way. */
  listing(id: string): Promise<T | null>;
  /** Drops the full list and, with an id, that listing. */
  invalidate(id?: string): Promise<void>;
}

export function createPropertyFinderCache<T>(options: PropertyFinderCacheOptions<T>): PropertyFinderCache<T> {
  const { kv, log } = options;
  const listTtl = options.listTtlSeconds ?? 600;
  const itemTtl = options.itemTtlSeconds ?? 3600;

  async function read<V>(key: string): Promise<V | null> {
    if (!kv) return null;
    try {
      return await kv.get<V>(key);
    } catch (error) {
      log?.warn(`[PF cache] read ${key} failed`, error);
      return null;
    }
  }

  async function write(key: string, value: unknown, ttl: number): Promise<void> {
    if (!kv) return;
    try {
      await kv.set(key, value, ttl);
    } catch (error) {
      log?.warn(`[PF cache] write ${key} failed`, error);
    }
  }

  return {
    enabled: kv !== null,
    async allListings() {
      const cached = await read<T[]>(LISTINGS_KEY);
      if (cached) return cached;
      try {
        const fresh = await options.loadAll();
        await write(LISTINGS_KEY, fresh, listTtl);
        return fresh;
      } catch (error) {
        log?.warn("[PF cache] loading listings failed", error);
        return [];
      }
    },
    async listing(id) {
      const key = listingKey(id);
      const cached = await read<T>(key);
      if (cached) return cached;
      const fresh = await options.loadOne(id);
      if (fresh) await write(key, fresh, itemTtl);
      return fresh;
    },
    async invalidate(id) {
      if (!kv) return;
      try {
        await Promise.all([kv.del(LISTINGS_KEY), id ? kv.del(listingKey(id)) : null]);
      } catch (error) {
        log?.warn("[PF cache] invalidate failed", error);
      }
    },
  };
}

interface Stamped<V> {
  value: V;
  savedAt: number;
}

export interface StaleWhileRevalidateOptions {
  /** Seconds a cached value counts as fresh; older ones are served while one caller refreshes. */
  freshSeconds: number;
  /** Seconds a value is kept at all. */
  ttlSeconds: number;
  /** Seconds the refresh lock is held, so one caller refreshes at a time. Default 120. */
  lockSeconds?: number;
  /** Runs the background refresh (e.g. Next's after()). Default: fire and forget. */
  background?: (task: () => Promise<void>) => void;
  now?: () => number;
  log?: { warn(message: string, detail?: unknown): void };
}

/**
 * Stale-while-revalidate for slow API reads (the leads list): a fresh value
 * returns at once; a stale one returns at once too while the caller that wins
 * the lock reloads it in the background; with nothing cached (or no cache)
 * the loader runs.
 */
export async function staleWhileRevalidate<V>(
  kv: CacheKv | null,
  key: string,
  load: () => Promise<V>,
  options: StaleWhileRevalidateOptions
): Promise<V> {
  if (!kv) return load();
  const now = options.now ?? Date.now;
  const store = async (value: V) => {
    try {
      await kv.set(key, { value, savedAt: now() } satisfies Stamped<V>, options.ttlSeconds);
    } catch (error) {
      options.log?.warn(`[PF cache] write ${key} failed`, error);
    }
  };

  const cached = await kv.get<Stamped<V>>(key).catch(() => null);
  if (cached && now() - cached.savedAt < options.freshSeconds * 1000) return cached.value;

  if (cached) {
    const refresh = async () => {
      const locked = await kv.tryLock(`${key}:lock`, options.lockSeconds ?? 120).catch(() => false);
      if (!locked) return;
      try {
        await store(await load());
      } catch (error) {
        options.log?.warn(`[PF cache] refresh ${key} failed`, error);
      }
    };
    (options.background ?? ((task) => void task()))(refresh);
    return cached.value;
  }

  const value = await load();
  await store(value);
  return value;
}
