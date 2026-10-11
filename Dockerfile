# syntax=docker/dockerfile:1.10

# Production image for the Sahan web app (Next.js 16, standalone output).
#
#   deps     pnpm store fetched from the lockfile only (cached until it changes)
#   builder  offline install, prisma generate, next build (standalone)
#   runner   distroless Node 24, non-root, only the traced server files
#
# Build:   docker buildx build -t sahan-web .
# Run:     docker run --rm -p 3000:3000 --env-file .env.production sahan-web
#
# Runtime configuration (DATABASE_URL, AUTH_SECRET, ...) is read when the
# server starts, so one image is promoted unchanged between environments.
# Only NEXT_PUBLIC_* values are inlined at build time (build args below).

ARG NODE_VERSION=24
ARG PNPM_VERSION=12.5.1

# ─── deps: the pnpm store, keyed on the lockfile alone ──────────────────────
FROM node:${NODE_VERSION}-trixie-slim AS deps
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN npm install -g --no-fund --no-audit "pnpm@${PNPM_VERSION}"
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm fetch --store-dir /pnpm/store

# ─── builder ────────────────────────────────────────────────────────────────
FROM deps AS builder
ARG NEXT_PUBLIC_BASE_URL=https://sahansachintha.com
ARG NEXT_DEPLOYMENT_ID=
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone \
    NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL} \
    NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}
COPY . .
# Offline: every package comes from the store fetched above. postinstall runs
# `prisma generate`, which needs no database.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --store-dir /pnpm/store --frozen-lockfile --offline
# The Next build cache survives between builds (local and CI cache mounts).
# No secret is needed: env guards only run when the server starts.
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    pnpm run build && \
    cp -r public .next/standalone/public && \
    mkdir -p .next/standalone/.next && \
    cp -r .next/static .next/standalone/.next/static

# ─── runner: distroless, non-root, no shell, no package manager ─────────────
FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian13:nonroot AS runner
ARG NEXT_DEPLOYMENT_ID=
LABEL org.opencontainers.image.title="sahan-web" \
      org.opencontainers.image.description="Sahan Sachintha portfolio and CMS (Next.js 16, standalone)" \
      org.opencontainers.image.source="https://github.com/ks-official-Sahan/Sahan" \
      org.opencontainers.image.licenses="SEE LICENSE IN LICENSE.md"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID} \
    # Bounded heap for small hosts; raise with the container memory limit.
    NODE_OPTIONS="--max-old-space-size=768"
WORKDIR /app
# Owned by nonroot so the image optimizer and ISR can write .next/cache.
COPY --from=builder --chown=nonroot:nonroot /app/.next/standalone ./
USER nonroot
EXPOSE 3000
# Liveness via the app's own cheap health route (no database or Redis read).
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# The distroless entrypoint is node; SIGTERM drains in-flight requests and after() work.
CMD ["server.js"]
