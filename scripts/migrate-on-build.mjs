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
// Any failure fails the build, so the old deployment keeps serving. A lock
// timeout or an unreachable database is retried first: a Neon compute that is
// restarting refuses connections for a few seconds.
//
// Concurrent builds (Vercel and Hostinger at once) are safe: Prisma holds a
// Postgres advisory lock, the loser retries, then finds nothing pending.
//
// Pure helpers are exported for tests. Never logs a URL or credential.

import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TRUE = new Set(["1", "true", "yes", "on"]);
const FALSE = new Set(["0", "false", "no", "off"]);
const RETRIES = 4;
const LOCK_WAIT_MS = 15_000;
const UNREACHABLE_WAIT_MS = 10_000;

/** Load `.env` / `.env.local` into process.env without overriding existing keys (Vercel). */
export function loadEnvFiles(cwd = process.cwd(), env = process.env) {
  for (const name of [".env", ".env.local"]) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || env[key] !== undefined) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
}

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

function directHost(hostname) {
  const [first, ...rest] = hostname.split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}

/** True when primary and backup resolve to the same host + database path. */
export function sameEndpoint(primaryUrl, backupUrl) {
  try {
    const primary = new URL(primaryUrl);
    const backup = new URL(backupUrl);
    return directHost(primary.hostname) === directHost(backup.hostname) && primary.pathname === backup.pathname;
  } catch {
    return false;
  }
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

/**
 * True for Prisma's "can't reach database server" failure. A Neon compute that
 * is restarting refuses connections for a short time, and one such refusal
 * failed two production deploys in a row before this retry existed.
 */
export function isUnreachable(output) {
  return /\bP1001\b|can't reach database server|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(output);
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
    const locked = isLockTimeout(output);
    if ((!locked && !isUnreachable(output)) || attempt >= RETRIES) {
      throw new Error(`${target.name} database migration failed`);
    }
    console.log(
      locked
        ? `[migrate-on-build] ${target.name}: another build holds the migration lock, waiting`
        : `[migrate-on-build] ${target.name}: database unreachable, waiting`,
    );
    await new Promise((r) => setTimeout(r, locked ? LOCK_WAIT_MS : UNREACHABLE_WAIT_MS));
  }
}

async function main() {
  // Next.js loads `.env.local` for `next build`; this script runs first via
  // plain Node, so load the same files without overriding host-provided env.
  loadEnvFiles();

  const decision = decide(process.env);
  if (!decision.run) {
    console.log(`[migrate-on-build] skipped: ${decision.reason}`);
    return;
  }
  const list = targets(process.env);
  if (list.length === 0) throw new Error("migrations requested but DATABASE_URL is not set");

  if (process.env.DATABASE_URL && process.env.BACKUP_DATABASE_URL && sameEndpoint(process.env.DATABASE_URL, process.env.BACKUP_DATABASE_URL)) {
    console.log("[migrate-on-build] warning: BACKUP_DATABASE_URL is the same endpoint as DATABASE_URL");
  }

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
