import { expect, test } from "@playwright/test";

import { E2E_POSTS } from "./data";

test("home page renders with security headers", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  expect(headers["content-security-policy"]).toBeTruthy();
  expect(headers["x-powered-by"]).toBeUndefined();
  await expect(page.locator("h1").first()).toBeVisible();
});

test("a published post is public and a draft is not", async ({ page }) => {
  const published = await page.goto(`/updates/${E2E_POSTS.published.slug}`);
  expect(published?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: E2E_POSTS.published.title })).toBeVisible();

  const draft = await page.goto(`/updates/${E2E_POSTS.draft.slug}`);
  expect(draft?.status()).toBe(404);
  await expect(page.getByText(E2E_POSTS.draft.title)).toHaveCount(0);
});

test("the updates list shows published posts only", async ({ page }) => {
  await page.goto("/updates");
  await expect(page.getByText(E2E_POSTS.published.title).first()).toBeVisible();
  await expect(page.getByText(E2E_POSTS.draft.title)).toHaveCount(0);
});

test("robots.txt and the sitemap answer, and the sitemap lists the published post only", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap:");

  const index = await request.get("/sitemap.xml");
  expect(index.status()).toBe(200);
  const locations = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  const bodies = await Promise.all(locations.map(async (path) => (await request.get(path)).text()));
  const all = [await index.text(), ...bodies].join("\n");
  expect(all).toContain(`/updates/${E2E_POSTS.published.slug}`);
  expect(all).not.toContain(`/updates/${E2E_POSTS.draft.slug}`);
});

test("an unknown page answers 404", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist-e2e");
  expect(response?.status()).toBe(404);
});
