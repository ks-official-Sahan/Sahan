# Docker image and VPS deployment

Vercel stays the primary host. This image runs the same app anywhere Docker
runs, and the `Docker` workflow builds, signs and (when enabled) deploys it to
one VPS.

## The image

`Dockerfile`, three stages:

| Stage | Base | What it does |
| --- | --- | --- |
| `deps` | `node:24-bookworm-slim` | `pnpm fetch` from the lockfile only, so the store is reused until the lockfile changes |
| `builder` | `deps` | offline `pnpm install` (runs `prisma generate`), `next build` with `NEXT_OUTPUT=standalone` |
| `runner` | `gcr.io/distroless/nodejs24-debian12:nonroot` | the traced `server.js`, `.next/static` and `public` only |

- No shell, no package manager, uid 65532, no secrets inside. Configuration
  is read when the server starts, so one image moves between environments.
- `NEXT_PUBLIC_BASE_URL` and `NEXT_DEPLOYMENT_ID` are build args. Public
  values are inlined into the browser bundle. The deployment id turns on
  Next.js version-skew protection, so assets carry `?dpl=<git sha>`.
- `HEALTHCHECK` calls `/api/health`. It reads no database and no Redis, so
  it only reports that the server answers.
- `SIGTERM` drains in-flight requests and `after()` work. Compose waits
  30 s before killing.

Build and run locally:

```bash
docker buildx build -t sahan-web .
docker run --rm -p 3000:3000 --read-only --tmpfs /app/.next/cache:uid=65532,gid=65532 --tmpfs /tmp:uid=65532,gid=65532 --env-file .env.production sahan-web
```

`assertProductionEnv()` still refuses to start a production server with a
database but a missing or short `AUTH_SECRET`, or with `EMAIL_PROVIDER=capture`.

## The workflow (`.github/workflows/docker.yml`)

- **Pull requests:**
  - Build `linux/amd64` with the GitHub Actions layer cache, plus the pnpm
    store and the Next cache as BuildKit cache mounts.
  - Start the container hardened as in production (read-only root, no
    capabilities), wait for it to report healthy, then fetch `/api/health`
    and `/robots.txt`.
  - Trivy fails the check on fixable CRITICAL/HIGH findings.
- **`master` and `v*` tags:**
  - Build `amd64` and `arm64` on native runners and push each by digest.
  - Merge them into one manifest tagged `latest`, `sha-<sha>`, the branch
    name and semver.
  - Sign it with cosign (keyless, GitHub OIDC), with SBOM and provenance
    attestations, and upload a Trivy scan to code scanning.
- **Deploy:** only when the repository variable `DEPLOY_ENABLED` is `true`.
  The job runs in the `production` environment, so required reviewers apply
  there. It deploys the exact digest it just built.

Verify a signature:

```bash
cosign verify ghcr.io/ks-official-sahan/sahan@sha256:<digest> \
  --certificate-identity-regexp 'https://github.com/ks-official-Sahan/Sahan/.github/workflows/docker.yml@.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

## Turning on VPS deploys

1. On the VPS:
   - Install Docker Engine and the Compose plugin.
   - Create a `deploy` user in the `docker` group.
   - Create `/opt/sahan` owned by that user.
   - Put the runtime configuration in `/opt/sahan/.env.production`, using
     the same keys as Vercel (`.env.example`), with `chmod 600`.
2. Point DNS for the domain at the VPS if Caddy terminates TLS (compose
   profile `proxy`).
3. In GitHub, go to **Settings → Environments → production** and add these
   secrets:
   - `DEPLOY_HOST`
   - `DEPLOY_USER`
   - `DEPLOY_SSH_KEY`: a key used only for deploys.
   - `DEPLOY_KNOWN_HOSTS`: the output of `ssh-keyscan -H <host>`.
4. Under **Variables**, add `DEPLOY_ENABLED=true`. Two more are optional:
   - `DEPLOY_DIR`: default `/opt/sahan`.
   - `DEPLOY_PROFILES`: default `proxy,cron`.
5. Make the GHCR package `sahan` private or public as you prefer. The job
   logs in with its own short-lived token.

Each rollout (`scripts/deploy/deploy.sh`):

1. Pulls the digest.
2. Runs `docker compose up -d --wait`, which waits until the container
   reports healthy.
3. Records the digest in `.deploy/current`.
4. Removes images older than a week.

If the new container never turns healthy, the script prints its logs, starts
the previous digest again and fails the job. Afterwards the job checks
`https://<domain>/api/health` from outside.

A single container restarts during a rollout, which means a few seconds of
502 from Caddy. For zero downtime, run two app replicas behind Caddy and roll
them one at a time.

## Compose (`compose.yaml`)

- **`app`:**
  - Read-only root filesystem, every capability dropped,
    `no-new-privileges`.
  - tmpfs mounts for `.next/cache` and `/tmp`.
  - CPU and memory limits, and rotated JSON logs.
  - The app port listens on `127.0.0.1` only. `TRUSTED_PROXY_HOPS=1` makes
    rate limits use the address Caddy (or your own proxy) saw.
- **`caddy`** (profile `proxy`):
  - HTTPS with automatic certificates, HTTP/3 and zstd/gzip.
  - `flush_interval -1`, so streamed RSC and Suspense chunks reach the
    browser as they are produced.
- **`cron`** (profile `cron`):
  - Calls `/api/cron/*` on the same schedule as `vercel.json`, with
    `Authorization: Bearer $CRON_SECRET`.
  - Run it on only one host. Vercel already runs these crons for the Vercel
    deployment.

## Caching across instances

Each container keeps the Next data cache in memory and on its tmpfs. The
app's Redis read-through cache (`lib/cache`) and the Upstash rate limits are
already shared. With more than one replica, also set the same
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time for every replica of a
release, and consider a shared `cacheHandler` (Next.js self-hosting guide,
"Multi-Server Deployments").
