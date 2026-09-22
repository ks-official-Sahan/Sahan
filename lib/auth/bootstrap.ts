import "server-only";

import { db } from "@/lib/db/prisma";
import { seedOwner } from "@/lib/db/seed";
import { log } from "@/lib/log";

// First run: when the users table is empty, sign-in creates the owner from
// ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD (docs/plan/admin-cms-adr.md, section
// 7). It never touches an existing account. Once a user exists the check is
// skipped for the life of the process.
let settled = false;

export async function ensureBootstrapOwner(): Promise<void> {
  if (settled) return;
  try {
    if ((await db.user.count()) > 0) {
      settled = true;
      return;
    }
    const result = await seedOwner(db, process.env, "bootstrap");
    log.info("bootstrap owner", { result });
    settled = result === "created" || result === "exists" || result === "skipped-users-exist";
  } catch (error) {
    // A database hiccup must not break sign-in; the next attempt tries again.
    log.error("bootstrap owner failed", { error: (error as Error).message });
  }
}
