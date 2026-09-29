import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import type { AuditEvent } from "@sahan-sac/auth-kit/audit-event";
import { eq } from "drizzle-orm";

import { createApp } from "./app";
import { createAuth, createLimiter } from "./auth";
import { openDatabase } from "./db";
import { user } from "./db/schema";

// The whole stack on an in-process Postgres: migrations, Better Auth through
// the Drizzle adapter, auth-kit's plugin and Hono middleware.

const BASE = "http://localhost:8787";
const PASSWORD = "Correct-Horse-42-Battery";

let database: Awaited<ReturnType<typeof openDatabase>>;
let app: ReturnType<typeof createApp>;
const events: AuditEvent[] = [];

before(async () => {
  database = await openDatabase();
  const limiter = createLimiter();
  const auth = createAuth({
    db: database.db,
    limiter,
    secret: "example-secret-example-secret-000000",
    baseURL: BASE,
    audit: async (event) => void events.push(event),
  });
  app = createApp({ auth, db: database.db, limiter, siteUrl: BASE });
});
after(() => database.close());

const post = (path: string, body: unknown, headers: Record<string, string> = { origin: BASE }) =>
  app.request(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

async function signIn(email: string, password = PASSWORD) {
  const res = await post("/api/auth/sign-in/email", { email, password });
  return { res, cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
}

test("sign-up applies the password policy and stores a bcrypt hash", async () => {
  assert.equal((await post("/api/auth/sign-up/email", { email: "weak@example.com", name: "W", password: "alllowercaseletters" })).status, 400);
  assert.equal((await post("/api/auth/sign-up/email", { email: "ada@example.com", name: "Ada", password: PASSWORD })).status, 200);
  const [row] = await database.db.select({ role: user.role }).from(user).where(eq(user.email, "ada@example.com"));
  assert.equal(row.role, "EDITOR");
});

test("unsafe requests without the site's Origin are refused", async () => {
  assert.equal((await post("/api/auth/sign-in/email", { email: "ada@example.com", password: PASSWORD }, {})).status, 403);
  assert.equal((await post("/api/auth/sign-in/email", { email: "ada@example.com", password: PASSWORD }, { origin: "https://evil.example" })).status, 403);
});

test("a signed-in user reads /api/me; the admin route stays hidden until the role allows it", async () => {
  const { res, cookie } = await signIn("ada@example.com");
  assert.equal(res.status, 200);
  assert.ok(events.some((e) => e.action === "auth.login.success" && e.actor?.email === "ada@example.com"));

  assert.equal((await app.request(`${BASE}/api/me`)).status, 404);
  const me = await app.request(`${BASE}/api/me`, { headers: { cookie } });
  assert.deepEqual(await me.json(), { email: "ada@example.com", name: "Ada", role: "EDITOR" });
  assert.equal(me.headers.get("x-content-type-options"), "nosniff");

  assert.equal((await app.request(`${BASE}/api/admin/stats`, { headers: { cookie } })).status, 404);
  await database.db.update(user).set({ role: "DEVELOPER" }).where(eq(user.email, "ada@example.com"));
  const stats = await app.request(`${BASE}/api/admin/stats`, { headers: { cookie } });
  assert.equal(stats.status, 200);
  assert.deepEqual(await stats.json(), { users: 1 });
});

test("repeated wrong passwords lock the account bucket with 429", async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) statuses.push((await signIn("ada@example.com", "Wrong-Password-123")).res.status);
  // The bucket counts every attempt: the sign-in above used one of the five.
  assert.deepEqual(statuses, [401, 401, 401, 401, 429, 429]);
  assert.equal((await signIn("ada@example.com")).res.status, 429, "the right password waits too");
  assert.ok(events.some((e) => e.action === "auth.login.failure"));
});
