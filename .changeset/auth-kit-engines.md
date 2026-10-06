---
"@sahan-sac/auth-kit": minor
---

One engine contract, one import to switch. `./engines/next-auth` and `./engines/better-auth` each export `createAuthEngine(options)`, which takes the same options (`signIn` deps, `database`, cookie name, paths, origins) and returns the same `AuthEngine` (`sessionSource`, `checkPasswordFingerprint`, `signIn`, `signOut`, `keepSessionAfterPasswordChange`). `./engines/<engine>/cookie` exports `createSessionCookieCheck` for the proxy without loading the engine. An app imports one engine and installs only that engine's package. next-auth reads `AUTH_TRUST_HOST`/`AUTH_DEBUG` itself, and both engines answer 404 on the auth catch-all, so routes and env need no change on a switch.

Better Auth now takes `database: { prisma }`, `{ drizzle }` (on a node-postgres or Neon Pool) or `{ pool }`. Drizzle and plain-SQL apps go through Better Auth's built-in SQL path, so they install no ORM adapter. `createAuthKitBetterAuth` builds the same instance without Next.js (for Hono).

**Session tokens are hashed.** `user_sessions.token` stores the SHA-256 of the cookie token, never the token, so a leaked row cannot be replayed (`withHashedSessionTokens`, `hashSessionToken`). Existing Better Auth sessions sign in once more.

**One database upgrade.** `prisma/upgrade.sql` (replacing `roles-table.sql`) brings any older database to the current schema: shared session columns, hashed tokens (ending sessions that still store a raw one), and the `roles` table. It is idempotent and works on one schema.

**CLI.** `npx auth-kit doctor` checks the engine, env and schema. `auth-kit db upgrade [--apply] [--schema]` prints or runs the upgrade. `auth-kit engine <next-auth|better-auth> [--write]` rewrites the engine imports and prints the dependency swap. `pg` is an optional peer, used only by the CLI.
