import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ENGINES, enginesIn, planEngineSwitch, swapCommand, type EngineName, type SourceFile } from "./engine-switch";

// npx auth-kit doctor | db upgrade [--apply] | engine <next-auth|better-auth> [--write]
// Reads the app from the current directory. Never installs packages and never
// prints a secret: environment variables are reported as set or missing.

const UPGRADE_SQL = fileURLToPath(new URL("../../prisma/upgrade.sql", import.meta.url));
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", "out", "coverage", ".turbo", ".vercel"]);
const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

type Manager = "pnpm" | "npm" | "yarn" | "bun";

function sources(root: string): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (SOURCE.test(name) && !TEST.test(name)) out.push({ path: relative(root, path).replaceAll("\\", "/"), text: readFileSync(path, "utf8") });
    }
  };
  walk(root);
  return out;
}

function appDependencies(root: string): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<string, Record<string, string> | undefined>;
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

function manager(root: string): Manager {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) return "bun";
  return "npm";
}

interface Pg {
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/**
 * The schema to work in: `--schema <name>`, else the URL's Prisma-style
 * `schema` parameter, else null (the server's search_path). A shared database
 * holds other projects' tables, so the target is always printed first.
 */
function targetSchema(argv: readonly string[]): string | null {
  const flagged = argv[argv.indexOf("--schema") + 1];
  const fromUrl = process.env.DATABASE_URL ? URL.parse(process.env.DATABASE_URL)?.searchParams.get("schema") : null;
  const schema = (argv.includes("--schema") ? flagged : fromUrl) || null;
  if (schema && !IDENTIFIER.test(schema)) throw new Error(`Not a schema name: ${schema}`);
  return schema;
}

/** A node-postgres client on `schema` when `pg` is installed and DATABASE_URL is set, else null. */
async function connect(schema: string | null): Promise<Pg | null> {
  const raw = process.env.DATABASE_URL;
  const url = raw ? URL.parse(raw) : null;
  if (!url) return null;
  url.searchParams.delete("schema");
  try {
    const { default: pg } = (await import("pg" as string)) as { default: { Client: new (config: { connectionString: string }) => Pg & { connect(): Promise<void> } } };
    const client = new pg.Client({ connectionString: url.toString() });
    await client.connect();
    if (schema) await client.query(`SET search_path TO "${schema}"`);
    return client;
  } catch {
    return null;
  }
}

const describeSchema = (schema: string | null) => (schema ? `schema "${schema}"` : "the server's default schema (pass --schema to choose)");

async function doctor(root: string, schema: string | null): Promise<number> {
  let problems = 0;
  const say = (ok: boolean | "warn", message: string) => {
    if (ok !== true) problems += ok === false ? 1 : 0;
    console.log(`${ok === true ? "ok  " : ok === "warn" ? "warn" : "FAIL"}  ${message}`);
  };

  const deps = appDependencies(root);
  const used = enginesIn(sources(root));
  const installed = ENGINES.filter((engine) => deps[engine]);
  if (used.length === 0) say("warn", "No file imports @sahan-sac/auth-kit/engines/<engine> yet.");
  else if (used.length > 1) say(false, `Both engines are imported (${used.join(", ")}). Run: auth-kit engine <name> --write`);
  else say(true, `Engine in use: ${used[0]}`);
  for (const engine of used) if (!deps[engine]) say(false, `${engine} is imported but not in package.json. Run: ${manager(root)} add ${engine}`);
  for (const engine of installed) if (used.length && !used.includes(engine)) say("warn", `${engine} is installed but not used; remove it to keep the install small.`);

  for (const name of ["AUTH_SECRET", "DATABASE_URL"]) {
    const value = process.env[name];
    if (!value) say(false, `${name} is not set in this shell.`);
    else if (name === "AUTH_SECRET" && value.length < 32) say(false, "AUTH_SECRET is shorter than 32 characters.");
    else say(true, `${name} is set.`);
  }

  const db = await connect(schema);
  if (!db) {
    say("warn", "Database not checked (needs DATABASE_URL and the pg package).");
  } else {
    console.log(`      Checking ${describeSchema(schema)}.`);
    try {
      const { rows } = await db.query(`
        SELECT
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'emailVerified') AS "emailVerified",
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'user_sessions' AND column_name = 'token') AS "token",
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'roles') AS "roles",
          EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'Role' AND n.nspname = current_schema()) AS "roleEnum"`);
      const state = rows[0] as Record<string, boolean>;
      const behind = !state.emailVerified || !state.token || !state.roles || state.roleEnum;
      if (!behind && state.token) {
        const raw = await db.query(`SELECT count(*)::int AS n FROM user_sessions WHERE token IS NOT NULL AND token !~ '^[A-Za-z0-9_-]{43}$'`);
        if ((raw.rows[0] as { n: number }).n > 0) say(false, "Some sessions still store a raw token. Run: auth-kit db upgrade --apply");
        else say(true, "Database schema is current.");
      } else if (behind) say(false, "Database schema is behind this auth-kit version. Run: auth-kit db upgrade --apply");
    } finally {
      await db.end();
    }
  }
  return problems ? 1 : 0;
}

async function dbUpgrade(root: string, apply: boolean, schema: string | null): Promise<number> {
  if (!apply) {
    console.log(`-- ${UPGRADE_SQL}\n-- Review, then run: auth-kit db upgrade --apply\n`);
    console.log(readFileSync(UPGRADE_SQL, "utf8"));
    return 0;
  }
  const db = await connect(schema);
  if (db) {
    console.log(`Upgrading ${describeSchema(schema)}.`);
    try {
      await db.query(readFileSync(UPGRADE_SQL, "utf8"));
      console.log("Database upgraded.");
      return 0;
    } finally {
      await db.end();
    }
  }
  // No pg: fall back to the app's own Prisma CLI, which reads its own datasource config.
  const prisma = join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  if (existsSync(prisma)) {
    const result = spawnSync(prisma, ["db", "execute", "--file", UPGRADE_SQL], { stdio: "inherit", shell: process.platform === "win32" });
    return result.status ?? 1;
  }
  console.error(`Set DATABASE_URL and install pg, or run the file yourself: psql "$DATABASE_URL" -f ${UPGRADE_SQL}`);
  return 1;
}

function engine(root: string, to: string | undefined, write: boolean, force: boolean): number {
  if (!ENGINES.includes(to as EngineName)) {
    console.error(`Usage: auth-kit engine <${ENGINES.join("|")}> [--write]`);
    return 1;
  }
  const target = to as EngineName;
  const files = sources(root);
  const from = enginesIn(files).find((name) => name !== target);
  const plan = planEngineSwitch(files, target);
  if (!plan.length) {
    console.log(`Already on ${target}.`);
    return 0;
  }
  for (const change of plan) for (const edit of change.edits) console.log(`${change.path}: ${edit}`);
  if (!write) {
    console.log("\nDry run. Add --write to apply.");
    return 0;
  }
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  if (!force && dirty.status === 0 && dirty.stdout.trim()) {
    console.error("The git tree has uncommitted changes. Commit or stash first, or pass --force.");
    return 1;
  }
  for (const change of plan) writeFileSync(join(root, change.path), change.text);
  console.log(`\nRewrote ${plan.length} file(s). Now swap the dependency:\n  ${swapCommand(manager(root), from ?? (target === "next-auth" ? "better-auth" : "next-auth"), target)}`);
  console.log("Everyone signs in once more after the deploy; the database needs no change.");
  return 0;
}

/** Loads the app's .env.local and .env (never overriding the shell), as Next.js would. */
function loadEnv(root: string) {
  for (const name of [".env.local", ".env"]) {
    const path = join(root, name);
    if (existsSync(path) && typeof process.loadEnvFile === "function") process.loadEnvFile(path);
  }
}

export async function main(argv: readonly string[], root = process.cwd()): Promise<number> {
  const [command, sub] = argv;
  loadEnv(root);
  const flag = (name: string) => argv.includes(`--${name}`);
  switch (command) {
    case "doctor":
      return doctor(root, targetSchema(argv));
    case "db":
      if (sub === "upgrade") return dbUpgrade(root, flag("apply"), targetSchema(argv));
      break;
    case "engine":
      return engine(root, sub, flag("write"), flag("force"));
  }
  console.log("auth-kit doctor [--schema <name>] | db upgrade [--apply] [--schema <name>] | engine <next-auth|better-auth> [--write] [--force]");
  return command ? 1 : 0;
}
