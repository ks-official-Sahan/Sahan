// Which environment variables the Cloudflare Worker (the vinext build) gets as
// secrets, shared by cloudflare.config.ts and scripts/cloudflare-secrets.mjs.
//
// A Worker only sees the variables its config declares. The list is every
// variable documented in .env.example that this machine (or CI) has set, so
// adding a variable to .env.example and setting it is all a new feature needs.
// Declared secrets are also required at deploy: a deploy with one missing fails
// instead of shipping a Worker that cannot reach its database.
//
// Pure helpers are exported for tests. Never logs a value.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

/** Used only by the build or the CLI, never read by the running Worker. */
const BUILD_ONLY = new Set([
  "ADMIN_PASSWORD",
  "BACKUP_DIRECT_DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "MIGRATE_ON_BUILD",
  "NEON_API_KEY",
  "NEON_BRANCH_ID",
  "NEON_PROJECT_ID",
  "NEXT_DEPLOYMENT_ID",
  "NEXT_OUTPUT",
]);

/** Every variable named in an .env.example, set or commented out. */
export function documentedNames(example) {
  const names = new Set();
  for (const line of example.split(/\r?\n/)) {
    const match = /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line.trim());
    if (match) names.add(match[1]);
  }
  return names;
}

/** Documented, runtime, non-empty: the names the Worker gets. Sorted for a stable config. */
export function secretNames(documented, env) {
  return [...documented].filter((name) => !BUILD_ONLY.has(name) && env[name]?.trim()).sort();
}

/**
 * The environment the way vinext and the Vite plugin load it: .env files for
 * the mode, then .dev.vars, then the process (which wins). Missing files are
 * skipped.
 */
export function loadLocalEnv(root, mode = "production", processEnv = process.env) {
  const merged = {};
  for (const name of [".env", `.env.${mode}`, ".env.local", `.env.${mode}.local`, ".dev.vars"]) {
    const path = resolve(root, name);
    if (existsSync(path)) Object.assign(merged, parseEnv(readFileSync(path, "utf8")));
  }
  return { ...merged, ...processEnv };
}

/**
 * The secret names for the project at `root`. WORKER_SECRETS=skip declares
 * none: only for the very first deploy, before the Worker exists to hold them.
 */
export function workerSecretNames(root, mode) {
  if (process.env.WORKER_SECRETS === "skip") return [];
  const example = readFileSync(resolve(root, ".env.example"), "utf8");
  return secretNames(documentedNames(example), loadLocalEnv(root, mode));
}
