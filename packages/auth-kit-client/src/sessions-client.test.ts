import assert from "node:assert/strict";
import { test } from "node:test";

import { createApiFetch } from "./api-fetch";
import { createAuthKitClient } from "./client";

// authClient.authKit against stub responses shaped like auth-kit's
// authKitSessions endpoints (the server side is tested in auth-kit).

const API = "http://localhost:8787";

function stub(respond: (path: string, body: unknown) => Response) {
  const calls: string[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    calls.push(path);
    return respond(path, request.method === "POST" ? await request.json().catch(() => null) : null);
  };
  return { calls, client: createAuthKitClient({ baseURL: API, plugins: [], fetchOptions: { customFetchImpl: fetchImpl } }) };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("authKit.signIn posts the credentials and maps refusals to auth-kit's codes", async () => {
  const { client, calls } = stub((path, body) => {
    const email = (body as { email?: string } | null)?.email;
    if (email === "ok@example.com") return json(200, { userId: "u1", sessionId: "s1", mfa: false });
    if (email === "mfa@example.com") return json(403, { code: "mfa_required", message: "A sign-in code is required." });
    if (email === "busy@example.com") return json(429, { code: "limited", message: "Too many sign-in attempts." });
    return json(500, { message: "boom" });
  });
  assert.deepEqual(await client.authKit.signIn({ email: "ok@example.com", password: "x" }), { ok: true });
  assert.deepEqual(await client.authKit.signIn({ email: "mfa@example.com", password: "x" }), { ok: false, code: "mfa_required" });
  assert.deepEqual(await client.authKit.signIn({ email: "busy@example.com", password: "x" }), { ok: false, code: "limited" });
  assert.deepEqual(await client.authKit.signIn({ email: "other@example.com", password: "x" }), { ok: false, code: "unavailable" });
  assert.ok(calls.every((path) => path === "/api/auth/auth-kit/sign-in"));
});

test("authKit.signOut posts to clear-session", async () => {
  const { client, calls } = stub(() => json(200, { ok: true }));
  await client.authKit.signOut();
  assert.deepEqual(calls, ["/api/auth/auth-kit/clear-session"]);
});

test("createApiFetch in a browser lets the browser send the cookie", async () => {
  let seen: RequestInit | undefined;
  const apiFetch = createApiFetch({ baseURL: API, fetch: async (_url, init) => ((seen = init), new Response("ok")) });
  await apiFetch("/api/me");
  assert.equal(seen?.credentials, "include");
  assert.equal(new Headers(seen?.headers).get("expo-origin"), null);
});
