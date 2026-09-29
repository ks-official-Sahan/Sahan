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

/** SQL that creates prisma/auth.prisma in an empty database (offline, no connection). */
export function prismaDdl(): string {
  return prisma("migrate", "diff", "--from-empty", "--to-schema", "prisma/auth.prisma", "--script");
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

export async function pgliteWith(ddl: string): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(ddl);
  return pg;
}
