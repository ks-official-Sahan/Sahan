import type { AuthDbAdapter } from "./adapter";

// First run: when the users table is empty, sign-in creates the owner from an
// app-chosen source (env vars, a setup wizard, whatever `seedOwner` reads). It
// never touches an existing account. Once a user exists the check is skipped
// for the life of the process.
//
// Concurrent cold starts (several serverless instances booting at once, an
// empty table, nobody has signed in yet) can all reach `seedOwner()` before
// any of them has written a row: each has its own in-memory `settled` flag
// (see below), so it is not a cross-instance guard. Safety instead comes from
// the database: the app's `seedOwner` is expected to rely on a real unique
// constraint on whatever it uses to detect "does the owner already exist"
// (e.g. `email`), so at most one concurrent `seedOwner()` call actually
// creates a row and the rest fail on that constraint. This function treats
// such a failure as an ordinary, expected outcome of losing the race rather
// than a real error: when `seedOwner()` throws, it rechecks `countUsers()`
// (an operation every adapter already implements and that needs no
// database-specific error-code knowledge) and only logs a failure when the
// table is still empty afterwards, i.e. when the error was not a lost race at
// all but a genuine problem (the database is down, the constraint is
// missing, ...). The seed itself staying idempotent (never overwriting an
// existing account) is the app's `seedOwner`'s job, same as before.
let settled = false;

export async function ensureBootstrapOwner(
  adapter: Pick<AuthDbAdapter, "countUsers">,
  // Any other outcome (e.g. the app's own "missing-env") just leaves `settled`
  // false so the next sign-in attempt tries again; the caller's result type is
  // its own and not otherwise constrained here.
  seedOwner: () => Promise<string>,
  log: { info: (message: string, fields?: Record<string, unknown>) => void; error: (message: string, fields?: Record<string, unknown>) => void }
): Promise<void> {
  if (settled) return; // fast path: only ever a database round trip once a table has users

  try {
    if ((await adapter.countUsers()) > 0) {
      settled = true;
      return;
    }
    const result = await seedOwner();
    log.info("bootstrap owner", { result });
    settled = result === "created" || result === "exists" || result === "skipped-users-exist";
    return;
  } catch (error) {
    // seedOwner threw. Before treating this as a real failure, check whether
    // another concurrent caller already won the race and created the owner:
    // if so this was expected (a unique-constraint rejection, most likely)
    // and the table is no longer empty, so the next call takes the fast path.
    try {
      if ((await adapter.countUsers()) > 0) {
        settled = true;
        log.info("bootstrap owner: lost the race to a concurrent caller, owner already exists");
        return;
      }
    } catch {
      // Fall through to the outer failure log below; the recheck itself
      // failing tells us nothing new.
    }
    // A database hiccup must not break sign-in; the next attempt tries again.
    log.error("bootstrap owner failed", { error: (error as Error).message });
  }
}
