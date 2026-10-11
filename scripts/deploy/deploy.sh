#!/usr/bin/env sh
# Health-checked rollout of one image on the host, with automatic rollback.
#
#   scripts/deploy/deploy.sh ghcr.io/ks-official-sahan/sahan@sha256:...
#
# Runs in DEPLOY_DIR (default /opt/sahan), which holds compose.yaml,
# scripts/deploy/ and .env.production. The image must already be reachable
# (the CD job logs in to GHCR before calling this). Exit status 0 means the
# new container answered /api/health; anything else rolled back.
set -eu

image="${1:?usage: deploy.sh <image@digest>}"
dir="${DEPLOY_DIR:-/opt/sahan}"
timeout="${DEPLOY_WAIT_SECONDS:-120}"
cd "$dir"

current_file=".deploy/current"
mkdir -p .deploy
previous="$(cat "$current_file" 2>/dev/null || true)"

echo "Pulling $image"
docker pull --quiet "$image"

# Compose reads COMPOSE_PROFILES (comma separated, e.g. "proxy,cron") itself.
export COMPOSE_PROFILES="${COMPOSE_PROFILES:-}"

rollout() {
  SAHAN_IMAGE="$1" docker compose up -d --no-build --remove-orphans --wait --wait-timeout "$timeout"
}

if rollout "$image"; then
  echo "$image" > "$current_file"
  echo "$previous" > .deploy/previous
  echo "Deployed $image"
  # Keep a week of images for manual rollback; drop older unused ones.
  docker image prune -af --filter "until=168h" >/dev/null || true
  exit 0
fi

echo "Rollout of $image failed; recent logs:" >&2
docker compose logs --tail=120 app >&2 || true
if [ -n "$previous" ]; then
  echo "Rolling back to $previous" >&2
  rollout "$previous" || echo "Rollback also failed; check the host." >&2
fi
exit 1
