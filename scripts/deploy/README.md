# Deploy scripts

Executable companions to `docs/deploy.md`. They turn the runbook into
~3 commands per droplet.

## Files

| File | Runs as | When |
|---|---|---|
| `first-boot.sh` | root | Once, on a fresh Ubuntu 24.04 droplet |
| `release.sh` | `skillnex` | Every push (after the initial clone) |
| `setup-nginx.sh` | root | Once, after `release.sh` produces a build |
| `skillnex.service` | — | Copied to `/etc/systemd/system/` once |
| `backup.sh` | `skillnex` (or root) | Hourly/daily via cron |

## First-time deploy on a new droplet

```bash
# As root on the droplet
curl -fsSL https://raw.githubusercontent.com/inno8/skillnex/main/scripts/deploy/first-boot.sh | bash

# Switch to the app user
sudo -iu skillnex
cd /home/skillnex
git clone https://github.com/inno8/skillnex.git app
cd app
cp .env.local.example .env.local
# Fill in: SKILLNEX_AUTH_SECRET (openssl rand -hex 32), ANTHROPIC_API_KEY,
# RESEND_API_KEY, RESEND_FROM_EMAIL, SKILLNEX_REGION=us|eu, SKILLNEX_BASE_URL
$EDITOR .env.local
bash scripts/deploy/release.sh

# Back as root: install systemd unit + nginx
sudo cp scripts/deploy/skillnex.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now skillnex
sudo SKILLNEX_HOST=app.skillnex.tech \
  SKILLNEX_HOST_ALIAS=app-us.skillnex.tech \
  bash scripts/deploy/setup-nginx.sh
```

That's it. Smoke test: `curl -I https://app.skillnex.tech/`.

## Subsequent releases

```bash
ssh skillnex@app.skillnex.tech 'cd app && bash scripts/deploy/release.sh'
```

`release.sh` does git pull → `pnpm install` → `pnpm build` → systemctl restart.
Keeps logs in `journalctl -u skillnex`.

## Backups

Add to crontab (`crontab -e` as `skillnex`):

```
0 3 * * *  /home/skillnex/app/scripts/deploy/backup.sh >> /var/log/skillnex-backup.log 2>&1
```

DO droplet snapshots cover weekly recovery; this script is the
nightly RPO between snapshots. See `docs/deploy.md` "Backups + recovery"
for the upgrade path to litestream once a customer asks for tighter RPO.
