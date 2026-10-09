import assert from "node:assert/strict";
import { test } from "node:test";

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

import type { AuditEvent } from "../audit-event";
import { authKit, authKitEmailPassword, type AuthKitPluginOptions, readBetterAuthSession } from "./index";

const BASE = "http://localhost:3000";
const STRONG = "Correct-Horse-42-Battery";

function setup(options: AuthKitPluginOptions = {}) {
  const db: Record<string, unknown[]> = { user: [], session: [], account: [], verification: [] };
  const auth = betterAuth({
    database: memoryAdapter(db),
    secret: "test-secret-test-secret-test-secret-00",
    baseURL: BASE,
    emailAndPassword: authKitEmailPassword(),
    plugins: [authKit(options)],
  });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, ...headers },
        body: JSON.stringify(body),
      })
    );
  return { auth, db, post };
}

test("sign-up rejects a password that fails auth-kit's policy", async () => {
  const { post } = setup();
  const res = await post("/sign-up/email", { email: "a@example.com", name: "A", password: "alllowercaseletters" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /three of/);
});

test("sign-up stores a bcrypt hash and gives the default role", async () => {
  const { post, db } = setup({ defaultRole: "VIEWER" });
  const res = await post("/sign-up/email", { email: "b@example.com", name: "B", password: STRONG });
  assert.equal(res.status, 200);
  const [user] = db.user as { role: string; mustChangePassword: boolean }[];
  assert.equal(user.role, "VIEWER");
  assert.equal(user.mustChangePassword, false);
  const [account] = db.account as { password: string }[];
  assert.match(account.password, /^\$2[aby]\$12\$/);
});

test("clients cannot set role or mustChangePassword on sign-up", async () => {
  const { post, db } = setup();
  const res = await post("/sign-up/email", { email: "c@example.com", name: "C", password: STRONG, role: "OWNER", mustChangePassword: true });
  assert.equal(res.status, 200);
  const [user] = db.user as { role: string; mustChangePassword: boolean }[];
  assert.equal(user.role, "EDITOR");
  assert.equal(user.mustChangePassword, false);
});

test("canSignIn false hides sign-in with 404", async () => {
  const { post } = setup({ canSignIn: () => false });
  const res = await post("/sign-in/email", { email: "d@example.com", password: STRONG });
  assert.equal(res.status, 404);
});

test("limit refusing a bucket answers 429 and checks the lowercased email", async () => {
  const seen: string[] = [];
  const { post } = setup({
    limit: async (bucket, key) => {
      seen.push(`${bucket}=${key}`);
      return { ok: bucket !== "login:acct" };
    },
  });
  const res = await post("/sign-in/email", { email: " E@Example.com ", password: STRONG });
  assert.equal(res.status, 429);
  assert.deepEqual(seen, ["login:acct=e@example.com"]);
});

test("sign-in audits success and failure, and the session reads in auth-kit's shape", async () => {
  const events: AuditEvent[] = [];
  const { auth, post } = setup({ audit: async (event) => void events.push(event) });
  assert.equal((await post("/sign-up/email", { email: "f@example.com", name: "F", password: STRONG })).status, 200);

  const bad = await post("/sign-in/email", { email: "f@example.com", password: "Wrong-Password-123" }, { "user-agent": "test-agent" });
  assert.equal(bad.status, 401);
  const good = await post("/sign-in/email", { email: "f@example.com", password: STRONG });
  assert.equal(good.status, 200);

  assert.deepEqual(
    events.map((e) => e.action),
    ["auth.login.failure", "auth.login.success"]
  );
  assert.equal(events[0].userAgent, "test-agent");
  assert.deepEqual(events[0].meta, { email: "f@example.com", status: "UNAUTHORIZED" });
  assert.equal(events[1].actor?.email, "f@example.com");

  const cookie = good.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const session = await readBetterAuthSession(auth, new Headers({ cookie }));
  assert.ok(session);
  assert.equal(session.email, "f@example.com");
  assert.equal(session.role, "EDITOR");
  assert.equal(session.mustChangePassword, false);
  assert.equal(session.mfaEnabled, false);
  assert.equal(await readBetterAuthSession(auth, new Headers()), null);
});

test("passwordPolicy false leaves only Better Auth's length checks", async () => {
  const { post } = setup({ passwordPolicy: false });
  const res = await post("/sign-up/email", { email: "g@example.com", name: "G", password: "alllowercaseletters" });
  assert.equal(res.status, 200);
});
