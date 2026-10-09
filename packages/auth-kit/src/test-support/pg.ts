import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

import { createAuthSchema } from "../drizzle/schema";

// In-process Postgres (PGlite) for the adapter contract and schema-parity
// tests. Nothing here connects to a real database server.

export const PACKAGE_DIR = fileURLToPath(new URL("../../", import.meta.url));
const PRISMA_CLI = fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url));

export const TEST_ROLES = ["DEVELOPER", "MANAGER", "EDITOR"] as const;
export const testSchema = () => createAuthSchema({ roles: TEST_ROLES, defaultRole: "EDITOR" });

function prisma(...args: string[]): string {
  return execFileSync(process.execPath, [PRISMA_CLI, ...args], { cwd: PACKAGE_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** SQL that creates prisma/auth.prisma (or another schema file) in an empty database (offline, no connection). */
export function prismaDdl(schema = "prisma/auth.prisma"): string {
  return prisma("migrate", "diff", "--from-empty", "--to-schema", schema, "--script");
}

/** Generates the Prisma client for prisma/auth.prisma into .prisma-test/client and returns its entry file. */
export function generatePrismaClient(): string {
  prisma("generate", "--schema", "prisma/auth.prisma");
  return fileURLToPath(new URL("../../.prisma-test/client/client.ts", import.meta.url));
}

/** SQL that creates the Drizzle schema in an empty database. */
export async function drizzleDdl(): Promise<string> {
  const { generateDrizzleJson, generateMigration } = await import("drizzle-kit/api");
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(testSchema()));
  return statements.join(";\n");
}

/** The test roles every fixture user and invite points at (users.role is a foreign key). */
export const TEST_ROLES_SQL = `INSERT INTO roles (name, label, rank, system, "updatedAt") VALUES
  ('DEVELOPER', 'Developer', 0, true, now()), ('MANAGER', 'Manager', 10, true, now()), ('EDITOR', 'Editor', 20, true, now())`;

/** Tables, columns, enums, indexes and constraints, for comparing two databases. */
export async function describeDb(pg: PGlite) {
  const rows = async (sql: string) => (await pg.query<Record<string, unknown>>(sql)).rows;
  return {
    columns: await rows(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, datetime_precision
      FROM information_schema.columns WHERE table_schema = 'public'
      ORDER BY table_name, column_name`),
    enums: await rows(`
      SELECT t.typname, e.enumlabel, e.enumsortorder
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      ORDER BY t.typname, e.enumsortorder`),
    indexes: await rows(`
      SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
      ORDER BY tablename, indexname`),
    constraints: await rows(`
      SELECT c.conrelid::regclass::text AS table_name, c.conname, c.contype, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
      ORDER BY 1, 2`),
  };
}

export async function pgliteWith(ddl: string): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(ddl);
  await pg.exec(TEST_ROLES_SQL);
  return pg;
}
