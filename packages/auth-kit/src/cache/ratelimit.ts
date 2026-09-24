import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

// Sliding window limits, generic over whatever bucket names the app defines
// (see `createRateLimit`). Upstash when a Redis client is given, otherwise an
// in-memory window (per instance, so it only protects development and
// single-instance deployments). "closed" means a limiter error denies the
// request, "open" means it allows it.

export type FailMode = "open" | "closed";

export interface LimitRule {
  windowSeconds: number;
  max: number;
  failMode: FailMode;
}

export interface LimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window frees a slot. */
  resetSeconds: number;
  /** True when the backend failed and the fail mode decided the answer. */
  degraded: boolean;
}

export interface LimitBackend {
  check(name: string, identifier: string, rule: LimitRule): Promise<LimitResult>;
}

const SWEEP_THRESHOLD = 5000;

/** Sliding-window log kept in memory. The clock is injectable for tests. */
export class MemoryLimiter implements LimitBackend {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * Drops fully-aged-out keys once the map grows large, the same pattern
   * `MemoryKv` uses, so a long-running process (an in-memory fallback with no
   * Redis configured) does not grow this map forever with keys nobody will
   * ever query again.
   */
  private sweep(windowMs: number, now: number): void {
    if (this.hits.size < SWEEP_THRESHOLD) return;
    for (const [key, times] of this.hits) {
      const recent = times.filter((time) => time > now - windowMs);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }

  async check(name: string, identifier: string, rule: LimitRule): Promise<LimitResult> {
    const key = `${name}:${identifier}`;
    const now = this.now();
    const windowMs = rule.windowSeconds * 1000;
    this.sweep(windowMs, now);
    const recent = (this.hits.get(key) ?? []).filter((time) => time > now - windowMs);

    if (recent.length >= rule.max) {
      this.hits.set(key, recent);
      return {
        ok: false,
        remaining: 0,
        resetSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)),
        degraded: false,
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return {
      ok: true,
      remaining: rule.max - recent.length,
      resetSeconds: rule.windowSeconds,
      degraded: false,
    };
  }

  /** Live keys, for tests. */
  size(): number {
    return this.hits.size;
  }
}

export class UpstashLimiter implements LimitBackend {
  private readonly instances = new Map<string, Ratelimit>();

  constructor(
    private readonly redis: Redis,
    /** Namespaces every Upstash key this limiter writes. For example `"myapp:rl:"`. */
    private readonly keyPrefix: string = "authkit:rl:"
  ) {}

  private for(name: string, rule: LimitRule): Ratelimit {
    let instance = this.instances.get(name);
    if (!instance) {
      instance = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(rule.max, `${rule.windowSeconds} s` as `${number} s`),
        prefix: `${this.keyPrefix}${name}`,
        analytics: false,
      });
      this.instances.set(name, instance);
    }
    return instance;
  }

  async check(name: string, identifier: string, rule: LimitRule): Promise<LimitResult> {
    const result = await this.for(name, rule).limit(identifier);
    return {
      ok: result.success,
      remaining: result.remaining,
      resetSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      degraded: false,
    };
  }
}

/** A hung limiter must not hang the request. */
export const LIMIT_TIMEOUT_MS = 1500;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("rate limit backend timed out")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface CreateRateLimitOptions {
  /** Upstash client, or omit/null to use the in-memory backend. */
  redis?: Redis | null;
  /** Namespaces every Upstash key. For example `"myapp:rl:"`. Ignored by the in-memory backend. */
  keyPrefix?: string;
  /** Backend override, mainly for tests. Takes precedence over `redis`. */
  backend?: LimitBackend;
  timeoutMs?: number;
}

export interface RateLimiter<TName extends string> {
  /**
   * Records one attempt and answers whether it is allowed. When the backend
   * errors or times out, the bucket's own fail mode decides.
   */
  limit(name: TName, identifier: string, options?: { backend?: LimitBackend; timeoutMs?: number }): Promise<LimitResult>;
  rules: Record<TName, LimitRule>;
}

/**
 * Builds a rate limiter over the app's own bucket catalogue. The app decides
 * every bucket name, window, ceiling and fail mode (there is no app-specific
 * default here on purpose — "login:ip" or "contact:ip" are this app's
 * policy, not a generic default a package can ship); this only supplies the
 * generic sliding-window engine and the Upstash/in-memory backend choice.
 */
export function createRateLimit<TRules extends Record<string, LimitRule>>(
  rules: TRules,
  options: CreateRateLimitOptions = {}
): RateLimiter<Extract<keyof TRules, string>> {
  let backend: LimitBackend | undefined = options.backend;
  const resolveBackend = (): LimitBackend => {
    if (!backend) backend = options.redis ? new UpstashLimiter(options.redis, options.keyPrefix) : new MemoryLimiter();
    return backend;
  };

  async function limit(
    name: Extract<keyof TRules, string>,
    identifier: string,
    callOptions: { backend?: LimitBackend; timeoutMs?: number } = {}
  ): Promise<LimitResult> {
    const rule = rules[name];
    try {
      return await withTimeout(
        (callOptions.backend ?? resolveBackend()).check(name, identifier, rule),
        callOptions.timeoutMs ?? options.timeoutMs ?? LIMIT_TIMEOUT_MS
      );
    } catch {
      return { ok: rule.failMode === "open", remaining: 0, resetSeconds: 0, degraded: true };
    }
  }

  return { limit, rules };
}
