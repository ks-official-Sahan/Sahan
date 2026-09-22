# ADR 0001: Admin panel and CMS for the portfolio

- Status: accepted. Design only: this record changes no code.
- Date: 2026-09-21
- Owner: Sahan
- Plan: [admin-cms.md](./admin-cms.md), steps 1 to 18
- Stack it applies to: Next.js 16.3.5, React 19.2, Tailwind 3.4, pnpm, Node 22.20 locally (`engines` asks for 24 or newer)

## 1. How to use this record

Every later step reads this file first. Sections 4 to 9 fix the designs, section 10 fixes file locations, section 11 names the inputs and outputs of each step, and section 14 lists every question that came up and how it was closed. A step that finds this record wrong fixes the record in the same change.

Statements about Next 16 behaviour carry a label such as [N7]. Section 15 maps each label to a local doc path and line numbers under `node_modules/next/dist/docs/01-app/`. `AGENTS.md` still applies: read the matching guide before writing Next code for a step (section 11 names them).

Library docs (Auth.js, Prisma 7, Resend, Cloudinary, Vercel AI SDK, TipTap, Upstash) are fetched through Context7 in the step that first uses them, as the global rules require.

## 2. Context: facts in this repo that shape the design

- **F1.** `app/layout.tsx` is the only layout. It renders `<html>`, the theme and Mantine providers, audio, Shoelace, the loading screen, navigation, the floating audio switch, the footer, Speed Insights, JSON-LD and all site metadata, for every route. The four page folders `about`, `works`, `updates` and `contact` each hold a metadata-only `layout.tsx` that calls `pageMetadata()` from `lib/metadata.ts`.
- **F2.** Special files at the app root: `not-found.tsx`, `loading.tsx`, `manifest.ts`, `opengraph-image.tsx`, `robots.ts`, `sitemap.ts`, `favicon.ico`.
- **F3.** Content lives in `contents/*.ts` objects. Several client components read them at module scope and compute derived values there (`WorksExplorer`, `UpdatesExplorer`, `ContactForm`, `RandomIam`, `SkillSection`). Content from a database can only reach them as props.
- **F4.** Some defaults contain React components (icons in `contents/about.ts`, `skills.ts`, `service.ts`, `updates.ts`). They cannot be stored as JSON, so the database stores icon keys.
- **F5.** `Site`, `SiteMetadata` and `PageMetadata` in `config/site.ts` are imported by about 20 files. Two lists overlap: `AboutContent.KB.skills.dev` (About "Grid" layout) and `MySkills` (tabs).
- **F6.** Several counts on the site (projects, live projects, platforms, teams, service "done" counts) are derived from `Projects`. They must stay derived.
- **F7.** Tooling: pnpm 12 with `allowBuilds` in `pnpm-workspace.yaml` (install scripts are blocked unless listed). In this repo `pnpm run` and `pnpm exec` can trigger a full install, so agent-driven work invokes `node` directly.
- **F8.** `.env.local` (git-ignored by `.env*.local`) holds every value. Four secrets are short: `INTERNAL_SIGNING_SECRET` (9), `MEDIA_SIGNING_SECRET` (10), `MAINTENANCE_BYPASS_SECRET` (8), `ADMIN_LOGIN_UNLOCK_SECRET` (14).
- **F9.** The Neon database `lakeview` hosts schemas of other projects. This project owns schema `sahan` only.
- **F10.** The reference panel (`G:/@Valorem/@Web/ValoremAdminPanel`) runs Next 16 with `cacheComponents: true`, Tailwind 4 and React Compiler. Sahan runs none of those, so the reference is a design source, not a copy source.

## 3. Decisions

| ID | Decision | Why | Evidence |
| --- | --- | --- | --- |
| D1 | One thin root layout, plus nested layouts for `(site)` and `admin`. Not multiple root layouts. | Multiple root layouts force a full page load between them and need the experimental `global-not-found` for unmatched URLs. | [N1] [N2] [N4] |
| D2 | Content flows from server loaders to components as props. Code defaults in `contents/*.ts` stay as the fallback. | Client components cannot read a database, and module-scope constants cannot change after build. | F3, F4 |
| D3 | Caching: Cache Components stay off. Loaders use `unstable_cache` with tags, plus ISR `revalidate` as a safety net, all behind one wrapper file. | Enabling Cache Components changes rendering rules for the whole public site (client components, `useSearchParams`, random and time based UI). The guide for projects without it documents this model. One wrapper file keeps a later move to `use cache` to one change. | [N15] [N16] |
| D4 | Loader failure rule: read the database whenever it is configured, including during `next build`. Fall back to code defaults only when the database is not configured, or when the read fails during `next build`. At runtime a failed read throws, so a stale ISR page keeps being served. Fallback results are never written into the data cache. | A build with a reachable database must bake real content, a build without one must still pass, and a stale good page is better than a wrong default. | [N15] [N30] |
| D5 | Proxy does optimistic checks only (cookie present and signed). A data access layer (`requireUser`, `requirePermission`) is the authority. Every Server Action and Route Handler re-checks. | Proxy cannot see Server Function calls on excluded paths, and layouts do not re-render on navigation. | [N9] [N12] [N13] |
| D6 | Hidden login: `/admin/login` shows the site's own 404 until `?secret=` matches. The proxy then sets a signed 2 hour cookie and strips the query. The locked state is a rewrite to an unmatched path, so the status is a real 404. | Indistinguishable from any unknown URL. | [N3] [N6] [N11] |
| D7 | Sessions: Auth.js v5 credentials with JWT (24 h). A `UserSession` row in Postgres is authoritative. Redis caches session state for 30 s and is cleared on every revoke. | Revocation must survive a Redis flush or outage, and sessions must be listable. Redis stays the fast path. | [N12] |
| D8 | MFA is an emailed 6 digit code stored hashed in Postgres (`MfaChallenge`), 5 minutes, 5 attempts, single use. | Durable counters, no dependency on Redis for a security decision. | plan step 7 |
| D9 | RBAC: permission keys are a code catalogue. The role by permission matrix is in Postgres. DEVELOPER always holds everything, and only DEVELOPER edits the matrix. | Owner can tune roles without a deploy, while a bad edit cannot lock the owner out. | plan decisions |
| D10 | Secrets and tokens: bcrypt cost 12 for passwords, SHA-256 of 32 random bytes for invite and reset tokens, HMAC-SHA256 for cookies and form tokens, constant-time comparison everywhere. | Standard, and matches the reference. | section 6 |
| D11 | One `sendEmail` facade: Resend first, Brevo SMTP second. Brevo's API is used for diagnostics only. A `capture` provider exists for tests and is refused in production. | SMTP delivered where the API returned success without delivery. Tests must never send real mail. | plan decisions |
| D12 | Blog editor is TipTap. HTML is sanitized on write and again in the cached public loader. CMS sections use plain and long text only. | HTML enters the site through blog posts only, which keeps the XSS surface small. | section 8 |
| D13 | Media: Cloudinary with server-signed uploads, server verification after upload, and a signed `/media` route. Existing `public/works` files are registered as `LOCAL` assets. | Direct browser upload keeps files off the function, and post-upload verification enforces type and size. | [N22] |
| D14 | Contact intake is a Route Handler (`POST /api/contact`), not a Server Action. | It needs its own status codes, rate limits and public access, and Route Handlers are not cached by default. | [N23] |
| D15 | AI chain OpenRouter, then Gemini, then NVIDIA, with paid OpenRouter models off. Visitor and post text is data, never instructions. | Locked by the owner. | plan decisions |
| D16 | Two stores for editable text. Operational switches are `Setting` rows (DEVELOPER only). Everything a visitor reads, including site identity, contact details and SEO defaults, is CMS content under the page slug `site`. | Content gets drafts, versions and audit for free, and switches stay small. | section 8 |
| D17 | Cron runs once a day on Vercel (safe on the free plan) with a bearer secret. Scheduled posts also become visible at read time within the revalidate window. | No dependence on a per-minute cron. | [N23] |
| D18 | Headers: static security headers everywhere through `next.config.ts`. A nonce CSP applies to `/admin` only. Public pages get no script CSP. | A nonce needs dynamic rendering, which would defeat ISR on public pages. | [N21] [N29] |
| D19 | Env: zod validated, lazy, `server-only`. Length rules are warnings in development and a startup error in production, raised from `instrumentation.ts`, never during build. The startup error applies only when `DATABASE_URL` is set, so a database-less deploy of the public site still starts. It stops the whole server, a trade-off the plan already accepts. | Build must pass in CI without secrets. | [N24] [N26] |
| D20 | One audit writer with redaction. Security events are written synchronously. Rows are not deletable from the UI. | Integrity of the trail. | section 6.9 |
| D21 | Tests use `node --conditions=react-server --import tsx --test`. Database tests run only against schema `sahan_test` and refuse anything else. | `server-only` throws outside the server condition. Protects real data. | section 12 |
| D22 | Package manager: `pnpm add` once per step with `allowBuilds` updated for `@prisma/client`, `@prisma/engines`, `prisma` and `esbuild`. Never start dev servers with `pnpm run` or `pnpm exec`. | F7. | F7 |

## 4. Route and layout design

### 4.1 Target tree

```
app/
  layout.tsx                thin root: <html>, <body>, font, root metadata (ThemeProvider is mounted by SiteShell and admin/layout.tsx, see section 4.3)
  not-found.tsx             <SiteShell><NotFoundContent/></SiteShell>   (unmatched URLs, locked admin)
  favicon.ico  manifest.ts  robots.ts  sitemap.ts  opengraph-image.tsx  (stay at the root)
  rss.xml/route.ts          step 12
  media/[...slug]/route.ts  step 13
  (site)/                   public site, URLs unchanged
    layout.tsx              SiteShell + site metadata + JSON-LD
    loading.tsx             PageLoader (moved from app/loading.tsx)
    not-found.tsx           <NotFoundContent/> only (chrome comes from the layout)
    page.tsx  about/  works/  updates/  contact/   (moved as is, then rewired in steps 9 to 14)
    updates/[slug]/page.tsx step 12
  admin/
    layout.tsx              dynamic = "force-dynamic", renders children only (no DOM, no metadata)
    admin.css               scrollbars restored for admin screens (the site hides them)
    (auth)/                 pre-login pages, no chrome
      layout.tsx            passthrough
      not-found.tsx         <SiteShell><NotFoundContent/></SiteShell>
      login/  set-password/
    (panel)/                authenticated pages
      layout.tsx            AdminShell (sidebar, top bar, heartbeat), permission-aware nav, noindex metadata, toaster
      loading.tsx  error.tsx  not-found.tsx   panel only, see section 4.4
      page.tsx              dashboard
      [...catchAll]/page.tsx   calls notFound(), answered by (panel)/not-found.tsx
      account/ users/ roles/ sessions/ audit/ content/ works/ blog/ media/ leads/ chatbot/ settings/
  api/
    auth/[...nextauth]/route.ts   auth/session-status/route.ts
    contact/route.ts   contact/token/route.ts   chat/route.ts
    admin/{uploads/sign,ai,export,email/diagnostics}/route.ts
    cron/{blog-publish,session-cleanup,audit-prune}/route.ts
```

### 4.2 What moves and what stays

- Moved with `git mv` into `app/(site)/`: `page.tsx`, `about/`, `works/`, `updates/`, `contact/`, `loading.tsx`. The four page folders carry their metadata-only `layout.tsx` (`pageMetadata()`) with them. Route groups do not change URLs [N1].
- Stay at `app/`: `favicon.ico`, `manifest.ts`, `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`. Metadata files keep their fixed URLs, and `sitemap` lives at the root of `app` [N28].
- New at `app/`: thin `layout.tsx` and `not-found.tsx`.

### 4.3 Layout responsibilities

| Layout | Owns | Does not own |
| --- | --- | --- |
| `app/layout.tsx` | `<html lang suppressHydrationWarning>`, `<body className={poppins.className ...}>`, the `litDisableDevMode` inline script (allowed by hash in the admin CSP), `globals.css`, metadata `metadataBase`, `title` default and template, `description`, `openGraph`, `twitter`, `robots` (`openGraph` and `twitter` stay here because `app/opengraph-image.tsx` sits at this level, see the paragraph below) | Mantine, audio, Shoelace, navigation, footer, loading screen, JSON-LD |
| `app/(site)/layout.tsx` | `SiteShell` and the site-only metadata (`authors`, `creator`, `keywords`, `alternates`) | `<html>`, `<body>` |
| `components/site/SiteShell.tsx` | `ThemeProvider` (class, system, default dark; it moved here from the root layout in step 4), JSON-LD, skip link, `MantineSyncProvider`, `AudioProvider`, `<main>` wrapper, `ShoelaceSetup`, `LoadingScreen`, `Navigation`, `FloatingAudioSwitch`, `#main-content` wrapper, `Footer`, `SpeedInsights`, and the Mantine CSS import. It lives in a component, not in the layout, because the root 404 renders it too and must not lose the chrome or the styles. | Suspense boundaries and suspending awaits (section 4.4) |
| `app/admin/layout.tsx` | `export const dynamic = "force-dynamic"` (needed for the nonce CSP, section 6.6), the `admin.css` import, and `ThemeProvider` with the `x-nonce` of the request (next-themes writes an inline script, which the CSP only allows with the nonce; the static root layout cannot read it) around `{children}` | metadata, DOM, site chrome, Mantine CSS. Keeping it bare makes a 404 rendered under `(auth)` the same document as the root 404. |
| `app/admin/(panel)/layout.tsx` | `AdminShell`, `SessionHeartbeat`, skip link to `#admin-main`, `<Toaster/>`, metadata `robots: noindex, nofollow, nocache` and a `title` template `%s - Admin` that replaces the site template | authorization (each page calls the data access layer) [N12] |

Root layout rule: the root layout defines `<html>` and `<body>` and must not hold manual `<title>` or `<meta>` tags [N2]. The inline script in `<head>` is not a title or meta tag, so it stays where it is today.

Public head output: the merged metadata of `/`, `/about`, `/works`, `/updates` and `/contact` must equal today's. Verified in step 3: the head tags of the five pages are identical before and after. JSON-LD moves from `<head>` to the start of `<body>` (inside `SiteShell`); its content is unchanged.

Two facts shaped where the metadata sits, both found by comparing builds:

- `openGraph` and `twitter` must stay in the root layout. A file such as `opengraph-image.tsx` sets the image of the segment it sits in [N32], and Next attaches it to that segment's `openGraph` object. A child layout that defines its own `openGraph` replaces the whole object (Next merges metadata one key deep) and the image is lost: the first build after the move dropped `og:image` from `/`. Moving `opengraph-image.tsx` into `(site)` is not an option either, because outside the app root Next appends a hash to its URL (`/opengraph-image-12o0cb`), and that changes a public URL. The admin panel resets both keys with `null`.
- A layout's `title.template` does not apply to the `title` of a page in the same segment [N31]. The admin dashboard page sits in `(panel)` with the layout that defines `%s - Admin`, so it sets `title.absolute`. The layout's own fallback title uses `absolute` as well, otherwise the root template `%s | Sahan Sachintha` would wrap it.

The public 404 page (unmatched URL) renders at the root, outside `(site)`, so its head no longer carries `author`, `creator`, `keywords` or a canonical link to the home page. That is intended: a 404 should not declare the home page as its canonical URL. Its body no longer wraps the message in the `PageLoader` fallback (the old root `loading.tsx` did), so the server-rendered HTML now holds the real 404 text.

### 4.4 not-found, loading and status codes

- The root `not-found.tsx` handles every unmatched URL [N3]. It renders inside the thin root, so it wraps its content in `SiteShell` to keep today's navigation and footer on a public 404. `(site)/not-found.tsx` renders the bare content, because `notFound()` inside a site page already sits inside `SiteShell`.
- Two mechanisms produce a 404 and only one gives server-rendered HTML. An unmatched URL renders Next's internal `/_not-found` route, which is prerendered at build with the root `not-found.tsx` inside the root layout: full HTML, status 404, cacheable. A `notFound()` thrown while a route renders is caught at the top of the render, which answers 404 and serves a client-rendered shell (`<html id="__next_error__">`), so the message appears once the scripts have run [N33]. The locked admin therefore rewrites to an unmatched path (section 4.5) and does not call `notFound()`. Step 3 tried a catch-all under `(site)` that calls `notFound()` for unmatched URLs, to keep the chrome out of the root 404, and dropped it for this reason.
- A not-found file belongs to the segment tree of every route under the same layout, so the root `not-found.tsx` puts the site chrome's client references into the manifest of `/admin` as well. Measured on the step 3 production build: `/admin` lists 10 entry scripts (405 KB) and 4 stylesheets (488 KB), against 6 scripts (70 KB) and 3 stylesheets (291 KB) when the root 404 has no chrome. Accepted (risk R19); `admin.css` repaints the body over Mantine's global styles.
- `(site)/loading.tsx` wraps pages and nested layouts of the public site, not the admin [N5]. The admin has its own `loading.tsx`.
- When a page streams, the status can no longer change and Next adds a `noindex` meta tag [N6]. That is today's behaviour and it does not change. The locked login must be a real 404, so the proxy rewrites to an unmatched path before any streaming starts [N6].
- `(auth)/not-found.tsx` renders the same site 404, so an invalid invite or reset link looks like any missing page and does not reveal the admin. `(auth)` has no `loading.tsx` on purpose: `notFound()` must run before any Suspense boundary or suspending `await` for the response to carry a 404 status [N6]. The admin `loading.tsx` and `error.tsx` therefore live in `(panel)`.
- `SiteShell` on the not-found path contains no Suspense boundary and no suspending `await`. Otherwise every 404 would stream and answer 200 [N3] [N6]. Extras such as `ChatWidget` mount from `(site)/layout.tsx`, never from `SiteShell`.
- The `(auth)` pages export their own `robots: noindex` metadata, because the admin layout carries none.
- Authenticated users hitting an unknown `/admin/x` get the admin styled 404 through `(panel)/[...catchAll]/page.tsx`, which calls `notFound()`. The boundary is `(panel)/not-found.tsx`, so the shell stays around the message.
- There is deliberately no `admin/not-found.tsx`. A not-found file renders below the layout of its own segment, so one at `admin/` would replace the whole panel including the shell, and it would also catch a `notFound()` thrown by the panel layout. That call is how an unauthenticated request that got past the proxy must end (the public 404, never an admin styled page). Without the file it falls through to the root `not-found.tsx`.

### 4.5 Proxy

`proxy.ts` sits next to `app/` and runs on the Node.js runtime; the `runtime` option is not available [N10]. It runs for every request matched by its `matcher` [N8]. It does no database work: optimistic checks read the cookie only [N12], and it must not rely on shared modules or globals [N7].

Matcher: everything except `_next/static`, `_next/image`, `favicon.ico` and paths that end in a static asset extension (`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`, `svg`, `ico`, `css`, `js`, `map`, `woff`, `woff2`, `ttf`, `otf`, `mp3`, `mp4`, `webm`). Other extensions (`.php`, `.env`, `.git`) still reach the proxy, which is what lets responsibility 1 block them.

Responsibilities, in order:

1. Block scanner paths (`/wp-admin`, `/.env`, `/.git`, `/phpmyadmin`, `*.php` and similar) with a bare 404.
2. Maintenance mode for public paths: flag mirrored in Redis with a 10 s in-memory cache, fail open. Requests carrying a valid bypass cookie, and all of `/admin`, `/api/auth` and `/api/cron`, are exempt.
3. Origin check for unsafe methods (POST, PUT, PATCH, DELETE) on `/admin` and `/api`, except `/api/cron`. Missing or foreign origin gets 403. Allowed origins: the request host, the origin of `SITE_URL`, and `ADMIN_ALLOWED_ORIGINS`.
4. `/admin/:path*` gate (section 6.2): unlock query handling, unlock cookie check, optimistic session check with `getToken` (cookie and signature only, no database) [N12].
5. Admin IP allowlist when the setting is on (mirrored in Redis, fail open with a console warning so the owner is never locked out by a Redis outage).
6. Response headers for unlocked or authenticated requests to `/admin` and `/api/admin`: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, and the nonce CSP (section 6.6). A request rewritten to `LOCKED_PATH`, and any denial on the admin surface (limiter, origin check), gets exactly the headers of a normal site 404 and nothing more, and answers that same 404, never 403 or 429, so the locked admin cannot be told apart from an unknown URL. Denials on `/api` outside the admin surface answer 403 or 429.

Server Functions are POST requests to the route that uses them, so a matcher change silently removes proxy cover [N9]. Nothing in this design relies on the proxy for authorization.

## 5. Rendering, caching and tags

### 5.1 Model

- Public pages stay statically rendered with ISR. Each page keeps a segment `revalidate` of 3600 as a safety net [N15]. `/updates` and `/updates/[slug]` use 300 instead, so scheduled posts appear within five minutes.
- Every content read goes through `cached()` in `lib/cache/cached.ts`, a thin wrapper over `unstable_cache(fn, keyParts, { tags, revalidate })` [N15] [N16]. `unstable_cache` is documented as replaced by `use cache` in Next 16 [N16]; the wrapper is the only file that changes if Cache Components are enabled later (risk R1).
- Invalidation always goes through `invalidate(tags, paths?)` in `lib/cache/invalidate.ts`. It calls `revalidateTag(tag, "max")` for each tag, which is valid in Server Functions and Route Handlers and never in a Client Component or the proxy [N17]. `"max"` is stale-while-revalidate: the old page keeps being served while the new one builds, so a database blip during regeneration never blanks the public site. The cost is that the first request after a publish can still see the old page (risk R16). `{ expire: 0 }` is not used for public tags, because it turns the next request into a blocking miss [N17]. The one-argument form is deprecated and is not used [N17]. `updateTag` is not used, because its documented tag sources are `fetch` tags and `cacheTag` [N18].
- `revalidateTag` invalidates data across all pages that use the tag [N17], so a shared section (for example `finalCta`, shown on four pages) refreshes everywhere. Each registry section also lists its consumer paths, and `invalidate` calls `revalidatePath` for them as a second safety [N19].

### 5.2 Loader contract

```
getPage(slug)            -> { blocks: Record<sectionKey, unknown> } | null      (one query per page)
getSection(slug, key)    -> defaults deep-merged with the published block, schema validated
```

- `null` means "use code defaults" and is returned only when `dbConfigured()` is false, or when the read throws while `isBuildPhase()` is true (`NEXT_PHASE === "phase-production-build"` [N30]). Any other database error is rethrown (D4). A build with a reachable database therefore bakes real content, and a build with an unreachable one still succeeds.
- The database read runs inside `cached()`. The `null` fallback is produced outside it, so a failed build-time read is never cached.
- Merge rule: objects merge key by key with the stored value winning, arrays are replaced whole, unknown stored keys are dropped by the schema, and a block that fails validation is ignored with a logged warning and the default is used.
- Loaders live in `lib/cms/loaders.ts` and `lib/collections/*.ts`. They import `server-only` [N13].

### 5.3 Tag scheme

| Tag | Read by | Invalidated by |
| --- | --- | --- |
| `cms` | every CMS loader (coarse tag) | cache clear in settings |
| `cms:page:<slug>` for `home`, `about`, `works`, `updates`, `contact`, `site` | `getPage(slug)` | publish or restore of any section of that page |
| `collection:projects` | projects loader | create, update, delete, reorder, publish toggle |
| `collection:experience`, `collection:services`, `collection:skills` | matching loaders | same |
| `blog:list` | posts list, sitemap, RSS, home teaser | publish, unpublish, schedule tick, delete, edit of a published post |
| `blog:post:<slug>` | post loader | edit, publish, unpublish, delete of that post |
| `blog:taxonomy` | topics and tags | any post status, topic or tag change |
| `site:config` | `getSite()` | publish of any `site` section |
| `settings:public` | `getPublicSettings()` (feature switches) | settings save |
| `chatbot:knowledge` | knowledge builder for the chatbot | any tag above, and training entry changes |

### 5.4 Invalidation matrix

| Mutation | Tags | Extra paths |
| --- | --- | --- |
| Publish or restore `<page>.<section>` | `cms:page:<page>`, plus `site:config` when page is `site` | registry `consumers` of the section, plus `/sitemap.xml` for `site.seo` |
| Collection change | `collection:<name>`, `chatbot:knowledge` | `/`, `/about`, `/works` |
| Post publish, unpublish, edit, delete | `blog:list`, `blog:post:<slug>`, `blog:taxonomy`, `chatbot:knowledge` | `/updates`, `/updates/<slug>`, `/sitemap.xml`, `/rss.xml` |
| Settings save | `settings:public` | `/` (layout level) |
| Cache clear | `cms`, every tag above | none |

### 5.5 Props, not imports

Server pages call the loaders and pass the slices down. Client components (`WorksExplorer`, `UpdatesExplorer`, `ContactForm`, `RandomIam`, `SkillSection`, `FAQSection`, `FinalCta`, `SocialMedia`) receive a `content` prop and compute derived values inside the component with `useMemo`. Client components that need site-wide values (email, phone, WhatsApp link) read them from a `SiteConfigProvider` mounted in `SiteShell` and `useSite()`. Server components call `getSite()`. No client component imports `contents/*.ts` after step 9.

## 6. Security architecture

### 6.1 Layers

| Layer | Job | Never does |
| --- | --- | --- |
| `proxy.ts` | scanner blocking, origin check, unlock gate, optimistic session check, headers | database reads, authorization decisions [N7] [N9] |
| Data access layer (`lib/auth/dal.ts`) | `requireUser()`, `requirePermission(p)`, per-request memoised with `React.cache` | trust the proxy or a layout [N12] |
| Server Actions (`lib/actions/*`) | zod validate, call the DAL, run the service, audit, invalidate | assume the caller came from the UI [N13] [N14] |
| Route Handlers (`app/api/**`) | same as actions, plus explicit status codes and rate limits | rely on proxy cover |
| Services (`lib/**/service.ts`) | pure business rules and Prisma access | read the request |

Layout checks are not authorization: layouts do not re-render on navigation [N12]. Each admin page and each action calls the DAL.

### 6.2 Hidden login

1. Any `/admin/*` request without a valid session and without a valid unlock cookie is rewritten [N11] to the constant `LOCKED_PATH` (`/not-found`, which matches no route). The response is the site 404 with `Cache-Control: no-store`. No redirect and no hint.
2. `/admin/login?secret=<value>` or `/admin?secret=<value>`: check the per-IP limiter first (`unlock:ip`, fail closed), then compare the SHA-256 digests of the given and the configured secret in constant time (raw values of different length would leak the length, and `timingSafeEqual` throws on them). Success sets `sahan_admin_unlock` and answers a 307 to the same path without the query. Failure and a limiter denial both answer the same 404 as step 1, never 429.
3. Cookie format: `issuedAtMs.base64url(HMAC-SHA256(key, "admin-unlock:v1:" + issuedAtMs))`, attributes `HttpOnly; Secure` (production) `; SameSite=Lax; Path=/admin; Max-Age=7200`. Lax and not Strict on purpose (changed in step 4): the unlock link is opened from a chat or an email, and with Strict the 307 that follows the `?secret=` request counts as cross-site, so the browser would not send the cookie it has just received. The cookie only decides whether the login page is visible; every action still passes the origin check and the session check. The key is `HMAC-SHA256(AUTH_SECRET, "admin-unlock:v1:" + SHA-256(ADMIN_LOGIN_UNLOCK_SECRET))`: a leaked cookie cannot be used to guess a short unlock secret offline, because the key also needs `AUTH_SECRET`, and rotating the unlock secret invalidates every issued cookie. Verification checks the signature in constant time, the 2 hour age, and rejects timestamps more than 60 s in the future.
4. Reachable when only the unlock cookie is valid: `/admin/login`. `/admin/set-password?token=` is reachable without it when the token carries a valid HMAC tag: invite and reset links carry `<random>.<tag>` (section 6.5). The proxy checks the tag without the database and rewrites a missing or forged token to `LOCKED_PATH`, so probing looks like any unknown URL. A genuine token that is used, expired or revoked shows a generic "link no longer valid" card, reachable only by someone who holds a real link. A successful `acceptInvite` or `setPassword` issues the unlock cookie (same signer, 2 h) before it redirects to `/admin/login`, so a new user can sign in.
5. A session cookie that is present, correctly signed and unexpired skips the unlock. The proxy cannot see revocation because it does no database work. The DAL detects it and sends the request to `/api/auth/expire`, a Route Handler that clears the session cookie (cookies are written only in Server Functions and Route Handlers [N20]) and redirects to `/admin/login?reason=revoked`. That page renders the form only while the unlock cookie is still valid, and is otherwise the site 404 by design.
6. `callbackUrl` is accepted only as a same-origin path that starts with `/admin`, contains no `//`, no backslash, no scheme and no control characters. Anything else becomes `/admin`.
7. The secret appears once in the request URL and therefore in access logs (risk R7). The 307 removes it from the address bar and from the `Referer` of the next page.

### 6.3 Sessions

- JWT claims: `sub`, `sid`, `role`, `pwf` (first 16 hex of HMAC-SHA256 of the stored password hash with `AUTH_SECRET`), `mfa` (bool), `iat`, `exp` (24 h). No sliding renewal.
- `getSessionState(sid)`: Redis key `sahan:sess:v1:<sid>` (30 s), else Postgres (`UserSession` joined to `User`). Returns `{ userId, role, disabled, revoked, expired, pwf, mustChangePassword, mfaEnabled }`. Any of revoked, expired, disabled or `pwf` mismatch means signed out. If Redis errors, the database read still answers. If both fail, the caller is signed out (fail closed).
- Revoke one session, revoke all sessions of a user (optionally except the current one), force logout everyone: each writes `revokedAt`, `revokedById`, `revokeReason` in Postgres, then deletes the cached state keys of the affected `sid`s, then writes an audit row.
- Password change, role change and disable revoke or refresh the affected sessions in the same transaction.
- `lastSeenAt` updates at most once a minute per session (Redis `SET NX EX 60` gate, in-memory gate if Redis is off).
- `GET /api/auth/session-status` returns `{ active, reason? }` with `no-store`. `SessionHeartbeat` (client) polls every 30 s and on tab focus and sends a revoked browser to `/api/auth/expire`, which clears the cookie and redirects to `/admin/login?reason=revoked` (see section 6.2, step 5).
- Sign-in creates the `UserSession` row before the JWT is issued and stores `sid` in it. IP and user agent come from request headers; browser, OS and device come from `userAgent()` (read `04-functions/userAgent.md` in step 8).

### 6.4 MFA

- Password step (`startSignIn` action): validates input, applies limiters, checks the password in constant time against a dummy hash when the user does not exist, and returns the same message for wrong email, wrong password and disabled user. If `mfaEnabled` is false it signs in. If true it creates an `MfaChallenge` (purpose `SIGN_IN`), emails the code, and returns only `{ challengeId }`. No session exists yet.
- Code step (`completeSignIn` action): verifies the code hash in constant time, increments `attempts` atomically in SQL, and on success sets `verifiedAt`. Then it calls `signIn("credentials", { challengeId })`. The Auth.js `authorize` runs an `updateMany` on that challenge, where `userId` matches, `verifiedAt` is within the last 60 s and `consumedAt` is null, and sets `consumedAt`. It proceeds only when exactly one row changed, so the same challenge id can never open a second session.
- Five failed attempts make the challenge dead until `expiresAt`. A resend creates a new challenge that copies `attempts` from the latest unexpired one for the same user and purpose, so resend never resets the counter. Sending is limited to 3 codes per user per 10 minutes.
- Enabling or disabling MFA needs the current password and an emailed code (purposes `ENABLE`, `DISABLE`).
- Break-glass for a lost mailbox: `db:admin clear-mfa <email>` (`prisma/admin-cli.ts`, step 7) clears `mfaEnabled` and open challenges and writes an `auth.mfa.disabled` audit row with actor `cli`. The same tool has `set-password <email>` (temporary password plus `mustChangePassword`) and `revoke-sessions <email>`. It needs database access, so only the holder of `.env.local` can run it.

### 6.5 Passwords, invites and reset

- bcryptjs cost 12. Policy for every new password: 12 to 128 characters, at least three of lower, upper, digit, symbol, not equal to the email or its local part, not in a built-in list of common passwords. The seeded owner password is exempt and forces `mustChangePassword`.
- Invite (72 h) and reset (1 h) share the `AuthToken` table. The link carries `<random>.<tag>`: `random` is 32 random bytes as base64url, `tag` is the first 16 bytes (base64url) of HMAC-SHA256 over `random` under a key derived from `AUTH_SECRET` (label `invite-token:v1`). The database stores the SHA-256 hex of `random`. Single use goes through `updateMany where usedAt is null`. The proxy verifies `tag` without the database (section 6.2, step 4).
- MANAGER can invite and manage EDITORs only. Nobody changes their own role, disables or deletes themselves, or removes the last DEVELOPER (enforced in the service, checked in tests).

### 6.6 CSRF, origin and headers

- Server Actions are POST requests. Next compares `Origin` with `Host` and caps the body at 1 MB by default; both are configurable [N14]. The proxy origin check adds a second layer (section 4.5).
- `next.config.ts` `headers()` adds on every route: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation off), `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: SAMEORIGIN`, and `poweredByHeader: false` [N29].
- `/admin` responses get a per-request nonce CSP from the proxy: `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self' https://api.cloudinary.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. The proxy sets the CSP header and `x-nonce` on the forwarded request headers (`NextResponse.next({ request: { headers } })`) as well as on the response, because Next reads the nonce from the request CSP while rendering [N21]. A nonce needs dynamic rendering, so `app/admin/layout.tsx` exports `dynamic = "force-dynamic"` for every page under `/admin`, including `(auth)/login`, which would otherwise prerender without a nonce [N15] [N21]. Public pages get no script CSP (D18).

### 6.7 Rate limits

Upstash sliding window with an in-memory fallback when Upstash is not configured. "Closed" means a limiter error denies the request, "open" means it allows it.

| Key | Window | Limit | On limiter error |
| --- | --- | --- | --- |
| `unlock:ip` | 10 min | 10 | closed |
| `login:ip` | 10 min | 10 | closed |
| `login:acct` | 15 min | 5 failures | closed (a Kv counter of failed passwords per SHA-256 of the email, not the sliding window: only failures count, and a success clears it) |
| `mfa:send:user` | 10 min | 3 | closed |
| `invite:actor` | 1 h | 20 | closed |
| `upload:sign:user` | 10 min | 30 | closed |
| `ai:admin:user` | 1 h | 30 | closed |
| `contact:ip` | 1 h | 5 | open (plus database cap by `ipHash`) |
| `contact:global` | 1 h | 100 | open |
| `chat:ip` | 10 min | 20 messages | closed (protects AI spend) |
| `chat:session` | 1 min | 6 messages | closed |

MFA code attempts are counted in Postgres (section 6.4), not here. Break-glass when Redis is down: sign-in is unavailable by design; removing the `UPSTASH_*` variables and redeploying switches to the in-memory limiter (single instance).

### 6.8 Secrets and environment

- `lib/env.ts` parses `process.env` lazily with zod and exposes a typed `env`. Every module that reads a secret imports `server-only` [N13]. Only `NEXT_PUBLIC_*` values reach the browser and they are inlined at build [N24]; this project defines none.
- Length rules: `AUTH_SECRET` and signing keys at least 32, unlock and bypass secrets at least 12. Development logs a warning. Production raises a startup error from `instrumentation.ts` `register()` [N26], only when `NEXT_RUNTIME === "nodejs"`, `NODE_ENV === "production"`, `NEXT_PHASE !== "phase-production-build"` and `DATABASE_URL` is set (D19).
- New variable names introduced by this design (values are not in git): `CRON_SECRET` (Vercel Cron sends it as a bearer token), `SITE_URL` (absolute links in emails; falls back to `SiteMetadata.siteUrl`), `DIRECT_DATABASE_URL` (optional, Prisma CLI), `ADMIN_ALLOWED_ORIGINS` (optional, comma separated), `EMAIL_PROVIDER` (`auto`, `resend`, `brevo-smtp`, or `capture` in test only).
- Env load order is the Next default; `.env.local` is not read when `NODE_ENV` is `test` [N24], so tests set their own variables.
- Logs never contain secrets. `lib/log.ts` redacts keys matching `pass|token|secret|hash|code|otp|authorization|cookie|key`.
- `serverExternalPackages` already contains `@prisma/client`, `prisma`, `bcrypt` and `sharp` [N25]. `bcryptjs` is pure JavaScript and is bundled.

### 6.9 Audit

`audit(event)` in `lib/admin/audit.ts` writes `{ actorId, actorEmail, action, entityType, entityId, before, after, ip, userAgent, meta }`. `before` and `after` pass through `redact()`. Security and permission events are written synchronously, and content mutations write inside the same transaction as the change. Low-value read events (viewing chat history, exporting) use `after()`. Inside its callback, `cookies()` and `headers()` can be read in Route Handlers and Server Functions, but not in Server Components [N27].

Action names use `domain.entity.verb`:

- Auth: `auth.login.success`, `auth.login.failure`, `auth.logout`, `auth.unlock.failure`, `auth.mfa.sent`, `auth.mfa.verified`, `auth.mfa.failed`, `auth.mfa.locked`, `auth.mfa.enabled`, `auth.mfa.disabled`, `auth.password.changed`, `auth.password.reset_requested`, `auth.password.reset_completed`, `auth.session.revoked`, `auth.session.force_logout`.
- People and access: `user.created`, `user.invited`, `user.role_changed`, `user.disabled`, `user.enabled`, `user.deleted`, `invite.revoked`, `rbac.matrix.updated`.
- Content: `content.draft.saved`, `content.published`, `content.restored`, `collection.<name>.created`, `.updated`, `.deleted`, `.reordered`, `.published`.
- Blog and media: `post.created`, `.updated`, `.scheduled`, `.published`, `.unpublished`, `.archived`, `.deleted`, `.ai_generated`, `media.uploaded`, `.updated`, `.deleted`.
- Leads, chat, email: `inquiry.created`, `.status_changed`, `.assigned`, `.note_added`, `.exported`, `chatbot.training.created`, `.updated`, `.deleted`, `chatbot.config.updated`, `email.sent`, `email.failed`.
- Operations: `settings.updated`, `maintenance.toggled`, `cache.cleared`, `cron.ran`, `audit.exported`.

Retention: the `audit-prune` cron deletes rows older than 365 days.

## 7. Data model

Prisma 7 with the `prisma-client-js` generator, as the reference does. Datasource provider `postgresql`; the URL is supplied in `prisma.config.ts`. Runtime uses `PrismaNeon` with `{ schema: "sahan" }` and the pooled `DATABASE_URL`. The CLI uses `DIRECT_DATABASE_URL` when set, otherwise `DATABASE_URL` with `-pooler` removed from the host and `channel_binding` removed from the query. Table names are `snake_case` through `@@map`. Ids are `cuid()` strings. Every model has `createdAt`, and mutable models have `updatedAt`.

Rules for the CLI: `db push` only, never `migrate reset` or `--force-reset`, and never against a schema other than `sahan`. Before the first push, list existing schemas with a read-only query and confirm `sahan` holds none of another project's tables.

Enums: `Role` (`DEVELOPER`, `MANAGER`, `EDITOR`), `ContentStatus` (`DRAFT`, `PUBLISHED`, `SUPERSEDED`), `PostStatus` (`DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`), `MediaKind` (`IMAGE`, `VIDEO`, `DOCUMENT`), `MediaProvider` (`LOCAL`, `CLOUDINARY`), `InquiryStatus` (`NEW`, `CONTACTED`, `CLOSED`, `SPAM`), `MfaPurpose` (`SIGN_IN`, `ENABLE`, `DISABLE`), `TokenPurpose` (`INVITE`, `PASSWORD_RESET`). Project category, status, platform and link kind stay as strings validated by zod, mirroring `types/project.d.ts`, so adding a value is not a schema change.

| Model | Key fields and constraints |
| --- | --- |
| `User` | `email` unique and stored lowercase, `name`, `passwordHash`, `role`, `image?`, `bio?`, `mfaEnabled`, `mustChangePassword`, `passwordChangedAt`, `lastLoginAt?`, `disabledAt?`, `createdById?` |
| `RolePermission` | `role`, `permission`, `updatedById?`, `updatedAt`, `@@id([role, permission])`. A row means granted. |
| `UserSession` | `id` (this is the JWT `sid`), `userId`, `ip`, `userAgent`, `browser`, `os`, `device`, `mfaVerified`, `lastSeenAt`, `expiresAt`, `revokedAt?`, `revokedById?`, `revokeReason?`. Indexes: `(userId, revokedAt)`, `expiresAt`. |
| `AuthToken` | `purpose`, `email`, `userId?`, `role?` (for invites), `tokenHash` unique, `createdById?`, `expiresAt`, `usedAt?`, `revokedAt?` |
| `MfaChallenge` | `userId`, `purpose`, `codeHash`, `attempts`, `expiresAt`, `verifiedAt?`, `consumedAt?`. Index `(userId, purpose, expiresAt)`. |
| `AuditLog` | fields in section 6.9. `actorId` uses `onDelete: SetNull`, `actorEmail` is a snapshot. Indexes: `createdAt`, `actorId`, `action`, `(entityType, entityId)`. |
| `Setting` | `key` primary key, `value Json`, `updatedById?`, `updatedAt` |
| `ContentBlock` | `pageSlug`, `sectionSlug`, `version`, `data Json`, `status`, `note?`, `createdById?`, `publishedById?`, `publishedAt?`, `updatedAt`. `@@unique([pageSlug, sectionSlug, version])`, `@@index([pageSlug, sectionSlug, status])`. |
| `Project` | `slug` unique, `title`, `tagline`, `description`, `role`, `organization?`, `organizationUrl?`, `category`, `status`, `platforms String[]`, `tech String[]`, `links Json` (`{kind, url, label?}[]`), `image Json?` (`{src, alt, fit?, background?, position?, mediaId?}`), `year`, `featured`, `sortOrder`, `published` |
| `Experience` | `company`, `companyUrl?`, `role`, `period`, `type`, `location?`, `highlights String[]`, `current`, `sortOrder`, `published` |
| `ServiceGroup` / `Service` | group: `name`, `sortOrder`. Service: `key` unique (for example `WEB`), `groupId`, `iconKey`, `name`, `description`, `done Json?` (`{title, href?, list: {name, metric}[]}`), `sortOrder`, `published`. `metric` is `{kind:"projects.category", value}`, `{kind:"projects.platform", value}`, `{kind:"projects.webProducts"}` or `{kind:"static", count}`, so derived counts stay derived (F6). |
| `SkillGroup` / `Skill` | group: `key` (`SC1` to `SC10`), `label`, `sortOrder`. Skill: `groupId`, `name`, `abbr`, `type`, `iconKey`, `variant` (`fill` or `stroke`), `colorLight`, `colorDark`, `grid Json?` (`{colors:[r,g,b], bgLight, bgDark}` for the About Grid layout, F5), `gridOrder?`, `sortOrder`, `published` |
| `Post` | `slug` unique, `title`, `excerpt?`, `content` (editor HTML), `contentHtml` (sanitized), `contentText`, `topic`, `tags String[]`, `status`, `publishAt?`, `publishedAt?`, `coverMediaId?`, `coverAlt?`, `seoTitle?`, `seoDescription?`, `canonicalUrl?`, `readMinutes`, `generatedByAI`, `authorId?` (`SetNull`, so deleting an author never fails). Indexes `(status, publishedAt)`, `slug`. |
| `MediaAsset` | `provider`, `kind`, `url`, `publicId?`, `format`, `width?`, `height?`, `sizeBytes`, `title?`, `alt?`, `tags String[]`, `folder`, `createdById?` |
| `MediaUsage` | `mediaId`, `entityType`, `entityId`, `field`, `@@unique([mediaId, entityType, entityId, field])`. Maintained by services on save, read by the in-use warning. |
| `Inquiry` | `name`, `email`, `phone?`, `topic?`, `message`, `status`, `notes?`, `assigneeId?`, `source` (`contact-form` or `chatbot`), `ipHash?`, `userAgent?`, `pagePath?`, `spamScore`, `emailStatus`, `autoReplyStatus`, `respondedAt?` |
| `InquiryEmailEvent` | `inquiryId`, `kind` (`notify` or `auto-reply`), `provider`, `ok`, `messageId?`, `error?` |
| `ChatSession` | `sessionId` unique, `ipHash?`, `userAgent?`, `pagePath?`, `inquiryId?`, `messagesCount`, `capturedLead`, `leadName?`, `leadContact?` |
| `ChatMessage` | `sessionId`, `role`, `content`, `tokens?`, `latencyMs?` |
| `ChatTrainingEntry` | `category`, `question`, `answer`, `priority`, `isActive`, `createdById?` |

`ContentBlock` lifecycle: at most one `DRAFT` and one `PUBLISHED` row per section. Saving a draft updates the draft row in place, or creates it with `version = max + 1`. Publish runs in one transaction that sets the old published row to `SUPERSEDED`, then the draft to `PUBLISHED` with `publishedAt`. Restore copies an old version's `data` into a new draft. Editors send `baseUpdatedAt` with every save; a mismatch returns a conflict instead of overwriting (two people editing one draft).

Seeds are idempotent: the owner is created only when no user exists or the email is missing, and an existing password is never overwritten. Default role permissions are inserted only for a role that has no rows, and later code additions insert new permissions only while `Setting rbac.seedVersion` is lower than the code's version. So an edited matrix is never reset.

## 8. CMS section registry

Each entry in `lib/cms/registry.ts` has: `page`, `key`, `label`, `schema` (zod), `fields` (UI descriptors, kept next to the schema and checked for completeness by a test), `defaults()` (adapter over `contents/*.ts`), `consumers` (paths to revalidate), `editPermission` (default `editPages`), `publishPermission` (default `publishPages`). Field kinds: `text`, `longtext`, `link` (`{label, href}`), `list` of any kind with add, remove and reorder, `stringList`, `iconKey`, `image` (media picker, alt text required). A `richtext` kind is added only when a section first needs it; none does today (D12).

Non-serialisable defaults (icons) are turned into keys through `lib/cms/icons.ts`, one registry from key to component covering the custom skill icons, Tabler and Lucide icons already in use. A skill or service with no matching key renders its `abbr` badge or a generic icon.

| Page | Section key | Source today | Fields | Consumers |
| --- | --- | --- | --- | --- |
| `home` | `hero` | `HomeContent.hero` | status, title, subtitle, primary and secondary link | `/` |
| `home` | `iam` | `HomeContent.iam` | prefix, words (1 to 12), hint | `/` |
| `home` | `channels` | `HomeContent.channels` | title, WhatsApp, Telegram and email label and detail, new-tab hint | `/`, `/about`, `/works`, `/updates` (shared, through `FinalCta`) |
| `home` | `teams` | `HomeContent.teams` | label (names derived from experience and projects) | `/` |
| `home` | `proof` | `HomeContent.proof` plus stat labels hard-coded in `ProofStrip` | label, stat labels (numbers derived) | `/`, `/about` (shared) |
| `home` | `featuredWorks` | `HomeContent.home.works`, `HomeContent.works.buttonTitle` | title, subtitle, button label (items: `Project.featured`) | `/` |
| `home` | `why` | `HomeContent.why` | title, subtitle, points (iconKey, title, body; 1 to 8) | `/` |
| `home` | `servicesOverview` | `HomeContent.home.services` | title, subtitle (items: first services) | `/` |
| `home` | `process` | `HomeContent.home.process`, `HomeContent.process` | title, subtitle, steps (title, body; 2 to 8) | `/`, `/contact` (shared) |
| `home` | `toolbox` | `HomeContent.home.toolbox` | title, subtitle (items: skills) | `/` |
| `home` | `faq` | `HomeContent.home.faq`, `HomeContent.faq.questions` | title, subtitle, questions (emoji, question, intro, points, outro) | `/`, plus FAQ JSON-LD built from the published block |
| `home` | `finalCta` | `HomeContent.finalCta` | title, subtitle, primary link, copy labels | `/`, `/about`, `/works`, `/updates` (shared) |
| `about` | `hero` | `AboutContent.SE1` | two title lines, description | `/about` |
| `about` | `bento` | `AboutContent.bento.B1` plus strings hard-coded in `AboutBento` | title, description, card labels | `/about` |
| `about` | `services` | `HomeContent.service` | title, subtitle (items: services) | `/about` |
| `about` | `skills` | `AboutContent.KB` | title, description (items: skills, grid subset) | `/about` |
| `about` | `experience` | headings hard-coded in `ExperienceSection` | title, subtitle (items: experience) | `/about` |
| `works` | `hero` | `WorksContent.hero` | status, title, description | `/works` |
| `works` | `tabs` | `WorksContent.tabs` | labels only. `id` and `param` are fixed so old `?wt=` links keep working. | `/works` |
| `works` | `results` | `WorksContent.results` | empty-state text | `/works` |
| `works` | `behind` | `WorksContent.behind` | title, subtitle, two labels, capabilities list, stack list (each name must exist in the skills collection) | `/works` |
| `updates` | `hero` | `UpdatesContent.title`, `.subtitle` | first word, second word, subtitle | `/updates` |
| `updates` | `filters` | `UpdatesContent.fs` | topics title, tags title | `/updates` |
| `updates` | `topics` | `UpdatesContent.topics` | topic names (ids generated, counts derived) | `/updates` |
| `contact` | `hero` | `ContactContent.hero` | status, title, description | `/contact` |
| `contact` | `form` | `ContactContent.form`, `TopicInputOptions`, labels hard-coded in `ContactForm` | title, intro, channel labels (ids fixed), topic options, field labels, success and error text | `/contact` |
| `contact` | `tips` | `ContactContent.tips` | title, items | `/contact` |
| `contact` | `socials` | `ContactContent.socials` | id, label, href (add, remove, reorder) | `/contact` |
| `site` | `identity` | `Site`, `SiteMetadata` | site name, footer text, tagline, author, roles, organization, GitHub, title, description, OG name (`manageSettings`) | all |
| `site` | `contact` | `Site.email`, `.phone`, `.phoneDisplay`, `.location`, WhatsApp text, Telegram URL | same (`manageSettings`). The WhatsApp URL stays derived from phone and text. | all |
| `site` | `seo` | `PageMetadata`, keywords, JSON-LD `sameAs` | per page title and description, keywords, profile links (`manageSettings`) | all, `/sitemap.xml` |

Collections behind the registry (steps 11 and 12): projects, experience, services, skills, posts.

String audit: Step 9 begins by listing every user-visible string in the components rendered by the five pages and classifying it as registry field, derived value, or deliberate code-only text (control names for assistive technology, error boundaries). The result is committed as `docs/plan/admin-cms-string-audit.md`. A registry entry exists for every string classified as content.

## 9. Permissions

Catalogue in `lib/auth/permissions.ts`, 33 keys. DEV is DEVELOPER, MGR is MANAGER, EDT is EDITOR. The columns show the seed defaults, which the DEVELOPER may change except where noted.

| Group | Permission | Allows | DEV | MGR | EDT |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `viewDashboard` | open the dashboard | yes | yes | yes |
| Pages | `editPages` | save page section drafts | yes | yes | yes |
| Pages | `publishPages` | publish, restore | yes | yes | no |
| Works | `editCollections` | create and edit projects, experience, services, skills (saved unpublished) | yes | yes | yes |
| Works | `publishCollections` | publish, feature, reorder | yes | yes | no |
| Blog | `viewBlog` | list posts | yes | yes | yes |
| Blog | `editBlog` | create and edit drafts | yes | yes | yes |
| Blog | `publishBlog` | publish, schedule, unpublish | yes | yes | no |
| Blog | `deleteBlog` | delete or archive | yes | yes | no |
| Blog | `generateAI` | AI draft and cover helpers | yes | yes | yes |
| Media | `viewMedia` | see the library and picker | yes | yes | yes |
| Media | `uploadMedia` | upload, edit alt text and tags | yes | yes | yes |
| Media | `deleteMedia` | delete assets | yes | yes | no |
| Leads | `viewLeads` | see inquiries | yes | yes | no |
| Leads | `manageLeads` | status, notes, assignee | yes | yes | no |
| Leads | `exportData` | CSV exports (leads, audit, sessions) | yes | yes | no |
| Chatbot | `viewChatHistory` | conversation history | yes | yes | no |
| Chatbot | `manageChatbot` | training entries, on and off, tone, greeting | yes | yes | no |
| Users | `viewUsers` | user list | yes | yes | no |
| Users | `inviteUser` | send invites | yes | yes (EDITOR only) | no |
| Users | `manageUsers` | change role, disable, enable | yes | yes (EDITOR targets) | no |
| Users | `deleteUser` | delete users | yes | no | no |
| Users | `resetPassword` | send a reset link | yes | yes (EDITOR targets) | no |
| Security | `viewSessions` | see sessions | yes | yes | no |
| Security | `revokeSessions` | revoke one session | yes | yes (EDITOR targets) | no |
| Security | `forceLogout` | force logout a user, or everyone (DEVELOPER only) | yes | yes (EDITOR targets) | no |
| Security | `viewAuditLogs` | audit screen | yes | yes | no |
| Security | `viewSecurityStatus` | integration health and security widgets | yes | yes | no |
| Operations | `manageSettings` | settings, `site.*` sections, maintenance | yes | no | no |
| Operations | `manageIpAllowlist` | admin IP allowlist | yes | no | no |
| Operations | `clearSystemCache` | cache clear | yes | no | no |
| Operations | `manageCron` | run cron jobs from the screen | yes | yes | no |
| Access | `managePermissions` | edit the matrix. Not grantable to any other role. | yes | never | never |

Hierarchy rule `canManage(actorRole, targetRole)`: DEVELOPER may manage every role, MANAGER only EDITOR, EDITOR none. It is applied on top of the permission for every user, session and invite action, and each server action checks both.

## 10. Folder map

New or changed paths. Existing folders not listed stay as they are.

```
proxy.ts                         instrumentation.ts        vercel.json
prisma.config.ts                 prisma/{schema.prisma, seed.ts, seed-content.ts, admin-cli.ts}
e2e/  playwright.config.ts (step 17)
app/                             see section 4.1
components/
  site/        SiteShell.tsx  NotFoundContent.tsx  SiteConfigProvider.tsx  chat/ChatWidget.tsx
  admin/       shell/ (AdminShell, Sidebar, Topbar, Nav, MobileNav, ThemeToggle, SessionHeartbeat)
               ui/ (dialog, tabs, switch, checkbox, table, empty-state, form fields)
               cms/ (SectionForm, FieldRenderer, ListField, ImageField, PreviewFrame, UnsavedGuard)
               blog/RichEditor.tsx    media/MediaPicker.tsx
lib/
  env.ts  env-rules.ts  log.ts
  db/          url.ts  state.ts  prisma.ts  seed.ts  health.ts
  cache/       redis.ts  memory.ts  cached.ts  fallback.ts  tags.ts  plan.ts  invalidate.ts  ratelimit.ts
  auth/        config.ts  dal.ts  session-store.ts  permissions.ts  rbac.ts  mfa.ts
               password-policy.ts  invite-token.ts  safe-callback-url.ts  bootstrap.ts
  admin/       login-unlock.ts  audit.ts  audit-query.ts  nav.ts  active.ts  toast.ts  dashboard.ts
               preview.ts (step 3 only, removed in step 4)
  security/    origin.ts  ip.ts  csp.ts  headers.ts  scanner-paths.ts  allowlist.ts
  email/       send.ts  providers/{resend,brevo-smtp,capture}.ts  templates/*  guards.ts
               brevo-diagnostics.ts  health.ts
  cms/         registry.ts  schemas/*.ts  defaults.ts  loaders.ts  merge.ts  versions.ts
               icons.ts  rich-text.ts
  collections/ projects.ts  experience.ts  services.ts  skills.ts
  site/        get-site.ts
  settings/    schema.ts  service.ts
  blog/        queries.ts  service.ts  slug.ts  schedule.ts  rss.ts
  media/       cloudinary.ts  signed-url.ts  usage.ts  validate.ts
  inquiries/   schema.ts  spam.ts  service.ts  notify.ts
  chatbot/     knowledge.ts  guard.ts  session.ts  prompts.ts
  ai/          providers.ts  guard.ts  blog.ts  chat.ts
  cron/        jobs.ts
  actions/     auth.ts  account.ts  users.ts  sessions.ts  content.ts  works.ts  blog.ts
               media.ts  leads.ts  chatbot.ts  settings.ts
docs/          plan/admin-cms.md  plan/admin-cms-adr.md  plan/admin-cms-string-audit.md  admin.md
```

Pure logic in `lib/**` has a `*.test.ts` next to it.

## 11. Per-step interfaces

Format: **In** is what must exist before the step. **Out** is what the step leaves behind for later steps. **Read first** lists the local Next docs to read before coding (`AGENTS.md`). **Library docs** are fetched through Context7. **Done when** repeats the plan's acceptance in checkable form. Every step ends with `tsc --noEmit`, eslint and its unit tests clean, and touches no public output unless it says so.

### Step 1: this record

- In: `AGENTS.md`, the local Next docs, the reference panel, `docs/plan/admin-cms.md`.
- Out: this file. The plan is updated for the four points where this record refines it: layouts (D1), session authority (D7), cron and its secret (D17), and the five new variable names.
- Done when: every step below has In and Out, section 14 has no open item, every Next claim has a label.

### Step 2: Foundation

- In: `.env.local`, section 7, section 6.8.
- Out:
  - Dependencies: `prisma`, `@prisma/client`, `@prisma/adapter-neon`, `@neondatabase/serverless`, `ws`, `zod`, `bcryptjs`, `@upstash/redis`, `@upstash/ratelimit`, `server-only`, `tsx`, `nodemailer` and its types, `resend` (used from step 5, installed here so lockfile churn happens once). `allowBuilds` gains `@prisma/client`, `@prisma/engines`, `prisma`, `esbuild`.
  - `prisma/schema.prisma` with every model of section 7, `prisma.config.ts`, generated client.
  - `lib/db/url.ts` (CLI and runtime connection strings, schema guard), `lib/db/state.ts` (`dbConfigured()`, `isBuildPhase()`), `lib/db/prisma.ts` (`db`, created lazily). `lib/env-rules.ts` (pure secret rules, `assertProductionEnv()`), `lib/env.ts` (typed `env`, server-only). `instrumentation.ts` calling the rules. `lib/log.ts` (`log`, `redact`).
  - `lib/cache`: `kv` (`get`, `set`, `del`, `incr`, `expire`; Upstash or memory), `cached()`, `loadOrNull()` (the D4 fallback rule), `TAGS` builders, `invalidationFor*()` (the section 5.4 matrix as pure functions), `invalidate()`, `limit(name, key)` with the fail modes of section 6.7.
  - `.env.example` (names only, including the five new names), `CRON_SECRET` generated into `.env.local` (48 random characters).
  - `lib/auth/permissions.ts` (the 33 keys, labels, seed defaults, `RBAC_SEED_VERSION`), `lib/db/seed.ts` (`seedOwner()`, `seedRolePermissions()`) and `prisma/seed.ts` as the CLI entry. `package.json` scripts `postinstall` (`prisma generate`), `test`, `db:generate`, `db:push`, `db:seed`. They load `.env.local` with `node --env-file-if-exists`, so no wrapper script is needed.
- Read first: `environment-variables.md`, `instrumentation.md`, `serverExternalPackages.md` [N24] [N25] [N26].
- Library docs: Prisma 7 config and Neon adapter, Upstash ratelimit.
- Tests: url derivation and schema guard, env length rules, memory kv, tag builders and the invalidation matrix, `loadOrNull`, limiter fail modes, permission defaults, seed logic against a fake client, and seed idempotency against the real schema.
- Done when: `db push` creates tables only in `sahan`; seed runs twice with one owner and unchanged password; `next build` passes with `DATABASE_URL` unset and with it pointing at a dead host; `git grep` finds no secret value in tracked files.

### Step 3: Route groups and admin shell

- In: Step 2 not required. Section 4.
- Out: file moves and new files of section 4.1 (site part and `admin` shell), all moves done with `git mv`; `components/site/{SiteShell,NotFoundContent}.tsx`; `components/admin/shell/{AdminShell,Sidebar,Topbar,Nav,MobileNav,ThemeToggle,SessionHeartbeat}.tsx` and `components/admin/ui/{Toaster,EmptyState}.tsx`; `lib/admin/nav.ts` (`ADMIN_NAV`, `ADMIN_NAV_GROUPS`, `navFor(permissions)`; each item is `{ href, label, icon, permission, group }` with `permission` a `Permission` or `null` for any signed-in user), `lib/admin/active.ts` (`ADMIN_HOME`, `isActive`, kept apart so the client nav does not bundle the nav config), `lib/admin/toast.ts` (store behind `Toaster`), `lib/admin/preview.ts`; the empty dashboard; `error.tsx`, `loading.tsx` and `not-found.tsx` inside `(panel)` only (there is no `admin/not-found.tsx`, section 4.4). The server filters the nav per user and passes the icons as rendered elements. Below 1024 px the nav is a native modal `<dialog>` drawer.
- Until step 4 landed, `(panel)/layout.tsx` and every admin `page.tsx` called `assertPreview()` (`lib/admin/preview.ts`), which ran `notFound()` in production so the unfinished shell was never reachable in a build. Step 4 replaced those calls with the data access layer and deleted the file. `app/admin/layout.tsx` exports `dynamic = "force-dynamic"`. `SessionHeartbeat` is a stub until step 8. Navigation is typed against `lib/auth/permissions.ts` from step 2.
- Read first: `route-groups.md`, `layout.md`, `not-found.md`, `loading.md` [N1] to [N6].
- Tests: `lib/admin/nav.test.ts` (unique links, real permissions, per-role visibility, empty sections dropped, `isActive`) and `lib/admin/toast.test.ts`. Before and after HTML capture of `/`, `/about`, `/works`, `/updates`, `/contact` and an unknown URL, compared for chrome, metadata tags and JSON-LD content.
- Done when: public output is unchanged apart from JSON-LD moving into the body; `/admin` has no public chrome; light and dark themes and keyboard navigation work; Lighthouse accessibility on the five pages is unchanged.
- Result: all five pages answer 200 and the unknown URL 404, with the same headers. Head tags are identical for all five. Body markup is identical before the merge of `master` into the branch (the later differences trace to that merge: `HomeHero`, `SkillGroupCard`, `ContactForm`, the LinkedIn icon and the `works` Suspense fix). JSON-LD moved from head to body and its content is the same. `/admin` (run with `next dev`) has the shell, the skip link, `noindex, nofollow, nocache`, no `og:` or `twitter:` tags, no canonical, no site chrome; tab order is skip link, brand, 13 links, "View site", three theme buttons; both themes and the mobile drawer (open, Escape, backdrop, link follow) work. In a production build `/admin` and `/admin/x` answer 404. The Lighthouse comparison is left to step 17, when the whole site is measured against a baseline build.

### Step 4: Auth core and hidden login

- In: steps 2 and 3.
- Out:
  - `lib/auth/config.ts` exporting `handlers`, `auth`, `signIn`, `signOut` (credentials, JWT 24 h, claims of section 6.3). `app/api/auth/[...nextauth]/route.ts`.
  - `lib/auth/dal.ts`: `getOptionalUser()`, `requireUser()`, `requirePermission(p)`. `lib/auth/session-store.ts` (create, get, touch). `lib/auth/{password-policy,safe-callback-url,bootstrap}.ts`. `lib/admin/login-unlock.ts`: `signUnlockCookie(now)`, `verifyUnlockCookie(value, now)`, `constantTimeEqual(a, b)`, `UNLOCK_COOKIE`, `UNLOCK_TTL_SECONDS`.
  - `lib/actions/auth.ts`: `startSignIn`, `signOutAction`. `lib/admin/audit.ts`: `audit()`, `redact()`.
  - `proxy.ts` (responsibilities 1, 3, 4, 6 of section 4.5), `lib/security/{origin,ip,csp,headers,scanner-paths}.ts`, `next.config.ts` headers.
  - `app/admin/(auth)/login/*`. The first-run bootstrap creates the owner only when the users table is empty.
- Read first: `proxy.md`, `authentication.md`, `data-security.md`, `cookies.md`, `server-actions.md` [N7] to [N14] [N20].
- Library docs: Auth.js v5 (credentials, JWT callbacks, `getToken`).
- Tests: unlock cookie signing, expiry, tampering and future timestamps; `safe-callback-url` table; limiter behaviour; password policy; dummy-hash timing path returns the same error.
- Done when: without the cookie `/admin/login` is a 404 with the site markup; a wrong secret is limited and indistinguishable; with the cookie the form appears; the owner signs in and out; audit rows exist.
- Built, and where it differs from the plan:
  - `lib/auth/credentials.ts` holds the sign-in rules with every side effect injected (limits, one bcrypt comparison against `DUMMY_HASH` for unknown, wrong-password and disabled users, one generic message, audit), so they are unit tested without a database. `lib/auth/session-state.ts` holds the pure yes-or-no rule for a session and the `pwf` fingerprint. `lib/auth/config.ts` is the only file that imports `next-auth`, because the package does not load under plain Node ESM and so cannot be tested there.
  - `app/api/auth/[...nextauth]/route.ts` answers 404 to every method. Sign-in and sign-out are Server Functions, and `GET /api/auth/session` would hand `sid` and `pwf` to the browser (found in the production check and removed). `/api/auth/expire` is a sibling route.
  - The DAL sends a signed-in browser whose session no longer counts to `/api/auth/expire`, and answers `notFound()` when there is no session at all. A database error while reading the session state is thrown (500) and does not sign the user out; the section 6.3 sentence "if both fail, the caller is signed out" is narrowed to "is not signed in and the page fails".
  - The proxy sends a visitor who holds the unlock cookie but no session from any `/admin/*` page to `/admin/login?callbackUrl=<path>`, and treats `/api/admin/*` as session only (no unlock cookie), answering the site 404 without one. An unlock failure is a `log.warn` line, not an audit row: the attempt has no actor, and a scanner could fill the table.
  - `auditSafe()` (audit write that logs instead of throwing) is used by sign-in and sign-out, so a failing audit table cannot turn a working login into an outage.
  - The mounted theme provider moved (see section 4.3) and an Auth.js `logger.error` override silences the stack trace for an expected `CredentialsSignin`.
  - An account with MFA enabled cannot sign in until step 7 (it answers "not available yet" after a correct password), so no account can skip its second factor.
  - Changes after a read-only security review of this step (`ecc:security-reviewer`; no bypass, forgery or open redirect found):
    - `clientIp` no longer reads the first `x-forwarded-for` entry. On Vercel it uses the platform headers. Elsewhere no header can be believed (a bare `next start` keeps whatever the client sent, checked by sending a different forged entry on each request), so all callers share the `unknown` bucket unless `TRUSTED_PROXY_HOPS` names how many proxies append to the header (risk R22).
    - `login:acct` reserves the attempt with `incr` before the password is checked, so parallel requests cannot each read "under the limit". `RedisKv.incr` runs `INCR` and `EXPIRE ... NX` in one `MULTI`, so a failure between them cannot leave a counter without an expiry (which would be a permanent lock).
    - Failed-login audit rows hold no typed email when the account does not exist (only a 16 hex character fingerprint, so a password pasted into the email field is never stored). Refused attempts write no row, except one `locked_account` row when a lock starts; a refused address is a log line.
    - The login page and `startSignIn` require the unlock cookie again, because the proxy lets any signed session through, revoked ones included (section 6.2, point 5). `GET /api/auth/expire` answers 404 to `Sec-Fetch-Site: cross-site`. Auth.js `debug` is off in production and its debug logger is silent, because it logs the request body (the password) when `authorize` throws something other than a sign-in error.
    - Not done here: `mustChangePassword` is exposed by the DAL but nothing enforces it yet. Step 7 (account page) adds the redirect in `requireUser` and the check in actions, because the seeded owner keeps a password that skips the policy until then.
- Result (production build, `next start` on 3100, real database, strong test secrets, in-memory limiter):
  - `/admin`, `/admin/login`, `/admin/users`, a wrong secret, `/api/admin/x` and a POST without an origin all answer 404 with the same status, body length (63,569 bytes) and headers as an unknown URL, apart from `x-middleware-rewrite: /not-found` (risk R21). A scanner path (`/wp-admin/x`) gets a bare empty 404.
  - The right secret answers 307 to the same path without the query and sets `sahan_admin_unlock` (`HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=7200`). With it, `/admin/login` is 200 with the form, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` and a nonce CSP; `/admin` redirects to `/admin/login?callbackUrl=%2Fadmin`. After 10 unlock attempts from one address even the right secret answers the same 404.
  - Wrong password through the real form: five generic messages, then "Too many attempts" (the account limit); an unknown email gets the generic message. Eight `auth.login.failure` rows with reason, IP and user agent and no password. A tampered token is treated as no session (404).
  - With a signed session (minted with the test secret, no password used): `/admin` is 200 with the shell, the user menu and nonce-carrying scripts; `/admin/login` redirects to `/admin`; the sign-out form answers 303, the session row is revoked with reason `sign_out`, an `auth.logout` row is written, the same cookie is then sent to `/api/auth/expire`, which clears it and redirects to `/admin/login?reason=revoked`.
  - In a browser the login page hydrates, follows the dark theme, shows no CSP violation, and the address bar no longer holds the secret.
  - Not verified by the agent: signing in with the real owner password, which the agent must not type into a form. The `authorize` path (session row, JWT issue, `auth.login.success` row) is the one step left for the owner to confirm by hand.
  - `/admin/x` for a signed-in user shows the admin styled 404 inside the shell with status 200, not 404: the panel `loading.tsx` makes the response stream, and a streamed response cannot change its status [N6]. Harmless for a signed-in user; the public 404 for everyone else is a real 404.

### Step 5: Email service

- In: step 2 (env, db), step 4 (audit).
- Out: `sendEmail({ to, subject, html, text, category, replyTo? }) -> { ok, provider, messageId?, attempts[] }`. Providers `resend`, `brevo-smtp`, `capture`. Provider order from `EMAIL_PROVIDER` (`auto` tries Resend then SMTP on transport failure, 4xx sender errors or 5xx). Templates return `{ subject, html, text }`: `mfaCode`, `newLogin`, `passwordChanged`, `mfaToggled`, `forcedLogout`, `invite`, `passwordReset`, `contactNotify`, `contactAutoReply`. `guards.ts`: `escapeHtml`, `assertNoHeaderInjection` (rejects CR and LF in addresses, subjects and names). `brevo-diagnostics.ts`: `getBrevoDiagnostics({ messageId?, email? }) -> { account, sender: { configured, verified, domainAuthenticated }, events[], verdict }` using the account, senders and message-events endpoints. `app/api/admin/email/diagnostics/route.ts` (needs `manageSettings`). `health.ts` for the settings screen. `email.sent` and `email.failed` audit rows carry provider, message id and error class, never the body.
- SMTP settings: port 587 uses STARTTLS (`secure: false`, `requireTLS: true`), port 465 uses implicit TLS.
- Read first: `15-route-handlers.md`, `after.md` [N23] [N27].
- Library docs: Resend Node SDK, nodemailer, Brevo transactional API and events.
- Tests: guards, template escaping with hostile input, provider selection with fake transports.
- Done when: one real test mail arrives through Resend and one through SMTP with Resend switched off, both sent only to the owner's address with no cc or bcc; diagnostics report a verdict for a Brevo API send; no test sends mail in bulk.
- Built, and where it differs from the plan:
  - `lib/email/service.ts` holds the rules with every side effect injected (providers, audit, clock); `lib/email/index.ts` is the only server-only wiring (`sendEmail`, `getEmailHealth`, `getBrevoDiagnostics`). `config.ts` turns the environment into provider settings and the provider order (pure). Providers are built on every call, so a changed variable applies to the next send.
  - Failover in `auto`: Resend, then SMTP, when the failure is transport (no status, timeout, thrown), 5xx, 401, 403 (Resend answers 403 for a sender domain that is not verified), 429, or an account or sender error code. A failure about the message itself (Resend 400 or 422 `invalid_parameter`, `missing_required_field`; SMTP every recipient rejected) stops the run, since another provider would fail too. Each provider has a 15 second timeout.
  - `sendEmail` returns a result and does not throw for a delivery failure or a rejected message (`errorClass`: `header_injection`, `bad_address`, `too_many_recipients` (more than 10 recipients), `no_provider`, and so on). Optional `cc` and `bcc` were added for the contact notification of step 11.
  - `capture` is refused in production both in the provider order and inside the provider. `email.sent` and `email.failed` audit rows carry category, provider, message id, error class, recipient count and per-attempt status; a test proves neither the body nor an address reaches them.
  - `brevo-diagnostics.ts` reads `/account`, `/senders`, `/senders/domains` and, given a `messageId` or `email`, `/smtp/statistics/events` (endpoints and fields checked against Brevo's reference), then gives one verdict: `no_api_key`, `api_key_rejected`, `sender_not_verified`, `domain_not_authenticated`, `delivered`, `rejected`, `pending`, `no_events`, `ready` or `unreachable`. The API key only travels in the `api-key` header. `GET /api/admin/email/diagnostics` needs `manageSettings` and returns the health report and the diagnostics.
  - `scripts/send-test-email.mts` sends one test mail to `ADMIN_EMAIL` only, through one forced provider, and only with `--yes`.
- Result: 62 new unit tests (guards and header injection, template escaping with hostile names, messages and links, provider selection, failover and timeouts with fake transports, audit content, Brevo verdicts, health with no secrets); `tsc` clean for the email files. No real mail was sent by the agent, since sending on the owner's behalf needs the owner's go-ahead. To finish the "done when" line, run the script twice (`--provider resend --yes`, then `--provider brevo-smtp --yes`) and call `/api/admin/email/diagnostics?messageId=<id>` for the SMTP id.

### Step 6: RBAC, users and invites

- In: steps 2, 4, 5.
- Out: `lib/auth/rbac.ts` (`can(role, permission)`, `loadMatrix()`, `canManage(actor, target)`; the catalogue itself exists since step 2), `lib/auth/invite-token.ts` (`createToken()` returns `{ token, hash }`, `verifyTokenTag(token)` is also used by the proxy), `lib/actions/users.ts` (`createUser`, `inviteUser`, `changeRole`, `setDisabled`, `deleteUser`, `sendReset`, `acceptInvite`, `setPassword`), `app/admin/(panel)/{users,roles}/*`, `app/admin/(auth)/set-password/*`, matrix cache key `sahan:rbac:v1` (60 s, cleared on edit).
- Read first: `data-security.md`, `authentication.md` [N12] [N13].
- Tests: full matrix table, hierarchy rules, last-DEVELOPER protection, token single use and expiry, password policy.
- Done when: an EDITOR cannot reach or call a user or role action, even by posting to the action directly; an invite link works once; every change has an audit row.
- Built, and where it differs from the plan:
  - Rules live in pure modules with unit tests: `lib/auth/rbac-rules.ts` (matrix, `can`, `canManage`, `assignableRoles`, `diffMatrix`, `validateMatrix`), `lib/users/rules.ts` (change role, disable, delete, reset and invite checks, including the last enabled DEVELOPER guard) and `lib/auth/invite-token.ts` (43 random characters plus a 22 character HMAC tag; only the SHA-256 of the random part is stored; `verifyTokenTag` needs no database, which is what lets the proxy use it). `lib/auth/rbac.ts` holds the database side: `loadMatrix` (one read per request, Kv key `sahan:rbac:v1` for 60 s) and `replaceMatrix`, which writes the rows and the audit row in one transaction and then clears the cache.
  - `lib/actions/guard.ts` (`authorizeAction`) is the first line of every Server Function: signed out, `mustChangePassword` (unless the action allows it) and a missing permission all answer with an error before anything is read. Then zod, then the rules, then one transaction with the change and its audit row, then `revalidatePath`. Shared result type and helpers are in `lib/actions/state.ts`, which is not a "use server" file because such a file may only export async functions (a helper there would become a public endpoint).
  - `acceptInvite` and `setPassword` are one action, `setPasswordAction`: the purpose comes from the token row. The token is claimed with one conditional `updateMany` (`usedAt` null, not revoked, not expired) inside the transaction that creates the user or changes the password, so a link works once even when two requests race. A reset also ends every session of that user and emails `passwordChanged`. After success the action sets the unlock cookie (the person just proved they hold a valid link) and redirects to the login page with a notice.
  - Proxy: a new rule 4b lets `/admin/set-password?token=...` through without the unlock cookie when the tag verifies. A wrong tag is the ordinary locked 404. The page checks the tag and the row again and shows one "no longer valid" card for a used, cancelled or expired link; it sends `referrer: no-referrer` because the URL carries the secret.
  - Permissions per action: `inviteUser` for invitations (and cancelling them), `manageUsers` for creating a user with a password, changing a role and disabling, `resetPassword`, `deleteUser` (DEVELOPER only, and the email must be typed), `managePermissions` for the matrix. The invitation asks for the name at acceptance, since the token row has none. If the invitation email fails the token is revoked at once and the action says so. Reset links share the `invite:actor` limit (20 per hour). Disabling a user ends their sessions and audits `auth.session.revoked`.
  - Deleting a user cannot fail on a foreign key: sessions and codes cascade, posts and inquiries keep their rows with the reference cleared. The typed-email confirmation is the only guard against a slip.
  - Screens: `users` (invite, create, accounts with a per row Manage disclosure, open invitations), `roles` (one form for the whole matrix; DEVELOPER shown ticked and locked; `managePermissions` locked for the other roles), `set-password` in the `(auth)` group. Forms share `components/admin/ui/ActionForm.tsx`, which takes the Server Function itself (so a form still posts without JavaScript), shows toasts, puts field errors next to their inputs and puts typed values back after a failed action.
- Result: pure-module tests for the matrix table, the hierarchy, the last-developer guard and the token (tag, single use, expiry); `tsc`, eslint and a production build are clean. Over HTTP against `next start` with a minted owner session: the five new pages render with a nonce CSP, an unauthenticated request gets the 404, a valid link without cookies shows the form, a tampered tag answers 404, a weak password and a mismatch are refused with the token still open, a revoked link shows the "no longer valid" card and a submit on it creates no user. Not exercised end to end: an EDITOR posting a user action directly (there is no EDITOR account, and no real user was created for the test), so that line of "done when" rests on `authorizeAction`, the rules tests and review; and a successful acceptance (it would create a real user). To finish those two by hand: invite a test address you control, accept the link once, try it a second time, then sign in as that EDITOR and open `/admin/users`.

### Step 7: MFA and account page

- In: steps 4 to 6.
- Out: `lib/auth/mfa.ts` (`issueChallenge`, `verifyChallenge`, `consumeChallenge`), `prisma/admin-cli.ts` with script `db:admin` (`clear-mfa <email>`, `set-password <email>`, `revoke-sessions <email>`, each audited with actor `cli`), `lib/actions/account.ts` (`updateProfile`, `changePassword`, `startMfaEnable`, `confirmMfaEnable`, `startMfaDisable`, `confirmMfaDisable`, `listMySessions`, `revokeMySession`), `app/admin/(panel)/account/*`, the code step of the login form, the dashboard banner for `mustChangePassword`, the security emails of step 5.
- Read first: `server-actions.md`, `forms.md` [N14].
- Tests: attempt counter, resend inheriting attempts, expiry, single use, purpose separation.
- Done when: with MFA on, a password alone never signs in; five wrong codes lock; disabling needs password and code; a password change kills every other session.
- Built, and where it differs from the plan:
  - `lib/auth/mfa-rules.ts` (pure, tested): six digit codes, 5 minute life (D8), five attempts, a 60 second window between a verified code and its use, an HMAC of the code bound to the challenge id, and attempts inherited by a resend. `lib/auth/mfa.ts` is the database side. `issueChallenge` applies `mfa:send:user` (3 per 10 minutes), inherits the attempts of the newest open challenge and emails the code. `verifyChallenge` counts the attempt with an atomic `updateMany` guarded by `attempts < 5` before it compares, so parallel guesses cannot exceed the limit. `consumeChallenge` succeeds only when one row changes (right user and purpose, verified in the last 60 seconds, not consumed).
  - Two step sign-in. `startSignIn` checks the password through Auth.js; for an account with MFA `authorize` throws `MfaLogin` (no session), and the action then sends the code. `completeSignIn` verifies the code and calls `signIn` again with only the challenge id, which `authorize` accepts only after `consumeChallenge`. So a password alone never signs in. `resendSignInCode` issues a new code that carries the failed attempts over. The login form shows the code step from the result of the last action, so a reload starts again from the password.
  - `lib/actions/account.ts`: `updateProfile`, `changePassword`, the four MFA actions, `revokeMySession` and `revokeOtherSessions`. Changing the password re-asks for the current one (counted on `login:acct`), applies the policy, updates the hash, ends every other session, and puts the new fingerprint into the current cookie with `unstable_update({ pwf })`, so this session stays signed in. Turning MFA on or off asks for the password first (that is what starts a challenge) and then the code; the challenge is bound to the user and purpose, so the second step does not ask for the password again (the plan asked for it at both steps; nothing is gained at the second one). Each change emails `passwordChanged` or `mfaToggled`.
  - `mustChangePassword` is now enforced in `requireUser` (redirect to `/admin/account?reason=change-password`), the panel layout allows only the account page, and `authorizeAction` refuses everything else. The dashboard banner of the plan became a notice on the account page, because the dashboard redirects there and a banner would never be seen. `listMySessions` is a read done by the page through `listSessions`.
  - `prisma/admin-cli.ts` (`pnpm db:admin clear-mfa | set-password | revoke-sessions <email>`): audits with actor `cli`, reads the new password from a hidden prompt or a pipe, applies the policy, and sets `mustChangePassword` again after `set-password` because the operator now knows the password.
- Result: attempt counter, resend inheritance, expiry, single use and purpose separation are tested in `mfa-rules.test.ts`; `credentials.test.ts` now expects `ok` with `mfaEnabled` for an MFA account. Over HTTP the forced change was checked with the real owner row: `/admin/users` redirects to the account page and the account page shows the "Choose your own password" notice. Not exercised end to end: the code step of the sign-in and the enable and disable flows, because they need a real mail and an account with MFA on, and the owner's password is not typed by the agent. To check by hand: turn MFA on at `/admin/account`, sign out, sign in, and confirm the code mail arrives; `pnpm db:admin clear-mfa <email>` is the way back if the mailbox is lost.

### Step 8: Sessions and audit log

- In: steps 4, 6, 7.
- Out: `session-store` additions (`revokeSession`, `revokeUserSessions`, `forceLogoutAll`, `listSessions`), `app/api/auth/session-status/route.ts`, `SessionHeartbeat`, `app/admin/(panel)/sessions/*`, `lib/admin/audit-query.ts` (filters: actor, action, entity, date range, cursor paging), `app/admin/(panel)/audit/*` with a before and after diff view, `app/api/admin/export/audit/route.ts` (needs `viewAuditLogs` and `exportData`).
- Read first: `userAgent.md`, `after.md` [N27].
- Tests: revocation with Redis warm, cold and down; heartbeat states; filter query builder.
- Done when: a revoked session is signed out on its next request and within 30 s while idle; force logout keeps the actor's other sessions unless asked; audit rows exist for every mutation of steps 4 to 7.
- Built, and where it differs from the plan:
  - `session-store` additions: `revokeSession`, `revokeUserSessions(userId, by, { exceptSid })`, `forceLogoutAll(by, { exceptUserId })` (keeps every session of the caller unless asked; a small change from `exceptSid` so a caller with several browsers stays signed in on all of them), `listSessions`, `invalidateUserSessionState`. Each drops the cached state of the sessions it ends, so the next request in the same process sees the revocation at once; another process sees it when its 30 second copy lapses.
  - `app/api/auth/session-status/route.ts` answers `{ active: true }` or `{ active: false, reason }` from the same data access layer as the pages and returns nothing else. `SessionHeartbeat` polls it every 30 seconds and when the tab regains focus, backs off while the server is unreachable, and sends a browser whose session ended to `/api/auth/expire`. The decisions are in `lib/admin/heartbeat.ts` and unit tested.
  - `sessions` page: active sessions (or the last 7 days with `?ended=1`), End session where `revokeSessions` and the hierarchy allow it, Force logout per person (`forceLogout`, follows `canManage`, optional reason that goes into the email), and Sign everyone out (DEVELOPER only, keeps the caller's own sessions unless the box is ticked). Affected users get the `forcedLogout` mail after the response, through `after()`.
  - `lib/admin/audit-query.ts` and the `audit` page: filters for actor, action (a `prefix.*` works), date range and cursor paging on `(createdAt, id)`, a Before and After table from `diffValues` and the `meta` object per row. `GET /api/admin/export/audit` needs `viewAuditLogs` and `exportData`, answers 404 to anyone else, returns at most 10,000 rows as CSV with the formula guard, and writes an `audit.exported` row.
  - Audit coverage: every mutation of steps 4 to 8 writes a row, in the same transaction where one exists (`user.created`, `user.invited`, `invite.revoked`, `user.invite_accepted`, `user.role_changed`, `user.disabled`, `user.enabled`, `user.deleted`, `user.profile_updated`, `rbac.matrix.updated`, `auth.password.changed`, `auth.password.reset_requested`, `auth.password.reset_completed`, `auth.password.check_failed`, `auth.mfa.*`, `auth.session.revoked`, `auth.session.force_logout`, `audit.exported`, plus the sign-in rows of step 4 and the `cli` rows).
- Review: a read-only security review of steps 6 to 8 found no critical or high issue and every action authorizing first. Its findings were fixed as follows.
  - A resend left the older codes alive, each with its own five guesses. `issueChallenge` now starts the new code from the highest attempt count of all open codes of that user and purpose and expires the older ones in the same transaction. The code life is 5 minutes, as D8 says.
  - A verified challenge no longer counts as a credential: `verifyChallenge` compares the code every time (a repeat costs an attempt), and MFA audit rows name the user, not the challenge id.
  - The last-DEVELOPER rule ran on a snapshot, so two developers acting on each other at once could leave none. `changeRole`, `setDisabled` and `deleteUser` now lock the DEVELOPER rows (`lib/users/tx.ts`, `SELECT ... FOR UPDATE`), re-read the target and re-run the rule inside the transaction, and abort with the rule's message.
  - Turning MFA on ends every other session and marks the current one as verified. A new invitation may only replace open invitations for roles the actor could send. Password changes and `db:admin set-password` cancel open reset links; disabling or deleting a person cancels the invitations they sent; deleting drops the cached state of their sessions. `/api/auth/expire` and `/api/auth/session-status` answer a bare 404 without a session cookie, so neither points at an admin. The email diagnostics route now also refuses a user who must change their password and answers 404 instead of 403.
  - Interactive transactions on Neon take a round trip per statement and a cold connection took 3.3 s, longer than Prisma's default 2 s to start and 5 s to finish, so the client sets `transactionOptions` to 10 s and 15 s.
  - Not changed: the invitation link stays in the URL for 72 hours (it is in access logs and history, and the page sends no referrer); the admin export has no rate limit.
- Result: 267 unit tests pass in all (66 new for steps 6 to 8: matrix, rules, tokens, MFA rules, session reader with Redis warm, cold and down, heartbeat, audit filters, diff, CSV, date formatting). Over HTTP against `next start`: a session ended from another session is `revoked` on the status route at once, its next page request is a 307 to `/api/auth/expire`, the other session stays active; the audit page filters by `auth.session.*` and shows the row; the export answers 200 as `text/csv` with a dated filename for the owner and 404 without a session, and writes `audit.exported`. The pages were also looked at in the browser pane (users, roles, sessions, audit and account, desktop and 375 px). Not verified: an idle tab signing itself out within 30 seconds in a real browser (the pane would not accept a session cookie written from script), which rests on the route test and the unit tested decisions; and the cross-process 30 second lapse.

### Step 9: CMS engine

- In: steps 2, 4, 6. Sections 5 and 8.
- Out: `lib/cms/{registry,schemas,defaults,loaders,merge,versions,icons}.ts`, `lib/site/get-site.ts`, `lib/settings/{schema,service}.ts` (`getPublicSettings()` under tag `settings:public`, defaults for every key), `SiteConfigProvider`, `docs/plan/admin-cms-string-audit.md`, `prisma/seed-content.ts` (imports current content as version 1 `PUBLISHED`), every public consumer switched to props (section 5.5), `FaqJsonLd` fed from the published block.
- Read first: `caching-without-cache-components.md`, `unstable_cache.md`, `revalidateTag.md`, `revalidatePath.md` [N15] to [N19].
- Tests: deep merge and array replacement, schema failure falls back to defaults, `null` only for unconfigured or build phase, version lifecycle (draft, publish, restore), optimistic-concurrency conflict.
- Done when: with an empty database every public page's HTML equals the step 3 capture; publishing a change shows after revalidation on the page and on every consumer page; restore works.
- Built, and where it differs from the plan:
  - Engine in `lib/cms/`: `types.ts` (field descriptors and `SectionDefinition`), `define.ts` (`defineSection` and field builders), `schema-parts.ts` (length-bounded strings, safe links, bounded lists), `href.ts` (the one link rule, no imports, shared with the browser editor), `merge.ts` (`deepMerge`: objects merge, arrays replace, `__proto__`, `constructor` and `prototype` skipped; `resolveSection` falls back to the defaults and reports why when a stored block no longer validates), `registry.ts`, `loaders.ts`, `versions.ts` (pure lifecycle rules), `service.ts` (server only: transactional save, publish, restore, discard, each with its audit row in the same transaction), `seed.ts`.
  - Registry in `lib/cms/pages/{home,about,works,updates,contact}.ts`: 10 Home, 5 About, 4 Works, 2 Updates and 4 Contact sections. Defaults adapt `contents/*.ts` where the content lives there (Home derives from `HomeContent` directly, so `Site.email` and `Site.myRole` still come from `config/site.ts`).
  - Public pages take props: `app/(site)/*/page.tsx` load with `getPageContent(page)` and hand the result to `components/pages/<Page>PageView.tsx`, which have no `server-only` import and no loader call. The admin preview renders the same views, so the two cannot drift.
  - Loaders: one `cached()` reader per page (tags `cms` and `cms:page:<slug>`). `getStoredPage` returns `null` only when the database is not configured or a read fails during the build, so the code defaults show and are never cached.
  - Lifecycle: at most one DRAFT and one PUBLISHED row per section; a save creates the draft as `max(version) + 1` or updates it in place; publish promotes the draft and marks the old published row SUPERSEDED; restore copies an old version into the draft; conflicts are detected with a conditional `updateMany` on the draft's `updatedAt`, and a unique violation on the version counts as a conflict.
  - `prisma/seed-content.ts` (`pnpm db:seed-content`) imports the code defaults as version 1 published, once per section that has no row. It is optional, because an empty table already renders the same pages. It was not run against the real database.
  - FAQ JSON-LD is fed from the section, so an edited answer reaches the structured data too. FAQ ids are no longer stored: the accordion numbers items by position (1-based, as before).
  - Deferred, on purpose: the `site` page (`getSite`, `SiteConfigProvider`, `lib/settings/*`) moves to step 16, where the settings screen needs it; `docs/plan/admin-cms-string-audit.md` is one merged file of the four per-page audits; Updates topics, tags and posts stay in `contents/updates.ts` until step 12; Works and About collections (projects, experience, services, skills) stay in code until step 11, so the registry holds only their wording.
- Result: the registry completeness test checks every section (defaults parse and survive unchanged, every default value has an editor field and the other way round with `fixedKeys` for ids that stay in code, consumers are real paths, labels and permissions exist). New unit tests: merge (15), versions (12), field model and link rule (17), content import (3). 441 unit tests pass in all. With an empty database the HTML of `/`, `/about`, `/works`, `/updates` and `/contact` is identical to the capture taken before this step (head, body and JSON-LD), after fixing the drifts the comparison found: a retyped hero tagline and FAQ title, 0-based FAQ ids, empty `ul` elements, empty `placeholder` attributes, and a placeholder email in place of `Site.email`. Public pages are still static with a one hour revalidate.

### Step 10: CMS editors for Home, About, Contact

- In: step 9.
- Out: `app/admin/(panel)/content/page.tsx` (page list with draft counts), `content/[page]/page.tsx`, `components/admin/cms/*`, `lib/actions/content.ts` (`saveDraft`, `publishSection`, `restoreVersion`, `discardDraft`), a preview route that renders a draft for the signed-in editor only.
- Read first: `forms.md`, `mutating-data.md` [N13] [N14].
- Until step 13, the `image` field takes an existing site path or an https URL plus alt text. `MediaUsage` rows are backfilled in step 13.
- Tests: registry completeness (every schema key has a field descriptor), permission split, invalid payload rejected before the database.
- Done when: an EDITOR saves drafts but cannot publish; every registry field is editable; forms work by keyboard and screen reader at 390 px.
- Built, and where it differs from the plan:
  - `app/admin/(panel)/content/page.tsx` lists the five pages with draft counts; `content/[page]/page.tsx` shows one collapsible card per section (open when a draft exists) with its live version, and a `SectionEditor` inside. Both need `editPages`; each section also checks its own `editPermission` and `publishPermission`, so an EDITOR sees Save draft and no Publish button.
  - `components/admin/cms/FieldRenderer.tsx` draws any field descriptor (text, long text, select, link, list of strings, list of objects, group) recursively: every input has a label, help and error tied by `aria-describedby`, list items have Up, Down and Remove buttons with their own accessible names, and length counters show on limited fields. `SectionEditor.tsx` holds the values as JSON and sends them in one hidden `payload`; quick checks come from `lib/cms/field-model.ts` (unit tested), and the server validates again with the section's zod schema, which is the authority. Save, Publish, Discard and Restore are four Server Functions in `lib/actions/content.ts` (`saveDraftAction`, `publishAction` (saves what is on screen, then publishes), `restoreAction`, `discardAction`), each calling `authorizeAction` first.
  - Unsaved-changes guard is a `beforeunload` prompt while the form is dirty; Discard and Restore ask for confirmation; a conflict shows a banner with a reload button.
  - Preview is `/preview/[page]` under `app/(site)`, not under `/admin`, because it needs the site's chrome, styles and CSP and the admin CSP only allows nonce scripts. It needs `editPages` (answers the public 404 UI otherwise), sends `noindex`, is never cached and renders draft over published over defaults through the same page views as the public routes.
  - Differences from the plan: the action names are `saveDraftAction`, `publishAction`, `restoreAction` and `discardAction`; there is no image field yet (no section uses one; the field kind arrives with step 13); the editor needs JavaScript to build the payload, so unlike the account forms it does not post without it.
- Result: over HTTP against `next start` and the real database, signed in as the owner with a minted session (26 checks, 25 pass, the 26th is explained below): the list and editor pages render, an unknown page is the not-found UI, `/admin/content` is a bare 404 without a session; an oversized text, an unreadable payload and an empty required text write nothing; a save creates draft 1, a second save with the right base updates it, a save with a stale base is refused and changes nothing; the public page does not change on a draft and the preview shows it; publish leaves one published row, stores the note and publisher, and the public page shows the text after revalidation; a second publish marks the first SUPERSEDED and the public page follows; restore copies the old version into a draft and leaves the live page alone; discard removes only the draft; audit rows exist for save, publish, restore and discard with the owner as actor. All test rows (2 content blocks, 8 audit rows) were deleted afterwards, the owner flag was restored and the session revoked. The one check that failed was the status of the anonymous preview: it is 200 with the not-found UI, not 404, because `app/(site)/loading.tsx` streams the response before the permission check runs; the body carries no preview content and the page is `noindex` (see R25). Not verified: an EDITOR account (none exists; the split rests on `DEFAULT_GRANTS` and the per-section permission check in the actions), and the form itself in a real browser (the pane would not accept a session cookie written from script).

### Step 11: Works collections

- In: steps 9, 10.
- Out: `lib/collections/*`, seeds from `contents/{projects,experience,service,skills}.ts`, `app/admin/(panel)/works/{projects,experience,services,skills}/*`, `lib/actions/works.ts` (create, update, delete, reorder, publish toggle), public consumers switched to loader props with derived counts still derived, `MediaUsage` rows for project images.
- Tests: seeded output equals today's arrays (deep equal after icon-key mapping), metric evaluation, reorder persistence.
- Until step 13, project images stay site paths or https URLs with alt text, the same rule as step 10.
- Done when: seeded output equals today; a new project with links and an image appears on Works and the home featured row after revalidation; reordering persists; an EDITOR-created item stays unpublished.
- Built, and where it differs from the plan:
  - `lib/collections/{projects,experience,services,skills,seed,index}.ts`: zod schemas per model, cached loaders (`getProjects`, `getExperience`, `getServices`, `getSkills`) that fall back to the `contents/*.ts` code arrays when the tables are empty or the database is not configured, and `seedProjects`/`seedExperience`/`seedServices`/`seedSkills`, idempotent, only filling an empty table. `prisma/seed-collections.ts` and `db:seed-collections` run them; not run against the real database.
  - `lib/actions/works.ts`: full CRUD, reorder and publish/feature toggle for Project and Experience; for Service and Skill, ServiceGroup and SkillGroup are containers only (`name`/`label` and reorder; a group is never itself published), while the leaf rows (Service, Skill) carry `published` and get the full action set. `editCollections` guards create/update (an EDITOR's item stays unpublished); `publishCollections` guards delete, reorder, publish, feature and unpublish. Every action audits inside its transaction and calls `invalidate(forCollection(...))`.
  - `app/admin/(panel)/works/{page,projects,experience,services,skills}/*`: list pages with status, search where noted, up/down reorder with accessible names, delete confirmation.
  - Public consumers: `components/pages/{Home,About,Works}PageView.tsx` and the matching `app/(site)/*/page.tsx` now receive `projects`/`experience`/`services`/`skills` as props from the loaders, with derived counts (years, project counts, service "done" metrics) still computed from the loaded data, never stored.
  - `MediaUsage` rows for project images are deferred to step 13, as planned; until then an image is a site path or an https URL plus alt text.
- Result: `tsc --noEmit` 0 errors, full unit suite passes (project totals below), registry-style tests cover seeded-output equality, reorder logic, permission split (EDITOR cannot publish/feature/reorder/delete) and loader fallback. Not run: the seed scripts, and a browser check of the admin UI against the real database.

### Step 12: Updates and blog

- In: steps 9, 10, 11. Media picker from step 13 is used through a stub until then.
- Out: `lib/blog/*`, `lib/cms/rich-text.ts` (`sanitizeRich(html)`, one allowlist used on write and in the public loader), `lib/actions/blog.ts`, `app/admin/(panel)/blog/*` (list with search, status filter, bulk actions; editor page), `components/admin/blog/RichEditor.tsx` (client, loaded on demand), `lib/ai/{providers,guard,blog}.ts`, `app/api/admin/ai/{draft,cover}/route.ts`, public `/updates` from `blog:list`, `app/(site)/updates/[slug]/page.tsx`, `app/rss.xml/route.ts`, sitemap additions, import of `UpdatesContent.posts` as published posts, `app/api/cron/blog-publish/route.ts`.
- Read first: `generateStaticParams`, `generateMetadata`, `dynamicParams`, the JSON-LD guide, `sitemap.md` and `15-route-handlers.md` (before coding) [N23] [N28].
- Library docs: TipTap 3, `sanitize-html`, Vercel AI SDK.
- Tests: slug rules, sanitizer allowlist with hostile HTML, scheduled visibility (`publishAt <= now`), AI guard (injection text is wrapped as data and secrets never enter prompts).
- Done when: an EDITOR cannot publish; public HTML is sanitized; a scheduled post appears within the 5 minute revalidate window without cron and the daily cron flips its status; TipTap is absent from public bundles.
- Built, and where it differs from the plan:
  - `lib/cms/rich-text.ts`: one `sanitize-html` allowlist (`p, br, hr, h2-h4, ul, ol, li, strong, b, em, i, u, s, code, pre, blockquote, a, img`), used by `lib/actions/blog.ts` on save and again by the public loader before render, so a row written before a rule tightened is never trusted as-is. An anchor with an unsafe `href` (checked with the same `isSafeHref` from step 9) is unwrapped to plain text rather than dropped, so the sentence still reads; an image without a safe `src` or a non-empty `alt` is dropped outright. `extractText()` strips every tag for search text and the read-time calculation.
  - `lib/blog/{slug,readtime,schema,queries,seed}.ts`: pure slug rules (lowercase, hyphenated, unique, length-capped), a read-time estimate from `contentText`, and `getPosts()`/`getPostBySlug()` filtering strictly on `status: "PUBLISHED"` (`PUBLISHED_WHERE`, unit tested) — never on `publishAt`, so a `SCHEDULED` post stays hidden until `blogPublishJob` (step 16) or a manual publish actually promotes the row, exactly as that job already assumes. The loader falls back to `contents/updates.ts`'s array only when the `Post` table is empty, the same rule as step 11's collections.
  - `lib/actions/blog.ts`: create/update/delete/publish/schedule/unpublish/archive and a bulk action, each authorizing first, then `editBlog` for draft CRUD and `publishBlog` for any status change touching `PUBLISHED`/`SCHEDULED`/`ARCHIVED` and for delete (`deleteBlog`), audited in the same transaction, `invalidate()` only when a change actually touches a published post.
  - `components/admin/blog/{RichEditor,RichEditorField,BlogEditorForm,BlogListClient}.tsx`: TipTap 3 loaded through a dynamic import with `ssr:false`, so it and `sanitize-html`'s admin-only surface never reach the public bundle; saving computes `contentHtml`, `contentText` and `readMinutes` from the editor's `content` through `sanitizeRich`/`extractText` server-side, never trusting anything the browser sends as already safe.
  - `lib/ai/{guard,providers,blog}.ts`: an injectable, ordered provider chain (OpenRouter, Gemini by raw `fetch`, NVIDIA) mirroring `lib/email/service.ts`'s fallback pattern; every system prompt is a fixed constant that never interpolates caller input, and a topic or prompt is always fenced between unforgeable delimiters (`wrapUserData`) before it reaches the user message, so it can only ever be data to write about, never a new instruction; `looksLikeLeak()` is a defense-in-depth check on the model's own reply for a forged delimiter or a secret-shaped token. `app/api/admin/ai/{draft,cover}/route.ts` need `generateAI` and are rate-limited.
  - `app/(site)/updates/[slug]/page.tsx` (`generateStaticParams` from published slugs, `generateMetadata` from `seoTitle`/`seoDescription`/`canonicalUrl` with fallbacks, renders only `contentHtml`), `app/rss.xml/route.ts` (RSS 2.0 of the latest published posts) and `app/sitemap.ts` (a `<updates/slug>` entry per published post) are new; `UpdatesExplorer`/`UpdatesCard` and the hero/filter sections from step 9 keep working, now driven by real posts.
  - `prisma/seed-blog.ts` (`db:seed-blog`) imports `UpdatesContent.posts` as published rows, computing slug, `contentHtml`, `contentText` and `readMinutes`; idempotent, only when the table is empty; not run against the real database.
- Result: `tsc --noEmit` 0 errors, full unit suite passes (678 tests). I independently ran `sanitizeRich` against a hostile string combining `<script>`, `<iframe>`, `<style>`, `onerror`, `onclick`, `onmouseover` and a `javascript:` href: every one of them was stripped and nothing unsafe survived. Not done: `db:seed-blog`, a live call to any AI provider, a browser check of the TipTap editor and the media picker inside it, and RSS feed validation against a real reader.

### Step 13: Media

- In: steps 2, 4, 6.
- Out: `lib/media/*`, `app/api/admin/uploads/sign/route.ts` (signed params: folder `sahan/`, `allowed_formats`, timestamp), `lib/actions/media.ts` (`registerUpload` re-reads the asset from Cloudinary and rejects and deletes it when type, size or folder is wrong), `app/admin/(panel)/media/*`, `components/admin/media/MediaPicker.tsx`, `app/media/[...slug]/route.ts` (HMAC-signed with `MEDIA_SIGNING_SECRET`, allowed widths and qualities only, then a redirect to the Cloudinary delivery URL), `next.config.ts` `images.remotePatterns` for `res.cloudinary.com` with `pathname` restricted to `/${CLOUDINARY_CLOUD_NAME}/**` [N22], seed of `public/works/*` as `LOCAL` assets.
- Limits: images up to 8 MB (`jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`, `svg` is refused), documents up to 10 MB (`pdf`).
- Read first: `image.md` [N22].
- Library docs: Cloudinary Node SDK signed uploads.
- Tests: signature verification, allowed width table, validation rules, usage tracking.
- Done when: disallowed files are rejected; alt text is required wherever an image is used in content; deleting an asset in use is blocked with the list of places; `uploadMedia` and `deleteMedia` are enforced on the server.
- Built, and where it differs from the plan:
  - `lib/media/{config,signature,validation,cloudinary,service,seed}.ts`: signing and Cloudinary access take the secret as a parameter (`signMediaUrl(params, secret)`, `verifyMediaSignature(params, signature, secret)`, `signCloudinaryUpload(params, secret)`), matching the pure-function pattern of `lib/auth/invite-token.ts`, rather than reading `env` inside the function; each caller reads its own secret once. `registerUpload` re-reads the asset from the Cloudinary Admin API through an injectable client, checks type, size and the `sahan/` folder prefix, and deletes the asset from Cloudinary and refuses when any check fails, before creating the `MediaAsset` row and its audit event in one transaction.
  - `deleteMedia`: blocked when any `MediaUsage` row exists, listing where the asset is used; otherwise deletes from Cloudinary first, then the database row, and audits.
  - `components/admin/media/MediaPicker.tsx`: requests a signature from `/api/admin/uploads/sign`, uploads straight to Cloudinary from the browser with the signed params, calls `registerUpload`, and returns `{ mediaId, src, alt }`.
  - `app/media/[...slug]/route.ts`: verifies the HMAC signature in constant time, allows only a fixed table of widths and qualities, then redirects to the Cloudinary delivery URL.
  - `lib/media/seed.ts` (`prisma/seed-media.ts`, `db:seed-media`) scans `public/works/*`, reads JPEG and PNG headers directly for width and height (no new dependency), and registers `LOCAL` assets idempotently; not run against the real database.
  - `recordMediaUsage`/`clearMediaUsage` are exported for steps 11 and 12 to call when an image field is saved.
- Result: signature and validation tests are pure and pass with a fixed test secret, independent of any real environment variable (36 tests). `tsc --noEmit` 0 errors, full unit suite passes. Not done: a live Cloudinary upload and a browser check of the picker and library pages.

### Step 14: Contact pipeline and inquiries

- In: steps 5, 9.
- Out: `app/api/contact/route.ts` (JSON only; zod; honeypot field; signed timing token from `app/api/contact/token/route.ts` that must be 3 s to 2 h old; origin check; limiters of section 6.7; spam score from link count, repeated text and disposable domains; dedupe of identical messages per `ipHash` within 10 minutes), `lib/inquiries/*` (store, notify owner with cc and bcc from `RESEND_CC_EMAILS` and `RESEND_BCC_EMAILS`, auto-reply, `InquiryEmailEvent` rows), `ContactForm` submits for real and keeps the WhatsApp and Telegram quick links, `app/admin/(panel)/leads/*`, `lib/actions/leads.ts`, `app/api/admin/export/leads/route.ts`.
- Tests: schema, spam heuristics, header injection neutralised, dedupe, provider failure recorded.
- Done when: a submission is stored and emailed; with Resend forced to fail it falls back and the failure shows in the lead detail; over-limit traffic gets 429; the sender receives a confirmation.
- Built, and where it differs from the plan:
  - `lib/inquiries/{token,schema,spam,service,notify}.ts`: `issueToken(secret)`/`verifyToken(token, secret, now?)` are pure, take the secret as a parameter (same pattern as step 13's fix), sign a nonce plus timestamp with HMAC-SHA256 and compare in constant time; both `/api/contact/token` and `/api/contact` call the same implementation. `app/api/contact/route.ts` rejects a non-JSON content type (415), a body over 16 KB (413), a disallowed origin (403) and a missing or out-of-window token (403, fail closed if the signing secret is unset), strips `\r\n` from name, email and topic before they reach storage or a mail header, hashes the IP with the internal signing secret (no ipHash at all if the secret is missing, never a literal fallback), and answers 429 with `Retry-After` once a limiter is genuinely over budget.
  - Spam: `scoreSpam` weighs disposable domains, link count, repeated characters and all-caps; a message over the threshold is stored as `SPAM` and gets neither the owner notification nor the auto-reply (no backscatter), while the sender still sees the same success response as a normal submission, and so does a honeypot hit or a duplicate.
  - Deduplication: identical `ipHash` + email + message within 10 minutes short-circuits to the same silent success.
  - Emails run after the response with `after()` from `next/server`, so serverless does not drop them; every attempt, including a provider fallback, is recorded as an `InquiryEmailEvent` with a truncated error, and `Inquiry.emailStatus`/`autoReplyStatus` end `SENT` or `FAILED`.
  - `app/admin/(panel)/leads/*` (list with status filter and search, detail with email history and notes) and `lib/actions/leads.ts` (status, notes, assignee, delete) need `viewLeads` to read and `manageLeads` to change; `app/api/admin/export/leads/route.ts` needs `viewLeads` and `exportData`, caps rows, uses the existing CSV formula guard, and writes `leads.exported`.
  - `ContactForm` posts to `/api/contact` for real, still degrades to the `mailto:`/WhatsApp flow on a failed fetch, timeout or 429, and keeps the WhatsApp and Telegram quick links; the honeypot input is visually hidden, `aria-hidden`, `tabindex="-1"` and `autoComplete="off"`, the only markup addition for a no-JS visitor.
- Result: `tsc --noEmit` 0 errors, full unit suite passes, including dedupe, header-injection stripping and provider-fallback event recording with a fake mailer. Not done: a live mail send and a real browser submission.

### Step 15: Chatbot

- In: steps 9, 11, 12, 14. AI provider chain from step 12.
- Out: `components/site/chat/ChatWidget.tsx` (lazy client component mounted from `(site)/layout.tsx`, never from `SiteShell`, and only when the public setting is on), `app/api/chat/route.ts` (streaming, limiters, input cap 1000 characters, last 10 messages), `lib/chatbot/{knowledge,guard,session,prompts}.ts` (knowledge is built only from published content, collections and active training entries, under tag `chatbot:knowledge`), `app/admin/(panel)/chatbot/*`, `lib/actions/chatbot.ts`, lead capture into `Inquiry` with `source = chatbot`. Output filter strips HTML and any URL outside the site, project links and contact channels.
- Read first: `15-route-handlers.md` (streaming) [N23].
- Library docs: Vercel AI SDK streaming.
- Tests: guard against prompt injection strings, output filter, knowledge never contains a secret or admin URL.
- Done when: the bot cannot reveal secrets, prompts or admin URLs; answers draw on published content; turning it off removes the widget; history needs `viewChatHistory`, training needs `manageChatbot`.

### Step 16: Settings, dashboard, cron, maintenance

- In: steps 5, 8, 9, 13.
- Out: extends `lib/settings/*` from step 9 with the keys `features`, `maintenance`, `security.ipAllowlist`, `chatbot.config`, `email.routing`, `rbac.seedVersion`, `app/admin/(panel)/settings/*` (site sections link to the `site` page editor, integration health for database, Redis, Resend, Brevo, Cloudinary, AI, cache clear), maintenance mode in the proxy with the `MAINTENANCE_BYPASS_SECRET` cookie, `vercel.json` daily crons, `app/api/cron/{blog-publish,session-cleanup,audit-prune}/route.ts` (each checks `Authorization: Bearer ${CRON_SECRET}` in constant time), a manager screen to run jobs (needs `manageCron`, except `audit-prune`, which deletes audit rows and needs `manageSettings`), dashboard widgets (recent activity, drafts, new inquiries, unpublished changes, health, security status, password-change banner).
- Read first: `instrumentation.md`, `headers.md`, `proxy.md` [N8] [N26] [N29].
- Tests: settings schemas, maintenance bypass cookie, cron auth (missing, wrong, right), allowlist matching including IPv6.
- Done when: only DEVELOPER changes settings and each change is audited; maintenance blocks the public site but not a bypassed developer; cron routes reject calls without the secret.
- Built, and where it differs from the plan:
  - `lib/settings/{schema,service}.ts`: zod per key (`features`, `maintenance`, `security.ipAllowlist`, `chatbot.config`, `email.routing`, `rbac.seedVersion`), `getPublicSettings()` cached under `settings:public` and limited to the public-safe subset, every write through `authorizeAction` (`manageSettings`, or `manageIpAllowlist` for the allowlist, `clearSystemCache` for the cache button), audited in the same transaction. The `site` page (`getSite`, `SiteConfigProvider`) stays deferred, as planned, since it depends on the public components other steps still touch.
  - Maintenance and the allowlist are mirrored to the kv layer (`lib/cache/kv`, Upstash or memory) on every save, because the proxy has no database access; a kv miss or read failure is treated as the safe default (not in maintenance, allowlist empty), never as blocking.
  - `MAINTENANCE_BYPASS_SECRET` sets a signed `HttpOnly` cookie the same way the hidden login unlock does, never revealing the mechanism; `/admin` and `/api/admin` are always exempt from the maintenance page.
  - IP allowlist: `lib/security/allowlist.ts` matches IPv4, IPv6 and CIDR, and `shouldBlockAdminByAllowlist(ip, list)` is the one decision the proxy calls, pure and unit tested. It fails open both when the list is empty and when the caller's IP is the shared `"unknown"` bucket (risk R22): checking `"unknown"` against the list would have locked every caller, owner included, out of `/admin` the first time the allowlist was turned on without `TRUSTED_PROXY_HOPS` set. `lib/actions/settings.ts` also refuses to save a new allowlist that would exclude the caller's own known IP.
  - `lib/cron/{jobs,auth}.ts`: `Authorization: Bearer ${CRON_SECRET}` is checked in constant time (length-checked `timingSafeEqual`) and rejects a missing secret; `blogPublishJob`, `sessionCleanupJob` and `auditPruneJob` take an injectable database client, so they are unit tested with a fake and run for real from `app/api/cron/{blog-publish,session-cleanup,audit-prune}/route.ts` and from a manual run in `/admin/settings` (`manageCron`, except audit-prune which needs `manageSettings`). `sessionCleanupJob` also deletes revoked sessions and applies a grace period to tokens and MFA challenges, not only their exact expiry.
  - `lib/admin/integrations.ts` reports database, Redis, Resend, Brevo, Cloudinary and AI provider health as configured/reachable booleans through an injectable fetch with a short timeout, and never returns a secret or a fragment of one.
  - Dashboard (`app/admin/(panel)/page.tsx`): recent activity, draft and unpublished-change counts, new inquiries, integration health and a security status block (MFA state, `mustChangePassword` banner), each widget shown only when the viewer holds its permission and tolerant of an unconfigured database.
- Result: `tsc --noEmit` 0 errors, full unit suite passes, including the allowlist decision, the maintenance bypass cookie, cron auth and the job logic against fakes. Not done: `vercel.json` crons have not run on real infrastructure, and `/admin/settings` has not been clicked through against the real database.

### Step 17: End-to-end verification and security audit

- In: all earlier steps.
- Out: `e2e/*.spec.ts` (unlock then sign in, MFA, invite, role limits, content edit to public page, blog publish, media upload, contact submit, session revoke) running against `next start` with `EMAIL_PROVIDER=capture` and schema `sahan_test`; `docs/plan/admin-cms-security-review.md` (OWASP top ten mapping, secret handling, XSS, CSRF, IDOR check of every `app/api/admin` route and every action, rate limits, headers, `pnpm audit`); Lighthouse reports for the five public pages; fixes for every finding.
- Done when: no high or medium finding is open; e2e passes; public accessibility scores are unchanged.

### Step 18: Documentation and ops handoff

- In: all earlier steps.
- Out: README section, `docs/admin.md` (unlock and sign in, roles, restore a content version, add a user, rotate secrets, Vercel env setup, break-glass for Redis), `.env.example` checked against `lib/env.ts` by a script, `AGENTS.md` and `CLAUDE.md` notes for admin, CMS and cache rules, secret rotation checklist.
- Done when: a fresh clone plus `.env.local` reaches a working admin using the docs only.

## 12. Testing and verification conventions

- Unit tests sit next to the code as `*.test.ts` and run with `node --conditions=react-server --import tsx --test "lib/**/*.test.ts"`. The condition lets modules that import `server-only` load outside Next (D21). The command is run with `node` directly, not through `pnpm run` (F7).
- Database tests need `TEST_DATABASE_URL` whose schema is `sahan_test`. The helper refuses to run against any other schema name and skips when the variable is absent.
- E2E (step 17) uses Playwright against a production build. Mail goes to the `capture` provider, which `assertProductionEnv()` rejects in production.
- Before any step touches public rendering, capture the HTML of the five routes and an unknown URL into the session scratch directory, and diff after.
- Each step records its own commands and results in its change description. Nothing is committed unless the owner asks.

## 13. Risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| R1 | `unstable_cache` is documented as replaced by `use cache` [N16]. | One wrapper file (`lib/cache/cached.ts`). Revisit Cache Components after step 17 as its own task. |
| R2 | Local Node is 22.20 while `engines` asks for 24 or newer. | pnpm only warns. Prisma 7 and the libraries here support 22. Keep `engines` and align the machine when convenient. |
| R3 | Prisma CLI may reject `channel_binding` or the pooled host. | `DIRECT_DATABASE_URL`, else a derived CLI URL (section 7). |
| R4 | pnpm blocks install scripts, so `prisma generate` may not run. | `allowBuilds` entries (D22) and an explicit generate script called before build. |
| R5 | Four secrets are 8 to 14 characters. | Length rules in `lib/env.ts` (section 6.8). Replace with random 32 or more characters before deploying. |
| R6 | Credentials were pasted into a chat and live in `.env.local`. | After go-live rotate: Neon password, Upstash token, Cloudinary secret, Resend key, Brevo SMTP key and API key, OpenRouter keys, Gemini key, NVIDIA key, Google service account key. Revoke any Claude Code OAuth token that was shared. Change the seeded owner password on first sign-in. |
| R7 | The unlock secret is visible in access logs for the request that carries it. | Short cookie life, rotate the secret when in doubt, `Referrer-Policy` and the redirect keep it out of later pages. |
| R8 | The Resend sender address belongs to another domain (`contact.valoremrealestate.ae`). | Used as configured. Verify a domain of this portfolio in Resend later and switch `RESEND_SENDER_EMAIL`. Brevo SMTP is the fallback. |
| R9 | Brevo API accepted sends that never arrived. | Diagnostics route reads message events and the senders list; the likely cause is an unverified sender or unauthenticated domain. SMTP stays the fallback. |
| R10 | Redis outage makes sign-in and chat unavailable (fail closed). A lost mailbox with MFA on blocks sign-in. | Deliberate. Break-glass in sections 6.7 and 6.4 (`db:admin clear-mfa`). Public pages and contact keep working. |
| R11 | Neon can take seconds to wake. | Loading states on admin pages, `connect_timeout` 15 s, no pool warm-up during build. |
| R12 | Rewiring about 25 components can change visuals. | HTML capture and diff with an empty database, Lighthouse before and after (step 9). |
| R13 | `generateStaticParams` for posts sees no database at build. | Empty list, `dynamicParams` stays on, pages render on first request and are cached. |
| R14 | Two editors change the same draft. | `baseUpdatedAt` conflict check (section 7). |
| R15 | Editor bundle weight. | TipTap and the admin UI load on admin routes only; step 12 checks the public bundles. |
| R16 | Stale-while-revalidate means the first request after a publish can still see the old page. | Accepted (section 5.1). The publish confirmation says the change is live after one reload. A warm-up request can be added in step 9 if it proves annoying. |
| R17 | A production env error stops the whole server, including the public site. | Accepted by the plan, and limited to deployments where `DATABASE_URL` is set (D19). |
| R18 | The Resend and Brevo credentials sit in `.env.local` next to the database password. | `.env.local` is git-ignored (`.env*.local`). No secret value appears in tracked files, and step 17 runs a scan for that. |
| R19 | The root `not-found.tsx` renders `SiteShell`, so its client references and the Mantine stylesheet reach `/admin` (405 KB of entry scripts and 488 KB of CSS instead of 70 KB and 291 KB). | Accepted for a panel used by a few people. `admin.css` repaints the body over Mantine's. If it matters later: `experimental.globalNotFound` once it is stable (it renders outside the layout tree), or a lightweight 404 chrome. Recheck in step 17. |
| R20 | `pageMetadata()` gives every inner page its own `openGraph` and `twitter`, so those pages carry no `og:image`; only `/` has one. This was already true before step 3. | Fix in step 9, when page metadata is rewired to the CMS: add the image URL to `pageMetadata()`. |
| R21 | Next's own server adds `x-middleware-rewrite: /not-found` to the response of a request the proxy rewrites (`resolve-routes.js` sets it after the middleware headers are filtered), so on a self-hosted `next start` a locked `/admin` differs from an unknown URL by that one header. | Vercel strips it. On a self-hosted deployment, remove `x-middleware-*` response headers at the reverse proxy. Recheck in step 17 against the real deployment. |
| R22 | Outside Vercel with `TRUSTED_PROXY_HOPS` unset, every caller shares the `unknown` limiter bucket, so `unlock:ip` (10 per 10 minutes) and `login:ip` are one global budget: an attacker can use it up and keep the owner from unlocking or signing in. Guessing stays bounded, because `login:acct` is per account and the unlock secret is long and random. | Deploy on Vercel, or set `TRUSTED_PROXY_HOPS` behind your own proxy. Audit and session rows carry no IP until then. Recheck in step 17. |
| R23 | An empty role matrix is stored as no rows, and no rows means "not seeded", so it reads back as the defaults: the roles cannot be stripped of every permission from the screen. | Acceptable: a role with nothing would be a locked account anyway. To lock a person out, disable the account. |
| R24 | Without Upstash configured, the session-state cache (30 s) and the limiters are per process. On several serverless instances a revoked session can stay valid on another instance for up to 30 s, and the limiters do not add up. A request that loads state just before a revoke commits can also write the old state back for 30 s. | Configure Upstash for production (step 16 checks it). The database stays the authority, so nothing outlives the 30 s. |
| R25 | `/preview/[page]` sits under `(site)`, whose `loading.tsx` streams the response, so the status line is already 200 when the permission check fails: an anonymous request gets the 404 UI with status 200. The body has no preview content and the page is `noindex`. | Accepted: the status carries no information the UI does not. The same holds for an unknown `/admin/content/<x>`. If it matters, move the route out of `(site)` and add the site shell by hand. |
| R26 | Found and fixed in step 16: turning the admin IP allowlist on while `TRUSTED_PROXY_HOPS` is unset (R22) would have checked the shared `"unknown"` caller IP against the list, which never matches, locking every caller including the owner out of `/admin`. | Fixed: `shouldBlockAdminByAllowlist` fails open on the `"unknown"` IP as well as on an empty list (`lib/security/allowlist.ts`), unit tested. Still recheck alongside R22 once `TRUSTED_PROXY_HOPS` is set for real. |
| R27 | The step 13 and step 14 agents first wrote signing functions (`lib/media/signature.ts`, the contact token) that read a secret from `env` inside the function, which only works when a real `.env.local` is sourced and makes the unit tests depend on the environment they run in; the contact route's IP hash also once fell back to a literal `"default"` secret. | Fixed: every signer takes the secret as an explicit parameter, matching `lib/auth/invite-token.ts`; tests pass a fixed value; the literal fallback was removed, so no ipHash is stored when the real secret is missing instead of a guessable one. |

## 14. Resolved questions

| Question | Answer |
| --- | --- |
| Multiple root layouts or one thin root? | One thin root with `(site)` and `admin` layouts (D1). The plan wording for step 3 is updated. |
| Are Auth.js adapter tables needed? | No. Credentials with JWT needs no adapter, so `Account`, `Session` and `VerificationToken` are not created. `UserSession` replaces the session table. |
| Where does session state live? | Postgres is authoritative, Redis caches 30 s (D7). |
| Where are MFA codes stored? | Postgres, hashed (D8). |
| TipTap or markdown? | TipTap (D12). |
| Are there rich text fields in CMS sections? | No. Plain and long text only. A `richtext` kind is added when a section first needs it. |
| How do site identity, contact details and SEO defaults get edited? | As CMS content under page `site`, permission `manageSettings` (D16). Operational switches are `Setting` rows. |
| How do icons work in the database? | Icon keys mapped by `lib/cms/icons.ts` (section 8). |
| Which locked decision changes? | Three refinements, all recorded in the plan: layouts (D1), instant revocation is DB authoritative with a Redis cache (D7), cron uses `CRON_SECRET` and a daily schedule (D17). |
| How on time is a scheduled post? | Within the 5 minute revalidate window without cron. The daily cron makes the status and cache exact. |
| Is `CRON_SECRET` new? | Yes. Vercel sends it as a bearer token. It is generated into `.env.local` in step 2 and must also be set on Vercel. |
| Where do invite tokens live? | `AuthToken` table, hashed, single use (section 6.5). |
| How is the owner created without a shell? | `db:seed` script, plus a bootstrap in `authorize()` that runs only when the users table is empty. |
| What does the locked login return? | The site 404 through a proxy rewrite to an unmatched path (section 6.2). |
| Does the public site depend on the database? | No. Build falls back to code defaults, runtime keeps the last good ISR page (D4). |
| Are public pages under a CSP? | Static security headers only. Nonce CSP applies to `/admin` (D18). |
| How are MANAGER limits enforced? | `canManage` on top of each permission, in every action and in tests (section 9). |
| How do tests avoid sending mail or touching real data? | `capture` mail provider and the `sahan_test` schema guard (D11, D21). |
| How does an invited user sign in? | Accepting an invite or setting a password issues the unlock cookie, then redirects to the login form (section 6.2, step 4). |
| How is probing of invite and reset links prevented? | Tokens carry an HMAC tag that the proxy checks without the database. A bad token gets the site 404 (section 6.2). |
| Why `"max"` and not `{ expire: 0 }` for revalidation? | Stale-while-revalidate keeps the public site up if regeneration fails. The cost is one stale first request (section 5.1, R16). |
| What if the owner loses the mailbox while MFA is on? | `db:admin clear-mfa <email>` from the machine that holds `.env.local` (section 6.4). |
| Can one verified MFA challenge open two sessions? | No. `authorize` consumes it atomically (section 6.4). |
| Does deleting a user fail when they wrote posts? | No. `Post.authorId` is optional with `SetNull` (section 7). |
| Which Next behaviours were checked against local docs? | All labelled in section 15. `updateTag` is deliberately not used for `unstable_cache` tags because the docs list other tag sources [N18]. |

No open questions remain.

## 15. Next 16 citations

Paths are under `node_modules/next/dist/docs/01-app/`, checked against the installed 16.3.5 docs.

| Label | File and lines | What it says |
| --- | --- | --- |
| N1 | `03-api-reference/03-file-conventions/route-groups.md:25-32` | Route groups allow multiple root layouts. Navigating between different root layouts is a full page load. Without a top-level layout the home route must live in a group. |
| N2 | `03-api-reference/03-file-conventions/layout.md:112-146` | An app must include a root layout that defines `<html>` and `<body>`. Do not add `<title>` or `<meta>` to it. Any layout without a layout above it is a root layout. |
| N3 | `03-api-reference/03-file-conventions/not-found.md:13, 133` | `not-found` returns 200 for streamed responses and 404 for non-streamed ones. The root `not-found` handles unmatched URLs for the whole app. |
| N4 | `03-api-reference/03-file-conventions/not-found.md:47-58` | `global-not-found.js` is experimental and is meant for apps with multiple root layouts. |
| N5 | `03-api-reference/03-file-conventions/loading.md:76-86` | `loading` wraps the page, nested layouts and `not-found` in Suspense, and does not wrap the layout of the same segment. |
| N6 | `03-api-reference/03-file-conventions/loading.md:101-113` | The status cannot change once streaming starts. To get a 404 status, check in the proxy and rewrite to a not-found route or produce a 404 response. |
| N7 | `03-api-reference/03-file-conventions/proxy.md:19-21` | Proxy runs apart from render code. Pass data with headers, cookies, rewrites, redirects or the URL. |
| N8 | `03-api-reference/03-file-conventions/proxy.md:73-75` | Without a `matcher` the proxy runs on every request, including static files and images. |
| N9 | `03-api-reference/03-file-conventions/proxy.md:249-251` | Server Functions are POST requests to the route that uses them. A matcher that excludes a path skips them, so authorization must be verified inside each function. |
| N10 | `03-api-reference/03-file-conventions/proxy.md:255` | Proxy defaults to the Node.js runtime, and the `runtime` option is not available. |
| N11 | `03-api-reference/03-file-conventions/proxy.md:211-220` | Proxy can rewrite the response to display a given URL, including a rewrite to a route that produces a response. |
| N12 | `02-guides/authentication.md:1026, 1131, 1350-1352, 1461` | Optimistic checks in the proxy, the data access layer, the caution about layout checks because of partial rendering, and Server Actions authorization. |
| N13 | `02-guides/data-security.md:56-87, 243-273, 281-291, 337, 397-437, 476` | Data access layer with `server-only`, Server Actions reachable by direct POST, authorization inside each, a DAL for mutations, rate limiting. |
| N14 | `02-guides/server-actions.md:78-85` | Every action is an untrusted entry point. `Origin` is compared with `Host`. The default body limit is 1 MB. `allowedOrigins` and `bodySizeLimit` are configurable. |
| N15 | `02-guides/caching-without-cache-components.md:4, 35-74, 163-165` | Caching and revalidation for projects not using Cache Components: `unstable_cache` for non-fetch functions with `tags` and `revalidate`, and segment `revalidate`. |
| N16 | `03-api-reference/04-functions/unstable_cache.md:7-8, 39-42` | `unstable_cache` has been replaced by `use cache` in Next 16. `keyParts`, `tags` and `revalidate` options. |
| N17 | `03-api-reference/04-functions/revalidateTag.md:15-17, 23-26, 35-39, 61, 69` | Callable in Server Functions and Route Handlers, never in Client Components or the proxy. The second argument is required, `{ expire: 0 }` expires immediately, one argument is deprecated, and it invalidates data across all pages that use the tag. |
| N18 | `03-api-reference/04-functions/updateTag.md:12-16, 28-34` | `updateTag` works only in Server Actions and lists `fetch` tags and `cacheTag` as its tag sources. |
| N19 | `03-api-reference/04-functions/revalidatePath.md:13-15, 39-43` | Callable in Server Functions and Route Handlers, not in Client Components or the proxy. A layout path invalidates nested layouts and pages. |
| N20 | `03-api-reference/04-functions/cookies.md:6, 72-83` | Cookies are set or deleted only in Server Functions and Route Handlers, not during rendering. |
| N21 | `02-guides/content-security-policy.md:38, 66-70, 179-199` | The proxy generates the nonce and sets it on the request headers and the CSP header. A nonce requires dynamic rendering, because static pages are built without request headers, so pages may have to opt into dynamic rendering. |
| N22 | `03-api-reference/02-components/image.md:533-540, 698-712` | `remotePatterns` can restrict remote images to one account path. `qualities` is required in Next 16. |
| N23 | `01-getting-started/15-route-handlers.md:49-51` | Route Handlers are not cached by default. `GET` can opt in with a route config option. |
| N24 | `02-guides/environment-variables.md:154-166, 266-272` | `NEXT_PUBLIC_` values are inlined at build. Non-prefixed variables stay on the server. `.env.local` is not loaded when `NODE_ENV` is `test`. |
| N25 | `03-api-reference/05-config/01-next-config-js/serverExternalPackages.md:33-89` | Default external list includes `@prisma/client`, `prisma`, `bcrypt` and `sharp`. |
| N26 | `03-api-reference/03-file-conventions/instrumentation.md:16-18, 127` | `register()` runs once when a server instance starts and must finish before requests are served. `NEXT_RUNTIME` selects the runtime. |
| N27 | `03-api-reference/04-functions/after.md:8, 40, 64-66, 120` | `after` runs after the response. Route Handlers and Server Functions may read `cookies` and `headers` inside it. Server Components may not. |
| N28 | `03-api-reference/03-file-conventions/01-metadata/sitemap.md:15, 44` | The sitemap file lives at the root of `app` and is a cached special Route Handler unless it uses request-time APIs. |
| N29 | `03-api-reference/05-config/01-next-config-js/headers.md:14-58` | Custom response headers are set with `headers()` in `next.config`. |
| N30 | `03-api-reference/07-adapters/02-creating-an-adapter.md:82` | Names the build phase `phase-production-build`. Next sets the same value as `process.env.NEXT_PHASE` during `next build` (installed code `next/dist/build/index.js:1212`, and the reference panel relies on it). |
| N31 | `03-api-reference/04-functions/generate-metadata.md:285-287` | `title.template` applies to child segments and not to the segment it is defined in, so a layout's template does not apply to the `title` of a `page.js` in the same segment. |
| N32 | `03-api-reference/03-file-conventions/01-metadata/opengraph-image.md:17, 82` | An `opengraph-image` file sets the shared image of the route segment it is placed in. |
| N33 | Installed code `next/dist/server/app-render/app-render.js:1281-1345, 2381-2440` (no doc page) | A `notFound()` that escapes the render is turned into status 404 and an error payload whose document is `<html id="__next_error__">`, which the client then renders. Seen in step 3 on a production build and on `next dev`. |
