# Pilot deploy runbook — skillnex.tech

Step-by-step for the **first** deploy onto a fresh DigitalOcean droplet.
Assumes:

- Droplet is provisioned (Ubuntu 24.04, root SSH access)
- DNS for `skillnex.tech` already points at the droplet's IP
- You have these secrets ready:
  - `ANTHROPIC_API_KEY` (from console.anthropic.com)
  - `RESEND_API_KEY` + a verified sender domain in Resend
  - A 32-byte hex string (we'll generate it in step 4)

The full architectural story (multi-region, EU droplet, scaling
ladder) lives in [`deploy.md`](./deploy.md). This file is just the
"do these commands in this order" version for the first deploy.

---

## 0 · Push the code to GitHub

From your laptop, **before** SSH'ing into the droplet:

```bash
git push origin main
```

The droplet pulls from `https://github.com/inno8/skillnex.git`, so
nothing else works until the latest `main` is on GitHub.

---

## 1 · One-time droplet setup (as root)

SSH in as root:

```bash
ssh root@skillnex.tech
```

Then run the bootstrap script. This installs Node 20, pnpm, nginx,
certbot, ufw, fail2ban, and creates a `skillnex` system user with
your SSH key copied over.

```bash
curl -fsSL https://raw.githubusercontent.com/inno8/skillnex/main/scripts/deploy/first-boot.sh | bash
```

Verify it finished cleanly — last line should say `Done. Next steps:`.

---

## 2 · Clone the repo (as the skillnex user)

```bash
sudo -iu skillnex
cd /home/skillnex
git clone https://github.com/inno8/skillnex.git app
cd app
```

---

## 3 · Generate the auth secret

Still as `skillnex`:

```bash
openssl rand -hex 32
```

Copy that 64-char string somewhere — you'll paste it into `.env.local`
in the next step.

---

## 4 · Fill in `.env.local`

```bash
cp .env.local.example .env.local
nano .env.local
```

Set these values:

```bash
# LLM
ANTHROPIC_API_KEY=sk-ant-api03-...
SKILLNEX_MOCK_LLM=false

# Auth — paste the openssl output from step 3 here
SKILLNEX_AUTH_SECRET=<64-char hex from openssl rand>

# Public URL — must match what you put in DNS + the LE cert below
SKILLNEX_BASE_URL=https://skillnex.tech

# Region pin — pilot is US-only for now; setting this stops anyone
# accidentally signing up for "EU" on the wrong droplet later
SKILLNEX_REGION=us

# DB lives outside the app dir so backups + redeploys don't fight
SKILLNEX_DB_PATH=/var/skillnex/data/skillnex.db

# Email — domain MUST be verified in Resend, otherwise sends silently
# fail to anyone who isn't your Resend account email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Skillnex <noreply@skillnex.tech>"
```

Save (Ctrl-O, Enter, Ctrl-X) and tighten permissions:

```bash
chmod 600 .env.local
```

---

## 5 · First build + start (as skillnex)

```bash
bash scripts/deploy/release.sh
```

This runs:
- `git pull` (already current)
- `pnpm install --frozen-lockfile`
- `pnpm run build`
- `systemctl restart skillnex` — but the unit isn't installed yet,
  so it'll print a hint and skip. That's fine.

If the build fails, fix the error and re-run. The script is
idempotent.

---

## 6 · Install systemd unit (as root)

Open a new shell or `exit` back to root:

```bash
sudo cp /home/skillnex/app/scripts/deploy/skillnex.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now skillnex
sudo systemctl status skillnex --no-pager
```

You should see `active (running)`. If not:

```bash
sudo journalctl -u skillnex -n 50 --no-pager
```

The most common first-boot failure is a typo in `.env.local` — fix
and `sudo systemctl restart skillnex`.

At this point Node is listening on `127.0.0.1:3000`. Nginx isn't
proxying yet, so the public URL still 404s — that's the next step.

---

## 7 · nginx + Let's Encrypt SSL (as root)

```bash
sudo SKILLNEX_HOST=skillnex.tech \
  bash /home/skillnex/app/scripts/deploy/setup-nginx.sh
```

This script:
1. Writes `/etc/nginx/sites-available/skillnex` (proxy to `127.0.0.1:3000`,
   25 MB upload limit for xlsx, 120 s timeout + buffering off for SSE)
2. Enables it, removes the default site
3. Runs certbot to issue a Let's Encrypt cert for `skillnex.tech`
4. Re-writes the config with the cert paths and reloads nginx

When certbot prompts (it shouldn't with `--non-interactive`, but just
in case), agree to the TOS and decline the EFF newsletter.

---

## 8 · Smoke test

From your laptop:

```bash
curl -I https://skillnex.tech/
# Expect: HTTP/2 200, content-type: text/html
```

Then in a browser:
1. https://skillnex.tech/ — landing page renders, no cert warnings
2. https://skillnex.tech/signup — create a real account
3. Check email inbox — verification email arrives from your Resend
   sender (if it doesn't, check `journalctl -u skillnex -f` for
   `[email]` lines; common cause is unverified Resend domain)
4. Click verify → log in → upload a test xlsx → generate a narrative
5. Hit "Send to employee" on a generated review → recipient gets the
   email + PDF attachment

---

## 9 · Set up nightly backups (as skillnex)

```bash
crontab -e
```

Add this line:

```
0 3 * * *  /home/skillnex/app/scripts/deploy/backup.sh >> /var/log/skillnex-backup.log 2>&1
```

Backups land in `/var/skillnex/backups/skillnex-YYYYMMDD-HHMMSS.db.gz`,
prune after 14 days. DO droplet snapshots cover the rest. When a
customer asks for tighter RPO than 24 h, swap to litestream — see
[`deploy.md`](./deploy.md) "Backups + recovery".

Also worth setting up: `rsync` from your laptop to copy backups
off-host periodically. From your laptop:

```bash
rsync -av skillnex@skillnex.tech:/var/skillnex/backups/ ./local-backups/
```

---

## Releases after the first deploy

For every push to `main` after this:

```bash
ssh skillnex@skillnex.tech 'cd app && bash scripts/deploy/release.sh'
```

That pulls latest, rebuilds, restarts. Logs in `journalctl -u skillnex -f`.

---

## Things that will trip you up

| Symptom | Fix |
|---|---|
| `curl: (35) SSL: no alternative certificate subject name matches` | DNS hadn't propagated when certbot ran. `sudo certbot delete --cert-name skillnex.tech` then re-run step 7. |
| Verification email never arrives | Resend domain not verified yet. Open Resend dashboard → Domains → add DNS records → wait for verified state. Until then, only your Resend account email receives mail. |
| `502 Bad Gateway` from nginx | systemd unit not running. `sudo systemctl status skillnex` then check `journalctl -u skillnex -n 100`. |
| `next: command not found` during build | pnpm install didn't complete. `cd ~/app && pnpm install --frozen-lockfile` then retry `bash scripts/deploy/release.sh`. |
| `EACCES` writing to `/var/skillnex/data` | first-boot.sh wasn't run, or was run before the user existed. `sudo chown -R skillnex:skillnex /var/skillnex && sudo chmod -R 750 /var/skillnex`. |
| Narrative streaming hangs at ~30 s | nginx proxy timeout too short. Check `proxy_read_timeout 120s` and `proxy_buffering off` are in the nginx config (they should be — `setup-nginx.sh` sets both). |

---

## When to come back to this file

- Adding the EU droplet → see `deploy.md` "Adding the EU droplet later"
- Resizing the droplet → DO console, in-place resize, ~30 s downtime
- Switching from SQLite to Postgres → that's the 75-tenant scale signal in `deploy.md`
