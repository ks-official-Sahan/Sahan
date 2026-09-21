import "server-only";

import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

import { dbConfigured, isBuildPhase } from "./state";
import { runtimeConnectionString, runtimeSchema } from "./url";

export { dbConfigured, isBuildPhase };

// The Neon driver needs a WebSocket implementation on Node.
neonConfig.webSocketConstructor = ws;

const globalForDb = globalThis as unknown as { sahanDb?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = runtimeConnectionString(process.env);
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  // The schema goes through the adapter option, not the URL (Prisma 7).
  const adapter = new PrismaNeon(
    { connectionString },
    { schema: runtimeSchema(process.env) }
  );

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** The shared client, created on first use. Throws when DATABASE_URL is unset. */
export function getDb(): PrismaClient {
  globalForDb.sahanDb ??= createClient();
  return globalForDb.sahanDb;
}

/**
 * Lazy handle to the client. Importing this module never connects and never
 * throws, so `next build` works on a machine with no database. The first
 * property access creates the client.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDb();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
