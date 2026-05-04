#!/usr/bin/env bash
#
# Skillnex first-boot setup — runs ONCE on a fresh Ubuntu 24.04 droplet.
# Idempotent: safe to re-run after a partial failure.
#
# What it does (mirrors steps 3 of docs/deploy.md):
#   1. Creates the `skillnex` user with the same SSH key as root
#   2. Installs system packages (nginx, certbot, ufw, fail2ban, build tools)
#   3. Installs Node 20 LTS + pnpm (the lockfile is pnpm)
#   4. Configures the firewall (deny inbound except SSH + HTTP/HTTPS)
#   5. Creates /var/skillnex/data for the SQLite file (separate from app
#      dir so backups + git pull don't fight over it)
#
# AFTER this script runs, switch to the `skillnex` user and run
# scripts/deploy/release.sh to clone + build the app.
#
# Usage (as root, on the droplet):
#   curl -fsSL https://raw.githubusercontent.com/inno8/skillnex/main/scripts/deploy/first-boot.sh | bash
# OR after copying the file:
#   sudo bash scripts/deploy/first-boot.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "first-boot.sh must run as root (use sudo)." >&2
  exit 1
fi

log() { printf '\n[first-boot] %s\n' "$*"; }

log "Creating skillnex user (idempotent)…"
if ! id -u skillnex &>/dev/null; then
  adduser --disabled-password --gecos "" skillnex
  usermod -aG sudo skillnex
fi
mkdir -p /home/skillnex/.ssh
if [[ -f /root/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys /home/skillnex/.ssh/authorized_keys
  chown -R skillnex:skillnex /home/skillnex/.ssh
  chmod 700 /home/skillnex/.ssh
  chmod 600 /home/skillnex/.ssh/authorized_keys
fi

log "Installing system packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl git build-essential \
  nginx ufw certbot python3-certbot-nginx fail2ban \
  ca-certificates gnupg

log "Installing Node 20 LTS…"
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

log "Installing pnpm…"
if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm@latest
fi

log "Configuring firewall…"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow "Nginx Full"
yes | ufw --force enable

log "Creating data dir for SQLite…"
mkdir -p /var/skillnex/data
chown -R skillnex:skillnex /var/skillnex
chmod 750 /var/skillnex
chmod 750 /var/skillnex/data

log "Done. Next steps:"
cat <<EOF

  1. Switch to the skillnex user:
       sudo -iu skillnex

  2. Clone the repo + run the release script:
       cd /home/skillnex
       git clone https://github.com/inno8/skillnex.git app
       cd app
       cp .env.local.example .env.local && \$EDITOR .env.local
       bash scripts/deploy/release.sh

  3. As root, install the systemd unit + nginx config:
       cp /home/skillnex/app/scripts/deploy/skillnex.service /etc/systemd/system/
       systemctl daemon-reload && systemctl enable --now skillnex
       SKILLNEX_HOST=app.skillnex.tech bash /home/skillnex/app/scripts/deploy/setup-nginx.sh

EOF
