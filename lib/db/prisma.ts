import "server-only";

import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

import { describeError } from "@/lib/data/prisma/errors";
import { log } from "@/lib/log";

import { readSources, runOnSources, SourceBreaker } from "./failover";
import { dbConfigured, isBuildPhase } from "./state";
import { runtimeConnectionString, runtimeSchema, type DbSource } from "./url";

export { dbConfigured, isBuildPhase };

// Node needs a WebSocket implementation for the Neon driver; Cloudflare
// Workers (the vinext build) have a native one, and `ws` does not run there.
// A Worker also cannot reuse a socket opened by another request (the request
// hangs), so there plain queries go over stateless HTTP and a transaction's
// WebSocket is closed after one use instead of returning to the pool.
const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
if (onWorkers) neonConfig.poolQueryViaFetch = true;
else neonConfig.webSocketConstructor = ws;

const globalForDb = globalThis as unknown as {
  sahanDbClients?: Partial<Record<DbSource, PrismaClient>>;
  sahanDbBreaker?: SourceBreaker;
};

function createClient(source: DbSource): PrismaClient {
  const connectionString = runtimeConnectionString(process.env, source);
  if (!connectionString) throw new Error(source === "primary" ? "DATABASE_URL is not set" : `no URL configured for the ${source} database`);

  const pool = onWorkers ? { connectionString, maxUses: 1, idleTimeoutMillis: 1 } : { connectionString };
  const adapter = new PrismaNeon(pool, { schema: runtimeSchema(process.env, source) });

  return new PrismaClient({
    adapter,
    // Each statement of an interactive transaction is a round trip to Neon (about
    // 0.3 s), and a cold connection takes seconds. The defaults (2 s to start, 5 s
    // to finish) were shorter than the admin's multi-statement transactions.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function client(source: DbSource): PrismaClient {
  const clients = (globalForDb.sahanDbClients ??= {});
  return (clients[source] ??= createClient(source));
}

function breaker(): SourceBreaker {
  return (globalForDb.sahanDbBreaker ??= new SourceBreaker());
}

const onTrip = (source: DbSource, error: unknown) =>
  log.warn("database unavailable for reads, using the next source", { source, error: describeError(error) || String(error) });

/** Runs a read on the first source that answers (replica, primary, then backup when enabled). */
function runRead<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
  const sources = readSources(process.env);
  if (sources.length <= 1) return operation(client("primary"));
  return runOnSources(sources, breaker(), (source) => operation(client(source)), onTrip);
}

/** Model methods that never write, so a replica may answer them. */
const READ_METHODS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** The primary client, created on first use. Throws when DATABASE_URL is unset. */
export function getDb(): PrismaClient {
  return client("primary");
}

/** True while the primary is skipped after a connection failure. */
export function dbDegraded(): boolean {
  return breaker().isOpen("primary");
}

/** The databases that may answer a read, in order: shown on the integrations screen. */
export function dbReadSources(): DbSource[] {
  return readSources(process.env);
}

/**
 * Lazy handle to the primary. Importing this module never connects and never
 * throws, so `next build` works on a machine with no database. Every write and
 * every transaction goes here.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const primary = client("primary");
    const value = Reflect.get(primary, property, primary);
    return typeof value === "function" ? value.bind(primary) : value;
  },
});

/**
 * Lazy handle for reads that tolerate replication lag: public pages, feeds,
 * the sitemap. Model reads and `$queryRaw` go to the read replica when one is
 * configured (and to the backup with DB_FAILOVER=read-only), falling back in
 * order on a connection failure. Writes, `$executeRaw` and transactions still
 * go to the primary, so a repository built on it stays fully working. Never use
 * it to read back something this request just wrote.
 */
export const dbRead: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    if (property === "$queryRaw" || property === "$queryRawUnsafe") {
      return (...args: unknown[]) =>
        runRead((c) => Reflect.apply(Reflect.get(c, property, c) as (...a: unknown[]) => Promise<unknown>, c, args));
    }
    const primary = client("primary");
    const value = Reflect.get(primary, property, primary);
    if (typeof property !== "string" || property.startsWith("$") || typeof value !== "object" || value === null) {
      return typeof value === "function" ? value.bind(primary) : value;
    }
    // A model delegate: route its read methods, pass writes to the primary.
    return new Proxy(value as object, {
      get(delegate, method) {
        if (typeof method === "string" && READ_METHODS.has(method)) {
          return (...args: unknown[]) =>
            runRead((c) => {
              const model = Reflect.get(c, property, c) as Record<string, (...a: unknown[]) => Promise<unknown>>;
              return Reflect.apply(model[method], model, args);
            });
        }
        const fn = Reflect.get(delegate, method, delegate);
        return typeof fn === "function" ? fn.bind(delegate) : fn;
      },
    });
  },
});
