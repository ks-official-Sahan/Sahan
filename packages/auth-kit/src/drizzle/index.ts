// The Drizzle (Postgres) side of auth-kit: the tables and an AuthDbAdapter.
export { createAuthSchema, type AuthSchema, type AuthSchemaOptions } from "./schema";
export { createDrizzleAuthAdapter, type DrizzlePgDatabase } from "./adapter";
