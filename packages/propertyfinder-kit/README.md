# @sahan-sac/propertyfinder-kit

Property Finder (Atlas API) for server apps, framework-agnostic:

- **Client** (`createPropertyFinderClient`): token auth with a per-client JWT
  cache (refreshed 60 s before expiry, concurrent refreshes shared), 401 retry,
  request timeouts, listings pagination, leads, locations, webhook
  subscriptions and statistics.
- **Transforms** (`./transform`, `./listing-content`, `./location-format`,
  `./related`): Atlas listing to one app-facing `AppProperty` shape, rich
  description parsing, location formatting and related-listing scoring.
- **Webhook payloads** (`./webhook-payload`): parse and normalise delivered
  payloads.

Persistence, caching of listings and locations, and webhook routes stay in
the app.

## Install

```sh
npm install @sahan-sac/propertyfinder-kit
```

Node 20 or later. No runtime dependencies.

## Quick start

```ts
import { createPropertyFinderClient, propertyFinderEnv } from "@sahan-sac/propertyfinder-kit";

const creds = propertyFinderEnv(process.env); // null when PF_API_KEY / PF_API_SECRET are unset
if (creds) {
  const pf = createPropertyFinderClient({
    ...creds,
    log: { warn: (message) => console.info(message) }, // optional debug notices
  });
  const listing = await pf.fetchListingById("123456");
}
```

Credentials are parameters. The package never reads environment variables
itself; `propertyFinderEnv` only reads the object you pass in.

## Modules

| Subpath | Contents |
| --- | --- |
| `.` | Client factory, `propertyFinderEnv`, and type exports |
| `./client` | `createPropertyFinderClient`, `PropertyFinderClientOptions`, webhook event helpers |
| `./types` | Atlas listing, location and token types |
| `./leads-types` | Lead record types |
| `./transform` | `transformPFListing`, `transformPFListings`; takes optional `ImageUrlTransforms` (for example CDN resize presets) |
| `./listing-content` | Description and amenity parsing |
| `./location`, `./location-format` | Location helpers and display formatting |
| `./related` | `getRelatedListings` |
| `./webhook-payload` | Webhook payload parsing |

Each subpath is also exported from `dist/` in the published package.

## Cache (optional)

`@sahan-sac/propertyfinder-kit/cache` puts Redis in front of the API. `redisKv(redis, prefix)` takes any Upstash-compatible client and returns `null` when there is none, which turns the cache off: every read then goes straight to the API.

```ts
import { createPropertyFinderCache, redisKv } from "@sahan-sac/propertyfinder-kit/cache";

const cache = createPropertyFinderCache({
  kv: redisKv(redisOrNull, "myapp:"),
  loadAll: async () => transformPFListings(await pf.fetchAllListings()),
  loadOne: async (id) => {
    const listing = await pf.fetchListingById(id);
    return listing ? transformPFListing(listing) : null;
  },
});
```

`staleWhileRevalidate(kv, key, load, { freshSeconds, ttlSeconds })` serves a slow read (the leads list) from cache and refreshes it in the background, one caller at a time.
