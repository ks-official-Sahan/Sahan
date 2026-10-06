import assert from "node:assert/strict";
import { test } from "node:test";

import { createApiFetch } from "./api-fetch";

test("createApiFetch sends the stored cookie and app origin to the API only", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const apiFetch = createApiFetch({
    baseURL: "https://api.example.com",
    getCookie: () => "better-auth.session_token=abc",
    appOrigin: "myapp://",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response("ok");
    },
  });

  await apiFetch("/api/me", { headers: { accept: "application/json" } });
  const headers = new Headers(calls[0].init.headers);
  assert.equal(calls[0].url, "https://api.example.com/api/me");
  assert.equal(headers.get("cookie"), "better-auth.session_token=abc");
  assert.equal(headers.get("expo-origin"), "myapp://");
  assert.equal(headers.get("accept"), "application/json");
  assert.equal(calls[0].init.credentials, "omit");

  await assert.rejects(apiFetch("https://evil.example/steal"), /only calls https:\/\/api\.example\.com/);
  await assert.rejects(apiFetch("//evil.example/steal"), /only calls/);
  assert.equal(calls.length, 1, "no request left for another origin");
});

test("createApiFetch sends no cookie header when signed out", async () => {
  let seen: Headers | undefined;
  const apiFetch = createApiFetch({
    baseURL: "https://api.example.com/",
    getCookie: () => null,
    fetch: async (_url, init) => {
      seen = new Headers(init?.headers);
      return new Response("ok");
    },
  });
  await apiFetch("api/health");
  assert.equal(seen?.has("cookie"), false);
  assert.equal(seen?.has("expo-origin"), false);
});
