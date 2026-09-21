import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

import { getRedis } from "./redis";

// Sliding window limits. Upstash when configured, otherwise an in-memory
// window (per instance, so it only protects development and single-instance
// deployments). "closed" means a limiter error denies the request, "open"
// means it allows it. Design record: docs/plan/admin-cms-adr.md, section 6.7.

export type FailMode = "open" | "closed";

export interface LimitRule {
  windowSeconds: number;
  max: number;
  failMode: FailMode;
}

export const LIMITS = {
  "unlock:ip": { windowSeconds: 600, max: 10, failMode: "closed" },
  "login:ip": { windowSeconds: 600, max: 10, failMode: "closed" },
  "login:acct": { windowSeconds: 900, max: 5, failMode: "closed" },
  "mfa:send:user": { windowSeconds: 600, max: 3, failMode: "closed" },
  "invite:actor": { windowSeconds: 3600, max: 20, failMode: "closed" },
  "upload:sign:user": { windowSeconds: 600, max: 30, failMode: "closed" },
  "ai:admin:user": { windowSeconds: 3600, max: 30, failMode: "closed" },
  "contact:ip": { windowSeconds: 3600, max: 5, failMode: "open" },
  "contact:global": { windowSeconds: 3600, max: 100, failMode: "open" },
  "chat:ip": { windowSeconds: 600, max: 20, failMode: "closed" },
  "chat:session": { windowSeconds: 60, max: 6, failMode: "closed" },
} as const satisfies Record<string, LimitRule>;

export type LimitName = keyof typeof LIMITS;

export interface LimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window frees a slot. */
  resetSeconds: number;
  /** True when the backend failed and the fail mode decided the answer. */
  degraded: boolean;
}

export interface LimitBackend {
  check(name: LimitName, identifier: string, rule: LimitRule): Promise<LimitResult>;
}

/** Sliding-window log kept in memory. The clock is injectable for tests. */
export class MemoryLimiter implements LimitBackend {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  async check(name: LimitName, identifier: string, rule: LimitRule): Promise<LimitResult> {
    const key = `${name}:${identifier}`;
    const now = this.now();
    const windowMs = rule.windowSeconds * 1000;
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
}

class UpstashLimiter implements LimitBackend {
  private readonly instances = new Map<LimitName, Ratelimit>();

  constructor(private readonly redis: Redis) {}

  private for(name: LimitName, rule: LimitRule): Ratelimit {
    let instance = this.instances.get(name);
    if (!instance) {
      instance = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(rule.max, `${rule.windowSeconds} s` as `${number} s`),
        prefix: `sahan:rl:${name}`,
        analytics: false,
      });
      this.instances.set(name, instance);
    }
    return instance;
  }

  async check(name: LimitName, identifier: string, rule: LimitRule): Promise<LimitResult> {
    const result = await this.for(name, rule).limit(identifier);
    return {
      ok: result.success,
      remaining: result.remaining,
      resetSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      degraded: false,
    };
  }
}

let defaultBackend: LimitBackend | undefined;

function backend(): LimitBackend {
  if (!defaultBackend) {
    const redis = getRedis();
    defaultBackend = redis ? new UpstashLimiter(redis) : new MemoryLimiter();
  }
  return defaultBackend;
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

/**
 * Records one attempt and answers whether it is allowed. When the backend
 * errors or times out, the rule's fail mode decides.
 */
export async function limit(
  name: LimitName,
  identifier: string,
  options: { backend?: LimitBackend; timeoutMs?: number } = {}
): Promise<LimitResult> {
  const rule: LimitRule = LIMITS[name];
  try {
    return await withTimeout(
      (options.backend ?? backend()).check(name, identifier, rule),
      options.timeoutMs ?? LIMIT_TIMEOUT_MS
    );
  } catch {
    return { ok: rule.failMode === "open", remaining: 0, resetSeconds: 0, degraded: true };
  }
}
