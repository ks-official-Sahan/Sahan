# Hono API example

A Hono API that signs users in with [Better Auth](https://better-auth.com),
stores them with Drizzle, and applies `@sahan-sac/auth-kit`'s rules:

- the `authKit()` Better Auth plugin: password policy, sign-in throttling per IP
  and per account, audit events, and a server-only `role` field;
- bcrypt password hashes (`authKitEmailPassword()`), compatible with auth-kit's
  next-auth engine;
- Hono middleware from `@sahan-sac/auth-kit/hono`: security headers, the Origin
  check on unsafe methods, a per-IP rate limit, the session read once per
  request, and permission gates that answer 404.

## Run it

```bash
pnpm install
pnpm --filter @sahan-sac/example-hono-api dev
```

Without `DATABASE_URL` the API uses an in-process Postgres (PGlite) in memory;
set `PGLITE_DIR` to keep the data on disk. Migrations in `./drizzle` run at
startup.

| Variable | Default | Notes |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | random per start (development only) | Required in production, at least 32 characters. |
| `BETTER_AUTH_URL` | `http://localhost:8787` | Public URL of this API. |
| `SITE_URL` | none | Origin of the browser app allowed to call the API. |
| `DATABASE_URL` | none | Postgres URL; uses node-postgres when set. |
| `PORT` | `8787` | |
| `TRUSTED_PROXY_HOPS` | `0` | Reverse proxies that append to `X-Forwarded-For` (see auth-kit's `./security/ip`). |

## Routes

- `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email` and the rest of Better Auth under `/api/auth/*`
- `GET /api/health`
- `GET /api/me`: signed-in users; 404 otherwise
- `GET /api/admin/stats`: `DEVELOPER` role only; 404 otherwise

New users get the `EDITOR` role. Clients cannot set `role`; change it in the
database (or from an admin route you add).

## Schema changes

Edit `src/db/schema.ts`, then run `pnpm db:generate` to write a migration.

## Tests

`pnpm test` runs the whole stack (migrations, Better Auth, the plugin and the
middleware) on an in-memory PGlite.
