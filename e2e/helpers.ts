import { expect, type Page } from "@playwright/test";

/**
 * Signed-in browser state per role, written once by auth.setup.ts. Reusing it
 * keeps the suite well under the unlock and sign-in rate limits
 * (lib/auth/kit-config.ts: 10 unlocks and 10 sign-ins per IP per 10 minutes).
 */
export const STORAGE_STATE = {
  editor: ".tmp-e2e/state/editor.json",
  manager: ".tmp-e2e/state/manager.json",
} as const;

/** Required environment for the admin specs; the CI job sets all three. */
export function adminEnv() {
  const unlockPath = process.env.ADMIN_UNLOCK_PATH;
  const unlockSecret = process.env.ADMIN_LOGIN_UNLOCK_SECRET;
  const password = process.env.E2E_PASSWORD;
  if (!unlockPath || !unlockSecret || !password) {
    throw new Error("Set ADMIN_UNLOCK_PATH, ADMIN_LOGIN_UNLOCK_SECRET and E2E_PASSWORD for the admin specs");
  }
  return { unlockPath, unlockSecret, password };
}

/** Opens the hidden login through the break-glass unlock form. */
export async function unlock(page: Page): Promise<void> {
  const { unlockPath, unlockSecret } = adminEnv();
  await page.goto(unlockPath);
  await page.getByLabel("Unlock secret").fill(unlockSecret);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

/** Unlocks, signs in with the shared test password and waits for the dashboard. */
export async function signIn(page: Page, email: string): Promise<void> {
  const { password } = adminEnv();
  await unlock(page);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
}
