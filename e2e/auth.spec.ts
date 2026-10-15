import { expect, test } from "@playwright/test";

import { E2E_USERS } from "./data";
import { signIn, unlock } from "./helpers";

test("a wrong password is refused with a generic message", async ({ page }) => {
  await unlock(page);
  await page.locator('input[name="email"]').fill(E2E_USERS.editor.email);
  await page.locator('input[name="password"]').fill("Wrong-password-e2e-1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("an editor signs in, reaches the dashboard and signs out", async ({ page }) => {
  await signIn(page, E2E_USERS.editor.email);
  await expect(page.getByRole("navigation").first()).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).first().click();
  await expect(page).not.toHaveURL(/\/admin\/?$/);
  const back = await page.goto("/admin");
  expect(back?.url()).not.toMatch(/\/admin\/?$/);
});
