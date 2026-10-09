import { defineConfig } from "prisma/config";

// Only for the package tests: `prisma generate` and the offline
// `prisma migrate diff --from-empty` that turns prisma/auth.prisma into SQL.
// Neither connects, so the URL is a placeholder and never used.
export default defineConfig({
  schema: "prisma/auth.prisma",
  datasource: { url: "postgresql://localhost:5432/auth_kit_test" },
});
