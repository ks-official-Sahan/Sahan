import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateSession, type SessionState } from "./session-state";
import { createSessionReader, type SessionCache } from "./session-reader";

const NOW = 1_800_000_000_000;
const live: SessionState = {
  userId: "u1",
  email: "owner@example.com",
  name: null,
  role: "DEVELOPER",
  disabled: false,
  revoked: false,
  expiresAt: NOW + 60_000,
  pwf: "0123456789abcdef",
  mustChangePassword: false,
  mfaEnabled: false,
  mfaVerified: false,
};

function fixture(options: { cacheDown?: boolean } = {}) {
  const db = new Map<string, SessionState>([["s1", live]]);
  const store = new Map<string, SessionState>();
  let dbReads = 0;
  const cache: SessionCache = {
    get: async (sid) => {
      if (options.cacheDown) throw new Error("redis down");
      return store.get(sid) ?? null;
    },
    set: async (sid, state) => {
      if (options.cacheDown) throw new Error("redis down");
      store.set(sid, state);
    },
    del: async (...sids) => {
      if (options.cacheDown) throw new Error("redis down");
      for (const sid of sids) store.delete(sid);
    },
  };
  const reader = createSessionReader({
    cache,
    load: async (sid) => {
      dbReads += 1;
      return db.get(sid) ?? null;
    },
  });
  const revoke = () => db.set("s1", { ...live, revoked: true });
  return { reader, revoke, store, reads: () => dbReads };
}

const claims = { sub: "u1", pwf: live.pwf };

test("cold cache: the database is read once, then the cache answers", async () => {
  const { reader, reads } = fixture();
  assert.equal((await reader.get("s1"))?.userId, "u1");
  assert.equal((await reader.get("s1"))?.userId, "u1");
  assert.equal(reads(), 1);
});

test("warm cache: a revocation in the database is not seen until the cache entry is dropped", async () => {
  const { reader, revoke } = fixture();
  await reader.get("s1");
  revoke();
  assert.deepEqual(evaluateSession(await reader.get("s1"), claims, NOW), { ok: true }, "stale for up to the cache TTL");
  await reader.invalidate("s1");
  assert.deepEqual(evaluateSession(await reader.get("s1"), claims, NOW), { ok: false, reason: "revoked" });
});

test("cache down: reads go to the database, so a revocation is seen at once", async () => {
  const { reader, revoke, reads } = fixture({ cacheDown: true });
  assert.deepEqual(evaluateSession(await reader.get("s1"), claims, NOW), { ok: true });
  revoke();
  assert.deepEqual(evaluateSession(await reader.get("s1"), claims, NOW), { ok: false, reason: "revoked" });
  assert.equal(reads(), 2);
  await reader.invalidate("s1");
});

test("an unknown session is not cached, and a database failure is not turned into an answer", async () => {
  const { reader, store } = fixture();
  assert.equal(await reader.get("nope"), null);
  assert.equal(store.size, 0);

  const failing = createSessionReader({
    cache: { get: async () => null, set: async () => undefined, del: async () => undefined },
    load: async () => {
      throw new Error("db down");
    },
  });
  await assert.rejects(failing.get("s1"), /db down/);
});

test("invalidate with nothing to drop does nothing", async () => {
  const { reader } = fixture();
  await reader.invalidate();
});
