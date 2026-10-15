import { expect, test } from "@playwright/test";

import { adminEnv, unlock } from "./helpers";

test("the admin is hidden until it is unlocked", async ({ page }) => {
  const login = await page.goto("/admin/login");
  expect(login?.status()).toBe(404);
  const admin = await page.goto("/admin");
  expect(admin?.status()).toBe(404);
});

test("a wrong unlock secret leaves the admin hidden", async ({ page }) => {
  const { unlockPath } = adminEnv();
  await page.goto(unlockPath);
  await page.getByLabel("Unlock secret").fill("not-the-secret-e2e");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toHaveCount(0);
  const login = await page.goto("/admin/login");
  expect(login?.status()).toBe(404);
});

test("the right unlock secret opens the login page", async ({ page }) => {
  await unlock(page);
});
