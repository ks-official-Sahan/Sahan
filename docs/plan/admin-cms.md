# Admin panel and CMS for the portfolio

Owner: Sahan. Status: steps 1 to 4 done (ADR, foundation, route groups and admin shell, auth core and hidden login), steps 5 to 18 not started. Tick the progress list at the end as steps finish.

## Goal

One private admin at `/admin` that runs the whole portfolio: edit every section of Home, About, Works, Updates and Contact; manage blog posts, media, users, roles, permissions, sessions, settings and the chatbot; audit every change. The public site must keep rendering when the database, Redis or an email provider is down (code defaults in `contents/*.ts` stay as the fallback).

## Reference implementation

`G:/@Valorem/@Web/ValoremAdminPanel` (Next 16, Prisma on Neon, Auth.js v5 credentials + JWT, Upstash Redis, Resend, Cloudinary, TipTap, Vercel AI SDK). Mirror its design and hardening, not its real-estate domain (properties, Property Finder, feed). Files to mirror:

- Auth: `proxy.ts`, `lib/auth/config.ts`, `lib/auth/{permissions,rbac,mfa,session-revocation,session,invite-token,password-policy,rate-limit-ip,safe-callback-url}.ts`, `lib/admin/login-unlock.ts`, `lib/maintenance/access.ts`, `app/admin/login/*`, `app/admin/account/*`, `app/admin/set-password/*`
- Users and audit: `lib/actions/{users,account,set-password}.ts`, `lib/admin/audit.ts`, `app/admin/{users,audit}/*`
- CMS: `lib/cms/*`, `lib/admin/{content-actions,content-pages,section-schemas}.ts`, `app/admin/content/*`
- Blog and AI: `lib/actions/blog.ts`, `lib/blog/*`, `lib/ai/*`, `app/admin/blog/*`, `app/api/admin/blog/*`
- Media: `lib/cloudinary/*`, `lib/admin/{upload,cloudinary-accounts}.ts`, `lib/media/*`, `app/admin/media/*`, `app/media/[...slug]/route.ts`
- Email and contact: `lib/email/*`, `lib/inquiries/*`, `app/api/inquiries/route.ts`
- Chatbot, settings, cron: `lib/chatbot/*`, `lib/ai/public-chat.ts`, `app/api/chat/route.ts`, `app/admin/{chatbot,settings}/*`, `lib/cron/*`, `app/api/cron/*`

## Locked decisions

- **Framework**: Next 16 as installed. `AGENTS.md` applies: read the matching guide in `node_modules/next/dist/docs/` before writing any Next code (`proxy.ts` replaces middleware, caching and tag revalidation, route groups, server actions).
- **Database**: Neon Postgres, database `lakeview`, **schema `sahan` only**. Other schemas in that database belong to other projects: never read, alter or drop them. Never use `prisma migrate reset` or `db push --force-reset`. Prisma CLI needs a direct (non-pooler) URL without `channel_binding` if the CLI rejects it; the runtime uses `@prisma/adapter-neon` with `{ schema: "sahan" }`.
- **Auth**: Auth.js v5 credentials, JWT sessions (24h), bcrypt cost 12, session id and password fingerprint in the token, instant revocation: a Postgres session row is authoritative and Redis caches session state for 30 seconds (ADR D7).
- **Hidden login**: `/admin/login` shows the same neutral 404 page as any unknown route until `?secret=` matches `ADMIN_LOGIN_UNLOCK_SECRET`. The proxy then sets an httpOnly HMAC cookie (2h) and strips the query. Unlock attempts are rate limited per IP. The secret is never sent to client JS.
- **Owner account**: seeded from env (`ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`) as role DEVELOPER, password stored only as a bcrypt hash. The seeded password is temporary: the account page and a dashboard banner push the owner to change it. Seeding never overwrites an existing user's password.
- **RBAC**: roles DEVELOPER > MANAGER > EDITOR, DB-backed permission matrix seeded from the reference defaults, editable in `/admin/roles` by DEVELOPER only. DEVELOPER always keeps every permission and the last DEVELOPER cannot be demoted or deleted. Every server action and API route checks the permission on the server; UI hiding is never the control.
- **MFA**: email one-time code (6 digits, 5 minutes, 5 attempts, single use) like the reference. Turning MFA on or off needs the current password plus a code. Authenticator-app TOTP is out of scope for now.
- **Email**: one `sendEmail` facade. Resend is primary, Brevo SMTP through nodemailer is the fallback. Brevo transactional API is only used for diagnostics: the owner reports its calls return success but mail never arrives, while SMTP delivers. Suspect an unvalidated sender or domain (SPF, DKIM), so the diagnostics read message events from Brevo instead of trusting the 2xx.
- **Content model**: code defaults in `contents/*.ts` remain the fallback. The DB stores versioned, publishable overrides per page and section (`ContentBlock`, as in the reference) plus real collections (projects, experience, services, skills, posts). Public pages read through cached loaders with tags and `revalidateTag` on publish. Seed collections from the current code so day one looks identical.
- **Layouts**: one thin root layout (html, body, theme). The public site moves into the `(site)` route group, whose layout renders navigation, footer, audio and loading screen. `/admin` has its own nested layout with none of them. Public URLs must not change (ADR D1).
- **AI**: blog drafts and chatbot use OpenRouter first, then Gemini, then NVIDIA. Paid OpenRouter models stay off (`OPENROUTER_ALLOW_PAID_MODELS=false`). Untrusted text (posts, visitor messages) is treated as data, never as instructions.
- **Env**: names only in git (`.env.example`). Values live in `.env.local`. The Claude Code OAuth token is not used by the app and must not be stored anywhere in it.

## Environment variable names

Auth and signing: `AUTH_SECRET`, `AUTH_TRUST_HOST`, `AUTH_DEBUG`, `INTERNAL_SIGNING_SECRET`, `MEDIA_SIGNING_SECRET`, `MAINTENANCE_BYPASS_SECRET`, `ADMIN_LOGIN_UNLOCK_SECRET`, `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`.
Data: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_URL`.
Email: `RESEND_API_KEY`, `RESEND_SENDER_EMAIL`, `RESEND_SENDER_NAME`, `RESEND_RECIPIENT_EMAILS`, `RESEND_CC_EMAILS`, `RESEND_BCC_EMAILS`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`, `EMAIL_SENDER_USER`, `EMAIL_BREVO_API_KEY`.
AI: `OPENROUTER_BASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_2`, `OPENROUTER_ALLOW_PAID_MODELS`, `OPENROUTER_MODEL`, `GEMINI_API_KEY`, `NVIDIA_API_KEY`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_TOKEN_URI`.
Added by the ADR: `CRON_SECRET` (bearer token Vercel Cron sends), `SITE_URL` (absolute links in emails), `DIRECT_DATABASE_URL` (optional, Prisma CLI), `ADMIN_ALLOWED_ORIGINS` (optional, comma separated), `EMAIL_PROVIDER` (`auto`, `resend`, `brevo-smtp`, or `capture` in tests only).

Signing and bypass secrets are short today (8 to 10 characters). Enforce a minimum length in `lib/env.ts` (32 for `AUTH_SECRET` and the signing keys, 12 for the unlock and bypass secrets): a console warning in development, a hard startup error in production. Before deploying, replace them with random 32+ character values.

## Rules for every step

- Never print, log, echo or commit a secret. `server-only` on every module that reads one.
- Validate all input with zod. Authorize on the server. Audit every mutation (who, what, before, after, IP, user agent).
- Sanitize any HTML from the CMS or blog before it renders. No unsanitized `dangerouslySetInnerHTML`.
- Constant-time comparison for secrets and codes. Same error text for wrong email and wrong password. Rate limit login, unlock, OTP, contact and chat.
- Admin UI follows the existing tokens and primitives in `style/globals.css`, meets WCAG 2.2 AA, works with keyboard and at 390px.
- Each step ends with `tsc --noEmit` and eslint clean, plus unit tests for its pure logic (`node --import tsx --test`).
- Public routes must not regress: same URLs, same visual output, Lighthouse accessibility stays at 100 on the five pages.

## Step 1 — Architecture decisions record

Status: done. Record: `admin-cms-adr.md`.
Intent: turn the locked decisions into an implementable design before any code.
Deliverable: `docs/plan/admin-cms-adr.md` with the route-group layout (admin root layout, public root layout, where `not-found`, `robots`, `sitemap`, `manifest` and `opengraph-image` live), the CMS section registry (page, section key, zod schema, default source), the cache and tag scheme for Next 16, the Prisma model list, the permission list, the folder map and the interface each later step exposes.
Acceptance: every step below has its inputs and outputs named; no open question left; Next 16 behaviours cited from the local docs.
Out of scope: any code change.

## Step 2 — Foundation: env, dependencies, database, cache, seed

Intent: everything later steps import.
Deliverables: dependencies (`prisma`, `@prisma/client`, `@prisma/adapter-neon`, `@neondatabase/serverless`, `ws`, `zod`, `bcryptjs`, `@upstash/redis`, `@upstash/ratelimit`, `server-only`, `tsx`, `nodemailer`, `@types/nodemailer`, `resend`); `prisma/schema.prisma` and `prisma.config.ts` scoped to schema `sahan` (users, accounts, sessions, verification tokens, invites, roles and permissions, content blocks and versions, projects, experience, services, skills, posts, media assets and locations, inquiries, chat sessions and messages, training entries, settings, audit log); `lib/db/prisma.ts` singleton; `lib/cache` (Upstash with in-memory fallback); `lib/env.ts` zod validation; `.env.example` with names only; idempotent seed for the owner account and default roles; test runner script.
Acceptance: `db push` creates tables only inside `sahan`; seed can run twice safely; `next build` passes with the database unreachable; no secret value appears in any tracked file.
Out of scope: UI, auth flows.

## Step 3 — Route groups and admin shell

Intent: give `/admin` its own layout without touching public output.
Deliverables: route groups (public site in `(site)`, `/admin` with its own nested layout, both under one thin root layout); admin layout with sidebar, top bar, theme, skip link, permission-aware navigation, error and loading states; empty dashboard page; `/admin/*` catch-all not-found.
Acceptance: public pages render the same navigation, footer, metadata tags and JSON-LD content (JSON-LD moves from head to body); `/admin` renders no public chrome; both themes work; keyboard navigation works.
Out of scope: authentication (next step), any data screens.

## Step 4 — Auth core and hidden login

Intent: secure sign-in that only appears after the secret unlock.
Deliverables: Auth.js v5 config (credentials, JWT, sessionId, password fingerprint, throttled role refresh); `proxy.ts` with the unlock gate, CSRF Origin check for mutations, scanner-path blocking and `/admin` guard; login page and form; safe callbackUrl; login rate limit; sign-in and sign-out audit events; `requireUser` and `requirePermission` helpers.
Acceptance: the login form is invisible without a valid unlock cookie; wrong secret and wrong password are rate limited with uniform errors; the owner can sign in and out; unit tests cover unlock cookie signing and expiry, callbackUrl sanitising and rate limits.
Out of scope: MFA, invites, sessions UI.

## Step 5 — Email service

Intent: one reliable way to send mail, used by MFA, security alerts, invites and the contact form.
Deliverables: `lib/email` facade (Resend primary, Brevo SMTP fallback, provider chosen by config and health); HTML templates for MFA code, new-login alert, password changed, MFA toggled, forced logout, user invite, contact notification and contact auto-reply; header-injection and HTML escaping guards; Brevo API diagnostics route that reads message events; delivery result recorded in the audit log; integration health entry.
Acceptance: a test send reaches the inbox through Resend and, when Resend is disabled, through Brevo SMTP; diagnostics explain why a Brevo API call succeeded without delivery; templates escape all user input.
Out of scope: bulk or marketing mail.

## Step 6 — RBAC, users and invites

Intent: manage who can do what.
Deliverables: DB-backed permission matrix and `can()` used by every action; `/admin/roles` matrix editor (DEVELOPER only); `/admin/users` list, create, invite by email, edit role, disable, delete, reset password; invite tokens (hashed, single use, expiring) and `/admin/set-password`; password policy; last-DEVELOPER protection; MANAGER can assign only EDITOR and cannot see DEVELOPER accounts.
Acceptance: an EDITOR cannot reach or call user or role actions even by direct request; invite link works once; every change is audited; unit tests cover the matrix and hierarchy rules.
Out of scope: MFA and session screens.

## Step 7 — MFA and account page

Intent: the owner manages their own security.
Deliverables: `/admin/account` with profile, change password (current password required, other sessions revoked), enable and disable MFA (password plus emailed code), recent sign-ins, list of own sessions; MFA challenge step in the sign-in flow; security emails from step 5.
Acceptance: with MFA on, password alone never signs in; five wrong codes lock until expiry; resend cannot reset the counter; disabling MFA needs password and code; changing the password invalidates every other session.
Out of scope: authenticator-app TOTP.

## Step 8 — Sessions and audit log

Intent: see and control every sign-in, and see every change.
Deliverables: active session tracking in Postgres with a Redis state cache (IP, browser, OS, device, issued, last active); `/admin/sessions` for MANAGER and above with revoke one session and force logout a user or everyone; session-status heartbeat that signs a revoked browser out within seconds; `/admin/audit` with filters, detail diff and CSV export.
Acceptance: revoking a session logs that browser out on its next request; force logout also kills the actor's other sessions only when asked; audit rows exist for every mutation added in steps 4 to 7; export needs the export permission.
Out of scope: audit rows for later steps, added in each of those steps.

## Step 9 — CMS engine

Intent: the content layer every page editor uses.
Deliverables: section registry and zod schemas for every section of Home (hero, proof, channels, sections copy, teams, why, process, final call to action, service overview, featured works, FAQ), About (hero, bento, services, skills, experience), Works (hero, tabs, behind the work), Updates (hero, topics, tags) and Contact (hero, form copy, tips, socials, contact details); `ContentBlock` versioning with draft, publish and restore; cached public loaders with code-default fallback and tag revalidation; FAQ JSON-LD fed from the published content; import of current code content as version 1.
Acceptance: with an empty database every public page is identical to today; publishing a change shows on the public page after revalidation; restoring an old version works; unit tests cover merge and fallback.
Out of scope: editor screens (next step).

## Step 10 — CMS editors for Home, About and Contact

Intent: edit those pages from the dashboard.
Deliverables: `/admin/content` page list and `/admin/content/[page]` with one schema-driven form per section (text, long text, lists with add, remove and reorder, image picker, links), live validation, draft versus published state, preview, unsaved-changes guard, per-section audit; permissions `editPages` and `publishPages`.
Acceptance: an EDITOR can save drafts but not publish; every field in the registry is editable; invalid input never reaches the database; forms work by keyboard and screen reader.
Out of scope: Works collections and blog.

## Step 11 — Works collections

Intent: projects, experience, services and skills managed as data.
Deliverables: DB models seeded from `contents/projects.ts`, `experience.ts`, `service.ts`, `skills.ts`; admin CRUD with ordering, featured flag, status, links (website, Play Store, App Store, web app, demo, case study), image via media picker, organization filter; public Works, About and Home read them with fallback; derived counts stay derived.
Acceptance: seeded output equals today's page; adding a project with a Cloudinary image and links shows on Works and in the home featured row after revalidation; reordering persists.
Out of scope: media library itself (step 13).

## Step 12 — Updates and blog management

Intent: run the public Updates page from the dashboard.
Deliverables: post model and admin list with search, status (draft, scheduled, published, archived) and bulk actions; editor (TipTap) with a shared sanitizer, slug, excerpt, topic, tags, cover image, SEO fields; scheduled publish cron; AI draft and cover-image helpers using the provider chain, with prompt-injection guard; public `/updates` reads posts, plus `/updates/[slug]`, RSS feed and sitemap entries; existing `UpdatesContent.posts` imported as published posts.
Acceptance: an EDITOR cannot publish; scheduled posts publish on time; public HTML is sanitized; the AI helper never receives secrets and its output is reviewed before save.
Out of scope: comments, newsletter.

## Step 13 — Media management

Intent: one place for images and files.
Deliverables: signed Cloudinary upload, media library grid with search, tags, alt text and usage locations, delete with in-use warning, media picker used by every editor, signed media route using `MEDIA_SIGNING_SECRET`, type and size limits, `next.config.ts` image host entry, existing `public/works` images registered.
Acceptance: only allowed types and sizes upload; alt text is required for images used in content; deleting a used asset is blocked or warned; permissions `uploadMedia` and `deleteMedia` enforced on the server.
Out of scope: video transcoding.

## Step 14 — Contact pipeline and inquiries

Intent: the contact form becomes a real, safe intake.
Deliverables: `/api/contact` (zod, honeypot, IP rate limit, origin check, spam heuristics) storing an inquiry, notifying the owner through the email facade with cc and bcc from config, sending an auto-reply, recording delivery result; the current compose-and-open form gains a real submit while keeping the WhatsApp and Telegram quick links; `/admin/leads` list with status, notes, assignee, export.
Acceptance: a submission is stored and emailed; a failed provider falls back and the failure is visible in the admin; abusive traffic is rate limited; the sender gets a confirmation; header injection attempts are neutralised.
Out of scope: CRM integrations.

## Step 15 — Chatbot

Intent: an assistant on the public site, managed from the admin.
Deliverables: public chat widget and `/api/chat` (streaming, rate limited, provider chain, answers grounded in published CMS content and training entries); `/admin/chatbot` with conversation history, training entries CRUD, on and off switch, tone and greeting settings, lead capture into inquiries; prompt-injection guard and output sanitising.
Acceptance: the bot cannot reveal secrets, hidden prompts or admin URLs; answers cite site content; disabling it removes the widget; history needs `viewChatHistory`, training needs `manageChatbot`.
Out of scope: voice, WhatsApp bridge.

## Step 16 — Settings, dashboard, cron and maintenance

Intent: operate the site.
Deliverables: `/admin/settings` (site identity, contact details, SEO defaults, feature switches, integrations health for DB, Redis, Resend, Brevo, Cloudinary and AI, cache clear, IP allowlist for admin), maintenance mode with `MAINTENANCE_BYPASS_SECRET` cookie, cron routes protected by `CRON_SECRET` as a bearer token (blog publish, session cleanup, audit prune, daily Vercel schedule) and a manager screen, dashboard widgets (recent activity, drafts, new inquiries, unpublished changes, health, security status, password-change banner).
Acceptance: only DEVELOPER can change settings; maintenance mode blocks the public site but not a bypassed developer; cron routes reject calls without the secret; every setting change is audited.
Out of scope: analytics vendor integration.

## Step 17 — End-to-end verification and security audit

Intent: prove it works and is safe.
Deliverables: e2e for unlock then sign in, MFA, invite, role limits, content edit to public page, blog publish, media upload, contact submit and revoke session; security review covering OWASP top ten, secret handling, XSS and CSRF, IDOR on every admin API, rate limits, header hardening and dependency audit; performance and Lighthouse pass on public pages; fixes for every finding.
Acceptance: no high or medium finding open; e2e green; public accessibility score unchanged.
Out of scope: new features.

## Step 18 — Documentation and ops handoff

Intent: the owner can run and recover this alone.
Deliverables: README section and `docs/admin.md` (how to unlock and sign in, roles, backups, restore a content version, add a user, rotate secrets, Vercel env setup), `.env.example` verified against code, `AGENTS.md` and `CLAUDE.md` notes for the new areas, and a secret rotation checklist.
Acceptance: a fresh clone plus `.env.local` reaches a working admin by following the docs only.
Out of scope: code changes beyond doc fixes.

## Progress

- [x] Step 1: architecture decisions record (`admin-cms-adr.md`)
- [x] Step 2: foundation
- [x] Step 3: route groups and admin shell
- [x] Step 4: auth core and hidden login (the owner's real password sign-in is left for the owner to confirm by hand, see the ADR result)
- [ ] Step 5: email service
- [ ] Step 6: RBAC, users and invites
- [ ] Step 7: MFA and account page
- [ ] Step 8: sessions and audit log
- [ ] Step 9: CMS engine
- [ ] Step 10: CMS editors for Home, About and Contact
- [ ] Step 11: Works collections
- [ ] Step 12: updates and blog
- [ ] Step 13: media
- [ ] Step 14: contact pipeline and inquiries
- [ ] Step 15: chatbot
- [ ] Step 16: settings, dashboard, cron, maintenance
- [ ] Step 17: end-to-end verification and security audit
- [ ] Step 18: documentation and ops handoff
