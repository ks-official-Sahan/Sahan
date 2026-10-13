# @sahan-sac/analytics-kit

Cookieless, first-party page-view analytics on Upstash Redis:

- **No cookie, no storage, no third party.** A visitor id is
  `sha256(daily salt, IP, user agent)` cut to 16 hex characters. The salt is
  random and expires after two days. After the day ends, nobody (the site owner
  included) can link an id to an IP or to the same visitor on another day. No
  IP or user agent is stored.
- **Respects opt-outs.** The browser beacon and the endpoint both skip Do Not
  Track and Global Privacy Control. They also skip bots and automated browsers
  (`navigator.webdriver`).
- **Cheap on Redis.** One pipelined round trip per view (two on the day's first
  view). One round trip per dashboard read. Top pages and referrers are merged
  on the server, so only the top entries come back. Data is kept for 90 days.
- **Web-standard endpoint.** `createCollectHandler` is `(Request) => Response`,
  so it mounts in a Next.js route handler, Hono, Remix or any fetch server. It
  always answers 204 and does the write after the response.

## Install

```sh
pnpm add @sahan-sac/analytics-kit @upstash/redis
```

## Use

**Store** (server):

```ts
import { Redis } from "@upstash/redis";
import { createAnalyticsStore } from "@sahan-sac/analytics-kit/store";

export const analytics = createAnalyticsStore({
  redis: Redis.fromEnv(), // or a getter that answers null when Redis is not configured
  prefix: "myapp:", // every key starts with it, so one Redis can serve several apps
  log: console,
});
```

Without Redis, `record` does nothing and `read` answers null.

**Endpoint** (Next.js route handler, `app/api/collect/route.ts`):

```ts
import { after } from "next/server";
import { createCollectHandler } from "@sahan-sac/analytics-kit/collect";

const collect = createCollectHandler({
  store: analytics,
  clientIp: (request) => request.headers.get("x-real-ip") ?? "unknown",
  siteHosts: ["example.com"], // internal navigation is not a referrer
  allow: async (visitor) => (await ratelimit.limit(visitor)).success, // optional
  defer: (task) => after(task), // Vercel: waitUntil; Workers: ctx.waitUntil
});

export const POST = collect;
```

The handler accepts only small JSON bodies (1 KB by default, enforced while
the body is read). It counts only public page paths: `/admin`, `/api`,
`/_next`, query strings and unexpected characters are refused.

Origin/CSRF checks stay in your app. The beacon only sends a same-origin POST.

**Beacon** (client):

```tsx
"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPageView } from "@sahan-sac/analytics-kit/client";

export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) trackPageView(pathname);
  }, [pathname]);
  return null;
}
```

`trackPageView` sends one view per route change as a `keepalive` `fetch`, so
the request outlives a page unload. Only the first view carries
`document.referrer`, because client-side navigations keep the landing page's
referrer. It never throws.

**Dashboard read** (server):

```ts
import { parseRange } from "@sahan-sac/analytics-kit";

const summary = await analytics.read(parseRange(searchParams.range)); // 7, 30 (default) or 90 days
// summary.days, totals (with the previous period), live, pages, referrers,
// countries, devices, browsers, systems
```

## Entry points

| Import | Contents |
| --- | --- |
| `@sahan-sac/analytics-kit` | Everything below except the client beacon. |
| `@sahan-sac/analytics-kit/classify` | Pure helpers: `isBot`, `deviceOf`, `browserOf`, `osOf`, `normalizePath`, `referrerHost`, `countryOf`, `optedOut`, `parseRange`, `ANALYTICS_RANGES`. |
| `@sahan-sac/analytics-kit/store` | `createAnalyticsStore`, `summarize`, types. Uses `node:crypto`. |
| `@sahan-sac/analytics-kit/collect` | `createCollectHandler`. |
| `@sahan-sac/analytics-kit/client` | `trackPageView`, `trackingAllowed`. Browser only. |

## Redis keys

Each key starts with `prefix`. Keys are per UTC day:

| Key | Type | Contents |
| --- | --- | --- |
| `a:{day}:n` | hash | `pv`, `d:<device>`, `b:<browser>`, `o:<os>`, `c:<country>` |
| `a:{day}:u` | HyperLogLog | visitor ids (unique visitors, about 0.8% error) |
| `a:{day}:p` | sorted set | path to views (top 500 kept) |
| `a:{day}:r` | sorted set | referrer host to views (top 500 kept) |
| `a:live` | sorted set | visitor id to last seen, for "on the site now" |
| `a:salt:{day}` | string | the day's salt, expires after two days |

## License

Apache-2.0
