import type { SessionState } from "./session-state";

// Reads a session's state through a short-lived cache and falls back to the
// database. Split from session-store.ts so that the three cases that matter for
// revocation (cache warm, cache cold, cache down) are unit tested. The database is
// the authority; the cache only saves reads for a few seconds
// (docs/plan/admin-cms-adr.md, section 6.3).

export interface SessionCache {
  get(sid: string): Promise<SessionState | null>;
  set(sid: string, state: SessionState): Promise<void>;
  del(...sids: string[]): Promise<void>;
}

export interface SessionReaderDeps {
  cache: SessionCache;
  /** Reads the database. Throws when it cannot answer; null when there is no such session. */
  load(sid: string): Promise<SessionState | null>;
}

export function createSessionReader({ cache, load }: SessionReaderDeps) {
  return {
    async get(sid: string): Promise<SessionState | null> {
      try {
        const cached = await cache.get(sid);
        if (cached) return cached;
      } catch {
        // Cache down: the database still answers.
      }
      const state = await load(sid);
      if (state) await cache.set(sid, state).catch(() => undefined);
      return state;
    },

    /** Called after a revocation, so the next request reads the database. */
    async invalidate(...sids: string[]): Promise<void> {
      if (sids.length === 0) return;
      await cache.del(...sids).catch(() => undefined);
    },
  };
}
