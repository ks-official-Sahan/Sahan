# @sahan-sac/auth-kit

A framework-agnostic core for a **Next.js (App Router) + Auth.js v5** admin
authentication system: JWT-over-database-session auth, RBAC generic over your
own role/permission catalogue, emailed one-time-code MFA, a hidden-login
unlock gate, an IP allowlist, origin/CSRF checks, CSP nonces, and rate limits
— all as small, dependency-injected factory functions you wire up once in
your app. It ships no UI.

This package was extracted from a real production app (a portfolio + admin
CMS); every module here is the exact code that app runs, generalized so the
app-specific parts (cookie names, paths, role names, the permission
catalogue, rate-limit buckets, CSP hosts) are supplied by you through one
config object (`defineAuthKit`) instead of being hardcoded.

## Security model

- **Session**: Auth.js issues a 24-hour JWT that carries only a session id
  (`sid`), never the source of truth. The `sid` points at a database row
  (`UserSession`); every request re-checks that row (through a short-lived
  Redis/in-memory cache) for revocation, expiry, the account being disabled,
  and a `pwf` (password fingerprint) match, so **changing a password
  invalidates every older session immediately**, without a token blocklist.
- **Revocation / force logout**: `createSessionStore` gives you
  `revokeSession`, `revokeSessions` (a chosen set, in one write),
  `revokeUserSessions`, `forceLogoutAll`, all of which drop
  the cached state so the change is visible on the very next request, not
  after a TTL.
- **RBAC**: a role → permission matrix stored in your database, cached for a
  short TTL, with one role (`superRole`) that always holds every permission
  **in code** — a bad matrix edit can never lock the owner out. Generic over
  `<TRole extends string, TPermission extends string>`; you supply the roles,
  the permissions, the default grants and (optionally) the "who may manage
  whom" hierarchy through `defineAuthKit`.
- **MFA**: emailed 6-digit one-time codes. Every state change (issue, verify,
  consume) is an atomic, conditional database update, so two concurrent
  requests can never both win. A verified-but-not-yet-consumed challenge can
  be re-verified with the same code without spending another attempt, but a
  wrong code always counts.
- **Hidden sign-in ("unlock gate")**: the login page answers 404 until a
  visitor opens it once with `?secret=<your-secret>`, which sets a short-lived
  signed cookie. This does not replace authentication — it just keeps casual
  scanners from ever seeing a login form. `signSignInLink`/`verifySignInLink`
  make a short, expiring code (`<expiry>.<tag>`, about 23 characters) that an
  app can put in a link to unlock the same way without the secret in a URL;
  rotating either secret ends every code.
- **Short links** (`@sahan-sac/auth-kit/short-link`): `/a/<token>` for invite
  and reset links, `/e/<token>` for email-change links and `/s/<code>` for
  sign-in links. Build them with `accountLinkPath`/`emailLinkPath`/
  `signInLinkPath`; in the proxy, `parseShortLink(pathname, search)` then
  `resolveShortLink(link, { authSecret, unlockGate, keys, now, paths, rateLimit })`
  says where to redirect and whether to set the unlock cookie. The parsing and
  path builders alone, without `node:crypto`, are in `./short-link-path` (for
  React Native or an edge runtime). Keep `/a`, `/e`
  and `/s` free of your own pages.
- **Short invite and reset tokens**: `createToken` makes 34-character tokens
  (128 random bits, a 64-bit tag); `verifyTokenTag` still accepts the older
  66-character form, so links already sent keep working.
- **IP allowlist**: optional, for `/admin`-shaped paths. Fails **open** when
  the caller's IP cannot be resolved at all (no trusted proxy configured) —
  turning the allowlist on must never turn into "lock out everyone,
  including the owner," on a host that has not configured proxy trust.
- **Origin/CSRF**: a second layer next to Next's own Origin/Host check, for
  Server Actions and API routes.
- **CSP**: a per-request nonce-based policy for the admin surface (needs
  dynamic rendering; the public site stays static and needs no script CSP).
- **Rate limits**: sliding-window, Upstash-backed with an in-memory fallback,
  with a per-bucket fail-open/fail-closed policy you choose (e.g. a public
  contact form should fail *open* so an Upstash outage doesn't take the site
  down; a login endpoint should fail *closed*).
- **Secrets are parameters.** No function in this package reads
  `process.env` for a secret — `authSecret`, rate-limit Redis clients, unlock
  keys, are all passed in by the app, which resolves them once. This makes
  every function unit-testable without a live secret and means rotating a
  secret never needs a code change.
- **Audit hooks**: every mutating factory (`createRbac`, `createAuthConfig`,
  `createMfa`, `createSessionStore`) takes an `audit`/`writeAudit` callback
  you wire to your own audit log, and `createRbac`'s `replaceMatrix` writes
  its audit row inside the *same* database transaction as the matrix change,
  via your adapter's `withTransaction`.

## Install

```bash
npm install @sahan-sac/auth-kit next-auth@5.0.0-beta.32 next react
```

This package is published under a **private, restricted** scope
(`@sahan-sac`). Installing it requires:

1. A paid npm organization plan for `sahan-sac` (private scoped
   packages are not available on npm's free tier).
2. An npm auth token with read access to that org in your `.npmrc`:
   ```
   //registry.npmjs.org/:_authToken=${NPM_TOKEN}
   @sahan-sac:registry=https://registry.npmjs.org/
   ```

### Peer dependencies

| Package | Version |
| --- | --- |
| `next` | `^16.3.5` |
| `next-auth` | `5.0.0-beta.32` |
| `react` | `^19.0.0` |
| `better-auth` | `^1.7.6` |
| `drizzle-orm` | `>=0.44.0 <1` |
| `hono` | `^4.6.0` |

All are optional: install `next-auth` for the next-auth engine or
`better-auth` for the Better Auth engine (never both), `drizzle-orm` only
for the Drizzle adapter, and `hono` only for `./hono`. `react` is a peer because `createRbac` and `createAuthDal` use `react`'s
`cache()` to memoize one database read per request/render.

## Required environment variables

None of these are read by this package directly (see "Secrets are
parameters" above) — this is the list your app needs to resolve once and
pass into the factories below.

| Variable | Used for |
| --- | --- |
| `AUTH_SECRET` | JWT signing, password fingerprints, unlock cookie signing. **Must be long and random** (`assertProductionEnv`-style checks in your own app should refuse to boot without one in production). |
| `ADMIN_LOGIN_UNLOCK_SECRET` | The hidden-login `?secret=` value. Optional: `loginUnlockEnabled(env)` is false while it is unset, and an app can then skip the unlock gate and show its login page to everyone. |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | First-run owner bootstrap (`ensureBootstrapOwner`) — optional; the app decides how `seedOwner` sources these. |
| `REDIS_ENABLED` | Optional. `false`/`0`/`no`/`off` forces the in-memory store even with Upstash configured; unset means "use Redis when configured". |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Session-state cache and rate limits. Used only when both are set and the URL is https (`redisConfigFromEnv`). Falls back to an in-memory store/limiter when unset — **fine for a single server, not safe across multiple serverless instances.** Required in any real serverless/multi-instance deployment. |
| `TRUSTED_PROXY_HOPS` | How many of *your own* reverse proxies append to `x-forwarded-for`. `0` (default) means no header is trusted and every caller reads as `"unknown"`. On Vercel this is unnecessary (its own headers are trusted automatically); use `trustProxy` in `defineAuthKit` to make this explicit config instead of environment-implicit. |
| `ADMIN_ALLOWED_ORIGINS` | Extra allowed origins (e.g. preview deployments), comma/whitespace separated. Parse with `parseOriginList` from `./security/origin`. |

## Database: Prisma or Drizzle

auth-kit reads and writes its tables through `AuthDbAdapter` (`./adapter`).
Two ready implementations ship with the package, and both pass one shared
contract suite against a real (in-process) Postgres in the package tests:

```ts
// Prisma: copy the enums and models from prisma/auth.prisma into your schema.
import type { Prisma } from "@prisma/client";
import { createPrismaAuthAdapter } from "@sahan-sac/auth-kit/prisma";
export const authAdapter = createPrismaAuthAdapter<Prisma.TransactionClient>(db);

// Drizzle: the same tables as Drizzle definitions.
import { createAuthSchema, createDrizzleAuthAdapter } from "@sahan-sac/auth-kit/drizzle";
export const authSchema = createAuthSchema({ roles: ["DEVELOPER", "MANAGER", "EDITOR"], defaultRole: "EDITOR" });
export const authAdapter = createDrizzleAuthAdapter(db, authSchema);
```

The two schemas create the same database, name for name (tables, columns,
types, defaults, enums, indexes and constraints); a package test builds both
and compares them. A project can switch ORMs without a migration.
`@sahan-sac/auth-kit/prisma/auth.prisma` is the full Prisma source.

## The Prisma schema this package's reference adapter expects

You are not required to use Prisma — `AuthDbAdapter` (see `./adapter`) is a
plain interface — but the reference implementation this package was built
against uses these models (trimmed to the columns the adapter actually
reads/writes; add whatever else your app needs):

```prisma
enum MfaPurpose {
  SIGN_IN
  ENABLE
  DISABLE
}

model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  name               String?
  passwordHash       String
  role               String    // foreign key to roles.name
  mfaEnabled         Boolean   @default(false)
  mustChangePassword Boolean   @default(false)
  lastLoginAt        DateTime?
  disabledAt         DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  sessions      UserSession[]
  mfaChallenges MfaChallenge[]
}

// A row means the permission is granted to the role. Your super role always
// holds every permission in code, so it needs no rows.
model RolePermission {
  role        String
  permission  String
  updatedById String?
  updatedAt   DateTime @default(now()) @updatedAt

  @@id([role, permission])
}

// One row per signed-in browser. `id` is the `sid` claim in the JWT. This
// table is authoritative for revocation; Redis only caches the state briefly.
model UserSession {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  ip           String?
  userAgent    String?
  browser      String?
  os           String?
  device       String?
  mfaVerified  Boolean   @default(false)
  createdAt    DateTime  @default(now())
  lastSeenAt   DateTime  @default(now())
  expiresAt    DateTime
  revokedAt    DateTime?
  revokedById  String?
  revokeReason String?

  @@index([userId, revokedAt])
  @@index([expiresAt])
}

// Emailed one-time codes for sign-in, enabling and disabling MFA.
model MfaChallenge {
  id         String     @id @default(cuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  purpose    MfaPurpose
  codeHash   String
  attempts   Int        @default(0)
  expiresAt  DateTime
  verifiedAt DateTime?
  consumedAt DateTime?
  createdAt  DateTime   @default(now())

  @@index([userId, purpose, expiresAt])
}

// Invite and password-reset links (invite-token.ts / login-unlock.ts style
// signed tokens; only the SHA-256 of the token is stored).
model AuthToken {
  id          String   @id @default(cuid())
  purpose     String   // "INVITE" | "PASSWORD_RESET" | "EMAIL_CHANGE"
  email       String
  userId      String?
  role        String?  // role granted on acceptance (invites only)
  tokenHash   String   @unique
  createdById String?
  expiresAt   DateTime
  usedAt      DateTime?
  revokedAt   DateTime?
  createdAt   DateTime @default(now())

  @@index([email, purpose])
  @@index([expiresAt])
}
```

## Integration, step by step

### 1. `defineAuthKit` — your one config object

```ts
// lib/auth/kit.ts
import "server-only";
import { defineAuthKit } from "@sahan-sac/auth-kit/kit";

export const ROLES = ["OWNER", "MANAGER", "EDITOR"] as const;
export type RoleName = (typeof ROLES)[number];

export const PERMISSIONS = ["viewDashboard", "editPosts", "publishPosts", "manageUsers" /* ... */] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const authKit = defineAuthKit<RoleName, Permission>({
  cookies: { session: "myapp_admin_session", unlock: "myapp_admin_unlock" },
  paths: { login: "/admin/login" /* every other path has a sensible /admin/... default, see AuthKitPaths */ },
  keyPrefix: "myapp:",
  roles: ROLES,
  superRole: "OWNER",
  permissions: PERMISSIONS,
  neverGrantable: ["manageUsers"],
  // Optional: roles whose permissions are fixed in code, like superRole.
  fixedGrants: { AUDITOR: ["viewDashboard", "viewOrders"] },
  defaultGrants: { MANAGER: ["viewDashboard", "editPosts", "publishPosts"], EDITOR: ["viewDashboard", "editPosts"] },
  // Optional: defaults to "only superRole manages anyone but themself".
  canManage: (actor, target) => actor.id !== target.id && (actor.role === "OWNER" || (actor.role === "MANAGER" && target.role === "EDITOR")),
  assignableRoles: (role) => (role === "OWNER" ? [...ROLES] : role === "MANAGER" ? ["EDITOR"] : []),
  limits: {
    "login:ip": { windowSeconds: 600, max: 10, failMode: "closed" },
    "login:acct": { windowSeconds: 900, max: 5, failMode: "closed" },
    "mfa:send:user": { windowSeconds: 600, max: 3, failMode: "closed" },
    "unlock:ip": { windowSeconds: 600, max: 10, failMode: "closed" },
    "contact:ip": { windowSeconds: 3600, max: 5, failMode: "open" },
    // ... every bucket your app needs; there is no default catalogue.
  },
  csp: { imgHosts: ["https://res.cloudinary.com"], connectHosts: ["https://api.cloudinary.com"] },
  trustProxy: { hops: 0 }, // or { vercel: true } — see "Required environment variables"
});
```

### 2. Implement `AuthDbAdapter`

`AuthDbAdapter<TTx>` (see `./adapter`) is the one interface you implement
against your database. The package's own reference implementation is a
Prisma adapter — copy the shape from this repo's `lib/auth/prisma-adapter.ts`
(every method is a small, direct Prisma call; see the schema above for the
tables it reads). `withTransaction` is the one method every other
transactional call (RBAC's `replaceMatrix`, MFA's `issueChallenge`) goes
through, so your audit-write closure can run inside the same transaction as
the mutation it is auditing.

### 3. Wire Auth.js with `createAuthConfig`

```ts
// lib/auth/config.ts
import "server-only";
import NextAuth from "next-auth";
import { after } from "next/server";
import { createMfa, createSessionStore, ensureBootstrapOwner, resolveCookieName } from "@sahan-sac/auth-kit";
import { createAuthConfig } from "@sahan-sac/auth-kit/next-auth";
import { authKit } from "./kit";
import { myAdapter } from "./adapter";
// ... your own kv, limit(), audit(), email sender, env resolution

const production = process.env.NODE_ENV === "production";
const sessionStore = createSessionStore({ adapter: myAdapter, kv, authSecret: AUTH_SECRET });
const mfa = createMfa({ adapter: myAdapter, authSecret: AUTH_SECRET, limit, sendEmail, audit, renderMfaCode });

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(() =>
  createAuthConfig({
    adapter: myAdapter,
    authSecret: AUTH_SECRET,
    keyPrefix: authKit.keyPrefix,
    sessionCookieName: authKit.sessionCookieName(production),
    loginPath: authKit.paths.login,
    defaultRole: authKit.superRole, // or any safe fallback role
    authTrustHost: false,
    authDebug: false,
    production,
    sessionStore,
    mfa,
    after,
    bootstrap: () => ensureBootstrapOwner(myAdapter, () => seedOwner(), log),
    loginFailureWindowSeconds: authKit.limits["login:acct"].windowSeconds,
    loginFailureMaxAttempts: authKit.limits["login:acct"].max,
    limit,
    failures: { reserve: (key, windowSeconds) => kv.incr(key, windowSeconds), clear: (key) => kv.del(key).then(() => undefined) },
    audit,
    warn: (message, fields) => log.warn(message, fields),
    sendKnownDeviceEmail: async (input) => { /* ... */ },
  })
);
```

### 4. `proxy.ts` (middleware) integration

The proxy makes **optimistic** checks only (cookie presence/signature,
never a database read) and is not the authority — see step 5. Import
`isUnlockSecret`, `signUnlockCookie`, `verifyUnlockCookie`,
`unlockCookieOptions`, `unlockKeysFromEnv` from the root, `limit`/rate
buckets from `./cache`, `buildCsp`/`generateNonce`/`shouldBlockAdminByAllowlist`/`clientIp`/`isAllowedOrigin`/`isScannerPath`/`parseOriginList` from
`./security`, and `getToken` from `next-auth/jwt` with
`cookieName: authKit.sessionCookieName(production)` (and the same value as
`salt`). This repo's own `proxy.ts` is the fullest worked example.

### 5. DAL usage in Server Components / Server Actions / route handlers

```ts
// lib/auth/dal.ts
import "server-only";
import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createAuthDal } from "@sahan-sac/auth-kit/session";
import { auth } from "./config";
import { getRolePermissions } from "./rbac";
import { getSessionState, touchSession } from "./session-store";
import { authKit } from "./kit";

export const { getOptionalUser, requireUser, getSessionStatus, hasPermission, requirePermission } = createAuthDal({
  auth, getSessionState, touchSession, getRolePermissions, notFound, redirect, after,
  expirePath: authKit.paths.expire,
  accountPasswordChangePath: authKit.paths.accountPasswordChange,
});
```

**The `notFound()`-not-403 rule**: `requirePermission`/`requireUser` call
`notFound()` (never throw/return a 403) when a session is missing or a
permission is absent — an unauthorized admin surface must never confirm it
exists. Apply the same rule to every `app/api/admin/*` route you write by
hand: check the permission, `return notFound()` on failure, *then* do the
route's real work.

### 6. RBAC matrix admin

`createRbac({ adapter, kv, kit: authKit, writeAudit })` gives you
`loadMatrix`, `getRolePermissions`, `roleCan`, `invalidateMatrix`, and
`replaceMatrix(matrix, updatedById, auditEvent)` — the last one deletes every
editable role's rows, inserts the new ones, and writes the audit row, all
inside one `adapter.withTransaction`, then drops the cache. Pure helpers
(`matrixFromRows`, `defaultMatrix`, `matrixToRows`, `diffMatrix`,
`validateMatrix`, `can`) live in `./rbac` and all take `authKit` (or a
`Pick` of it) as their first argument.

### Runtime roles

Roles are rows in the `roles` table (`name`, `label`, `description`,
`rank`, `system`), so an admin can add one without a deploy. The super role is
still named in code (`superRole`) and holds every permission there, so no
stored row can lock the owner out. Pass `loadRoles` (every role name, cached by
your app) to `createRbac` and the matrix covers the stored roles; a role the
matrix does not know holds nothing.

`createRoleCatalog(rows, superRole)` from `./rbac/roles` answers the
hierarchy from one load: `canManage(actor, target)` (never yourself; the super
role manages everyone, anyone else only strictly higher ranks) and
`assignable(actorRole)`. `checkRoleInput` validates a new or edited role (name
`^[A-Z][A-Z0-9_]{1,31}$`, label, description, rank 1 to 1000).

`SUPER_ADMIN_ROLE` is a built-in row at rank 5: only the super role (rank 0)
manages or assigns it, and it manages every role ranked above it. Fix its
permissions in code with `fixedGrants` in `defineAuthKit`, for example every
permission except the ones you keep for the super role. `matrixFromRows`
ignores stored rows for a fixed role, `matrixToRows` stores none and
`validateMatrix` refuses anything outside its list, so no matrix edit widens
or narrows it.

### Step-up codes

An emailed code with purpose `STEP_UP` confirms one sensitive action. Issue
it with `issueChallenge({ ..., purpose: "STEP_UP" })`, then hand the browser
`signStepUp(secret, userId, { challengeId, action })` instead of the bare
challenge id. When the code comes back, `readStepUp(secret, userId, ticket)`
returns the challenge and the action it was signed for (null if the ticket was
altered or belongs to someone else); verify and consume the code, then do that
action and nothing else. `renderMfaCode` receives the `purpose`, so the
email can say what the code is for.

### Masking the super role

`createMask({ superRole, maskAs }, { global, users })` from `./rbac/mask`
shows super-role accounts to everyone else as `maskAs` (for example
SUPER_ADMIN): globally, or per account through `users.masked`. It is opt-in
and presentation only. Every authorization check keeps the real role; run what
you send to a viewer through `present`, `visibleRoles`, `presentCounts` and
`canSeeAuditBy` on the server. The super role sees through every mask.
`audit_logs.actorRole` keeps the actor's role at the time
(`AuditEvent.actor.role`), so `canSeeAuditBy` hides rows written by the super
role even after a role change. Tell your client in the contract that their
developers' accounts can appear under another role, and audit every toggle.

Upgrading from the `Role` enum (before 0.7): `npx auth-kit db upgrade --apply`
(see "Upgrading the database"). It creates `roles` from the enum values
(ranked 0, 10, 20 in enum order, so the first must be your super role), turns
the three role columns into text with foreign keys and drops the enum.

### 7. MFA flows

`createMfa({ adapter, authSecret, limit, sendEmail, audit, renderMfaCode })`
gives you `issueChallenge`, `verifyChallenge`, `consumeChallenge`,
`challengeOwner`. Sign-in's second step is: `issueChallenge` (from the
`authorize` callback's `mfa_required` result, or from a "resend code"
action) → your UI collects the 6-digit code → `verifyChallenge` → if
`{ ok: true }`, call Auth.js's `signIn("credentials", { challengeId })` (no
password), which reaches `createAuthConfig`'s MFA-second-step branch and
calls `consumeChallenge` for you.

### 8. Session management UI hooks

`createSessionStore` also gives you `listSessions`, `getKnownIps`,
`revokeSession`, `revokeSessions`, `revokeUserSessions`, `forceLogoutAll` — wire these to a
"your sessions" screen and an admin "sessions" screen.

### 9. Rate limits and custom buckets

```ts
// lib/cache/ratelimit.ts
import { createRateLimit } from "@sahan-sac/auth-kit/cache/ratelimit";
import { authKit } from "@/lib/auth/kit";
import { getRedis } from "./redis";

export const { limit, rules: LIMITS } = createRateLimit(authKit.limits, { redis: getRedis(), keyPrefix: `${authKit.keyPrefix}rl:` });
```

Add a new bucket by adding a key to `defineAuthKit`'s `limits` — there is
nothing else to register.

## Better Auth engine

The `./better-auth` subpath layers auth-kit's policy on
[Better Auth](https://better-auth.com) instead of next-auth. Better Auth owns
sign-in, sessions, cookies and routes; the `authKit()` plugin adds:

- the login-unlock gate (`canSignIn` false answers 404 on `/sign-in/email`);
- per-IP and per-account throttling through your own `limit` buckets (429);
- auth-kit's password policy on sign-up, password change and reset (400);
- `auth.login.success` / `auth.login.failure` / `auth.login.challenge` audit events;
- `role` and `mustChangePassword` user fields that clients can never set.

`authKitEmailPassword()` keeps auth-kit's length limits and bcrypt hashes, so
users created under the next-auth engine keep signing in after a switch.

```ts
import { betterAuth } from "better-auth";
import { authKit, authKitEmailPassword } from "@sahan-sac/auth-kit/better-auth";

export const auth = betterAuth({
  database: /* prismaAdapter(...) or drizzleAdapter(...) */,
  emailAndPassword: authKitEmailPassword(),
  plugins: [
    authKit({
      canSignIn: (headers) => hasValidUnlockHeader(headers),
      limit: (bucket, key) => rateLimit(bucket, key),
      audit: (event) => writeAuditRow(event),
    }),
  ],
});

// Server code: the signed-in user in auth-kit's shape, or null.
const session = await readBetterAuthSession(auth, request.headers);
```

## Engines: one import

`authorize`, the session store, the DAL and the tables are the same on both
engines. Only the session issuer differs: next-auth signs a JWT pointing at the
`user_sessions` row, Better Auth writes the row's `token` column (as a
SHA-256, never the cookie value) and sets a cookie. An app picks the engine in
two imports and installs only that engine's package.

```ts
// lib/auth/engine.ts (server only)
import { createAuthEngine } from "@sahan-sac/auth-kit/engines/better-auth"; // or /engines/next-auth

export const engine = createAuthEngine({
  signIn: signInDeps, // createAuthorize's deps: adapter, sessionStore, mfa, limit, audit, ...
  database: { prisma }, // or { drizzle: db } on a pg/Neon Pool, or { pool }; next-auth ignores it
  production,
  sessionCookieName: authKit.sessionCookieName(production),
  loginPath: authKit.paths.login,
  defaultRole: authKit.superRole,
  origins: ["https://example.com", "https://www.example.com"],
});

export const { sessionSource, checkPasswordFingerprint, signIn, signOut, keepSessionAfterPasswordChange } = engine;

// lib/auth/session-cookie.ts (proxy.ts and the expire route read it)
import { createSessionCookieCheck } from "@sahan-sac/auth-kit/engines/better-auth/cookie"; // or /engines/next-auth/cookie
export const { sessionCookies, hasSessionCookie } = createSessionCookieCheck({ cookieName, secret: process.env.AUTH_SECRET });
```

`signIn({ email, password })` or `signIn({ challengeId })` answers null (the
cookie is set) or `{ code: "invalid" | "limited" | "mfa_required" }`.
`signOut(to)` clears the cookies and redirects; revoke the row with the
session store first. Pass `sessionSource` and `checkPasswordFingerprint` to
`createAuthDal`. The `/api/auth/[...all]` catch-all answers 404 on both
engines: everything runs as server actions, so no auth route is mounted.
next-auth reads `AUTH_TRUST_HOST` and `AUTH_DEBUG` itself (or
`nextAuth: { trustHost, debug }`), so the app's env schema does not change.

### Switching engines

```bash
npx auth-kit engine next-auth           # dry run: lists the imports it would change
npx auth-kit engine next-auth --write   # rewrites them (clean git tree), prints the dependency swap
```

The database needs no change. After the deploy everyone signs in once more:
the other engine's cookie is not read. Passwords, MFA, roles, invites and audit
history are untouched.

### Upgrading the database

`prisma/upgrade.sql` brings a database from any earlier auth-kit version to
the current schema (the shared Better Auth columns, hashed session tokens, the
`roles` table). Every step checks first, so it is safe on a current database
and safe to rerun. It works on one schema: the URL's `schema=` parameter or
`--schema`.

```bash
npx auth-kit doctor                # engine, env, and whether the schema is current
npx auth-kit db upgrade            # prints the SQL
npx auth-kit db upgrade --apply    # runs it (pg, or the app's own prisma CLI)
```

Or run it yourself: `prisma db execute --file node_modules/@sahan-sac/auth-kit/prisma/upgrade.sql`,
`psql "$DATABASE_URL" -f ...`, or as a Drizzle custom migration.

### Better Auth on any server

`createAuthKitBetterAuth({ database, authorize, secret, origins })` from
`./better-auth` builds the same Better Auth instance without Next.js, for Hono
or plain Node (mount `auth.handler`; see below). `withHashedSessionTokens`
and `hashSessionToken` are exported for apps that build their own adapter.

## Hono

`./hono` brings the same rules to a Hono app (Node, Bun, Deno, Workers):

```ts
import { Hono } from "hono";
import { readBetterAuthSession, type KitSession } from "@sahan-sac/auth-kit/better-auth";
import { betterAuthRoute, originGuard, rateLimit, requirePermission, securityHeaders, session } from "@sahan-sac/auth-kit/hono";

const app = new Hono();
app.use(securityHeaders());
app.use("/api/*", originGuard({ siteUrl: process.env.SITE_URL }));
app.on(["GET", "POST"], "/api/auth/*", betterAuthRoute(auth));
app.use("/api/*", session((headers) => readBetterAuthSession(auth, headers)));
app.post(
  "/api/posts",
  rateLimit({ limit: (key) => limiter.limit("posts:ip", key) }),
  requirePermission<KitSession>((s) => rbac.can(s.role, "posts.write")),
  (c) => c.json({ ok: true })
);
```

`originGuard` refuses unsafe methods without a matching Origin (403, or 404
with `status: 404`). For a React Native app, list its scheme in
`nativeOrigins: ["myapp://"]` (see `@sahan-sac/auth-kit-client`). `requirePermission` answers 404 when signed out or not
allowed, so a protected route cannot be told from a missing one.

## API reference

| Subpath | Runtime | Exports |
| --- | --- | --- |
| `.` (root) | Pure/universal | `defineAuthKit`, `AuthDbAdapter` types, `AuditEvent`, `createAuthorize`/`AuthorizeDeps`/`AuthorizeResult`, `ensureBootstrapOwner`, `resolveCookieName`, `SESSION_MAX_AGE_SECONDS`, `verifyCredentials`/`CredentialDeps`, `createToken`/`verifyTokenTag`/`tokenState` (invite/reset links), `signUnlockCookie`/`verifyUnlockCookie`/`isUnlockSecret`/`unlockKeysFromEnv`/`unlockCookieOptions`/`constantTimeEqual`, `hashPassword`/`verifyPassword`, `checkPassword`, `safeCallbackUrl`, `createMfa`, RBAC generics (`isPermission`/`isRole`/`defaultPermissionsFor`/`canBeGranted`/`matrixFromRows`/`defaultMatrix`/`matrixToRows`/`can`/`diffMatrix`/`validateMatrix`/`createRbac`) |
| `./rbac/rules` | Pure/universal (no React) | `can`, `defaultMatrix`, `matrixFromRows`, `matrixToRows`, `diffMatrix`, `validateMatrix` |
| `./rbac/roles` | Pure/universal (no React) | `createRoleCatalog`, `checkRoleInput`, `RoleRecord`, `SUPER_ADMIN_ROLE`, `ROLE_NAME_PATTERN`, `MAX_ROLE_RANK` |
| `./rbac/mask` | Pure/universal (no React) | `createMask`, `Mask`, `MaskState` |
| `./kit` | Pure/universal | `defineAuthKit` and its types (also at root) |
| `./authorize` | Pure/universal | `createAuthorize` — the credentials/MFA decision, without the next-auth error-throwing wrapper |
| `./engines/next-auth`, `./engines/better-auth` | Next.js + that engine | `createAuthEngine(options)`: the same options and the same `AuthEngine` shape on both |
| `./engines/next-auth/cookie`, `./engines/better-auth/cookie` | Edge-safe (proxy) | `createSessionCookieCheck({ cookieName, secret })`: `sessionCookies`, `hasSessionCookie` |
| `./config`, `./next-auth` | Next.js + next-auth | `createAuthConfig`, `InvalidLogin`/`LimitedLogin`/`MfaLogin` (lower level than `./engines/next-auth`) |
| `./prisma` | Any server | `createPrismaAuthAdapter`, `PrismaAuthClient`/`PrismaAuthModels` types |
| `./drizzle` | Any server (drizzle-orm) | `createAuthSchema`, `createDrizzleAuthAdapter`, types |
| `./hono` | Any server (hono) | `securityHeaders`, `originGuard`, `rateLimit`, `session`, `requirePermission`, `betterAuthRoute` |
| `./better-auth` | Any server (Better Auth) | `authKit` plugin, `authKitEmailPassword`, `readBetterAuthSession`; on auth-kit's tables: `authKitSessions` plugin, `authKitDatabaseOptions`, `AUTH_KIT_DISABLED_PATHS`, `betterAuthSessionSource`, `signInRefusal`; types |
| `./session` | Next.js (`next/navigation`, `next/server`) | `createAuthDal`, `createSessionStore`, `createSessionReader`, `evaluateSession`, `passwordFingerprint`, types |
| `./security` | Mixed — `request-device` needs `next/headers` | `clientIp`, allowlist functions, `isAllowedOrigin`/`parseOriginList`, `buildCsp`/`generateNonce`, `SECURITY_HEADERS`, `isScannerPath`, `checkOrigin`, `requestDetails` |
| `./cache` | Server (any runtime) | `MemoryKv`, `createRateLimit`/`MemoryLimiter`/`UpstashLimiter`, `RedisKv`/`getRedis`/`getKv`/`kv` |
| `./unlock-request` | `next/headers` | `hasValidUnlock` |
| `./rbac`, `./mfa`, `./adapter`, `./credentials`, `./password`, `./password-policy`, `./invite-token`, `./login-unlock`, `./safe-callback-url`, `./constants`, `./bootstrap`, `./audit-event` | Pure | As above / self-explanatory from the source |
| Fine-grained `./security/*`, `./cache/*` | — | Every module above is also reachable individually, for a bundler that wants the smallest possible import |

Only `.` (root), `./kit`, `./rbac`, `./mfa`, `./adapter`, `./credentials`,
`./password*`, `./invite-token`, `./login-unlock`, `./safe-callback-url`,
`./constants`, `./bootstrap`, `./audit-event`, `./authorize` are
safe to import from a Client Component or a plain (non-Next.js) test runner
— `./session`, `./security` (specifically `request-device`), `./cache` and
`./unlock-request` are Next.js/server-only and must stay at their subpath.
No entry except the engine subpaths imports `next-auth` or `better-auth`, so
an app installs only the engine it uses (a package test enforces this).

## Security checklist for production

- [ ] `AUTH_SECRET` is set and long (32+ random bytes, base64 or hex) —
      have your app refuse to boot in production without one.
- [ ] `TRUSTED_PROXY_HOPS` is set correctly for your reverse-proxy topology,
      or `trustProxy.vercel` is explicit in `defineAuthKit` on Vercel — an
      unconfigured value means every rate limit and the IP allowlist share
      one `"unknown"` bucket.
- [ ] Upstash Redis (`UPSTASH_REDIS_REST_URL`/`_TOKEN`) is configured in any
      serverless/multi-instance deployment — the in-memory fallback is
      per-instance and does not enforce anything across instances.
- [ ] Cookies are `__Host-`-prefixed in production (`resolveCookieName`,
      already wired into `sessionCookieName`/`unlockCookieName` on the
      resolved kit) — confirm `NODE_ENV=production` is actually set where
      you deploy.
- [ ] Your deployment is served over HTTPS (`__Host-` cookies and `Secure`
      require it; the login unlock and session cookies quietly stop working
      over plain HTTP in production mode otherwise).
- [ ] Every `app/api/admin/*` route and Server Action checks its permission
      and answers `notFound()`, not 403, on failure.

## Versioning and publishing

```bash
pnpm --filter @sahan-sac/auth-kit typecheck
pnpm --filter @sahan-sac/auth-kit test
pnpm --filter @sahan-sac/auth-kit build   # emits dist/, runs prepublishOnly's checks again on publish
npm login                                          # interactive; requires access to the sahan-sac org
pnpm --filter @sahan-sac/auth-kit publish --access restricted
```

`pnpm pack --dry-run` (run from `packages/auth-kit` after `build`) should
list only `dist/**`, `README.md` and `package.json`.

Bump `version` in `package.json` following semver; this package has no
automated changelog yet (see below).

## Changelog

### 0.1.0 — unreleased

Initial extraction from the Sahan portfolio/admin app into a standalone,
installable package: `defineAuthKit` config surface, generic RBAC, a tsup
ESM + `.d.ts` build, and the full QA pass described in this repository's
`docs/plan/` history (dependency fixes, entry-point split, idempotent
bootstrap seeding, an MFA re-verify fix, `__Host-` cookies, configurable
CSP/rate-limit/IP-trust, and unit tests for every stateful factory).
