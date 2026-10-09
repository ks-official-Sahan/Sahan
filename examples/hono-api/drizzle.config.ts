import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` writes SQL migrations to ./drizzle (offline, no connection).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
