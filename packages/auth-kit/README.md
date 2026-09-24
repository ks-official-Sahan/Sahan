# @ks-official-sahan/auth-kit

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
  `revokeSession`, `revokeUserSessions`, `forceLogoutAll`, all of which drop
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
  scanners from ever seeing a login form.
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
npm install @ks-official-sahan/auth-kit next-auth@5.0.0-beta.32 next react
```

This package is published under a **private, restricted** scope
(`@ks-official-sahan`). Installing it requires:

1. A paid npm organization plan for `ks-official-sahan` (private scoped
   packages are not available on npm's free tier).
2. An npm auth token with read access to that org in your `.npmrc`:
   ```
   //registry.npmjs.org/:_authToken=${NPM_TOKEN}
   @ks-official-sahan:registry=https://registry.npmjs.org/
   ```

### Peer dependencies

| Package | Version |
| --- | --- |
| `next` | `^16.3.5` |
| `next-auth` | `5.0.0-beta.32` |
| `react` | `^19.0.0` |

`react` is a peer because `createRbac` and `createAuthDal` use `react`'s
`cache()` to memoize one database read per request/render.

## Required environment variables

None of these are read by this package directly (see "Secrets are
parameters" above) — this is the list your app needs to resolve once and
pass into the factories below.

| Variable | Used for |
| --- | --- |
| `AUTH_SECRET` | JWT signing, password fingerprints, unlock cookie signing. **Must be long and random** (`assertProductionEnv`-style checks in your own app should refuse to boot without one in production). |
| `ADMIN_LOGIN_UNLOCK_SECRET` | The hidden-login `?secret=` value. |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | First-run owner bootstrap (`ensureBootstrapOwner`) — optional; the app decides how `seedOwner` sources these. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Session-state cache and rate limits. Falls back to an in-memory store/limiter when unset — **fine for a single server, not safe across multiple serverless instances.** Required in any real serverless/multi-instance deployment. |
| `TRUSTED_PROXY_HOPS` | How many of *your own* reverse proxies append to `x-forwarded-for`. `0` (default) means no header is trusted and every caller reads as `"unknown"`. On Vercel this is unnecessary (its own headers are trusted automatically); use `trustProxy` in `defineAuthKit` to make this explicit config instead of environment-implicit. |
| `ADMIN_ALLOWED_ORIGINS` | Extra allowed origins (e.g. preview deployments), comma/whitespace separated. Parse with `parseOriginList` from `./security/origin`. |

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
  role               String    // your own role enum/string
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
import { defineAuthKit } from "@ks-official-sahan/auth-kit/kit";

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
import { createAuthConfig, createMfa, createSessionStore, ensureBootstrapOwner, resolveCookieName } from "@ks-official-sahan/auth-kit";
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
import { createAuthDal } from "@ks-official-sahan/auth-kit/session";
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
`revokeSession`, `revokeUserSessions`, `forceLogoutAll` — wire these to a
"your sessions" screen and an admin "sessions" screen.

### 9. Rate limits and custom buckets

```ts
// lib/cache/ratelimit.ts
import { createRateLimit } from "@ks-official-sahan/auth-kit/cache/ratelimit";
import { authKit } from "@/lib/auth/kit";
import { getRedis } from "./redis";

export const { limit, rules: LIMITS } = createRateLimit(authKit.limits, { redis: getRedis(), keyPrefix: `${authKit.keyPrefix}rl:` });
```

Add a new bucket by adding a key to `defineAuthKit`'s `limits` — there is
nothing else to register.

## API reference

| Subpath | Runtime | Exports |
| --- | --- | --- |
| `.` (root) | Pure/universal | `defineAuthKit`, `AuthDbAdapter` types, `AuditEvent`, `createAuthorize`/`AuthorizeDeps`/`AuthorizeResult`, `ensureBootstrapOwner`, `createAuthConfig`/`AuthConfigDeps`/`InvalidLogin`/`LimitedLogin`/`MfaLogin`, `resolveCookieName`, `SESSION_MAX_AGE_SECONDS`, `verifyCredentials`/`CredentialDeps`, `createToken`/`verifyTokenTag`/`tokenState` (invite/reset links), `signUnlockCookie`/`verifyUnlockCookie`/`isUnlockSecret`/`unlockKeysFromEnv`/`unlockCookieOptions`/`constantTimeEqual`, `hashPassword`/`verifyPassword`, `checkPassword`, `safeCallbackUrl`, `createMfa`, RBAC generics (`isPermission`/`isRole`/`defaultPermissionsFor`/`canBeGranted`/`matrixFromRows`/`defaultMatrix`/`matrixToRows`/`can`/`diffMatrix`/`validateMatrix`/`createRbac`) |
| `./kit` | Pure/universal | `defineAuthKit` and its types (also at root) |
| `./authorize` | Next.js (`next/server`) | `createAuthorize` — the credentials/MFA decision, without the next-auth error-throwing wrapper |
| `./config` | Next.js + next-auth | `createAuthConfig` |
| `./session` | Next.js (`next/navigation`, `next/server`) | `createAuthDal`, `createSessionStore`, `createSessionReader`, `evaluateSession`, `passwordFingerprint`, types |
| `./security` | Mixed — `request-device` needs `next/headers` | `clientIp`, allowlist functions, `isAllowedOrigin`/`parseOriginList`, `buildCsp`/`generateNonce`, `SECURITY_HEADERS`, `isScannerPath`, `checkOrigin`, `requestDetails` |
| `./cache` | `server-only` | `MemoryKv`, `createRateLimit`/`MemoryLimiter`/`UpstashLimiter`, `RedisKv`/`getRedis`/`getKv`/`kv` |
| `./unlock-request` | `next/headers` | `hasValidUnlock` |
| `./rbac`, `./mfa`, `./adapter`, `./credentials`, `./password`, `./password-policy`, `./invite-token`, `./login-unlock`, `./safe-callback-url`, `./constants`, `./bootstrap`, `./audit-event` | Pure | As above / self-explanatory from the source |
| Fine-grained `./security/*`, `./cache/*` | — | Every module above is also reachable individually, for a bundler that wants the smallest possible import |

Only `.` (root), `./kit`, `./rbac`, `./mfa`, `./adapter`, `./credentials`,
`./password*`, `./invite-token`, `./login-unlock`, `./safe-callback-url`,
`./constants`, `./bootstrap`, `./audit-event`, `./config`, `./authorize` are
safe to import from a Client Component or a plain (non-Next.js) test runner
— `./session`, `./security` (specifically `request-device`), `./cache` and
`./unlock-request` are Next.js/server-only and must stay at their subpath.

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
pnpm --filter @ks-official-sahan/auth-kit typecheck
pnpm --filter @ks-official-sahan/auth-kit test
pnpm --filter @ks-official-sahan/auth-kit build   # emits dist/, runs prepublishOnly's checks again on publish
npm login                                          # interactive; requires access to the ks-official-sahan org
pnpm --filter @ks-official-sahan/auth-kit publish --access restricted
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
