import assert from "node:assert/strict";
import { test } from "node:test";

import { authKit, authKitEmailPassword, type KitSession, readBetterAuthSession } from "@sahan-sac/auth-kit/better-auth";
import { betterAuthRoute, originGuard, requirePermission, session } from "@sahan-sac/auth-kit/hono";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Hono } from "hono";

import { createApiFetch } from "./api-fetch";
import { createAuthKitClient } from "./client";

// A native app's view of the stack: no Origin header, the app scheme in
// `expo-origin`, and the session cookie kept by the app (SecureStore on a
// device, a variable here) instead of a browser cookie jar.

const API = "http://localhost:8787";
const APP_ORIGIN = "myapp://";

// Stands in for `expo()` from "@better-auth/expo" (its server half), which apps
// add to Better Auth: it copies `expo-origin` into `origin` so Better Auth's own
// origin check sees the app scheme. The real package pulls React Native into
// this workspace as a peer, so the tests use the same six lines.
const expoOriginStandIn = {
  id: "expo-origin-stand-in",
  async onRequest(request: Request) {
    const expoOrigin = request.headers.get("expo-origin");
    if (request.headers.get("origin") || !expoOrigin) return;
    const headers = new Headers(request.headers);
    headers.set("origin", expoOrigin);
    return { request: new Request(request, { headers }) };
  },
} satisfies BetterAuthPlugin;

function server() {
  const auth = betterAuth({
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    secret: "test-secret-test-secret-test-secret-00",
    baseURL: API,
    trustedOrigins: [APP_ORIGIN],
    emailAndPassword: authKitEmailPassword(),
    plugins: [expoOriginStandIn, authKit()],
  });
  const app = new Hono();
  app.use("/api/*", originGuard({ siteUrl: "https://example.com", nativeOrigins: [APP_ORIGIN] }));
  app.on(["GET", "POST"], "/api/auth/*", betterAuthRoute(auth));
  app.use("/api/*", session((headers) => readBetterAuthSession(auth, headers)));
  app.get("/api/me", requirePermission<KitSession>(), (c) => c.json({ role: c.get("session")?.role }));
  return app;
}

test("the typed client signs in over the native origin, and createApiFetch reaches a protected route", async () => {
  const app = server();
  let cookie = "";
  // What a device does: no Origin, the app scheme instead, and a stored cookie.
  const nativeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const headers = new Headers(request.headers);
    headers.delete("origin");
    headers.set("expo-origin", APP_ORIGIN);
    if (cookie) headers.set("cookie", cookie);
    const response = await app.fetch(new Request(request, { headers }));
    const set = response.headers.getSetCookie().map((c) => c.split(";")[0]);
    if (set.length) cookie = set.join("; ");
    return response;
  };

  const client = createAuthKitClient({ baseURL: API, plugins: [], fetchOptions: { customFetchImpl: nativeFetch } });
  const signUp = await client.signUp.email({ email: "n@example.com", name: "N", password: "Correct-Horse-42-Battery" });
  assert.equal(signUp.error, null);
  const role: string | null | undefined = signUp.data?.user.role;
  assert.equal(role, "EDITOR");

  const weak = await client.signUp.email({ email: "w@example.com", name: "W", password: "alllowercaseletters" });
  assert.equal(weak.error?.status, 400);

  const signIn = await client.signIn.email({ email: "n@example.com", password: "Correct-Horse-42-Battery" });
  assert.equal(signIn.error, null);
  assert.ok(cookie.includes("session_token"));

  const apiFetch = createApiFetch({ baseURL: API, getCookie: () => cookie, appOrigin: APP_ORIGIN, fetch: async (url, init) => app.fetch(new Request(url, init)) });
  const me = await apiFetch("/api/me");
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { role: "EDITOR" });

  const wrongApp = await app.fetch(new Request(`${API}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", "expo-origin": "otherapp://" },
    body: JSON.stringify({ email: "n@example.com", password: "Correct-Horse-42-Battery" }),
  }));
  assert.equal(wrongApp.status, 403);
});
