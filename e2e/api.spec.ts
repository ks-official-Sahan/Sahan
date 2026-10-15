import { expect, test } from "@playwright/test";

import { E2E_POSTS } from "./data";

test("the content API lists published posts only", async ({ request }) => {
  const response = await request.get("/api/content/v1/posts");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  const text = await response.text();
  expect(text).toContain(E2E_POSTS.published.slug);
  expect(text).not.toContain(E2E_POSTS.draft.slug);

  const one = await request.get(`/api/content/v1/posts/${E2E_POSTS.published.slug}`);
  expect(one.status()).toBe(200);
  const draft = await request.get(`/api/content/v1/posts/${E2E_POSTS.draft.slug}`);
  expect(draft.status()).toBe(404);
});

test("a cross-site POST to a public API is refused before the route runs", async ({ request }) => {
  const response = await request.post("/api/contact", {
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    data: { name: "x", email: "x@example.com", message: "hello" },
  });
  expect(response.status()).toBe(403);
});

test("an admin API answers 404, never 401 or 403, without a session", async ({ request }) => {
  const response = await request.get("/api/admin/media");
  expect(response.status()).toBe(404);
});
