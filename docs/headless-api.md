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

Every response also carries `Server-Timing: app;dur=<ms>, cache;desc="redis-hit=N redis-miss=N load=N"`, the handler's time and the cache events of that request (`load` counts reads that reached the database; all zeros means the data cache answered). A response served from the CDN shows the timing of the request that filled it.

Only documented query parameters are accepted (`limit` and `cursor` on `/posts`, none elsewhere). Any other parameter returns `400`, so cache-busting suffixes cannot bypass the CDN. Malformed input returns `400`; missing content returns `404` (never cached); deep cursor pages are rate-limited per IP (`429` with `Retry-After`); a data-store failure returns `503` with `Retry-After`.

Clients should treat `apiVersion` as the response schema version and keep cursors opaque. A breaking response change gets a new URL version.

## Webhooks

An admin with `manageSettings` adds endpoints at `/admin/webhooks`. Each endpoint gets a signing secret (`whsec_...`), shown once. The site stores it encrypted, and "Rotate secret" replaces it.

**Events.** `content.changed` is sent after every publish, edit or delete that refreshes the public site. Its `data` lists the cache `tags` and public `paths` that were refreshed, so a consumer can refresh the same things. `webhook.ping` is sent only by the "Send test" button.

```json
{ "id": "6f1c...", "type": "content.changed", "createdAt": "2026-10-10T12:00:00.000Z",
  "data": { "tags": ["blog:list", "blog:post:hello"], "paths": ["/updates", "/updates/hello"] } }
```

**Headers.**

- `X-Sahan-Signature: t=<unix seconds>,v1=<hex>`, where `v1` is HMAC-SHA256 of `` `${t}.${rawBody}` `` with the endpoint secret.
- `Idempotency-Key`: the same value on every retry of one delivery. Store it and drop repeats.
- `X-Sahan-Event` and `X-Sahan-Delivery`.

**Checking a request (Node).** Use the raw body, before any JSON parsing:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(secret: string, rawBody: string, header: string | null, toleranceS = 300): boolean {
  const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.trim().split("=", 2)));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1 || Math.abs(Date.now() / 1000 - t) > toleranceS) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

**Delivery.**

- Answer with any 2xx within 5 seconds. The response body is ignored.
- Redirects are not followed, and a 3xx counts as a failure.
- A failed delivery is retried once a few seconds later. Further retries happen in the daily housekeeping cron, up to 6 attempts. An admin can retry any delivery from the page.
- URLs must be https, and the host must resolve to public addresses only. This is checked again before every send.
