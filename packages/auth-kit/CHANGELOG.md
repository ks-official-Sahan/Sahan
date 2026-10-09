# Changelog

All notable changes to this package are documented in this file.

## 0.10.0

### Minor Changes

- Split React request caching from the framework-neutral RBAC entry point and publish an explicit Auth.js type augmentation subpath.

## 0.9.0

### Minor Changes

- bbce9b0: `./rbac/mask`: `createMask` is off unless its policy sets `enabled: true`. Resolve it with `presentationModeOn(process.env.ADMIN_PRESENTATION_MODE)`, which is true only for the exact value `"true"`. While off, roles, role rows, counts and audit visibility are unchanged, and stored state is ignored. Adds `hiddenAuditRole`, `NO_MASKS` and an optional `state` argument.

## 0.8.0

### Minor Changes

- Step-up codes: the `STEP_UP` MFA purpose confirms one sensitive action, and `signStepUp`/`readStepUp` (`./mfa`) bind an emailed code to that action and user with a signed ticket. `renderMfaCode` now receives the `purpose`, so the code email can say what it is for. `upgrade.sql` adds the enum value, and `auth-kit doctor` also checks `users.masked`, `audit_logs.actorRole` and `STEP_UP`. Run `npx auth-kit db upgrade --apply`.

## 0.7.0

### Minor Changes

- 6888284: `authKitSessions` and `createAuthKitBetterAuth` take `revokeSession`; with it, `authKitClearSession` revokes the session it clears, so a browser or native client signing out over HTTP leaves no live row behind. The `./engines/better-auth` engine wires it to the session store.
- dfea086: The root entry no longer loads an auth engine. `createAuthConfig`, `InvalidLogin`, `LimitedLogin` and `MfaLogin` are no longer exported from `@sahan-sac/auth-kit`; import them from `@sahan-sac/auth-kit/next-auth` instead. An app on Better Auth can now import the root without `next-auth` installed, and a test keeps every non-engine entry free of both engines.
  
  A configured Redis that errors or times out no longer fails the request. `getKv()` wraps it in the new `FailoverKv`, which serves from memory for 30 seconds and then tries Redis again. `kvBackend()` reports `"upstash-degraded"` while that happens. `FailoverKv` and `withTimeout` are exported from `./cache/memory` for apps that build their own key-value store.
- 1636d39: One engine contract, one import to switch. `./engines/next-auth` and `./engines/better-auth` each export `createAuthEngine(options)`, which takes the same options (`signIn` deps, `database`, cookie name, paths, origins) and returns the same `AuthEngine` (`sessionSource`, `checkPasswordFingerprint`, `signIn`, `signOut`, `keepSessionAfterPasswordChange`). `./engines/<engine>/cookie` exports `createSessionCookieCheck` for the proxy without loading the engine. An app imports one engine and installs only that engine's package. next-auth reads `AUTH_TRUST_HOST`/`AUTH_DEBUG` itself, and both engines answer 404 on the auth catch-all, so routes and env need no change on a switch.
  
  Better Auth now takes `database: { prisma }`, `{ drizzle }` (on a node-postgres or Neon Pool) or `{ pool }`. Drizzle and plain-SQL apps go through Better Auth's built-in SQL path, so they install no ORM adapter. `createAuthKitBetterAuth` builds the same instance without Next.js (for Hono).
  
  **Session tokens are hashed.** `user_sessions.token` stores the SHA-256 of the cookie token, never the token, so a leaked row cannot be replayed (`withHashedSessionTokens`, `hashSessionToken`). Existing Better Auth sessions sign in once more.
  
  **One database upgrade.** `prisma/upgrade.sql` (replacing `roles-table.sql`) brings any older database to the current schema: shared session columns, hashed tokens (ending sessions that still store a raw one), and the `roles` table. It is idempotent and works on one schema.
  
  **CLI.** `npx auth-kit doctor` checks the engine, env and schema. `auth-kit db upgrade [--apply] [--schema]` prints or runs the upgrade. `auth-kit engine <next-auth|better-auth> [--write]` rewrites the engine imports and prints the dependency swap. `pg` is an optional peer, used only by the CLI.
- c085402: Runtime roles. Roles are rows in a new `roles` table (`name`, `label`, `description`, `rank`, `system`) instead of the Postgres enum `Role`, so an admin can add roles without a deploy; `users.role`, `role_permissions.role` and `auth_tokens.role` are text with foreign keys to it (restrict, cascade and set null on delete). `createAuthSchema` returns `roles` instead of `roleEnum`, and its `roles` option only types the columns now. `createRbac` takes `loadRoles` so the matrix covers stored roles, and a role the matrix does not know holds nothing. New `./rbac/roles`: `createRoleCatalog` (rank hierarchy: `canManage`, `assignable`) and `checkRoleInput`. **Upgrade:** run `npx auth-kit db upgrade --apply` (or `@sahan-sac/auth-kit/prisma/upgrade.sql`) once before deploying; it converts the enum in place, keeps every row, and is safe to rerun.
- 71cb8d9: New `@sahan-sac/auth-kit/short-link-path`: the short-link shapes, `parseShortLink`, `shortLinkTarget` and the path builders without `node:crypto`, for React Native and edge runtimes. `./short-link` re-exports them, so existing imports are unchanged.
- 38aa0d1: Add a built-in SUPER_ADMIN role and opt-in masking of the super role.
  
  - `defineAuthKit({ fixedGrants })`: roles whose permissions are fixed in code, like the super role. Stored rows and matrix edits never change them, and `isFixedRole` tells them apart.
  - `SUPER_ADMIN_ROLE` (`./rbac/roles`): the built-in rank 5 row, managed and assigned only by the super role.
  - `./rbac/mask`: `createMask` shows super-role accounts to other viewers as another role, globally or per account. Presentation only: authorization keeps the real role.
  - `AuditEvent.actor.role` and the `audit_logs.actorRole` column snapshot the actor's role. `users.masked` stores the per-account mask. `upgrade.sql` adds both columns and fills `actorRole` on older rows from the actor's current role. Run `npx auth-kit db upgrade --apply`.

### Patch Changes

- 5e7f3cb: The build shares modules between subpaths (code splitting) instead of copying them into each one. Before, a class imported from two subpaths was two different classes, so `instanceof` failed (for example `EmailGuardError` from `@sahan-sac/email-kit/guards` against an error thrown through `./layout`), and module-level state such as caches existed once per subpath.

## 0.6.0

### Minor Changes

- c01d431: The session store adds `revokeSessions(ids, by)`: ends a chosen set of sessions in one write and one cache delete, for a bulk "end selected" on an admin screen. Sessions that already ended are left as they were.
- a1718a9: Shorter auth links. `createToken` now makes 34-character invite and reset tokens (128 random bits and a 64-bit tag) instead of 66; `verifyTokenTag` accepts both forms, so links already sent keep working until they expire. New `signSignInLink`, `verifySignInLink` and `signInLinkDays` (with `SIGN_IN_LINK_DEFAULT_DAYS` and `SIGN_IN_LINK_MAX_DAYS`) make a short, expiring code that unlocks the hidden login page like `?secret=` does, without the secret in a URL. Rotating either secret ends every code. New `@sahan-sac/auth-kit/short-link` packages the short links themselves: `parseShortLink`, `accountLinkPath`/`emailLinkPath`/`signInLinkPath` (`/a/<token>`, `/e/<token>`, `/s/<code>[/<admin path>]`), `shortLinkTarget`, and `resolveShortLink`, a framework-agnostic decision (redirect, with or without the unlock cookie, or the ordinary 404) a proxy answers with no database read.

## 0.5.0

### Minor Changes

- 00387ef: Better Auth can now run on auth-kit's own tables, so an app on the next-auth engine can switch engines without moving data.
  
  - `authKitSessions()` (in `./better-auth`) adds `POST /auth-kit/sign-in` and `POST /auth-kit/clear-session`. Sign-in runs auth-kit's `authorize` (lockout, IP limit, emailed MFA codes, known-device email, audit), and Better Auth writes the `user_sessions` row and the session cookie.
  - `authKitDatabaseOptions("prisma" | "drizzle")` maps Better Auth onto `users` and `user_sessions`, with 24-hour sessions that are never extended. `AUTH_KIT_DISABLED_PATHS` switches off every Better Auth route that would sidestep auth-kit.
  - `betterAuthSessionSource()` feeds `createAuthDal`, and `signInRefusal()` reads the sign-in refusal code.
  - `createAuthDal` and `evaluateSession` accept `checkPasswordFingerprint: false`, for sessions without a `pwf` claim.
  - `createAuthorize`'s `authorize` takes an optional third argument, `{ createSession }`.
  - Schema: `users.emailVerified`, plus `user_sessions.token` (nullable, unique) and `updatedAt`, in `prisma/auth.prisma` and `createAuthSchema`. These are additive columns with defaults, so apps that copy the schema need a migration that adds them.

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
