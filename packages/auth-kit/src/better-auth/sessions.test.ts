import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { pathToFileURL } from "node:url";

import type { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import type { AuthDbAdapter } from "../adapter";
import type { AuditEvent } from "../audit-event";
import { createAuthorize } from "../authorize";
import { MemoryKv } from "../cache/memory";
import { SESSION_MAX_AGE_SECONDS } from "../constants";
import { createDrizzleAuthAdapter } from "../drizzle/adapter";
import { createMfa } from "../mfa/mfa";
import { hashPassword } from "../password";
import { createPrismaAuthAdapter } from "../prisma/index";
import { createAuthDal } from "../session/dal";
import { createSessionStore } from "../session/store";
import type { AuthKitDatabase } from "../engines/types";
import { drizzleDdl, generatePrismaClient, pgliteWith, prismaDdl, testSchema } from "../test-support/pg";
import { hashSessionToken } from "./hash-tokens";
import { createAuthKitBetterAuth, type AuthKitBetterAuth } from "./instance";
import { betterAuthSessionSource, signInRefusal } from "./sessions";

// Better Auth on auth-kit's tables, end to end on an in-process Postgres, once
// per database kind: auth-kit's authorize decides, Better Auth writes the
// user_sessions row (token hashed) and the cookie, and createAuthDal reads it back.

const BASE = "http://localhost:3000";
const SECRET = "test-secret-test-secret-test-secret-00";
const STRONG = "Correct-Horse-42-Battery";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface Db {
  pg: PGlite;
  adapter: AuthDbAdapter<any>;
  database: AuthKitDatabase;
  close(): Promise<void>;
}

// Drizzle on a node-postgres Pool: Better Auth reaches the tables through the
// Pool with its built-in SQL path, so no Drizzle adapter is involved.
async function openDrizzle(): Promise<Db> {
  const lite = await pgliteWith(await drizzleDdl());
  const server = new PGLiteSocketServer({ db: lite, port: 0 });
  await server.start();
  const pool = new pg.Pool({ connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`, max: 1 });
  const db = drizzle({ client: pool });
  return {
    pg: lite,
    adapter: createDrizzleAuthAdapter(db, testSchema()),
    database: { drizzle: db },
    async close() {
      await pool.end();
      await server.stop();
      await lite.close();
    },
  };
}

async function openPrisma(): Promise<Db> {
  const entry = generatePrismaClient();
  const pg = await pgliteWith(prismaDdl());
  const server = new PGLiteSocketServer({ db: pg, port: 0 });
  await server.start();
  const { PrismaClient } = await import(pathToFileURL(entry).href);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`, max: 1 }) });
  return {
    pg,
    adapter: createPrismaAuthAdapter(prisma),
    database: { prisma },
    async close() {
      await prisma.$disconnect();
      await server.stop();
      await pg.close();
    },
  };
}

function suite(kind: string, open: () => Promise<Db>) {
  describe(`Better Auth sessions on auth-kit tables (${kind})`, () => {
    let db: Db;
    let seq = 0;
    const events: AuditEvent[] = [];
    const codes: string[] = [];
    const knownDeviceEmails: string[] = [];
    let unlocked = true;

    let auth: AuthKitBetterAuth;
    let sessionStore: Awaited<ReturnType<typeof setup>>["sessionStore"];
    let mfa: Awaited<ReturnType<typeof setup>>["mfa"];

    async function setup() {
      const audit = async (event: AuditEvent) => void events.push(event);
      const limit = async () => ({ ok: true });
      const counters = new Map<string, number>();
      const sessionStore = createSessionStore({ adapter: db.adapter, kv: new MemoryKv(), authSecret: SECRET });
      const mfa = createMfa({
        adapter: db.adapter,
        authSecret: SECRET,
        limit,
        audit,
        sendEmail: async (message) => {
          codes.push(/\d{6}/.exec(message.text)![0]);
          return { ok: true };
        },
        renderMfaCode: ({ code }) => ({ subject: "Your code", html: code, text: `Your code is ${code}` }),
      });
      const authorize = createAuthorize({
        adapter: db.adapter,
        authSecret: SECRET,
        keyPrefix: "test:",
        sessionStore,
        mfa,
        bootstrap: async () => {},
        loginFailureWindowSeconds: 900,
        loginFailureMaxAttempts: 5,
        limit,
        failures: {
          reserve: async (key) => {
            counters.set(key, (counters.get(key) ?? 0) + 1);
            return counters.get(key)!;
          },
          clear: async (key) => void counters.delete(key),
        },
        audit,
        warn: () => {},
        after: (fn) => fn(),
        sendKnownDeviceEmail: async ({ email }) => void knownDeviceEmails.push(email),
      });
      const auth = await createAuthKitBetterAuth({ database: db.database, authorize, secret: SECRET, origins: [BASE], canSignIn: () => unlocked });
      return { auth, sessionStore, mfa };
    }

    before(async () => {
      db = await open();
      ({ auth, sessionStore, mfa } = await setup());
    });
    after(async () => {
      await db?.close();
    });

    async function seedUser(options: { mfaEnabled?: boolean; mustChangePassword?: boolean } = {}) {
      const id = `user-${++seq}`;
      const email = `${id}@example.com`;
      await db.pg.query(
        `INSERT INTO users (id, email, name, "passwordHash", role, "mfaEnabled", "mustChangePassword", "updatedAt")
         VALUES ($1, $2, 'Test', $3, 'EDITOR', $4, $5, CURRENT_TIMESTAMP)`,
        [id, email, await hashPassword(STRONG, 4), options.mfaEnabled ?? false, options.mustChangePassword ?? false]
      );
      return { id, email };
    }

    const post = (path: string, body: unknown, cookie?: string) =>
      auth.handler(
        new Request(`${BASE}/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASE, "user-agent": CHROME, ...(cookie ? { cookie } : {}) },
          body: JSON.stringify(body),
        })
      );
    const cookieOf = (res: Response) =>
      res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");

    function dal(cookie: string) {
      return createAuthDal({
        auth: betterAuthSessionSource(auth, () => new Headers({ cookie })),
        getSessionState: sessionStore.getSessionState,
        touchSession: sessionStore.touchSession,
        getRolePermissions: async () => [],
        notFound: () => {
          throw new Error("not-found");
        },
        redirect: (path) => {
          throw new Error(`redirect:${path}`);
        },
        after: (fn) => fn(),
        expirePath: "/api/auth/expire",
        accountPasswordChangePath: "/admin/account",
        checkPasswordFingerprint: false,
      });
    }

    async function sessionRow(token: string) {
      const { rows } = await db.pg.query<Record<string, unknown>>(`SELECT * FROM user_sessions WHERE token = $1`, [hashSessionToken(token)]);
      return rows[0];
    }
    const tokenOf = (cookie: string) => decodeURIComponent(/better-auth\.session_token=([^;]+)/.exec(cookie)![1]).split(".")[0];

    test("password sign-in writes a user_sessions row and the DAL accepts its cookie", async () => {
      const user = await seedUser();
      const res = await post("/auth-kit/sign-in", { email: user.email, password: STRONG });
      assert.equal(res.status, 200);
      const cookie = cookieOf(res);
      const row = await sessionRow(tokenOf(cookie));
      assert.ok(row, "the session row carries the SHA-256 of the cookie token");
      assert.equal((await db.pg.query(`SELECT 1 FROM user_sessions WHERE token = $1`, [tokenOf(cookie)])).rows.length, 0, "the raw token is never stored");
      assert.equal(row.userId, user.id);
      assert.equal(row.browser, "Chrome");
      assert.equal(row.os, "Windows");
      assert.equal(row.device, "desktop");
      assert.equal(row.mfaVerified, false);
      assert.equal(row.userAgent, CHROME);
      const lifetime = (row.expiresAt as Date).getTime() - (row.createdAt as Date).getTime();
      assert.ok(Math.abs(lifetime - SESSION_MAX_AGE_SECONDS * 1000) < 60_000, "sessions last SESSION_MAX_AGE_SECONDS");

      const signedIn = await dal(cookie).requireUser();
      assert.equal(signedIn.id, user.id);
      assert.equal(signedIn.sid, row.id);
      assert.equal(signedIn.email, user.email);
      assert.deepEqual(knownDeviceEmails.at(-1), user.email, "a first sign-in sends the known-device email");
      assert.equal(events.at(-1)?.action, "auth.login.success");
    });

    test("a wrong password is refused with code invalid and no cookie", async () => {
      const user = await seedUser();
      const res = await post("/auth-kit/sign-in", { email: user.email, password: "Wrong-Password-123" });
      assert.equal(res.status, 401);
      assert.equal((await res.json()).code, "invalid");
      assert.equal(res.headers.getSetCookie().length, 0);
      await assert.rejects(
        auth.api.authKitSignIn({ body: { email: user.email, password: "Wrong-Password-123" }, headers: new Headers() }),
        (error) => signInRefusal(error) === "invalid"
      );
    });

    test("an MFA account needs a verified emailed code before it gets a session", async () => {
      const user = await seedUser({ mfaEnabled: true });
      const first = await post("/auth-kit/sign-in", { email: user.email, password: STRONG });
      assert.equal(first.status, 403);
      assert.equal((await first.json()).code, "mfa_required");
      assert.equal(first.headers.getSetCookie().length, 0);

      const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: null, purpose: "SIGN_IN" });
      assert.ok(issued.ok);
      // An unverified challenge does not sign in.
      assert.equal((await post("/auth-kit/sign-in", { challengeId: issued.challengeId })).status, 401);
      const verified = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: codes.at(-1)! });
      assert.ok(verified.ok);

      const second = await post("/auth-kit/sign-in", { challengeId: issued.challengeId });
      assert.equal(second.status, 200);
      const cookie = cookieOf(second);
      assert.equal((await sessionRow(tokenOf(cookie))).mfaVerified, true);
      assert.equal((await dal(cookie).requireUser()).mfaVerified, true);
      // A challenge signs in once.
      assert.equal((await post("/auth-kit/sign-in", { challengeId: issued.challengeId })).status, 401);
    });

    test("a revoked session is refused by the DAL even while Better Auth's cookie cache still holds it", async () => {
      const user = await seedUser();
      const cookie = cookieOf(await post("/auth-kit/sign-in", { email: user.email, password: STRONG }));
      const signedIn = await dal(cookie).requireUser();
      assert.ok(await sessionStore.revokeSession(signedIn.sid, { userId: user.id, reason: "sign_out" }));
      assert.deepEqual(await dal(cookie).getSessionStatus(), { active: false, reason: "revoked" });
      await assert.rejects(dal(cookie).requireUser(), /redirect:\/api\/auth\/expire/);

      const cleared = await post("/auth-kit/clear-session", {}, cookie);
      assert.equal(cleared.status, 200);
      const expired = cleared.headers.getSetCookie().filter((c) => /Max-Age=0/i.test(c));
      assert.ok(expired.some((c) => c.startsWith("better-auth.session_token=")));
      assert.ok((await sessionRow(tokenOf(cookie))).revokedAt, "the row stays, marked revoked");
    });

    test("mustChangePassword sends the user to the account page", async () => {
      const user = await seedUser({ mustChangePassword: true });
      const cookie = cookieOf(await post("/auth-kit/sign-in", { email: user.email, password: STRONG }));
      await assert.rejects(dal(cookie).requireUser(), /redirect:\/admin\/account/);
      assert.equal((await dal(cookie).requireUser({ allowPasswordChange: true })).id, user.id);
    });

    test("Better Auth's own credential and session routes are switched off", async () => {
      const user = await seedUser();
      assert.equal((await post("/sign-in/email", { email: user.email, password: STRONG })).status, 404);
      assert.equal((await post("/sign-up/email", { email: "new@example.com", name: "N", password: STRONG })).status, 404);
      assert.equal((await post("/sign-out", {})).status, 404);
    });

    test("canSignIn false hides sign-in with 404", async () => {
      const user = await seedUser();
      unlocked = false;
      try {
        assert.equal((await post("/auth-kit/sign-in", { email: user.email, password: STRONG })).status, 404);
      } finally {
        unlocked = true;
      }
    });
  });
}

suite("drizzle", openDrizzle);
suite("prisma", openPrisma);
