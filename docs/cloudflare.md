# Cloudflare Workers (vinext build)

Production runs the Next.js build on Vercel: a push to `master` deploys it, and
nothing in this page changes that. The same app also builds with
[vinext](https://github.com/cloudflare/vinext) for Cloudflare Workers, side by
side. `vite.config.ts` and `cloudflare.config.ts` are read only by that build.

| Command | What it does |
| --- | --- |
| `pnpm dev:vinext` | Local dev in workerd, port 3005 |
| `pnpm build:vinext` | Worker build into `.cloudflare/output` |
| `pnpm start:vinext` | Serves that build locally in workerd |
| `pnpm secrets:vinext` | Uploads the Worker's secrets (`--dry-run` lists them) |
| `pnpm deploy:vinext` | Builds and deploys the Worker |

## Bindings

- `VINEXT_KV_CACHE` (KV): vinext's data cache (`"use cache"`, ISR).
- `IMAGES` (Cloudflare Images): `next/image` optimisation.
- `ASSETS`: the static files.
- One secret per variable documented in `.env.example` that is set where the
  build runs (`scripts/worker-secrets.mjs`). Build-only variables
  (`MIGRATE_ON_BUILD`, `DIRECT_DATABASE_URL`, `NEON_*`, ...) are left out.
  A deploy fails while any declared secret is missing on the Worker.

## First deploy

`CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID`) in the shell authenticate
the `cf` CLI; no `cf auth login` is needed.

1. `WORKER_SECRETS=skip pnpm deploy:vinext` creates the Worker without secret
   declarations. It cannot reach the database yet.
2. `pnpm secrets:vinext` uploads the secrets in one version.
3. `pnpm deploy:vinext` deploys again, now checking every secret exists.

After that, step 3 alone deploys. Run step 2 again when a value changes.

## What differs from Vercel

- **Database.** Prisma loads its edge entry (a Vite resolver in
  `vite.config.ts`), plain queries go over Neon's HTTP endpoint, and a
  transaction's WebSocket is closed after use (`lib/db/prisma.ts`): a Worker
  cannot reuse a socket another request opened.
- **Migrations** never run from this build. The Vercel build migrates.
- **Email.** Brevo API and Resend work (HTTP). Brevo SMTP, the last fallback,
  does not: Workers have no outbound SMTP.
- **Origins.** Add the Worker's URL (for example its `*.workers.dev` host) to
  `SITE_URLS` and `ADMIN_ALLOWED_ORIGINS`, so links, canonicals and the admin's
  trusted origins include it. Passkeys only work on the domain they were
  registered for.
- **Partial in vinext:** `cacheComponents` and `reactStrictMode`
  (`npx vinext check`).

## Nitro (other hosts)

`NITRO_PRESET=<preset> pnpm build:vinext` builds with Nitro instead of the
Cloudflare plugin, for example `NITRO_PRESET=vercel` writes `.vercel/output`.
It is kept building so the vinext app is not tied to one host; Vercel
production stays on the Next.js build. The KV cache and Images bindings are
Cloudflare-only, so a Nitro build uses vinext's defaults.
