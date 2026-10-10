# CMS audit against production headless CMS platforms (2026-10-10)

Audited baseline: commit `e07a317` (the head of `cms-features`, merged to
`master` as `956efcc` via PR #14). Findings describe that snapshot. Items
fixed since are marked with the PR that fixed them ("Fixed in #15").

Scope: the Sahan admin CMS, compared with
Contentful, Sanity, Strapi 5, Payload 3, Directus 11, Storyblok, Hygraph,
Prismic and Contentstack.

Method:
- A read-only code inventory, a read-only delivery and hot-path audit, and web
  research of vendor docs and changelogs.
- High-severity findings below were re-checked against the code before they
  were listed.
- Platform rows marked "(unverified)" in the research were not re-checked
  against vendor docs.

Context matters for scoring. This is a single-owner portfolio CMS, not a
multi-tenant SaaS. Features such as localization, GraphQL, a UI schema
builder or real-time co-editing are scored as gaps against the market, but
the roadmap only recommends them when the site needs them.

## 1. Scorecard

| # | Area | Score /10 | Weight | One-line verdict |
|---|---|---|---|---|
| 1 | Content modeling | 5.0 | 8% | Typed, validated schema-as-code; only 7 field kinds; no media, reference, rich-text, number, boolean or date fields in page sections. |
| 2 | Editorial workflow | 5.0 | 10% | Drafts and versions for sections and posts. Collections go live on save. No approval stage or releases. Scheduling is posts-only with a daily cron. |
| 3 | Versioning | 6.0 | 6% | Restore works for sections and posts. No diff view. Superseded section versions are never pruned. |
| 4 | Preview | 4.0 | 6% | Page-section preview only. No `draftMode`, no shareable links, no post or collection preview on the real page, no visual editing. |
| 5 | Localization | 0.0 | 2% | None (single language). Low weight: not needed today. |
| 6 | Media / DAM | 6.5 | 8% | Signed uploads, alt enforced, usage tracking, locked delete. No focal point, one folder, orphan asset on a failed register, video unsupported. |
| 7 | Delivery API | 5.0 | 10% | Versioned public REST with cursors and CDN headers. No tokens, ETag, webhooks, field selection, filtering, preview API or OpenAPI spec. |
| 8 | Caching and latency | 5.5 | 10% | Excellent hit path. Cache-correctness races, a 3-round-trip Redis miss path, and up to ~15 min scheduled-post delay. |
| 9 | Security and governance | 7.5 | 12% | Strong RBAC, in-transaction audit, CSRF, sanitize on read and write. The allowlist "off" switch is ignored, and maintenance and the allowlist fail open on a Redis outage. No TOTP, WebAuthn or SSO. |
| 10 | Concurrency safety | 8.0 | 6% | Optimistic concurrency, row locks, unique constraints, atomic token use, idempotent cron. Gaps: post status changes and collection edits. |
| 11 | SEO | 7.5 | 6% | Per-post SEO, noindex everywhere, chunked sitemap index, RSS, llms.txt, JSON-LD, IndexNow. No redirects or slug history, no per-page SEO fields. |
| 12 | AI | 7.0 | 3% | Gated, rate-limited admin AI and a knowledge-backed chatbot. The AI cost buckets fail open. |
| 13 | Ops and observability | 3.5 | 8% | No metrics, tracing, alerting, migration history, content export or backups. Cron is daily only. |
| 14 | Tests | 5.5 | 5% | 134 test files and about 1,000 cases. Server actions, services, API routes and UI are untested, and there is no e2e suite. |
| | **Weighted total** | **5.7** | 100% | Strong security core on a mid-level CMS feature set. Ops and observability are the weakest area. |

Against the market's table stakes (Appendix A), Sahan has 9 of 17
fully, 4 partially and 4 not at all:
- **Full:** draft/published, revisions with restore, validated schema, block modeling, media alt and usage, granular RBAC with audit, bulk actions with caps, cursor-paginated CDN delivery, keyset bounds.
- **Partial:** scheduling (posts only), preview (sections only), rate limiting (cursor pages only), typed SDK (types exist in code, none published).
- **Missing:** signed webhooks, separate preview/management credentials, an environment or branch story, and an MCP or agent API.

## 2. Hot path (delivery)

```
Browser -> Vercel CDN -> proxy.ts (every non-static path)
        -> page (ISR 300/3600 s) or /api/content/v1 (s-maxage=60, swr=300)
        -> cached(): unstable_cache -> Redis read-through (tag generation keys)
        -> loadOrNull -> Prisma repos -> Neon Postgres
```

| Request | Redis round trips | DB queries | Notes |
|---|---|---|---|
| CDN or ISR hit | 0 (1 on a cold proxy instance) | 0 | The proxy still runs before the CDN lookup (inferred). |
| Data-cache hit | 0 | 0 | Callback never runs. |
| Data-cache miss, Redis hit | 2 sequential | 0 | Version GET, then data GET. |
| Full miss | 3 sequential (SET is awaited) | 1 to 3 | A post list is 3 parallel queries at about 0.3 s each; likely a region mismatch with Neon (no `regions` in `vercel.json`, inferred). |

## 3. Flaws and issues (verified, ranked)

### High
| ID | Where | Issue | Fix |
|---|---|---|---|
| H1 (Fixed in #15) | `proxy.ts:69-71,240-250`; `lib/actions/settings.ts:117-133` | The proxy reads `.ips` only and ignores `.enabled`. Turning the allowlist "off" while IPs remain listed still enforces the list. The UI says off; admins can be locked out. | Return `[]` unless `enabled`. Add a test. |
| H2 (Fixed in #15) | `lib/settings/service.ts:38-55` | `readSettingRaw` catches DB errors and returns the default inside `cached()`. One DB blip caches defaults for `features` and `chatbot.config` for up to 3600 s, breaking the project's own "never cache a fallback" rule. | Throw inside the cached fn and apply the default outside with `loadOrNull`. |
| H3 (Fixed in #15) | `lib/cache/invalidate.ts:20-41` | `revalidateTag` runs before the Redis generation bump, which runs later in `after()` with swallowed errors. A regeneration in that gap re-caches the old Redis value for 300 to 3600 s. | Bump Redis first (awaited, logged), then revalidate. Or drop Redis from `cached()` on Vercel (M6). |

### Medium
| ID | Where | Issue | Fix |
|---|---|---|---|
| M1 (Fixed in #15) | `packages/auth-kit/src/cache/redis.ts:82`; `lib/cache/cached.ts` | The tag-version key gets its TTL only on creation (`EXPIRE NX`). After it expires, the counter restarts at 1 and can match data written before the purge, served stale for up to about 4 min. | Refresh the TTL on every bump, or use `SET tagversion = Date.now()`. |
| M2 (Fixed in #16) | `lib/settings/kv.ts`; `proxy.ts:64-71` | During a Redis outage the failover memory store is empty, so maintenance reads off and the allowlist reads empty (fail-open). | Keep the last settled value. Add an env override and alert when `kvBackend()` is degraded. |
| M3 (Fixed in #18) | `vercel.json`; `lib/blog/queries.ts` | Scheduled posts surface through read-time `publicNow()` plus stacked TTLs (ISR 300 + data 300 + Redis 300), so up to about 15 min late. The cron is daily. | Run the cron every 5 min, or clamp revalidate to the next `publishAt`. |
| M4 (ETag/304 in #16; CDN tags open) | `lib/api/content.ts:10`; `lib/cache/plan.ts` | `revalidatePath('/api/content/v1/...')` does not purge the CDN for dynamic handlers (inferred). API consumers see up to 6 min of stale data. No ETag. | Add CDN cache tags with tag purge on publish. Add a content-hash ETag with 304 support. |
| M5 (Fixed in #16) | `app/api/content/v1/posts/route.ts` | Only cursor requests are rate limited. A random `?x=` busts the CDN key on every call, and `clientIp` ignores `authKit.trustProxy`. | Reject unknown query params. Pass `trustProxy`. Add a WAF rule on `/api/content/*`. |
| M6 | `lib/cache/cached.ts` | The Redis layer duplicates Vercel's persistent data cache, adds up to 3 round trips per miss, and is the source of H3 and M1. No single-flight on cold keys. | Remove Redis from `cached()` on Vercel. Plan a move to `use cache` / `cacheTag` / `cacheLife` (`unstable_cache` is superseded in Next 16). |
| M7 | `lib/data/prisma/posts.ts:6-27` | List summaries select full `contentText` to cut a 200-char excerpt. Large pages risk the 2 MB cache item limit (then a silent miss on every request). | Store `excerpt` at write time and drop `contentText` from `SUMMARY_SELECT`. |
| M8 (Fixed in #15) | `lib/actions/works.ts:114-115,183-184` | `organization: x \|\| undefined` makes Prisma skip the field, so a project's organization and URL can never be cleared. | Map `""` to `null`. Check the other collections for the same pattern. |
| M9 (Fixed in #17) | `lib/actions/works.ts` (collections) | Edits to published rows go live immediately with no `updatedAt` guard (last write wins). | Add `updateIfUnchanged`. Optionally add a draft layer. |
| M10 (guard in #16; revision open) | `lib/actions/blog.ts:430-449` | Status changes are unconditional and write no revision. | Guard on `updatedAt` and record a revision. |
| M11 | `lib/actions/blog.ts` (slug edit) | A changed slug leaves the old URL as a 404 (no slug history or redirects). | Add a `PostSlugHistory` table with a 308 redirect in the post route. |
| M12 | `prisma/schema.prisma`; `package.json` | `db push` only, no migration history. The "one DRAFT + one PUBLISHED per block" rule is enforced in code only. | Adopt `prisma migrate` with a CI diff check, and add a partial unique index. |
| M13 (Fixed in #16) | `lib/admin/audit.ts`; `lib/actions/blog.ts` | The audit row stores full post bodies before and after (up to about 200 KB each) on top of revisions. | Omit body fields from the audit row (revisions hold them) or audit a diff. |

### Low
- **Media delivery and upload:**
  - `/media/[...slug]` is uncached and appears unused. Delete it or add cache headers.
  - `registerUpload` swallows errors and leaves an orphan Cloudinary asset on failure.
  - Tags are unvalidated and not searchable.
- **Data growth and indexes:**
  - Superseded ContentBlock versions are never pruned.
  - Each section load reads every version's data.
  - `listPublicSlugs` is unbounded.
  - Missing composite or partial indexes for the keyset queries and media `(createdAt, id)`.
- **Validation:**
  - `canonicalUrl` accepts relative, anchor and mailto values.
  - The project slug has no format check.
  - `generatedByAI` is trusted from the form.
- **Cache clear and maintenance page:**
  - "Clear cache" omits the `settings` tags (fixed in #16).
  - The maintenance page ignores the saved reason and end time.
- **Behaviour:**
  - The AI rate-limit buckets fail open.
  - Section publish is 2 transactions.
  - The audit-prune log uses action `audit.exported`.
  - The log redaction regex hides `statusCode` and `cacheKey`.
  - The bypass cookie has no nonce.

## 4. Gaps against production CMS platforms

| Capability | Market (Appendix A) | Sahan | Needed here? |
|---|---|---|---|
| Signed outgoing webhooks with retries and idempotency key | CF, SAN, SB, HYG, PRI | Missing | Yes, if any external consumer of the headless API exists |
| Separate delivery / preview / management tokens | All major SaaS | Public API only, no preview API | Yes, for a preview API |
| ETag / 304, CDN tag purge | Tag purge: SAN, HYG; webhook revalidation everywhere | Missing | Yes (cheap, cuts API cost) |
| Live / visual preview, shareable preview links | CF, SAN, PAY, DIR, SB, HYG, CS | Section preview only | Yes: `draftMode` and signed share links for posts |
| Revision diff | CF, SAN, DIR, SB, CS | Missing (audit diff only) | Yes, cheap with `lib/admin/diff.ts` |
| Releases (publish many atomically) | CF, SAN, STR, SB, HYG | Missing | No, not at this scale |
| Approval workflow stages | CF, STR, SB, HYG, CS | Permission split only | Optional |
| Scheduling for sections and collections | Most | Posts only | Optional |
| Trash / restore | SB, partial elsewhere | Missing (hard deletes) | Yes for posts, media and collections (cheap soft delete) |
| Redirects and slug history | PAY plugin, SB app | Missing | Yes (SEO) |
| Field projection and filtering on the API | Nearly all | Missing | Optional |
| OpenAPI spec and typed SDK | All | `docs/headless-api.md` only | Optional (generate from zod) |
| MCP server or agent API | CF, SAN, STR, PAY, DIR, SB | Missing | Optional (auth-kit tokens could back it) |
| SSO / SAML / SCIM, TOTP / WebAuthn | Most (plan-gated) | Email OTP only, not enforced by role | Add TOTP or WebAuthn, and enforce MFA for admin roles |
| Environments / branches | CF, SAN, HYG, CS | Missing (Neon branches could serve) | Optional |
| Localization with fallback | All | Missing | Only if multilingual is planned |
| Real-time co-editing / presence | SAN | Missing | No |
| GraphQL | Most | Missing | No |
| Metrics, tracing, alerting | Vendor-run SLAs | Missing | Yes (Server-Timing, cache-hit metrics, degraded-Redis alert) |

## 5. Strengths to keep
- Every mutation is gated first (`authorizeAction` / `hasPermission`), unauthorized admin surfaces return 404, and audit is written in the same transaction as the mutation.
- Content is never trusted at read time: sections are re-validated and post HTML is re-sanitized on every public read.
- Concurrency: optimistic concurrency on sections and posts, `FOR UPDATE` on media delete and on the last-developer check, atomic token consumption, idempotent cron jobs.
- Bounded public reads: keyset cursors, a slug-list guard against slug probing, first-page-only caching, and a chunked sitemap index.
- RBAC: runtime roles with a rank hierarchy, code-fixed grants for SUPER_ADMIN, and an audit visibility filter.

## 6. Roadmap (priority order)

**P0, bugs (one PR, small):** H1, H2, H3, M1, M8. Done in #15.

**P1, correctness and cost (one or two PRs):**
- M2: KV last-known-good value plus a degraded alert.
- M3: 5-minute publish cron or `publishAt`-aware revalidate.
- M4 and M5: CDN tags, ETag/304, query-param allowlist, `trustProxy`.
- M7: stored excerpt.
- M9 and M10: concurrency guards on collections and status changes.
- M13: audit without body fields.
- Settings tags in "Clear cache".

**P2, platform gaps worth building:**
- M11: slug history and redirects.
- Soft delete with a trash view.
- `draftMode` preview for posts and collections, with signed share links.
- Revision diff view.
- Signed outgoing webhooks (HMAC, retries, idempotency key) for headless consumers.
- TOTP/WebAuthn with role-enforced MFA.
- Prune superseded section versions.

**P3, architecture:**
- M6: drop the Redis read-through on Vercel and migrate `unstable_cache` to `use cache` / `cacheTag` / `cacheLife`.
- M12: `prisma migrate` with committed history.
- Observability: Server-Timing on content routes, cache hit/miss counters, p95 dashboards, request IDs.
- Co-locate the Vercel region with Neon.
- e2e suite for login, editing, publishing and the content API.

**Not recommended now (YAGNI for a single-owner site):** GraphQL, a UI schema
builder, real-time co-editing, releases, localization (until multilingual is
planned), environments beyond Neon branches.

## Appendix A. Market baseline (research summary, 2026-10-10)

Columns: CF Contentful, SAN Sanity, STR Strapi 5, PAY Payload 3, DIR Directus
11, SB Storyblok. Y yes, P partial, plugin or plan-gated, N no. Rows marked
"(unverified)" were not confirmed against vendor docs.

| Capability | CF | SAN | STR | PAY | DIR | SB |
|---|---|---|---|---|---|---|
| Draft / published + preview API | Y | Y | Y | Y | Y | Y |
| Revision history + restore | Y | Y | Y | Y | Y | Y |
| Revision diff | Y | Y | P | Y | Y | Y |
| Scheduled publish | Y | Y | Y | Y | P | Y |
| Releases (atomic multi-publish) | Y | Y | Y | N | N | Y |
| Visual / live preview | Y | Y | P | Y | Y | Y |
| Separate delivery / preview / management tokens | Y | Y | P | P | P | Y |
| Signed webhooks | Y | Y | ? | P | ? | Y |
| Field / locale / entry RBAC | P | Y | P | Y | Y | Y |
| Audit log | Y | Y | Y | P | Y | Y |
| MCP server | Y | Y | Y | Y | Y | Y (unverified) |
| Redirects management | N | N | P | Y | P | Y |

Table stakes used for the 17-item count in section 1:
1. Draft/published split with a separate preview API.
2. Revision history with restore.
3. Scheduled publish and unpublish.
4. Validated schema.
5. Reference resolution with a depth cap.
6. Block/component modeling.
7. Live or visual preview.
8. Locale fallback chains.
9. Media with transforms, alt text and usage lookup.
10. Separate delivery, preview and management credentials.
11. CDN delivery with rate limits on cache misses only.
12. Signed webhooks with retries and an idempotency key.
13. Typed SDK or type generation.
14. Granular RBAC with an audit log.
15. Bulk actions with caps, and export.
16. An environment or branch story for schema changes.
17. An MCP server or agent API.

Sources (official docs):
- Contentful technical limits: https://www.contentful.com/developers/docs/technical-limits-2025/
- Contentful webhook verification: https://contentful.com/developers/docs/extensibility/webhooks/request-verification.md
- Sanity API CDN: https://www.sanity.io/docs/content-lake/api-cdn
- Sanity content releases: https://www.sanity.io/docs/content-lake/content-release-document-flow
- Strapi releases: https://docs.strapi.io/cms/features/releases.md
- Payload drafts: https://payloadcms.com/docs/v3/versions/drafts.md
- Payload MCP plugin: https://payloadcms.com/docs/v3/plugins/mcp.md
- Directus access control: https://directus.com/docs/guides/auth/access-control
- Storyblok caching: https://www.storyblok.com/docs/concepts/caching
- Storyblok rate limits: https://storyblok.com/docs/api/content-delivery/v2/getting-started/rate-limit
