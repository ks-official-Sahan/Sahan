// Runs once when a server instance starts (docs: file-conventions/instrumentation).
// It only loads the pure env rules, never a module that connects to anything.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertProductionEnv, warnDevEnv } = await import("./lib/env-rules");

  // Production with a database: refuse to start on missing or short secrets.
  // No effect during `next build` or on a database-less deploy.
  assertProductionEnv();
  // Development: warn about secrets that are too short to deploy.
  warnDevEnv();
}
