# ValoremAdminPanel to Sahan packages: migration plan

Date: 2026-10-16. Source: three read-only inventories of
`G:\@Valorem\@Web\ValoremAdminPanel` (architecture, auth/security,
content/AI/media).

## Starting point

Valorem already runs Next 16.4 with `cacheComponents`, React 19, Prisma 7 on
Neon (schema `valorem`) and bcryptjs password hashes. The hashes are
bcrypt-compatible with auth-kit's `hashPassword`/`verifyPassword`, so users keep
their passwords through the migration.

What it lacks: migrations (`db push` only), TOTP/passkeys/recovery codes,
self-service password reset, sign-in links, break-glass, a runtime roles
table, first-party analytics, email failover and blog revisions.

## Feature to package map

| Valorem today | Replaced by |
| --- | --- |
| NextAuth 5 Credentials + JWT 24h, Redis-only revocation | auth-kit (`authorize`, DB sessions, `authKitSessions`), Sahan session/device list |
| Roles DEVELOPER/MANAGER/EDITOR, 41 code permissions | auth-kit runtime roles table + `fixedGrants`; SUPER_ADMIN rank 5 with masking |
| Emailed OTP MFA (plaintext, `!==`) | auth-kit MFA picker: TOTP, WebAuthn passkeys, recovery codes; emailed OTP kept as one method, hashed |
| Invites via `verification_tokens` (raw tokens) | auth-kit invites (hashed, rotate-on-copy, CC copy) |
| Admin-only password reset | auth-kit forgot-password + admin reset |
| Login unlock / maintenance bypass via `?secret=` | Sahan unlock gate + break-glass form (no secrets in URLs), signed bypass cookie |
| HMAC M2M signing (falls back to `AUTH_SECRET`, skips permissions) | auth-kit API tokens (hashed) with permission scopes; `CRON_SECRET` kept for crons only |
| `/media/*` masked URLs, Cloudinary pool (16 accounts, usage rotation) | media-kit multi-account `MEDIA_ACCOUNT_<n>_*` + `signMediaUrl` |
| fal.ai images + Vertex fallback; 3 drifting chat chains | ai-core provider chain (one config) |
| OpenRouter-only blog/SEO generation | blog-kit AI generation on ai-core |
| TipTap blog, markdown + contentHtml, no revisions | blog-kit (sanitize on write and read, revisions, scheduling, preview gate) |
| Chatbot: sessions, messages, training entries, lead to Inquiry | chat-kit handler + retrieval hook for property data |
| Resend only, Svix webhook | email-kit (provider failover, templates, capture mode in dev) |
| gtag/Google Ads + consent, `/api/metrics` logs only | analytics-kit (first-party events, consent-aware client) |
| Audit log (mutable) | Sahan `audit()` inside the mutation transaction, append-only |
| `db push`, `postbuild` seed + backup sync | Prisma migrations (`0_init` baseline), Sahan encrypted S3 backups |

Stays Valorem-specific (moves onto the new auth/permission/audit/cache
patterns, no package): Properties CMS, Property Finder sync and webhooks, Leads
CRM (fix the CSV import N+1 with batched upserts), inquiries, Instagram feed,
content blocks, settings, Google reviews, SEO/sitemaps/IndexNow, the 6 daily
crons.

## Package gaps to close first

Each gap ships as a package change with a changeset and a template port.

1. ai-core: fal.ai image provider with a Vertex fallback.
2. media-kit: usage-based account rotation (Cloudinary credit/storage), and accounts stored in settings as well as env slots.
3. media-kit: `/media/*` masked delivery route helper, if `signMediaUrl` does not already cover Valorem's URL shape.
4. chat-kit: pluggable retrieval source (property search) and a lead-capture hook.
5. email-kit: Svix-verified webhook helper, if Valorem needs more than Resend delivery events.

## Phases

Each phase is one branch in a Valorem worktree. PRs open only when asked.

0. **Baseline and safety.** Add Prisma migrations: introspect the live
   `valorem` schema into `0_init` and mark it applied (no data change). Rotate
   and purge the secret-like values in the tracked `.env.example`. Remove
   `NEXT_PUBLIC_MEDIA_SIGNING_SECRET` and the `AUTH_SECRET`/`CLOUDINARY_API_SECRET`
   signature fallbacks. Drop seed + sync from `postbuild`.
1. **Auth core.** auth-kit sessions, roles table, permission mapping (41
   permissions onto auth-kit grants), default-deny for `app/api/*`,
   `authorizeAction` in every server action, `notFound()` on admin routes.
   Data migration: users keep bcrypt hashes; roles become roles rows;
   `verification_tokens` are expired, not migrated (pending invites resent).
2. **Auth features.** MFA (TOTP, passkeys, recovery codes, hashed email OTP),
   invites, sign-in links, forgot-password, unlock gate, break-glass, device
   list, lockout and rate limits that fail closed.
3. **Email.** email-kit with failover and templates; all auth mail moves to it.
4. **Media.** media-kit accounts, upload client, signed media URLs; existing
   Cloudinary references keep working (accounts mapped to slots).
5. **AI + blog.** ai-core single chain; blog-kit with revisions and
   sanitized rich text; existing posts imported (contentHtml sanitized).
6. **Chat.** chat-kit with property retrieval and lead-to-Inquiry.
7. **Analytics.** analytics-kit with consent; Google Ads tags stay behind consent.
8. **Ops.** Sahan backups replace the `sync_queue` write-through; cron
   routes on `CRON_SECRET` with constant-time compare; audit append-only;
   CSP nonces (drop `unsafe-inline`); `cached()` + `invalidate()` for public reads.

## Security fixes (all land by the end of phase 2)

- Public signing secret (`NEXT_PUBLIC_MEDIA_SIGNING_SECRET`) and secret fallbacks.
- Possibly real values in tracked `.env.example`: rotate, then purge history.
- HMAC path skips permission checks.
- Static maintenance cookie; secrets in query strings.
- Fail-open revocation, MFA status and rate limits.
- User-enumeration timing, no lockout.
- `Math.random` session IDs, raw verification tokens, plaintext OTP with `!==`.
- CSP `unsafe-inline`, mutable audit trail, no default-deny for APIs.

## Live-database steps (each needs explicit approval)

- Mark `0_init` applied on the live database.
- Each phase migration (roles, MFA, sessions, revisions, analytics tables).
- User/role data migration script.
- Retiring `sync_queue` and the backup write-through.
