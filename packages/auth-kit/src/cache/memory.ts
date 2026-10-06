// Key-value interface plus the in-memory implementation used in development,
// tests, and as the fallback when Upstash is not configured. In-memory state is
// per server instance, so it cannot enforce anything across serverless
// instances (docs/plan/admin-cms-adr.md, section 6.7).

export interface KvSetOptions {
  ttlSeconds?: number;
  /** Only set when the key does not exist yet. */
  nx?: boolean;
}

export interface Kv {
  get<T = unknown>(key: string): Promise<T | null>;
  /** Returns false only when `nx` blocked the write. */
  set(key: string, value: unknown, options?: KvSetOptions): Promise<boolean>;
  del(...keys: string[]): Promise<number>;
  /** Adds one. The TTL applies when the counter is created. */
  incr(key: string, ttlSeconds?: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
}

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

const SWEEP_THRESHOLD = 5000;

export class MemoryKv implements Kv {
  private readonly store = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  private live(key: string): Entry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private sweep(): void {
    if (this.store.size < SWEEP_THRESHOLD) return;
    for (const key of [...this.store.keys()]) this.live(key);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.live(key);
    return entry ? (entry.value as T) : null;
  }

  async set(key: string, value: unknown, options: KvSetOptions = {}): Promise<boolean> {
    if (options.nx && this.live(key)) return false;
    this.sweep();
    this.store.set(key, {
      value,
      expiresAt: options.ttlSeconds ? this.now() + options.ttlSeconds * 1000 : null,
    });
    return true;
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.live(key)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const entry = this.live(key);
    const next = (typeof entry?.value === "number" ? entry.value : 0) + 1;
    this.sweep();
    this.store.set(key, {
      value: next,
      expiresAt: entry ? entry.expiresAt : ttlSeconds ? this.now() + ttlSeconds * 1000 : null,
    });
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const entry = this.live(key);
    if (!entry) return false;
    entry.expiresAt = this.now() + ttlSeconds * 1000;
    return true;
  }

  /** Live keys, for tests. */
  size(): number {
    let live = 0;
    for (const key of [...this.store.keys()]) if (this.live(key)) live += 1;
    return live;
  }
}

/** Rejects when `promise` has not settled within `ms`, so a hung backend never hangs the request. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label = "backend"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface FailoverKvOptions {
  /** A primary call slower than this counts as a failure. Default 1500. */
  timeoutMs?: number;
  /** How long to stay on the fallback after a failure before trying the primary again. Default 30000. */
  cooldownMs?: number;
  now?: () => number;
  /** Called once per failover, with the error that caused it. */
  onFailover?: (error: unknown) => void;
}

/**
 * Uses `primary` (Redis) while it answers and `fallback` (memory) while it
 * does not: an error or timeout switches to the fallback for `cooldownMs`,
 * then the primary is tried again. The request in flight retries on the
 * fallback, so a Redis outage slows nothing and fails nothing. While
 * degraded, counters are per instance, as without Redis.
 */
export class FailoverKv implements Kv {
  private downUntil = 0;
  private readonly timeoutMs: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(
    private readonly primary: Kv,
    private readonly fallback: Kv = new MemoryKv(),
    private readonly options: FailoverKvOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? 1500;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  /** True while the fallback is in use. */
  get degraded(): boolean {
    return this.now() < this.downUntil;
  }

  private async run<T>(call: (kv: Kv) => Promise<T>): Promise<T> {
    if (this.degraded) return call(this.fallback);
    try {
      return await withTimeout(call(this.primary), this.timeoutMs, "kv");
    } catch (error) {
      this.downUntil = this.now() + this.cooldownMs;
      this.options.onFailover?.(error);
      return call(this.fallback);
    }
  }

  get<T = unknown>(key: string): Promise<T | null> {
    return this.run((kv) => kv.get<T>(key));
  }
  set(key: string, value: unknown, options?: KvSetOptions): Promise<boolean> {
    return this.run((kv) => kv.set(key, value, options));
  }
  del(...keys: string[]): Promise<number> {
    return this.run((kv) => kv.del(...keys));
  }
  incr(key: string, ttlSeconds?: number): Promise<number> {
    return this.run((kv) => kv.incr(key, ttlSeconds));
  }
  expire(key: string, ttlSeconds: number): Promise<boolean> {
    return this.run((kv) => kv.expire(key, ttlSeconds));
  }
}
