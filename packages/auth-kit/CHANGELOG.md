# Changelog

All notable changes to this package are documented in this file.

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
