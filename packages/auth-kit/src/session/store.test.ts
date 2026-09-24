import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryKv } from "../cache/memory";
import { FakeAdapter } from "../test-support/fake-adapter";
import { createSessionStore } from "./store";

const AUTH_SECRET = "test-auth-secret-0123456789-abcdefghijklmnop";

function harness() {
  const adapter = new FakeAdapter();
  const kv = new MemoryKv();
  const user = adapter.addUser({ email: "owner@example.com", passwordHash: "hash-a", role: "DEVELOPER", name: "Owner" });
  const store = createSessionStore({ adapter, kv, authSecret: AUTH_SECRET });
  return { adapter, kv, user, store };
}

test("createSession writes a row and getSessionState reads it back through the cache", async () => {
  const { store, user } = harness();
  const session = await store.createSession({ userId: user.id, ip: "203.0.113.1", userAgent: "UA/1" });
  assert.ok(session.id);

  const state = await store.getSessionState(session.id);
  assert.equal(state?.userId, user.id);
  assert.equal(state?.email, user.email);
  assert.equal(state?.role, "DEVELOPER");
  assert.equal(state?.revoked, false);
});

test("isKnownDevice is false until a session from the same fingerprint exists", async () => {
  const { store, user } = harness();
  assert.equal(await store.isKnownDevice(user.id, "203.0.113.1", "Mozilla/5.0"), false);
  await store.createSession({ userId: user.id, ip: "203.0.113.1", userAgent: "Mozilla/5.0" });
  assert.equal(await store.isKnownDevice(user.id, "203.0.113.1", "Mozilla/5.0"), true);
  assert.equal(await store.isKnownDevice(user.id, "198.51.100.1", "Mozilla/5.0"), false, "a different IP is a different device");
});

test("revokeSession invalidates the cached state so the next read sees it revoked", async () => {
  const { store, user } = harness();
  const session = await store.createSession({ userId: user.id, ip: null, userAgent: null });
  await store.getSessionState(session.id); // warm the cache
  assert.equal(await store.revokeSession(session.id, { userId: null, reason: "test" }), true);
  const state = await store.getSessionState(session.id);
  assert.equal(state?.revoked, true);
  assert.equal(await store.revokeSession(session.id, { userId: null, reason: "test" }), false, "revoking twice reports nothing changed");
});

test("revokeUserSessions ends every active session but the one excluded", async () => {
  const { store, user } = harness();
  const a = await store.createSession({ userId: user.id, ip: null, userAgent: null });
  const b = await store.createSession({ userId: user.id, ip: null, userAgent: null });
  const c = await store.createSession({ userId: user.id, ip: null, userAgent: null });

  const ended = await store.revokeUserSessions(user.id, { userId: user.id, reason: "password-change" }, { exceptSid: b.id });
  assert.deepEqual(ended.sort(), [a.id, c.id].sort());
  assert.equal((await store.getSessionState(a.id))?.revoked, true);
  assert.equal((await store.getSessionState(b.id))?.revoked, false);
  assert.equal((await store.getSessionState(c.id))?.revoked, true);
});

test("forceLogoutAll ends every session of every user except the one excluded", async () => {
  const { adapter, store, user } = harness();
  const other = adapter.addUser({ email: "other@example.com", passwordHash: "hash-b", role: "EDITOR" });
  const mine = await store.createSession({ userId: user.id, ip: null, userAgent: null });
  const theirs = await store.createSession({ userId: other.id, ip: null, userAgent: null });

  const result = await store.forceLogoutAll({ userId: user.id, reason: "incident" }, { exceptUserId: user.id });
  assert.equal(result.sessions, 1);
  assert.equal(result.users, 1);
  assert.deepEqual(result.userIds, [other.id]);
  assert.equal((await store.getSessionState(mine.id))?.revoked, false);
  assert.equal((await store.getSessionState(theirs.id))?.revoked, true);
});

test("invalidateUserSessionState drops the cache for every active session of a user", async () => {
  const { adapter, store, user } = harness();
  const a = await store.createSession({ userId: user.id, ip: null, userAgent: null });
  await store.getSessionState(a.id); // warm the cache
  // Mutate the database directly (bypassing the store) to simulate a role change made elsewhere.
  const row = adapter.getUser(user.id);
  assert.ok(row);
  row.role = "MANAGER";
  // Stale cache still reports the old role until invalidated.
  assert.equal((await store.getSessionState(a.id))?.role, "DEVELOPER");
  await store.invalidateUserSessionState(user.id);
  assert.equal((await store.getSessionState(a.id))?.role, "MANAGER");
});

test("touchSession updates lastSeenAt at most once per gate window", async () => {
  const { adapter, store, user } = harness();
  const session = await store.createSession({ userId: user.id, ip: null, userAgent: null });
  const before = adapter.getSession(session.id)?.lastSeenAt.getTime();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await store.touchSession(session.id);
  const after = adapter.getSession(session.id)?.lastSeenAt.getTime();
  assert.ok(after !== undefined && before !== undefined && after >= before);
  const afterFirst = adapter.getSession(session.id)?.lastSeenAt.getTime();
  await store.touchSession(session.id); // gated: no second write within the window
  assert.equal(adapter.getSession(session.id)?.lastSeenAt.getTime(), afterFirst);
});

test("getKnownIps de-duplicates by IP, most recently seen first", async () => {
  const { store, user } = harness();
  await store.createSession({ userId: user.id, ip: "203.0.113.1", userAgent: null });
  await new Promise((resolve) => setTimeout(resolve, 2));
  await store.createSession({ userId: user.id, ip: "198.51.100.1", userAgent: null });
  await new Promise((resolve) => setTimeout(resolve, 2));
  await store.createSession({ userId: user.id, ip: "203.0.113.1", userAgent: null }); // seen again, more recently

  const ips = await store.getKnownIps(10);
  assert.deepEqual(
    ips.map((entry) => entry.ip),
    ["203.0.113.1", "198.51.100.1"]
  );
});

test("listSessions defaults to active sessions only, newest activity first", async () => {
  const { store, user } = harness();
  const a = await store.createSession({ userId: user.id, ip: null, userAgent: null });
  const b = await store.createSession({ userId: user.id, ip: null, userAgent: null });
  await store.revokeSession(a.id, { userId: null, reason: "test" });

  const active = await store.listSessions({ userId: user.id });
  assert.deepEqual(
    active.map((s) => s.id),
    [b.id]
  );

  const all = await store.listSessions({ userId: user.id, includeEnded: true });
  assert.equal(all.length, 2);
});
