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
