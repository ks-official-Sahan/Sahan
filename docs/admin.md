# Admin panel: operator guide

This is for whoever runs the site day to day: the owner or a developer
setting up a new environment. For the design and the reasoning behind every
rule below, see `docs/plan/admin-cms-adr.md`. For the last security pass, see
`docs/plan/admin-cms-security-review.md`. The public read-only API is described
in [`docs/headless-api.md`](headless-api.md).

The page editor, blog, projects, experience, services and skills are backed by
the CMS. Collection mutations invalidate the public pages, headless API and
cached reads that use the changed collection.

## First-time setup

1. Copy `.env.example` to `.env.local` and fill in at least `DATABASE_URL`
   plus every variable marked `(admin)`. Run
   `pnpm exec tsx scripts/check-env-example.mts` any time you add a new
   variable to `lib/env.ts` — it fails if `.env.example` and the code
   disagree, and it never prints a value.
2. `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` seed the first owner
   account (role `DEVELOPER`). The password is temporary — change it on
   `/admin/account` on first sign-in.
3. `AUTH_SECRET`, `INTERNAL_SIGNING_SECRET`, `MEDIA_SIGNING_SECRET`,
   `MAINTENANCE_BYPASS_SECRET`, `ADMIN_LOGIN_UNLOCK_SECRET`, `CRON_SECRET`:
   random values, at least 32 characters (the two unlock/bypass secrets can
   be as short as 12). Generate with `openssl rand -base64 32` or similar.
   Production refuses to start with a missing or short value once
   `DATABASE_URL` is set. `MAINTENANCE_BYPASS_SECRET`,
   `ADMIN_LOGIN_UNLOCK_SECRET`, `MEDIA_SIGNING_SECRET` and `CRON_SECRET` are
   optional: each feature is off while its secret is unset.
4. Apply the checked-in Prisma schema to the dedicated `sahan` schema with
   `pnpm db:push`. This repository does not keep Prisma migration history;
   review the proposed schema changes before accepting them. Never point
   `DATABASE_URL` at a shared schema.
5. To initialize the works collections from the checked-in defaults, run
   `pnpm db:seed-collections`. It is idempotent and fills only empty
   collections. It seeds projects, experience, services and skills; review
   the content before running it against a database that already has editorial
   data.

## Unlock and sign in

The admin panel is hidden behind two independent gates, both enforced in
`proxy.ts` before any page renders:

1. **Unlock.** `/admin` answers a 404-shaped "locked" page to anyone without
   a valid unlock cookie. Get one by visiting
   `https://<site>/admin?secret=<ADMIN_LOGIN_UNLOCK_SECRET>` once — the query
   string is stripped and a signed, httpOnly cookie is set for 2 hours.
   Unlock attempts are rate-limited per IP; repeated wrong secrets lock you
   out for a while. With `ADMIN_LOGIN_UNLOCK_SECRET` unset this gate is off:
   `/admin/login` is public and only the sign-in gate below applies.
2. **Sign in.** Once unlocked, `/admin/login` is a normal email + password
   form (plus MFA if the account has it turned on, from `/admin/account`).
   A wrong password does not reveal whether the email exists.

**Sign-in links** unlock the login page without the secret ever being in a
URL. Copy one from **Account → Sign-in link** (or **Users → Sign-in link**
to send a team member), bookmark it, or use the **Sign in again** button in
the "signed out" email. A sign-in link looks like `https://<site>/s/<code>`;
opening it sets the same 2-hour unlock cookie and goes to `/admin`. It does
not sign anyone in. Links last `ADMIN_SIGN_IN_LINK_DAYS` days (default 14,
at most 90) and cannot be revoked one by one: rotating
`ADMIN_LOGIN_UNLOCK_SECRET` (or `AUTH_SECRET`) ends every link at once.
The new-inquiry email's "Open in the admin" button is a sign-in link too.

Emailed and copied account links are short as well: `/a/<token>` for
invitations and password resets, `/e/<token>` for email-change
confirmations. Each redirects to its page (`/admin/set-password`,
`/admin/confirm-email`) after the proxy checks the token's signature; links
in the old long form still work until they expire. The one-letter paths
`/a`, `/e` and `/s` are reserved, so no public page may use them.

**Copies of account emails.** With `EMAIL_CC` set (comma separated) and
**Settings → Email routing → Copy account emails** on, every invitation,
new-account and password-reset email also goes to those addresses as a
copy marked "Copy:", with every link left out: an invite or reset link lets
whoever holds it take the account, so only its recipient gets it. The copy
is sent after the original is delivered and never delays the action.
Invitation, new-account and reset emails also carry a sign-in link, so the
recipient can find the login page later.

**Creating a user.** "Create user" emails the single-use invitation link by
default, so the person sets their own password. The other choice, "Show me a
one-time password", generates a password, shows it to you once (copy it then)
and never emails it; the person must change it at first sign-in. Nobody types
a password for someone else.

**Which domain links use.** Every emailed or copied link (invites, resets,
sign-in links, the new-inquiry button) uses the first domain in `SITE_URLS`
that answers `/api/health` as this app; if none does yet (for example a
deployment from before the route existed), the first that answers at all;
otherwise the first listed. Unset, the list is `SITE_URL`, then
`https://sahansachintha.com`, then `https://sahansachintha.vercel.app`. The
answer is cached for five minutes (one minute when no domain is healthy) in
Redis, so one probe serves every instance. The request's own Host header is
never used.

If you're locked out of both (secret lost, cookie expired, no browser
access), see "Break-glass" below.

### Second factors

**Account → Authenticator app, passkeys and recovery codes** sets up the
strong factors. With one of them, signing in asks for it after the password:

- **Authenticator app:** a 6-digit code (TOTP). Scan the QR code, then
  confirm with a code. Each code works once.
- **Passkey:** fingerprint, face, device PIN or a security key. Passkeys work
  on `https://sahansachintha.com` (and `www.`) in production and on
  `http://localhost:3000`/`3001` in development, not on the `*.vercel.app`
  domains.
- **Recovery codes:** ten single-use codes, shown once when the first strong
  factor is added. Make new ones from the same section; the old ones stop
  working.

At sign-in, the second step shows a tab for each method the account set up
(passkey, authenticator app, emailed code); the browser remembers the last
one picked. The emailed code is sent only when chosen. Recovery codes sit
behind **Can't use these?**, and are offered on their own after two wrong
tries.

**Passkey sign-in** (Settings → Passkey sign-in, `DEVELOPER` only, off by
default) adds **Sign in with a passkey** to the sign-in page. The browser lists
the passkeys saved on the device for this site and each person picks their own,
so a shared device works. The passkey must check a fingerprint, face or device
PIN, so it replaces both the password and the second step, and counts as strong
MFA. The unlock cookie, a per-address limit (`passkey-sign-in:ip`), the
disabled-account check, the new-device email and the audit log still apply.
Passkeys added before this change may not be discoverable; add them again if
the browser does not offer them.

Removing a factor or making new recovery codes asks for the password again.

A `DEVELOPER` can reset someone else's second factors from **Users → (user) →
Second factors**: the authenticator app, one passkey, the recovery codes, or
everything. It asks for the developer's own password, signs the person out
everywhere when an app or passkey goes, and emails them. A `DEVELOPER` or
`SUPER_ADMIN` left without an app or passkey must set one up again before using
the admin. **Sign out everywhere** in the same sheet ends sessions without
touching the factors.
Adding the first strong factor signs out every other session.

`DEVELOPER` and `SUPER_ADMIN` must have an authenticator app or a passkey
(`strongMfaRoles` in `lib/auth/kit-config.ts`):

- Until they add one, the account page is the only page they can open, and
  actions and admin API routes refuse them.
- Everyone, these roles included, may still choose the emailed code at
  sign-in while "Two-factor sign-in" is on in the account page.

## Auth engine

Sign-in runs on Better Auth through auth-kit (`lib/auth/engine.ts`).
auth-kit's `authorize` still decides who gets in (lockout, IP limits, emailed
codes, known-device email, audit); Better Auth only issues the session, a
`user_sessions` row whose `token` is the SHA-256 of the session cookie. No Better Auth
route is mounted: sign-in and sign-out are server actions calling
`auth.api`, and `/api/auth/*` other than `expire` and `session-status`
answers 404. Everything else reaches the engine through
`lib/auth/engine.ts` and `lib/auth/session-cookie.ts`. To switch to next-auth,
run `node packages/auth-kit/bin/auth-kit.mjs engine next-auth --write` (after
`pnpm --filter @sahan-sac/auth-kit build`), then swap the `better-auth`
dependency for `next-auth`; the database stays as it is and everyone signs in
once more.

## Roles and permissions

Roles are rows in the `roles` table, managed at **Roles and permissions**
(`/admin/roles`, DEVELOPER and SUPER_ADMIN). Four are built in and cannot be
deleted: `DEVELOPER` (rank 0: every permission, in code, so no edit can lock
the owner out), `SUPER_ADMIN` (rank 5, see below), `MANAGER` (rank 10) and
`EDITOR` (rank 20). **Add a role**
takes a name (capital letters, digits, underscores; fixed once created), a
label, a description and a rank from 1 to 1000, and starts with no
permissions: tick them in the matrix below it.

The rank is the hierarchy: a role manages, invites and assigns only roles
with a higher rank number, never its own rank or above. A custom role at 30
sits below Editor; one at 15 sits between Manager and Editor. A role can be
deleted once nobody holds it, and deleting it cancels its open invitations.
Role and matrix changes are audited (`role.created`, `role.updated`,
`role.deleted`, `rbac.matrix.updated`) and apply within a minute
(cached in Redis for 60 seconds, dropped on every change).

The rule that doesn't change: every Server Action and every
`app/api/admin/*` route checks a permission before doing anything, and a
missing permission looks like a missing page (404), never a 403 — an
unauthorized admin surface should never confirm it exists.

**Upgrading the database after an auth-kit update**: run
`pnpm exec prisma db execute --file packages/auth-kit/prisma/upgrade.sql`
before deploying the new code (`auth-kit doctor` says whether it is needed).
It converts the old `Role` enum, adds the shared session columns and ends any
session still storing a raw token, keeps every other row, and does nothing on
a second run. Older code cannot write roles to a converted database, so
deploy right after.

## Super admins

`SUPER_ADMIN` is the client's top role. Only a developer can give it, and its
permissions are fixed in code (`FIXED_GRANTS` in `lib/auth/kit-config.ts`),
so no matrix edit widens or narrows them: every permission except clearing
the cache, running cron jobs, security status and integration health, the IP
allowlist, and training or switching the chatbot (`manageChatbotTraining`;
it still sets the tone and greeting). Its rank keeps it from managing,
signing out or deleting developers and other super admins, and in the matrix
it changes only roles ranked below it, granting only what it holds.

After deploying this release run the database upgrade and then
`pnpm db:seed`, which adds the SUPER_ADMIN row and gives
`manageChatbotTraining` to every role that held `manageChatbot`.

## Add a user

`/admin/users` → "Invite user" (needs `inviteUser`; an `EDITOR` account, if
you have one with elevated invite rights, can only invite other `EDITOR`s).
The invite is a one-time signed link, expires, and the new user sets their
own password on first use — nobody ever sees or sets another person's
password directly. To change an existing user's role or disable them, use
the same page (`manageUsers`); the system refuses to demote, disable or
delete the last enabled `DEVELOPER`, so you can't lock yourself out of user
management entirely.

## Restore a content version

Every CMS section (`ContentBlock`) and every collection publish keeps its
previous versions. On the section's edit page, open version history and pick
"Restore" on the version you want back — this writes a new draft from that
version's data (never a hard rewrite of history) and still runs the same
publish flow, so publishing the restored draft is a separate, explicit step.
If the version no longer passes the current schema (a field was added since
it was saved), the restore is refused with a message saying so, rather than
silently dropping data.

## Rotate a secret

All of the secrets in `.env.example`'s "Auth and signing" block can be
rotated independently, at different costs:

- `AUTH_SECRET`: rotating this signs everyone out (all sessions, all unlock
  and bypass cookies become invalid) and invalidates every outstanding
  invite/reset link. Use it if you suspect a session or link leaked.
- `MEDIA_SIGNING_SECRET`: rotating this invalidates every signed `/media/*`
  URL currently cached or shared (browsers, CDNs). Public pages regenerate
  new signed URLs on their next render; nothing breaks, but any externally
  saved media link stops working.
- `MAINTENANCE_BYPASS_SECRET`, `ADMIN_LOGIN_UNLOCK_SECRET`: rotating either
  signs everyone out of that specific bypass/unlock cookie only. Rotating
  `ADMIN_LOGIN_UNLOCK_SECRET` also ends every sign-in link (`/s/...`). Do this on
  its own schedule, or immediately if the secret leaked (e.g. pasted in the
  wrong chat).
- `CRON_SECRET`: rotate on Vercel and in `.env.local`/the deployment's env
  vars together — the two values must match, or every scheduled cron call
  starts failing its own auth check (fails closed, so nothing runs instead
  of running unauthenticated).
- `INTERNAL_SIGNING_SECRET`: used for internal HMACs (e.g. the contact form's
  IP hash). Rotating it just means IP hashes from before the rotation no
  longer match hashes computed after — low-stakes, rotate whenever.

General rule: every secret is read once from `env` at the route/action
boundary and passed as an explicit parameter into the function that uses it
(never read from inside a shared pure function) — so rotating a secret never
requires a code change, only an env var change and a redeploy/restart.

### Rotation checklist

Whenever a secret leaks, is due for a scheduled rotation, or an employee
with access leaves:

1. Generate the new value (`openssl rand -base64 32`, or per-secret length
   above).
2. Set it in Vercel's Environment Variables (and `.env.local` for anyone
   running the admin panel locally).
3. Redeploy (or restart the local server) so the new value is read.
4. Confirm the effect matches the table above (e.g. rotating `AUTH_SECRET`
   should sign you out — sign back in to confirm).
5. Note the rotation date somewhere outside this repo (a password manager
   entry, a ticket) — this file intentionally never records when a secret
   was last rotated, since that alone tells an attacker something.
6. If the leak was `CRON_SECRET`, also check `/admin/audit` for any cron job
   run you didn't expect around the leak window.

## Vercel environment setup

Set every `.env.example` variable marked `(admin)` in the Vercel project's
Environment Variables, scoped to Production (and Preview if you want a
working admin panel on preview deployments — set `ADMIN_ALLOWED_ORIGINS` to
include the preview domain pattern if so). `vercel.json` already declares the
daily cron schedules for `/api/cron/{blog-publish,session-cleanup,audit-prune}`;
Vercel calls them with `Authorization: Bearer ${CRON_SECRET}` automatically
once the env var is set — nothing else to configure.

If you're behind Vercel, `clientIp()` reads Vercel's own forwarded-IP header
and needs no extra configuration. Behind any other reverse proxy (a
self-hosted deployment), set `TRUSTED_PROXY_HOPS` to how many of your own
proxies append to `X-Forwarded-For`, or every caller is treated as unknown
and the IP allowlist and per-IP rate limits stop being effective (they fail
open on an unknown IP rather than locking everyone out — see the ADR's R22).
`TRUSTED_PROXY_HOPS` is a count, not a flag: `1` for one nginx in front of
the app. `true` is not a number and is ignored, so it trusts nothing. Never
set it on a deployment that is reachable without going through your proxy,
or callers can forge their IP.

### Upgrade note: `__Host-` cookies

In production the admin session and unlock cookies are named with the
`__Host-` prefix (`__Host-sahan_admin_session`, `__Host-sahan_admin_unlock`),
which the browser only accepts over HTTPS, for the exact host, on `Path=/`.
The first deploy that ships this signs every admin out once, and the unlock
cookie has to be earned again through the unlock link. Nothing else changes;
local development keeps the plain names because it runs on plain HTTP.

## Break-glass for Redis

Rate limits, the maintenance flag, and the IP allowlist are all mirrored
into Upstash Redis (or an in-memory fallback locally) because `proxy.ts` has
no database access. If Redis is down or misconfigured:

- Maintenance mode fails to its safe default: **not** in maintenance. The
  public site stays up; you can't accidentally lock visitors out because
  Redis hiccupped.
- The IP allowlist fails to its safe default: **empty** (no filtering). You
  will not be locked out of `/admin` because Redis is unreachable.
- Rate limits fail per their documented per-bucket mode (ADR section 6.7) —
  most fail open (the action proceeds) rather than blocking real users
  during an outage.

So a Redis outage degrades admin protections rather than causing an outage
of its own. To recover: fix `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
and redeploy or restart; the app re-reads settings from Redis on the next
request, no manual resync needed. Settings themselves live in Postgres and
are never lost — Redis is a cache the proxy layer reads, not the source of
truth.

## Packages

The reusable parts of the admin CMS are packages under `packages/*`,
published to npm with Changesets (see `.changeset/README.md`). The app
wires them together; none of them touches Prisma or React, and only auth-kit
depends on Next.js.

| Package | What it holds | Stays in the app |
| --- | --- | --- |
| `@sahan-sac/auth-kit` | Sessions, RBAC rules, rate-limit buckets, login unlock | Prisma adapter, route handlers, admin UI |
| `@sahan-sac/ai-core` | AI provider adapters and their registry, the fallback chain, model resolution, image generation, prompt guards, the AI env schema and feature switches | `lib/ai/availability.ts` (the switches bound to `getEnv()`) |
| `@sahan-sac/email-kit` | Email providers with fallback, guards, env schema, health, Brevo diagnostics, the layout and redacted CC copies | `lib/email/index.ts` (env and audit wiring), templates, `lib/email/account-mail.ts` |
| `@sahan-sac/blog-kit` | Post, SEO, draft and cover generation, `generateBlogImage` with its `ImageSink` port, Markdown, charts, slugs, revisions | Post schema, queries, rendering (`sanitizeRich`), seed, `lib/ai/image-sink.ts` |
| `@sahan-sac/chat-kit` | `runChat`, chat prompts and output filter, knowledge builder, `ChatStore` contract, visitor cookie | `/api/chat` (origin, rate limits, cookie, storage), `lib/chatbot/{knowledge,session,site}.ts`, the widget |
| `@sahan-sac/media-kit` | Cloudinary client, upload validation, URL signing, delivery transforms, browser upload client | `lib/media/service.ts` (DB rows and audit), `lib/media/cloudinary-client.ts` |

`ai-core`, `blog-kit` and `chat-kit` release together under one version;
`auth-kit`, `email-kit` and `media-kit` are versioned on their own. `chat-kit` never
imports `blog-kit` (blog posts reach the chatbot as a knowledge source), and
`blog-kit` never imports `media-kit` (images go through `ImageSink`).

Feature switches: `ENABLE_BLOG_AI` (off by default) and `ENABLE_CHATBOT`
(on by default) each also need a provider that can answer for them.

**AI providers.** Each request runs a chain: the first provider answers, and
any failure (quota, timeout, bad key, retired model, malformed output) hands
it to the next. Free providers (Gemini, OpenRouter, NVIDIA) run by default;
paid ones (OpenAI, Anthropic, DeepSeek, xAI, Perplexity, a custom
OpenAI-compatible endpoint, Vertex) join only with their key set and
`AI_ALLOW_PAID=true`. `AI_PROVIDER_ORDER` (or `AI_PROVIDER_ORDER_BLOG` /
`AI_PROVIDER_ORDER_CHAT`) picks exactly which providers run and in what
order, for example `AI_PROVIDER_ORDER_CHAT=gemini,anthropic,nvidia`.
**Settings → Integration health** shows each chain ("AI chain (blog)",
"AI chain (chat)") and every provider's key status. AI rows are never checked
automatically, because the only real check is a prompt that spends tokens:
press **Check** on a row to send one short prompt through that provider (or
through the whole chain, showing which provider answered and which fell
through). Checks share the AI tools' rate limit (120 an hour per user) and are
audited as `integration.ai.checked`.

**AI context.** **Settings → AI context** holds standing guidance for the
models: "Everywhere", then "Blog assistant", "SEO suggestions" and
"Chatbot" (up to 6,000 characters each). It is added after each prompt's
fixed rules, so it can set voice and facts but cannot switch off a safety
rule. Never paste secrets into it. In the blog assistant, "Instructions and
references" adds per-post instructions and pasted reference text; links in it
are not opened. With the chatbot off,
the site widget is not rendered, `/api/chat` answers 503, and
`/admin/chatbot` says why.

## Verify everything is configured

- `pnpm exec tsx scripts/check-env-example.mts` — `.env.example` matches
  `lib/env.ts`.
- `/admin/settings` → integration health panel — reports database, Redis,
  Resend, Brevo and Cloudinary as configured/reachable, and the AI providers
  and chains as configured (press Check for reachability),
  never printing a secret or a fragment of one.
- `/admin` dashboard → security status widget — shows MFA state and whether
  any account still has a temporary password.
