// Connection-string helpers shared by the Prisma CLI config and the runtime
// client. Pure on purpose (no server-only import) so prisma.config.ts can load
// it. Design record: docs/plan/admin-cms-adr.md, section 7.

export const DEFAULT_SCHEMA = "sahan";

/**
 * Schemas this project may target. Every other schema in the shared database
 * belongs to another project. `sahan_test` is for database tests only.
 */
export const ALLOWED_SCHEMAS = [DEFAULT_SCHEMA, "sahan_test"] as const;

type Env = Record<string, string | undefined>;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Schema named by the `schema` query parameter, `sahan` when absent. */
export function schemaFromUrl(url: string | undefined): string {
  if (!url) return DEFAULT_SCHEMA;
  return parse(url)?.searchParams.get("schema") || DEFAULT_SCHEMA;
}

/** Throws unless the schema is one this project owns. Returns the schema. */
export function assertAllowedSchema(schema: string): string {
  if (!(ALLOWED_SCHEMAS as readonly string[]).includes(schema)) {
    throw new Error(
      `Refusing to use database schema "${schema}". This project may only use: ${ALLOWED_SCHEMAS.join(", ")}.`
    );
  }
  return schema;
}

/** `ep-x-pooler.region.aws.neon.tech` becomes `ep-x.region.aws.neon.tech`. */
export function directHost(host: string): string {
  const [first, ...rest] = host.split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}

/**
 * URL for the Prisma CLI (`generate`, `migrate`). DDL needs a direct
 * connection, and the schema engine does not accept `channel_binding`. The
 * schema is always written explicitly and checked against the allowlist, so a
 * stray value can never point the CLI at another project's schema.
 */
export function deriveCliUrl(env: Env): string | undefined {
  const source = env.DIRECT_DATABASE_URL || env.DATABASE_URL;
  if (!source) return undefined;

  const url = parse(source);
  if (!url) throw new Error("The database URL is not a valid URL");

  if (!env.DIRECT_DATABASE_URL) url.hostname = directHost(url.hostname);
  url.searchParams.delete("channel_binding");

  const schema = assertAllowedSchema(
    url.searchParams.get("schema") || schemaFromUrl(env.DATABASE_URL)
  );
  url.searchParams.set("schema", schema);
  return url.toString();
}

/** A database the runtime can connect to, by the variable that holds its URL. */
export type DbSource = "primary" | "replica" | "backup" | "backupReplica";

const SOURCE_VARS: Record<DbSource, string> = {
  primary: "DATABASE_URL",
  replica: "DATABASE_READONLY_REPLICA_URL",
  backup: "BACKUP_DATABASE_URL",
  backupReplica: "BACKUP_DATABASE_READONLY_REPLICA_URL",
};

/** The URL of `source`, or undefined when its variable is unset. */
export function sourceUrl(env: Env, source: DbSource): string | undefined {
  return env[SOURCE_VARS[source]] || undefined;
}

/**
 * Pooled URL for the runtime driver. The schema travels through the adapter
 * option instead of the URL, and `channel_binding` is not supported over the
 * WebSocket driver, so both are removed.
 */
export function runtimeConnectionString(env: Env, source: DbSource = "primary"): string | undefined {
  const value = sourceUrl(env, source);
  if (!value) return undefined;
  const url = parse(value);
  if (!url) throw new Error(`${SOURCE_VARS[source]} is not a valid URL`);
  url.searchParams.delete("schema");
  url.searchParams.delete("channel_binding");
  return url.toString();
}

/** Schema for the runtime adapter, checked against the allowlist. A source without one uses the primary's. */
export function runtimeSchema(env: Env, source: DbSource = "primary"): string {
  const own = sourceUrl(env, source);
  const value = own && parse(own)?.searchParams.get("schema") ? own : env.DATABASE_URL;
  return assertAllowedSchema(schemaFromUrl(value));
}

/**
 * True when two URLs reach the same host and database, so one cannot stand in
 * for the other. Pooler and direct hosts of one Neon endpoint count as one.
 */
export function sameDatabaseEndpoint(a: string, b: string): boolean {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return false;
  return directHost(left.hostname) === directHost(right.hostname) && left.pathname === right.pathname;
}
