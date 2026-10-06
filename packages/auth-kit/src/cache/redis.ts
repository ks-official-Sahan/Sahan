import { Redis } from "@upstash/redis";

import { FailoverKv, MemoryKv, type Kv, type KvSetOptions } from "./memory";

// Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are
// set and valid and REDIS_ENABLED is not off, otherwise an in-memory store.
// A configured Redis that errors or times out falls back to memory for a
// while (FailoverKv), so an outage never fails a request.
// Redis is never the source of truth for a security decision: it caches and
// limits. Every key is prefixed so the
// instance can be shared with other apps or subsystems.
//
// This is a generic, ready-to-use default. Most apps already have their own
// KV singleton (e.g. wired to the same Redis instance other app code shares)
// and should pass a `Kv` they own into `createSessionStore`/`createMfa`/etc.
// instead of this one — see the README's "Prisma adapter" step. This module
// exists for apps that do not.

type Env = Record<string, string | undefined>;

export interface RedisConfig {
  url: string;
  token: string;
}

const OFF = new Set(["0", "false", "no", "off"]);

/**
 * The Upstash settings, or null when Redis must not be used: REDIS_ENABLED is
 * off, a variable is missing, or the URL is not an https URL. An unset
 * REDIS_ENABLED means "use Redis when it is configured".
 */
export function redisConfigFromEnv(env: Env = process.env): RedisConfig | null {
  if (OFF.has((env.REDIS_ENABLED ?? "").trim().toLowerCase())) return null;
  const url = env.UPSTASH_REDIS_REST_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { url, token };
}

export function redisConfigured(env: Env = process.env): boolean {
  return redisConfigFromEnv(env) !== null;
}

export class RedisKv implements Kv {
  constructor(
    private readonly redis: Redis,
    /** Namespaces every key this client reads and writes. For example `"myapp:"`. */
    private readonly prefix: string = "authkit:"
  ) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    return (await this.redis.get<T>(this.prefix + key)) ?? null;
  }

  async set(key: string, value: unknown, options: KvSetOptions = {}): Promise<boolean> {
    const settings = {
      ...(options.ttlSeconds ? { ex: options.ttlSeconds } : {}),
      ...(options.nx ? { nx: true as const } : {}),
    };
    // With `nx` Redis answers null when the key already existed.
    const result = await this.redis.set(this.prefix + key, value as never, settings as never);
    return result !== null;
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.redis.del(...keys.map((key) => this.prefix + key));
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const prefixed = this.prefix + key;
    if (!ttlSeconds) return this.redis.incr(prefixed);
    // One transaction: a failure between the two commands must not leave a
    // counter without an expiry, which for a failure counter means a permanent
    // lock. NX sets the TTL only when the key has none, that is on creation.
    const [next] = await this.redis.multi().incr(prefixed).expire(prefixed, ttlSeconds, "NX").exec<[number, number]>();
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.redis.expire(this.prefix + key, ttlSeconds)) === 1;
  }
}

const globalForKv = globalThis as unknown as {
  authKitRedis?: Redis | null;
  authKitKv?: Kv;
  authKitFailover?: FailoverKv | null;
};

/** The Upstash client, or null when Redis is not configured. Memoized for the process lifetime: an env change needs a restart to take effect, same as any other env-derived singleton. */
export function getRedis(): Redis | null {
  if (globalForKv.authKitRedis === undefined) {
    const config = redisConfigFromEnv();
    globalForKv.authKitRedis = config ? new Redis(config) : null;
  }
  return globalForKv.authKitRedis;
}

export function getKv(prefix?: string): Kv {
  if (!globalForKv.authKitKv) {
    const redis = getRedis();
    globalForKv.authKitFailover = redis ? new FailoverKv(new RedisKv(redis, prefix)) : null;
    globalForKv.authKitKv = globalForKv.authKitFailover ?? new MemoryKv();
  }
  return globalForKv.authKitKv;
}

/** Which backend is active, for an integration health screen. "upstash-degraded": Redis is configured but failing, so memory serves for now. */
export function kvBackend(): "upstash" | "upstash-degraded" | "memory" {
  if (!getRedis()) return "memory";
  getKv();
  return globalForKv.authKitFailover?.degraded ? "upstash-degraded" : "upstash";
}

/** Lazy handle using the default prefix: importing it never connects. Call `getKv(prefix)` directly for a namespaced client instead. */
export const kv: Kv = {
  get: <T = unknown>(key: string) => getKv().get<T>(key),
  set: (key, value, options) => getKv().set(key, value, options),
  del: (...keys) => getKv().del(...keys),
  incr: (key, ttlSeconds) => getKv().incr(key, ttlSeconds),
  expire: (key, ttlSeconds) => getKv().expire(key, ttlSeconds),
};
