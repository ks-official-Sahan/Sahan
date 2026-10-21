#!/usr/bin/env node
// Applies pending Prisma migrations as the first step of a production build.
//
// Vercel and Hostinger both build straight from a push to master, so no CI job
// sits between the merge and the deploy. Running `prisma migrate deploy` here
// means the schema is current before the new code goes live, on every host
// that builds it.
//
// When it runs:
//   MIGRATE_ON_BUILD=false  never (escape hatch for a broken migration).
//   MIGRATE_ON_BUILD=true   always (set it on Hostinger, and on a Vercel
//                           Preview scope whose database is its own branch).
//   unset, on Vercel        only when VERCEL_ENV=production.
//   unset, anywhere else    never, so local and CI builds stay offline.
//
// What it migrates: DATABASE_URL (or DIRECT_DATABASE_URL), then
// BACKUP_DATABASE_URL (or BACKUP_DIRECT_DATABASE_URL) when set. Each through
// a direct connection: DDL and Prisma's advisory lock need one, not the pooler.
//
// Any failure fails the build, so the old deployment keeps serving.
// Concurrent builds (Vercel and Hostinger at once) are safe: Prisma holds a
// Postgres advisory lock, the loser retries, then finds nothing pending.
//
// Pure helpers are exported for tests. Never logs a URL or credential.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const TRUE = new Set(["1", "true", "yes", "on"]);
const FALSE = new Set(["0", "false", "no", "off"]);
const LOCK_RETRIES = 4;
const LOCK_WAIT_MS = 15_000;

/** Whether this build should migrate, and why. */
export function decide(env) {
  const flag = env.MIGRATE_ON_BUILD?.trim().toLowerCase();
  if (flag && FALSE.has(flag)) return { run: false, reason: "MIGRATE_ON_BUILD is off" };
  if (flag && TRUE.has(flag)) return { run: true, reason: "MIGRATE_ON_BUILD is on" };
  if (env.VERCEL === "1") {
    return env.VERCEL_ENV === "production"
      ? { run: true, reason: "Vercel production build" }
      : { run: false, reason: `Vercel ${env.VERCEL_ENV || "unknown"} build` };
  }
  return { run: false, reason: "not a production build (set MIGRATE_ON_BUILD=true to opt in)" };
}

/** Neon pooler host to direct host, without `channel_binding` (the schema engine rejects it). */
export function directUrl(source) {
  const url = new URL(source);
  const [first, ...rest] = url.hostname.split(".");
  url.hostname = [first.replace(/-pooler$/, ""), ...rest].join(".");
  url.searchParams.delete("channel_binding");
  return url.toString();
}

/** Databases to migrate, primary first. */
export function targets(env) {
  const list = [];
  // A DIRECT_* URL only overrides how a configured database is reached; it
  // never adds a target on its own.
  if (env.DATABASE_URL) list.push({ name: "primary", url: env.DIRECT_DATABASE_URL || directUrl(env.DATABASE_URL) });
  if (env.BACKUP_DATABASE_URL) {
    list.push({ name: "backup", url: env.BACKUP_DIRECT_DATABASE_URL || directUrl(env.BACKUP_DATABASE_URL) });
  }
  return list;
}

/** True for Prisma's "could not get the advisory lock" failure. */
export function isLockTimeout(output) {
  return /advisory lock|P1002/i.test(output);
}

function prismaBin() {
  try {
    return createRequire(import.meta.url).resolve("prisma/build/index.js");
  } catch {
    throw new Error("The prisma CLI is not installed. Install devDependencies in the build, or set MIGRATE_ON_BUILD=false.");
  }
}

function migrateOnce(bin, url) {
  return new Promise((resolve) => {
    // Both URL variables point at the target, so prisma.config.ts resolves it
    // whichever one it reads.
    const env = { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url };
    const child = spawn(process.execPath, [bin, "migrate", "deploy"], { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const relay = (stream) => (chunk) => {
      output += chunk;
      stream.write(chunk);
    };
    child.stdout.on("data", relay(process.stdout));
    child.stderr.on("data", relay(process.stderr));
    child.on("close", (code) => resolve({ ok: code === 0, output }));
    child.on("error", (error) => resolve({ ok: false, output: String(error) }));
  });
}

async function migrate(bin, target) {
  for (let attempt = 1; ; attempt += 1) {
    console.log(`[migrate-on-build] ${target.name}: prisma migrate deploy (attempt ${attempt})`);
    const { ok, output } = await migrateOnce(bin, target.url);
    if (ok) return;
    if (!isLockTimeout(output) || attempt >= LOCK_RETRIES) {
      throw new Error(`${target.name} database migration failed`);
    }
    console.log(`[migrate-on-build] ${target.name}: another build holds the migration lock, waiting`);
    await new Promise((r) => setTimeout(r, LOCK_WAIT_MS));
  }
}

async function main() {
  const decision = decide(process.env);
  if (!decision.run) {
    console.log(`[migrate-on-build] skipped: ${decision.reason}`);
    return;
  }
  const list = targets(process.env);
  if (list.length === 0) throw new Error("migrations requested but DATABASE_URL is not set");
  console.log(`[migrate-on-build] ${decision.reason}: ${list.map((t) => t.name).join(", ")}`);
  const bin = prismaBin();
  for (const target of list) await migrate(bin, target);
  console.log("[migrate-on-build] done");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[migrate-on-build] ${error.message}`);
    process.exit(1);
  });
}
