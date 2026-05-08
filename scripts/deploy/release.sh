#!/usr/bin/env bash
#
# Skillnex release — runs as the `skillnex` user on the droplet to ship
# a new version. Pulls latest, installs deps, builds, restarts systemd.
#
# Designed to be re-run on every push to main:
#   ssh skillnex@app.skillnex.tech 'cd app && git pull && bash scripts/deploy/release.sh'
#
# Idempotent. Safe under concurrent runs (the systemctl restart at the
# end serializes anything weird). DB lives in /var/skillnex/data so
# nothing this script does can touch user data.

set -euo pipefail

APP_DIR="${APP_DIR:-/home/skillnex/app}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.local}"

log() { printf '\n[release] %s\n' "$*"; }

if [[ ! -d "$APP_DIR" ]]; then
  echo "App dir $APP_DIR does not exist. Clone the repo there first." >&2
  exit 1
fi

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.local.example and fill it in:" >&2
  echo "  cp .env.local.example .env.local && \$EDITOR .env.local" >&2
  exit 1
fi

# 600 so secrets aren't world-readable.
chmod 600 "$ENV_FILE"

log "git pull (current ref: $(git rev-parse --short HEAD))"
git pull --ff-only

log "Installing dependencies (pnpm, frozen lockfile)…"
pnpm install --frozen-lockfile

# Nuke .next BEFORE building. Without this, an interrupted previous
# build can leave stale content-hashed chunks alongside new HTML that
# references freshly-named ones — the browser then 404s on chunk
# loads and crashes with `ChunkLoadError: Failed to load chunk
# /_next/static/chunks/0q.qrmc4qs8dy.js`. Clean build is the only
# guaranteed fix; the old artifacts are useless once next build
# regenerates them anyway.
log "Removing stale .next/ before fresh build…"
rm -rf .next

log "Running migrations / typecheck guard via build…"
pnpm run build

# Restart through systemd so logs land in journalctl. If the unit isn't
# installed yet, skip — first-boot still has more to do.
if systemctl list-unit-files | grep -q '^skillnex.service'; then
  log "Restarting systemd unit…"
  sudo systemctl restart skillnex
  sleep 2
  sudo systemctl status skillnex --no-pager | head -20
else
  log "skillnex.service not installed yet — skipping restart."
  log "Install it as root with:"
  echo "  cp $APP_DIR/scripts/deploy/skillnex.service /etc/systemd/system/"
  echo "  systemctl daemon-reload && systemctl enable --now skillnex"
fi

log "Release complete: $(git rev-parse --short HEAD)"
