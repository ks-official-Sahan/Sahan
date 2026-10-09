import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import type { PGlite } from "@electric-sql/pglite";

import type { AuthDbAdapter } from "../adapter";

// One behavioural contract every AuthDbAdapter implementation must pass. The
// Prisma and Drizzle adapter tests each run it against their own in-process
// Postgres, so the two ORMs cannot drift apart.

export interface ContractHarness {
  adapter: AuthDbAdapter<any>;
  /** Raw access to the same database, for seeding and checking rows. */
  pg: PGlite;
  close(): Promise<void>;
}

// Both ORMs store UTC wall time in `timestamp(3)` columns; raw reads convert
// with AT TIME ZONE so the check does not depend on the machine time zone.
const HOUR = 3600 * 1000;

export function runAdapterContract(name: string, open: () => Promise<ContractHarness>) {
  describe(`${name} adapter contract`, () => {
    let h: ContractHarness;
    let seq = 0;

    before(async () => {
      h = await open();
    });
    after(async () => {
      await h?.close();
    });

    async function seedUser(overrides: { email?: string; role?: string; mfaEnabled?: boolean; disabled?: boolean } = {}) {
      const id = `user-${++seq}`;
      const email = overrides.email ?? `${id}@example.com`;
      await h.pg.query(
        `INSERT INTO users (id, email, name, "passwordHash", role, "mfaEnabled", "disabledAt", "updatedAt")
         VALUES ($1, $2, $3, 'hash', $4, $5, $6, CURRENT_TIMESTAMP)`,
        [id, email, `Name ${seq}`, overrides.role ?? "EDITOR", overrides.mfaEnabled ?? false, overrides.disabled ? new Date() : null]
      );
      return { id, email };
    }

    const session = (userId: string, extra: Partial<Parameters<AuthDbAdapter["createUserSession"]>[0]> = {}) =>
      h.adapter.createUserSession({
        userId,
        ip: "203.0.113.7",
        userAgent: "ua",
        browser: "Chrome",
        os: "Windows",
        device: "desktop",
        mfaVerified: false,
        expiresAt: new Date(Date.now() + HOUR),
        ...extra,
      });

    test("users: find by email or id, count, and record the last login", async () => {
      const before = await h.adapter.countUsers();
      const user = await seedUser({ role: "MANAGER", mfaEnabled: true });
      assert.equal(await h.adapter.countUsers(), before + 1);

      const auth = await h.adapter.findUserForAuth(user.email);
      assert.deepEqual(auth, {
        id: user.id,
        email: user.email,
        name: auth?.name,
        role: "MANAGER",
        passwordHash: "hash",
        disabledAt: null,
        mfaEnabled: true,
      });
      assert.equal(await h.adapter.findUserForAuth("nobody@example.com"), null);
      assert.deepEqual(await h.adapter.findUserById(user.id), { id: user.id, email: user.email, name: auth?.name, role: "MANAGER", passwordHash: "hash" });
      assert.equal(await h.adapter.findUserById("missing"), null);

      const when = new Date("2026-01-02T03:04:05.678Z");
      await h.adapter.updateLastLoginAt(user.id, when);
      const { rows } = await h.pg.query<{ lastLoginAt: Date }>(`SELECT "lastLoginAt" AT TIME ZONE 'UTC' AS "lastLoginAt" FROM users WHERE id = $1`, [user.id]);
      assert.equal(rows[0].lastLoginAt.getTime(), when.getTime());
    });

    test("sessions: create, read with the user, touch and revoke once", async () => {
      const user = await seedUser();
      const { id } = await session(user.id, { mfaVerified: true });
      assert.equal(typeof id, "string");

      const row = await h.adapter.findSessionWithUser(id);
      assert.ok(row);
      assert.equal(row.mfaVerified, true);
      assert.equal(row.revokedAt, null);
      assert.deepEqual(Object.keys(row.user).sort(), [
        "disabledAt",
        "email",
        "id",
        "mfaEnabled",
        "mustChangePassword",
        "name",
        "passwordHash",
        "role",
      ]);
      assert.equal(row.user.email, user.email);
      assert.equal(await h.adapter.findSessionWithUser("missing"), null);

      const seen = new Date(Date.now() + 1000);
      await h.adapter.touchSession(id, seen);
      const { rows } = await h.pg.query<{ lastSeenAt: Date }>(`SELECT "lastSeenAt" AT TIME ZONE 'UTC' AS "lastSeenAt" FROM user_sessions WHERE id = $1`, [id]);
      assert.equal(rows[0].lastSeenAt.getTime(), seen.getTime());

      assert.deepEqual(await h.adapter.revokeSessionById(id, null, "test"), { count: 1 });
      assert.deepEqual(await h.adapter.revokeSessionById(id, null, "again"), { count: 0 });
      const revoked = await h.adapter.findSessionWithUser(id);
      assert.ok(revoked?.revokedAt instanceof Date);
    });

    test("sessions: fingerprint lookup treats null as IS NULL", async () => {
      const user = await seedUser();
      const { id } = await session(user.id, { ip: null, browser: "Firefox", os: null });
      assert.deepEqual(await h.adapter.findFirstSessionByFingerprint({ userId: user.id, ip: null, browser: "Firefox", os: null }), { id });
      assert.equal(await h.adapter.findFirstSessionByFingerprint({ userId: user.id, ip: "203.0.113.7", browser: "Firefox", os: null }), null);
    });

    test("sessions: active lists, bulk revoke and the except filters", async () => {
      const a = await seedUser();
      const b = await seedUser();
      const s1 = await session(a.id);
      const s2 = await session(a.id);
      const expired = await session(a.id, { expiresAt: new Date(Date.now() - HOUR) });
      const other = await session(b.id);

      assert.deepEqual((await h.adapter.findActiveSessionIds(a.id)).sort(), [s1.id, s2.id, expired.id].sort());
      assert.deepEqual((await h.adapter.findActiveSessionIdsExcept(a.id, s1.id)).sort(), [s2.id, expired.id].sort());

      const allActive = await h.adapter.findAllActiveSessions(b.id);
      const ids = allActive.map((row) => row.id);
      assert.ok(ids.includes(s1.id) && ids.includes(s2.id));
      assert.ok(!ids.includes(expired.id), "expired sessions are not active");
      assert.ok(!ids.includes(other.id), "the excepted user's sessions are left out");

      await h.adapter.revokeSessionsByIds([], null, "noop");
      await h.adapter.revokeSessionsByIds([s1.id, s2.id], b.id, "bulk");
      assert.deepEqual(await h.adapter.findActiveSessionIds(a.id), [expired.id]);
      const { rows } = await h.pg.query<{ revokedById: string; revokeReason: string }>(
        `SELECT "revokedById", "revokeReason" FROM user_sessions WHERE id = $1`,
        [s1.id]
      );
      assert.deepEqual(rows[0], { revokedById: b.id, revokeReason: "bulk" });
    });

    test("sessions: recent IPs newest first and the sessions list", async () => {
      const user = await seedUser();
      const old = await session(user.id, { ip: "198.51.100.1" });
      const recent = await session(user.id, { ip: "198.51.100.2" });
      await session(user.id, { ip: null });
      await h.adapter.touchSession(old.id, new Date(Date.now() + 10 * HOUR));
      await h.adapter.touchSession(recent.id, new Date(Date.now() + 20 * HOUR));

      const ips = await h.adapter.findRecentSessionIps(2);
      assert.deepEqual(
        ips.map((row) => [row.ip, row.userEmail]),
        [
          ["198.51.100.2", user.email],
          ["198.51.100.1", user.email],
        ]
      );

      const ended = await session(user.id);
      await h.adapter.revokeSessionById(ended.id, null, "ended");
      const active = await h.adapter.findSessionsList({ userId: user.id, take: 10 });
      assert.equal(active.length, 3);
      assert.equal(active[0].id, recent.id);
      assert.equal(active[0].userEmail, user.email);
      assert.equal(active[0].userName, `Name ${seq}`);
      assert.ok(!active.some((row) => row.id === ended.id));
      const withEnded = await h.adapter.findSessionsList({ userId: user.id, includeEnded: true, take: 10 });
      assert.equal(withEnded.length, 4);
      assert.equal((await h.adapter.findSessionsList({ userId: user.id, take: 1 })).length, 1);
    });

    test("rbac: replace rows in a transaction, and a failed transaction writes nothing", async () => {
      await h.adapter.withTransaction(async (tx) => {
        await h.adapter.deleteRolePermissions(["EDITOR", "MANAGER"], tx);
        await h.adapter.createRolePermissions(
          [
            { role: "EDITOR", permission: "posts.read", updatedById: "u" },
            { role: "MANAGER", permission: "posts.write", updatedById: "u" },
          ],
          tx
        );
      });
      const sorted = async () => (await h.adapter.findAllRolePermissions()).map((row) => `${row.role}:${row.permission}`).sort();
      assert.deepEqual(await sorted(), ["EDITOR:posts.read", "MANAGER:posts.write"]);

      await assert.rejects(
        h.adapter.withTransaction(async (tx) => {
          await h.adapter.deleteRolePermissions(["EDITOR"], tx);
          await h.adapter.createRolePermissions([{ role: "EDITOR", permission: "users.delete", updatedById: "u" }], tx);
          throw new Error("rollback");
        }),
        /rollback/
      );
      assert.deepEqual(await sorted(), ["EDITOR:posts.read", "MANAGER:posts.write"]);

      await h.adapter.deleteRolePermissions([]);
      await h.adapter.createRolePermissions([]);
      await h.adapter.deleteRolePermissions(["EDITOR", "MANAGER"]);
      assert.deepEqual(await sorted(), []);
    });

    test("mfa: attempts are capped, a verified challenge is consumed once", async () => {
      const user = await seedUser({ email: "mfa@example.com" });
      const now = new Date();
      const id = `challenge-${seq}`;
      await h.adapter.createMfaChallenge({ id, userId: user.id, purpose: "SIGN_IN", codeHash: "c", attempts: 0, expiresAt: new Date(now.getTime() + HOUR) });

      assert.equal((await h.adapter.findOpenMfaChallenges(user.id, "SIGN_IN", now)).length, 1);
      assert.equal((await h.adapter.findOpenMfaChallenges(user.id, "ENABLE", now)).length, 0);

      const challenge = await h.adapter.findMfaChallengeById(id, user.id, "SIGN_IN");
      assert.deepEqual(challenge && { ...challenge, expiresAt: undefined }, {
        id,
        userId: user.id,
        purpose: "SIGN_IN",
        codeHash: "c",
        attempts: 0,
        verifiedAt: null,
        consumedAt: null,
        expiresAt: undefined,
      });
      assert.equal(await h.adapter.findMfaChallengeById(id, user.id, "ENABLE"), null);

      assert.deepEqual(await h.adapter.incrementMfaAttempts(id, now, 2), { count: 1 });
      assert.deepEqual(await h.adapter.incrementMfaAttempts(id, now, 2), { count: 1 });
      assert.deepEqual(await h.adapter.incrementMfaAttempts(id, now, 2), { count: 0 });
      assert.deepEqual(await h.adapter.findMfaChallengeAttempts(id), { attempts: 2 });
      assert.equal(await h.adapter.findMfaChallengeAttempts("missing"), null);

      const owner = await h.adapter.findMfaChallengeOwner(id, "SIGN_IN");
      assert.deepEqual(owner, { userId: user.id, user: { id: user.id, email: user.email, name: owner?.user.name, disabledAt: null } });

      const consume = { id, userId: user.id, purpose: "SIGN_IN" as const, now, verifiedWindowSeconds: 300 };
      assert.deepEqual(await h.adapter.consumeMfaChallenge(consume), { count: 0 }, "not verified yet");
      await h.adapter.markMfaChallengeVerified(id, now);
      await h.adapter.markMfaChallengeVerified(id, new Date(now.getTime() + 60_000));
      const verified = await h.adapter.findMfaChallengeById(id, user.id, "SIGN_IN");
      assert.equal(verified?.verifiedAt?.getTime(), now.getTime(), "the first verification time is kept");

      assert.deepEqual(await h.adapter.consumeMfaChallenge(consume), { count: 1 });
      assert.deepEqual(await h.adapter.consumeMfaChallenge(consume), { count: 0 });
      assert.equal(await h.adapter.findMfaChallengeOwner(id, "SIGN_IN"), null);
    });

    test("mfa: open challenges expire, one by one or per user and purpose", async () => {
      const user = await seedUser();
      const now = new Date();
      const later = new Date(now.getTime() + HOUR);
      await h.adapter.withTransaction(async (tx) => {
        await h.adapter.createMfaChallenge({ id: `a-${seq}`, userId: user.id, purpose: "ENABLE", codeHash: "c", attempts: 0, expiresAt: later }, tx);
        await h.adapter.createMfaChallenge({ id: `b-${seq}`, userId: user.id, purpose: "ENABLE", codeHash: "c", attempts: 0, expiresAt: later }, tx);
      });
      await h.adapter.expireMfaChallengeById(`a-${seq}`, now);
      assert.equal((await h.adapter.findOpenMfaChallenges(user.id, "ENABLE", now)).length, 1);
      await h.adapter.withTransaction((tx) => h.adapter.expireOpenMfaChallenges(user.id, "ENABLE", now, tx));
      assert.equal((await h.adapter.findOpenMfaChallenges(user.id, "ENABLE", now)).length, 0);
    });
  });
}
