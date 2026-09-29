import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { schema } from "./schema";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * Postgres through node-postgres when `url` is set, otherwise an in-process
 * PGlite (in memory, or on disk at `dataDir`). Applies the migrations in
 * ./drizzle before returning.
 */
export async function openDatabase(options: { url?: string; dataDir?: string } = {}) {
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url, max: 10 });
    const db = drizzlePg({ client: pool, schema });
    await migratePg(db, { migrationsFolder });
    return { db, close: () => pool.end() };
  }
  const client = new PGlite(options.dataDir);
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder });
  return { db, close: () => client.close() };
}

export type Database = Awaited<ReturnType<typeof openDatabase>>["db"];
