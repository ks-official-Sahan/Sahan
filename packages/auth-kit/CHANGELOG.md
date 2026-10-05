# Changelog

All notable changes to this package are documented in this file.

## 0.4.1

### Patch Changes

- d16a325: Every subpath export now has a `default` condition beside `import`, so CommonJS loaders can use the package through Node's `require(esm)`. drizzle-kit loads `drizzle.config.ts` and the schema through `require`, and it failed with `ERR_PACKAGE_PATH_NOT_EXPORTED` on a schema that imports `@sahan-sac/auth-kit/drizzle`.

## 0.4.0

### Minor Changes

- b0061ae: New `./better-auth` engine: an `authKit()` Better Auth plugin that adds auth-kit's login-unlock gate, sign-in throttling, password policy, audit events and server-only `role`/`mustChangePassword` user fields; `authKitEmailPassword()` keeps auth-kit's bcrypt hashes and length limits so existing users sign in unchanged; `readBetterAuthSession()` returns the session in auth-kit's shape. `better-auth` is a new optional peer dependency; the next-auth engine is unchanged.
- 54f57a6: New `./hono` subpath: `securityHeaders`, `originGuard` (CSRF check on unsafe methods), `rateLimit` (429 with Retry-After), `session` (read once per request), `requirePermission` (404 when signed out or not allowed) and `betterAuthRoute` for mounting Better Auth. `hono` is a new optional peer dependency.
- 2f74f93: `originGuard` (`./hono`) accepts `nativeOrigins` (for example `"myapp://"`): a request without a browser Origin passes when its `expo-origin` header matches exactly. New `./rbac/rules` subpath exposes the pure RBAC rules (`can`, `defaultMatrix`, ...) without React, for React Native clients.
- 6c4c634: Framework-neutral core, first step toward the Better Auth, Hono and Expo engines. User agents are parsed by the new `./user-agent` (ua-parser-js 1.x, the same parser Next.js bundles) instead of `next/server`, so `authorize` and the session store no longer import Next.js. New subpaths: `./next-auth` (engine-named alias of `./config`), `./session/core` (session state and store without React), `./security/device` (`requestDetailsFromHeaders` for any `Headers`). `next`, `next-auth` and `react` are now optional peer dependencies. Existing imports keep working unchanged.
- 4bc5653: Choose the ORM: new `./prisma` (`createPrismaAuthAdapter`, typed structurally so any generated client fits) and `./drizzle` (`createAuthSchema` + `createDrizzleAuthAdapter`) subpaths implement `AuthDbAdapter`. `prisma/auth.prisma` ships the models. Both schemas create an identical Postgres database, and both adapters pass one shared contract suite on in-process Postgres (PGlite) in the package tests. `drizzle-orm` is a new optional peer dependency.

## 0.3.1

### Patch Changes

- 8f98a47: Source and releases move to the Sahan monorepo (`packages/auth-kit`), published with Changesets and npm Trusted Publishing. No API changes. Now licensed Apache-2.0 (was UNLICENSED).

## 0.3.0

### Added

- `redisConfigFromEnv(env)` returns the Upstash `{ url, token }` only when
  both variables are set, the URL is https, and `REDIS_ENABLED` is not
  `false`/`0`/`no`/`off`; otherwise `null`. `redisConfigured` and
  `getRedis` use it, so a malformed URL now falls back to the in-memory store
  instead of failing on the first request.
- `loginUnlockEnabled(env)`: true only while `ADMIN_LOGIN_UNLOCK_SECRET` is
  set, so an app can turn the hidden-login gate off by leaving it unset.

## 0.2.0

### Added

- `createMfa`'s `issueChallenge` reports `retryAfterSeconds` on a `"limited"`
  result when the rate limiter returns a reset estimate, so an app can tell
  the user how long to wait instead of a vague "try again later". The
  `limit` dependency may now return `{ ok, resetSeconds? }`; returning only
  `{ ok }` still works.

### Fixed

- `createRateLimit().limit()` called with a bucket name missing from the
  rules now throws `Unknown rate-limit bucket "<name>"` instead of an
  unexplained `Cannot read properties of undefined (reading 'failMode')`
  from its error path. Typed names make this unreachable in a fresh build;
  it happens when a dev server hot-reloads a caller before the catalogue.

## 0.1.0

Initial extraction of `@sahan-sac/auth-kit` from the Sahan
portfolio/admin app into a standalone, installable package: a
framework-agnostic core for a Next.js (App Router) + Auth.js v5 admin
authentication system.

- JWT-over-database-session auth, with every request re-checked against the
  session row (through a short-lived cache) for revocation, expiry, a
  disabled account, and a password-fingerprint match — changing a password
  invalidates every older session immediately, without a token blocklist.
- RBAC generic over your own `<TRole, TPermission>` catalogue: a role →
  permission matrix stored in your database, cached with a short TTL, with a
  `superRole` that always holds every permission in code.
- Emailed 6-digit one-time-code MFA with atomic, conditional state
  transitions so concurrent requests can never both win a challenge.
- A hidden-login ("unlock gate") that answers 404 until a visitor opens it
  once with a signed `?secret=` query, an IP allowlist that fails open when
  the caller's IP can't be resolved, origin/CSRF checks, CSP nonces, and
  Upstash-backed sliding-window rate limits with a per-bucket fail-open/
  fail-closed policy.
- Every secret (`authSecret`, rate-limit Redis clients, unlock keys) is a
  parameter, never read from `process.env` inside a shared function, so
  every factory is unit-testable without a live secret.
- Audit hooks on every mutating factory (`createRbac`, `createAuthConfig`,
  `createMfa`, `createSessionStore`); `replaceMatrix` writes its audit row
  inside the same database transaction as the matrix change.
- ESM build (tsup) with per-subpath `.d.ts` output matching the package's
  fine-grained `exports` map.
- 189 passing unit tests (`node:test` + `tsx`) covering every stateful
  factory.
