# Admin CMS security review — Step 17

Date: 2026-09-22. Scope: everything built in Steps 1–16 of `docs/plan/admin-cms.md`
(auth, RBAC, CMS engine, collections, blog, media, contact pipeline, chatbot,
settings/dashboard/cron/maintenance). Method: direct code read of every admin
Server Action, every `app/api/admin/*` route, `proxy.ts`, and the shared
`lib/auth`, `lib/security`, `lib/cache` modules, plus independent execution of
security-sensitive pure functions against hand-crafted hostile input (not just
each function's own unit tests). `pnpm audit`, `tsc --noEmit`, the full `lib/**`
test suite (688 tests), and a real `next build` were run after every fix below.

## Findings and fixes

### 1. HIGH — origin/CSRF check unreachable for public API routes (fixed)

`proxy.ts`'s maintenance-mode block (`if (!isMaintenanceExempt(pathname, false))`)
covered every non-admin, non-cron path and always returned inside itself —
via the maintenance page, the bypass-cookie redirect, or
`return NextResponse.next()` — before control ever reached the origin/CSRF
check below it. `isMaintenanceExempt` returns `false` for `/api/contact` and
`/api/chat`, so on every request to those routes the origin check never ran,
regardless of maintenance mode being on or off. An off-origin `POST` to
`/api/contact` or `/api/chat` was accepted by the proxy layer; the routes'
own local origin/rate-limit checks (`app/api/contact/route.ts`,
`app/api/chat/route.ts`) were the only defense, and any newly added public
`POST` route would have silently inherited the same gap.

Fix: moved the origin check to run first, before the maintenance block, for
`UNSAFE_METHODS` on `adminPage`, `adminApi`, or `isApi(pathname) && !cronPath`
(`proxy.ts:150-165`). Removed the now-duplicate check that used to run after
the maintenance block. Confirmed via direct execution that
`isMaintenanceExempt("/api/contact", false)` is still `false` — i.e. the class
of request that was previously falling through unchecked is exactly the class
the new origin check now covers unconditionally.

### 2. LOW — non-constant-time secret comparisons (fixed)

`lib/admin/maintenance-bypass.ts`'s `verifyBypassCookie` and
`isValidBypassSecret` each did a manual byte-by-byte loop instead of the
constant-time comparison used everywhere else (`lib/admin/login-unlock.ts`'s
`constantTimeEqual`, which hashes both sides through SHA-256 before
`crypto.timingSafeEqual`, so even the length never leaks). The manual loops
were logically correct (no early return) but duplicated a pattern that
already exists, is already unit-tested, and is safer against length-based
timing attacks — `isValidBypassSecret`'s early `.length` comparison in
particular did leak length before the loop ran.

Fix: both functions now call the shared `constantTimeEqual`. Re-verified by
direct execution: correct secret accepted, wrong secret rejected, tampered
cookie rejected, wrong signing key rejected — see the maintenance-bypass
section of `docs/plan/admin-cms-adr.md`.

### 3. LOW — `deleteInquiry` permission undocumented (fixed)

`lib/actions/leads.ts`'s `deleteInquiry` gates on `manageLeads`, which is
correct (the same permission that gates status/notes/assignee changes,
matching the pattern that a resource's own "manage" permission covers its own
delete unless a delete needs a stronger permission, as blog's `deleteBlog` is
split out because posts are public-facing). The permission table in the ADR's
section 9 didn't list delete under `manageLeads`, so the actual authorization
surface didn't match what the doc described.

Fix: `docs/plan/admin-cms-adr.md` section 9 leads row now reads
`manageLeads` — "status, notes, assignee, delete". No code change; the
gating was already correct.

### 4. LOW — `featureProjectAction` missing admin-page revalidation (fixed)

`lib/actions/works.ts`'s `featureProjectAction` called `invalidate(forCollection("projects"))`
(public cache tags and public paths) but, unlike its sibling
`publishProjectAction`, never called `revalidatePath("/admin/works/projects")`.
The admin projects list could show a stale featured/unfeatured state until
the next unrelated navigation invalidated the route.

Fix: added the missing `revalidatePath("/admin/works/projects")` call,
matching `publishProjectAction` and `deleteProjectAction` in the same file.

## OWASP Top 10 (2021) mapping

- **A01 Broken access control** — every Server Action calls `authorizeAction(permission)`
  (54 call sites across `lib/actions/*`) before touching the database; every
  `app/api/admin/*` route calls `hasPermission(user, permission)` and returns
  `notFound()` (never 403) on failure, so an unauthorized admin request is
  indistinguishable from a missing route. IP allowlist and unlock-cookie/session
  checks run in `proxy.ts` ahead of the page/action. Finding 1 above was an
  access-control gap on the proxy's CSRF layer, now closed.
- **A02 Cryptographic failures** — secrets are read once from `env` at the
  route/action boundary and passed as explicit parameters into pure signing/
  verification functions (`lib/auth/invite-token.ts`, `lib/media/signature.ts`,
  `lib/admin/login-unlock.ts`, `lib/admin/maintenance-bypass.ts`); none of
  them read `process.env` internally, so every code path is testable and
  auditable without a live secret. All comparisons of secret material are
  now constant-time (finding 2). No secret literal fallbacks exist (fixed in
  Step 14 for the contact route's IP hash).
- **A03 Injection** — Prisma parameterizes all queries; no raw SQL in
  application code. Rich text is sanitized with one shared allowlist
  (`lib/cms/rich-text.ts`) applied on both write and read, so a value already
  in the database is never trusted as pre-sanitized. CSV exports
  (`app/api/admin/export/*`) use the existing formula-injection guard on any
  cell starting with `=`, `+`, `-`, `@`.
- **A04 Insecure design** — the AI provider chain (`lib/ai/providers.ts`) and
  the chatbot's prompt-injection guard (`lib/ai/guard.ts`, `lib/chatbot/guard.ts`)
  never interpolate caller-controlled text into the system prompt; untrusted
  text is fenced between unforgeable delimiters and treated only as data.
  Chatbot output is filtered through an exact-hostname allowlist (fixed from
  a substring-match bypass during Step 15) before any URL or contact address
  reaches the visitor.
- **A05 Security misconfiguration** — `proxy.ts` sets a nonce-based CSP for
  every admin response (`withCsp`), `Cache-Control: no-store` on every
  authentication-adjacent response, and `X-Robots-Tag: noindex, nofollow` on
  admin and locked pages. Maintenance mode and the IP allowlist both fail
  safe (maintenance defaults to off, allowlist defaults to open) on a KV read
  failure rather than fail closed, which is a deliberate choice recorded in
  the ADR (R22/R26) to avoid a silent full lockout.
- **A06 Vulnerable components** — `pnpm audit --prod` found 2 high +
  1 moderate advisory, all in `mysql2`/`deepmerge-ts`, transitive dependencies
  of the `prisma` CLI (a devDependency; the app connects to Postgres only,
  via `@prisma/adapter-neon`, and never loads the MySQL driver at runtime).
  `sharp`, a direct production dependency used by Next's image optimizer,
  was on 0.33.5 with 2 high advisories (libheif); bumped to 0.35.4, patched,
  rebuilt clean.
- **A07 Identification and authentication failures** — passwords hashed with
  the project's existing password hashing (unchanged from Step 4); MFA
  (Step 7); session cookies signed and checked optimistically in the proxy,
  with the database as the actual authority per request (`lib/auth/dal.ts`);
  unlock and invite-token flows both rate-limited (`lib/cache/ratelimit.ts`)
  and constant-time compared.
- **A08 Software and data integrity failures** — no dynamic `eval`/`Function`
  construction from user input found; AI-generated content (blog drafts,
  cover images) is always written as a draft requiring an explicit publish
  action gated by `publishBlog`/`publishCollections`, never auto-published.
- **A09 Security logging and monitoring failures** — every mutating action
  writes an `AuditLog` row inside the same transaction as the mutation
  (`lib/audit`), so a failed transaction never logs a mutation that didn't
  happen. Refused unlocks, refused maintenance bypasses, and allowlist blocks
  all call `log.warn` with the caller IP.
- **A10 Server-side request forgery** — the only outbound calls to
  caller-influenced URLs are the AI provider fetches, which go to fixed,
  hardcoded provider endpoints (never a URL built from user input), and
  Cloudinary signed uploads, which use the SDK's own upload endpoint.

## CSRF

Covered by finding 1: unsafe methods (`POST`/`PUT`/`PATCH`/`DELETE`) on
`/admin/*`, `/api/admin/*`, and any other `/api/*` path except `/api/cron/*`
now go through `isAllowedOrigin` in `proxy.ts` before anything else runs,
regardless of maintenance mode. Cron routes are excluded because they're
invoked by the platform's scheduler, not a browser, and are gated by a
separate secret check inside each cron route instead.

## IDOR

Every admin Server Action that operates on a specific record (`id` from
`FormData`) re-fetches that record from the database by `id` inside the
action, uses the fetched row as the audit `before` state, and relies on
`authorizeAction`'s coarse-grained permission model (role → permission, not
row-level ownership) — the CMS has no per-record ownership concept, so a
successful permission check is by design sufficient for every collection,
blog, media, and lead action. No route or action was found that trusts a
client-supplied `id` to scope a query without also checking permission first.

## Rate limits

`lib/cache/ratelimit.ts`'s `limit(bucket, key)` guards: admin unlock
(`unlock:ip`), maintenance bypass (`maintenance:ip`), and the public
`/api/contact` and `/api/chat` routes independently of the proxy's origin
check. Documented fail-open/fail-closed behavior per bucket is in the ADR
section 6.7 and was not changed by this review.

## Headers

CSP with a per-request nonce on every admin response; `Cache-Control: no-store`
on auth-adjacent responses; `X-Robots-Tag: noindex, nofollow` on admin and
locked pages; maintenance page adds `Retry-After: 3600` and
`X-Robots-Tag: noindex, nofollow, nocache`.

## Dependency audit

`pnpm audit --prod`: 2 high (sharp, fixed by upgrade) + 2 high and
1 moderate (mysql2/deepmerge-ts, transitive to the `prisma` devDependency,
not present in the runtime bundle) at review time. No advisory affects a
package this application actually loads at runtime after the sharp bump.

## Left for the owner (environment constraints)

- **E2E browser flows** (unlock → sign in, MFA, invite acceptance, content
  edit → public page, blog publish, media upload, contact submit, session
  revoke): this environment's browser pane could not accept a session cookie
  minted outside the browser in earlier steps (see the `sahan-prod-e2e-recipe`
  memory pattern), so admin-flow verification throughout Steps 9–16 was done
  via minted-session HTTP requests and direct function execution instead of a
  Playwright suite. The same limitation applies here; `e2e/*.spec.ts` was not
  produced. A real browser pass through unlock, sign-in, MFA, and the content/
  blog/media/contact flows is left for the owner.
- **Lighthouse** on the five public pages: not run in this environment (no
  running production server to point Lighthouse at outside the owner's own
  infrastructure). The production build above completed cleanly with no new
  client-bundle regressions from Step 17's changes (proxy.ts and
  lib/admin/maintenance-bypass.ts are server-only; lib/actions/works.ts is a
  Server Action file).
- **Live external services** (Cloudinary, the AI provider chain, real mail
  send): consistent with every prior step, these need real credentials this
  environment doesn't have and are left for the owner, as already noted in
  the ADR's Step 11–16 results.

## Verification run after all fixes

- `tsc --noEmit`: clean.
- `eslint` on every changed file: clean.
- `node --test` over `lib/**/*.test.ts`: 688/688 pass, 0 fail.
- `next build`: compiles clean, full route manifest printed, no server/client
  boundary errors.
- `pnpm audit --prod`: sharp advisories resolved; remaining advisories are in
  a devDependency's transitive graph, not the runtime bundle.
