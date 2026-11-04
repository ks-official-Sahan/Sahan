#!/usr/bin/env node
// Uploads the Worker's secrets (scripts/worker-secrets.mjs decides which) in one
// version, from .env.local / .dev.vars / the shell, with the `cf` CLI.
//
//   pnpm secrets:vinext            upload every declared secret
//   pnpm secrets:vinext --dry-run  list the names only
//
// A brand-new Worker has nowhere to put secrets yet, and a deploy with
// declared secrets fails until they exist. The first time, deploy once with
// WORKER_SECRETS=skip (no declarations), then run this, then deploy normally.
//
// Values travel through a temporary file readable only by this user, deleted
// afterwards; they are never printed or passed on the command line.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadLocalEnv, workerSecretNames } from "./worker-secrets.mjs";

const WORKER = "sahan-portfolio";
const root = process.cwd();
const names = workerSecretNames(root, "production");
const env = loadLocalEnv(root, "production");

if (names.length === 0) {
  console.error("[secrets] nothing to upload: no variable from .env.example is set");
  process.exit(1);
}
console.log(`[secrets] ${names.length} secrets for ${WORKER}: ${names.join(", ")}`);
if (process.argv.includes("--dry-run")) process.exit(0);

const dir = mkdtempSync(join(tmpdir(), "cf-secrets-"));
const file = join(dir, "secrets.json");
try {
  const secrets = Object.fromEntries(names.map((name) => [name, { type: "secret_text", text: env[name] }]));
  writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
  const result = spawnSync("npx", ["cf", "workers", "secrets", "bulk", "--worker", WORKER, "--secrets", `@${file}`], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(
      `[secrets] upload failed. If ${WORKER} has never been deployed, run "WORKER_SECRETS=skip pnpm deploy:vinext" once, then this again.`
    );
    process.exit(result.status ?? 1);
  }
  console.log("[secrets] uploaded");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
