#!/usr/bin/env bash
#
# Skillnex nginx + Let's Encrypt setup — runs ONCE as root after
# first-boot.sh + a successful `release.sh` build.
#
# Usage:
#   SKILLNEX_HOST=app.skillnex.tech \
#   SKILLNEX_HOST_ALIAS=app-us.skillnex.tech \
#     sudo bash scripts/deploy/setup-nginx.sh
#
# SKILLNEX_HOST is the canonical name (also used for the LE certificate
# CN). SKILLNEX_HOST_ALIAS is optional — for the US droplet that means
# `app-us.skillnex.tech`, on EU it means just leave it unset.

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "setup-nginx.sh must run as root (use sudo)." >&2
  exit 1
fi

if [[ -z "${SKILLNEX_HOST:-}" ]]; then
  echo "SKILLNEX_HOST is required, e.g. SKILLNEX_HOST=app.skillnex.tech" >&2
  exit 1
fi

ALIAS="${SKILLNEX_HOST_ALIAS:-}"
SERVER_NAMES="$SKILLNEX_HOST"
[[ -n "$ALIAS" ]] && SERVER_NAMES="$SKILLNEX_HOST $ALIAS"

CONF_PATH="/etc/nginx/sites-available/skillnex"
log() { printf '\n[nginx] %s\n' "$*"; }

log "Writing $CONF_PATH for: $SERVER_NAMES"
cat >"$CONF_PATH" <<NGINX
# Managed by scripts/deploy/setup-nginx.sh. Edits here will be
# overwritten on the next run — change the script if you need to.

server {
  listen 80;
  listen [::]:80;
  server_name $SERVER_NAMES;
  location / { return 301 https://\$host\$request_uri; }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name $SERVER_NAMES;

  # SSL certs are added in by certbot below; if it hasn't run yet,
  # nginx -t will fail and we re-run after issuance.
  ssl_certificate     /etc/letsencrypt/live/$SKILLNEX_HOST/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$SKILLNEX_HOST/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  add_header Strict-Transport-Security "max-age=63072000" always;

  # xlsx uploads — bumps over the default 1M.
  client_max_body_size 25M;

  location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade           \$http_upgrade;
    proxy_set_header   Connection        "upgrade";
    proxy_set_header   Host              \$host;
    proxy_set_header   X-Real-IP         \$remote_addr;
    proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto \$scheme;
    # Narrative SSE streams can run for ~60s; bump read timeout and
    # turn buffering off so chunks reach the browser as they arrive.
    proxy_read_timeout 120s;
    proxy_buffering    off;
  }
}
NGINX

log "Enabling site + removing default…"
ln -sf "$CONF_PATH" /etc/nginx/sites-enabled/skillnex
rm -f /etc/nginx/sites-enabled/default

# First run there's no cert yet. Use certbot in standalone mode rather
# than --nginx so we don't depend on a half-written nginx config:
#   1. Disable our (incomplete-without-a-cert) site
#   2. Stop nginx so certbot can bind :80 directly
#   3. Issue the cert via HTTP-01 challenge
#   4. Re-enter this script — the cert now exists, the SSL block in the
#      config above resolves cleanly, nginx -t passes, reload.
if [[ ! -d "/etc/letsencrypt/live/$SKILLNEX_HOST" ]]; then
  log "No cert yet — issuing one via certbot (standalone mode)…"
  rm -f /etc/nginx/sites-enabled/skillnex
  systemctl stop nginx

  CERTBOT_DOMAINS=("-d" "$SKILLNEX_HOST")
  [[ -n "$ALIAS" ]] && CERTBOT_DOMAINS+=("-d" "$ALIAS")
  certbot certonly --standalone --non-interactive --agree-tos \
    --email "ops@$SKILLNEX_HOST" "${CERTBOT_DOMAINS[@]}"

  systemctl start nginx
  log "Cert issued — re-running with SSL block…"
  SKILLNEX_HOST="$SKILLNEX_HOST" SKILLNEX_HOST_ALIAS="$ALIAS" \
    bash "$(dirname "$0")/setup-nginx.sh"
  exit 0
fi

log "nginx -t…"
nginx -t
log "Reloading nginx…"
systemctl reload nginx

log "Done. Smoke test:"
echo "  curl -I https://$SKILLNEX_HOST/"
