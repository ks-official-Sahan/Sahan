# Public content API

The read-only API is versioned under `/api/content/v1`. It returns published CMS content only; draft and preview data are never available here. The API has wildcard CORS because these responses are public and do not accept credentials.

## Pages

```http
GET /api/content/v1/pages/home
```

The response shape is `{ "apiVersion": 1, "data": { ...page sections } }`. Valid page slugs are `home`, `about`, `works`, `updates`, and `contact`.

## Posts

```http
GET /api/content/v1/posts?limit=20
GET /api/content/v1/posts?limit=20&cursor=<opaque-cursor>
GET /api/content/v1/posts/my-post-slug
```

The list response is `{ "apiVersion": 1, "data": { "items": [...], "nextCursor": "..." | null } }`. `limit` defaults to 20 and is capped at 50. Pass `nextCursor` back unchanged to read the next page. Posts are ordered by effective publication time; a scheduled post becomes public when its `publishAt` time is due, within the server cache's five-minute revalidation window if its cached page was built earlier. Article detail reads use the unique slug index, so they do not scan the full post list.

Post detail responses contain sanitized HTML and its plain-text form. A post marked `noindex` remains publicly readable by slug and may appear in the list, but it stays out of search indexing, RSS, and the sitemap.

## Collections

```http
GET /api/content/v1/projects
GET /api/content/v1/experience
GET /api/content/v1/services
GET /api/content/v1/skills
```

Each response uses `{ "apiVersion": 1, "data": [...] }`. Project and
experience arrays contain published entries in CMS order. Service and skill
responses contain groups with published entries only and follow configured
order. Services include their icon key and optional completion summary; skills
include their icon key, display colors, type, and fill/stroke variant. These
responses omit draft flags, database timestamps, and audit metadata. Existing
row IDs remain available where consumers need stable record identity.

## Caching and errors

Successful responses use `s-maxage=60` with `stale-while-revalidate=300` and carry a strong `ETag`. Send it back as `If-None-Match` to get a bodiless `304` when nothing changed. CMS publish actions invalidate the related data tags.

Only documented query parameters are accepted (`limit` and `cursor` on `/posts`, none elsewhere). Any other parameter returns `400`, so cache-busting suffixes cannot bypass the CDN. Malformed input returns `400`; missing content returns `404` (never cached); deep cursor pages are rate-limited per IP (`429` with `Retry-After`); a data-store failure returns `503` with `Retry-After`.

Clients should treat `apiVersion` as the response schema version and keep cursors opaque. A breaking response change gets a new URL version.
