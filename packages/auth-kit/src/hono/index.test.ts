import assert from "node:assert/strict";
import { test } from "node:test";

import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Hono } from "hono";

import { authKit, authKitEmailPassword, type KitSession, readBetterAuthSession } from "../better-auth";
import { betterAuthRoute, originGuard, rateLimit, requirePermission, securityHeaders, session } from "./index";

const BASE = "http://localhost:8787";

test("securityHeaders adds the static headers without overriding a route's own", async () => {
  const app = new Hono().use(securityHeaders());
  app.get("/", (c) => c.text("ok"));
  app.get("/framed", (c) => c.text("ok", 200, { "X-Frame-Options": "DENY" }));
  const res = await app.request("/");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal((await app.request("/framed")).headers.get("x-frame-options"), "DENY");
});

test("originGuard refuses unsafe requests from a missing or foreign Origin", async () => {
  const app = new Hono().use(originGuard({ siteUrl: "https://example.com" }));
  app.get("/", (c) => c.text("read"));
  app.post("/", (c) => c.text("write"));
  const post = (headers: Record<string, string>) => app.request("/", { method: "POST", headers: { host: "api.example.com", ...headers } });

  assert.equal((await app.request("/")).status, 200);
  assert.equal((await post({})).status, 403);
  assert.equal((await post({ origin: "https://evil.example" })).status, 403);
  assert.equal((await post({ origin: "https://api.example.com" })).status, 200, "same host");
  assert.equal((await post({ origin: "https://example.com" })).status, 200, "the site URL");

  const native = new Hono().use(originGuard({ nativeOrigins: ["myapp://"] }));
  native.post("/", (c) => c.text("write"));
  const nativePost = (headers: Record<string, string>) => native.request("/", { method: "POST", headers });
  assert.equal((await nativePost({ "expo-origin": "myapp://" })).status, 200, "the listed app scheme");
  assert.equal((await nativePost({ "expo-origin": "otherapp://" })).status, 403);
  assert.equal((await nativePost({ "expo-origin": "myapp://", origin: "https://evil.example" })).status, 403, "a browser Origin wins");

  const hidden = new Hono().use(originGuard({ status: 404 }));
  hidden.post("/", (c) => c.text("write"));
  assert.equal((await hidden.request("/", { method: "POST" })).status, 404);
});

test("rateLimit answers 429 with Retry-After once the key is spent", async () => {
  const used = new Map<string, number>();
  const app = new Hono().use(
    rateLimit({
      key: (c) => c.req.header("x-key") ?? "anon",
      limit: async (key) => {
        used.set(key, (used.get(key) ?? 0) + 1);
        return { ok: used.get(key)! <= 2, resetSeconds: 30.2 };
      },
    })
  );
  app.get("/", (c) => c.text("ok"));
  const get = (key: string) => app.request("/", { headers: { "x-key": key } });
  assert.equal((await get("a")).status, 200);
  assert.equal((await get("a")).status, 200);
  const limited = await get("a");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "31");
  assert.equal((await get("b")).status, 200, "other keys are separate");
});

test("Better Auth on Hono: sign-in through the kit plugin, then session and permission gates", async () => {
  const auth = betterAuth({
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    secret: "test-secret-test-secret-test-secret-00",
    baseURL: BASE,
    emailAndPassword: authKitEmailPassword(),
    plugins: [authKit({ defaultRole: "EDITOR" })],
  });

  const app = new Hono();
  app.use(originGuard({ siteUrl: BASE }));
  app.on(["GET", "POST"], "/api/auth/*", betterAuthRoute(auth));
  app.use("/api/*", session((headers) => readBetterAuthSession(auth, headers)));
  app.get("/api/me", requirePermission<KitSession>(), (c) => c.json({ email: c.get("session")?.email }));
  app.get("/api/admin", requirePermission<KitSession>((s) => s.role === "DEVELOPER"), (c) => c.text("admin"));

  const json = (path: string, body: unknown) =>
    app.request(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify(body),
    });

  assert.equal((await json("/api/auth/sign-up/email", { email: "h@example.com", name: "H", password: "Correct-Horse-42-Battery" })).status, 200);
  assert.equal((await json("/api/auth/sign-up/email", { email: "i@example.com", name: "I", password: "weakweakweakweak" })).status, 400);

  const signIn = await json("/api/auth/sign-in/email", { email: "h@example.com", password: "Correct-Horse-42-Battery" });
  assert.equal(signIn.status, 200);
  const cookie = signIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  assert.equal((await app.request(`${BASE}/api/me`)).status, 404, "signed out looks like a missing route");
  const me = await app.request(`${BASE}/api/me`, { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { email: "h@example.com" });
  assert.equal((await app.request(`${BASE}/api/admin`, { headers: { cookie } })).status, 404, "an EDITOR is not a DEVELOPER");
});
