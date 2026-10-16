import type { ProviderName } from "./types";

// A per-provider daily send limit, so a free plan's allowance (Brevo: 300 a
// day) is skipped for the next provider before the API starts refusing. The
// counter lives in a store the app supplies (Redis in production); the window
// is the UTC day. A store failure never blocks mail: the provider is tried and
// its own answer decides.

/** The two operations a counter store needs. Redis INCR + EXPIRE fit directly. */
export interface QuotaStore {
  /** Adds one to `key` and returns the new value; the key expires after `ttlSeconds`. */
  increment(key: string, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<number>;
}

export interface ProviderQuota {
  /** False when `provider` has reached its limit for today. */
  allow(provider: ProviderName): Promise<boolean>;
  /** Counts one accepted send. */
  record(provider: ProviderName): Promise<void>;
}

const DAY_SECONDS = 86_400;

export function quotaKey(provider: ProviderName, at: Date): string {
  return `email:quota:${provider}:${at.toISOString().slice(0, 10)}`;
}

export function createDailyQuota(options: {
  limits: Partial<Record<ProviderName, number>>;
  store: QuotaStore;
  now?: () => Date;
}): ProviderQuota {
  const now = options.now ?? (() => new Date());
  const limitOf = (provider: ProviderName) => options.limits[provider] ?? 0;

  return {
    async allow(provider) {
      const limit = limitOf(provider);
      if (limit <= 0) return true;
      try {
        return (await options.store.get(quotaKey(provider, now()))) < limit;
      } catch {
        return true;
      }
    },
    async record(provider) {
      if (limitOf(provider) <= 0) return;
      await options.store.increment(quotaKey(provider, now()), DAY_SECONDS + 3600).catch(() => undefined);
    },
  };
}

/** In-process store for tests and single-instance development. */
export function createMemoryQuotaStore(): QuotaStore {
  const counts = new Map<string, number>();
  return {
    async increment(key) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async get(key) {
      return counts.get(key) ?? 0;
    },
  };
}
