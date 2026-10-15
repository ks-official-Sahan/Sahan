import { test as setup } from "@playwright/test";

import { E2E_USERS } from "./data";
import { signIn, STORAGE_STATE } from "./helpers";

for (const role of ["editor", "manager"] as const) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await signIn(page, E2E_USERS[role].email);
    await page.context().storageState({ path: STORAGE_STATE[role] });
  });
}
