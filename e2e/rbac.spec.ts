import { expect, test } from "@playwright/test";

import { E2E_POSTS, E2E_USERS } from "./data";
import { STORAGE_STATE } from "./helpers";

test.describe("editor", () => {
  test.use({ storageState: STORAGE_STATE.editor });

  test("cannot open user or role management: both answer 404", async ({ page }) => {
    const users = await page.goto("/admin/users");
    expect(users?.status()).toBe(404);
    const roles = await page.goto("/admin/roles");
    expect(roles?.status()).toBe(404);
  });

  test("sees both the published and the draft post in the blog list", async ({ page }) => {
    await page.goto("/admin/blog");
    await expect(page.getByText(E2E_POSTS.published.title).first()).toBeVisible();
    await expect(page.getByText(E2E_POSTS.draft.title).first()).toBeVisible();
  });
});

test.describe("manager", () => {
  test.use({ storageState: STORAGE_STATE.manager });

  test("can open user management", async ({ page }) => {
    const users = await page.goto("/admin/users");
    expect(users?.status()).toBe(200);
    await expect(page.getByText(E2E_USERS.editor.email).first()).toBeVisible();
  });

  test("cannot open role management: managing permissions is never granted to a manager", async ({ page }) => {
    const roles = await page.goto("/admin/roles");
    expect(roles?.status()).toBe(404);
  });
});
