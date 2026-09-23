import type { AuthDbAdapter } from "./adapter";

// First run: when the users table is empty, sign-in creates the owner from
// ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD (docs/plan/admin-cms-adr.md, section
// 7). It never touches an existing account. Once a user exists the check is
// skipped for the life of the process.
let settled = false;

export async function ensureBootstrapOwner(
  adapter: Pick<AuthDbAdapter, "countUsers">,
  // Any other outcome (e.g. the app's own "missing-env") just leaves `settled`
  // false so the next sign-in attempt tries again; the caller's result type is
  // its own and not otherwise constrained here.
  seedOwner: () => Promise<string>,
  log: { info: (message: string, fields?: Record<string, unknown>) => void; error: (message: string, fields?: Record<string, unknown>) => void }
): Promise<void> {
  if (settled) return;
  try {
    if ((await adapter.countUsers()) > 0) {
      settled = true;
      return;
    }
    const result = await seedOwner();
    log.info("bootstrap owner", { result });
    settled = result === "created" || result === "exists" || result === "skipped-users-exist";
  } catch (error) {
    // A database hiccup must not break sign-in; the next attempt tries again.
    log.error("bootstrap owner failed", { error: (error as Error).message });
  }
}
