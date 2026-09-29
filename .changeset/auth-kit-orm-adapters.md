---
"@sahan-sac/auth-kit": minor
---

Choose the ORM: new `./prisma` (`createPrismaAuthAdapter`, typed structurally so any generated client fits) and `./drizzle` (`createAuthSchema` + `createDrizzleAuthAdapter`) subpaths implement `AuthDbAdapter`. `prisma/auth.prisma` ships the models. Both schemas create an identical Postgres database, and both adapters pass one shared contract suite on in-process Postgres (PGlite) in the package tests. `drizzle-orm` is a new optional peer dependency.
