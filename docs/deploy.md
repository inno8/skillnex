# Skillnex deployment — DigitalOcean droplet runbook

Pilot ships on **one US droplet**. EU droplet exists in this doc as
"the second of the same thing" so adding it later is a 30-minute
checklist, not an archaeology dig.

The architecture is **physically region-pinned**: every tenant lives
on exactly one droplet, in exactly one DO region, with its own
SQLite file. There is no cross-region replication and no shared
database. That's the whole multi-region story for pilot — keep it
simple, the DPA wins.

---

## Droplet spec (per region)

| | |
|---|---|
| Plan | Basic Droplet, **Premium AMD** |
| vCPU | 2 |
| RAM | 4 GB |
| SSD | 80 GB NVMe |
| Outbound | 4 TB included |
| Image | Ubuntu 24.04 LTS x64 |
| **Cost** | **$28/mo** + ~$5.60/mo backups |

**Regions to provision in:**

| Tenant region | DO datacenter | Hostname plan |
|---|---|---|
| `us` | NYC3 (New York) | `app.skillnex.tech` (also `app-us.skillnex.tech`) |
| `eu` | FRA1 (Frankfurt) | `app-eu.skillnex.tech` |

US is the pilot default. Provision EU only when an EU tenant signs up.

---

## Pilot today (US only)

### 1. DNS — set up both names now

Even though only US is live, claim the EU hostname today so DNS is
ready when you provision the EU droplet later. Until then it's a
404 — that's fine, no traffic flows there.

In the `skillnex.tech` DNS panel:

```
A    app             → <US droplet IP>
A    app-us          → <US droplet IP>
A    app-eu          → 0.0.0.0          # placeholder until EU exists
```

`app.skillnex.tech` is the marketing-facing name. `app-us` /
`app-eu` are the explicit per-region names — you'll need them once
both regions are live so a tenant that signs up in EU lands on the
EU droplet, not whatever `app` happens to point at today.

### 2. Provision the US droplet

DO console → Create → Droplets:

- Premium AMD, 2 vCPU / 4 GB / 80 GB
- Ubuntu 24.04 LTS
- Datacenter: **NYC3**
- Authentication: SSH key (paste your public key)
- Hostname: `skillnex-us`
- Add a **Reserved IP** (free) and assign it
- Enable backups (+20%)

Point `app.skillnex.tech` and `app-us.skillnex.tech` at the
Reserved IP.

### 3. First-boot setup (one-time, on the droplet)

SSH in as root, then:

```bash
# user
adduser --disabled-password --gecos "" skillnex
usermod -aG sudo skillnex
mkdir -p /home/skillnex/.ssh
cp /root/.ssh/authorized_keys /home/skillnex/.ssh/
chown -R skillnex:skillnex /home/skillnex/.ssh
chmod 700 /home/skillnex/.ssh
chmod 600 /home/skillnex/.ssh/authorized_keys

# packages
apt update && apt upgrade -y
apt install -y curl git build-essential nginx ufw certbot python3-certbot-nginx fail2ban

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# pnpm or npm — we use npm in CI
npm install -g pm2  # optional; systemd works fine and is one less dep

# firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

# data dir for SQLite (separate from the app for backup-friendliness)
mkdir -p /var/skillnex/data
chown -R skillnex:skillnex /var/skillnex
```

### 4. Deploy the app

As `skillnex`:

```bash
cd /home/skillnex
git clone https://github.com/inno8/skillnex.git app
cd app
npm ci
```

Create `/home/skillnex/app/.env.local` (file mode 600, owned by `skillnex`):

```bash
# REGION — must match the DO datacenter this droplet lives in.
# Signups for the wrong region will be rejected at the API.
SKILLNEX_REGION=us

# Auth secret — generate with: openssl rand -hex 32
SKILLNEX_AUTH_SECRET=<32-byte-hex-from-openssl>

# Public base URL — used in emails + OAuth redirects
SKILLNEX_BASE_URL=https://app.skillnex.tech

# DB lives outside the app dir so backups + redeploys don't trip on it
SKILLNEX_DB_PATH=/var/skillnex/data/skillnex.db

# Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...
SKILLNEX_MOCK_LLM=false

# Resend — domain must be verified for app.skillnex.tech
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Skillnex <support@skillnex.tech>
```

Build:

```bash
npm run build
```

### 5. systemd unit — keep Node alive

As root, write `/etc/systemd/system/skillnex.service`:

```ini
[Unit]
Description=Skillnex Next.js app
After=network.target

[Service]
Type=simple
User=skillnex
Group=skillnex
WorkingDirectory=/home/skillnex/app
EnvironmentFile=/home/skillnex/app/.env.local
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
# Next.js needs a few hundred MB; cap to keep an OOM contained
MemoryMax=2G

[Install]
WantedBy=multi-user.target
```

Then:

```bash
systemctl daemon-reload
systemctl enable --now skillnex
systemctl status skillnex   # verify it's running
journalctl -u skillnex -f   # tail logs
```

### 6. nginx + Let's Encrypt SSL

`/etc/nginx/sites-available/skillnex`:

```nginx
server {
  listen 80;
  server_name app.skillnex.tech app-us.skillnex.tech;
  location / { return 301 https://$host$request_uri; }
}

server {
  listen 443 ssl http2;
  server_name app.skillnex.tech app-us.skillnex.tech;

  ssl_certificate     /etc/letsencrypt/live/app.skillnex.tech/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.skillnex.tech/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  add_header Strict-Transport-Security "max-age=63072000" always;

  client_max_body_size 25M;   # xlsx uploads

  location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        "upgrade";
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;          # narrative streams
    proxy_buffering    off;           # don't break SSE
  }
}
```

```bash
ln -s /etc/nginx/sites-available/skillnex /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d app.skillnex.tech -d app-us.skillnex.tech
```

### 7. Smoke test

From your laptop:

```bash
curl -I https://app.skillnex.tech/        # 200 + landing
curl -I https://app.skillnex.tech/login   # 200 + auth shell
```

Then sign up for a real account and run a workbook through it.

---

## Adding the EU droplet later

When you sign your first EU pilot, do this. Should take 30 min end-to-end.

### 1. Provision an EU droplet

Same DO console flow as step 2 above, but:

- Datacenter: **FRA1** (Frankfurt)
- Hostname: `skillnex-eu`
- New Reserved IP

Point `app-eu.skillnex.tech` at the new Reserved IP.

### 2. Run steps 3–6 from the US setup, but with these changes

In `.env.local`:

```bash
SKILLNEX_REGION=eu                                      # ← differs from US
SKILLNEX_BASE_URL=https://app-eu.skillnex.tech          # ← differs from US
SKILLNEX_DB_PATH=/var/skillnex/data/skillnex.db         # same shape, different droplet
SKILLNEX_AUTH_SECRET=<DIFFERENT 32-byte hex>            # MUST be different from US
RESEND_FROM_EMAIL=Skillnex EU <support@skillnex.tech>   # same Resend, different display
ANTHROPIC_API_KEY=<same key is fine>
RESEND_API_KEY=<same key is fine>
```

The `SKILLNEX_AUTH_SECRET` MUST differ between regions — same secret
would mean a US session token would validate on the EU droplet,
defeating the whole physical-isolation point.

In `nginx`: change every `app.skillnex.tech` → `app-eu.skillnex.tech`.
Skip the `app.skillnex.tech` server block entirely on the EU droplet
(only the US droplet hosts the marketing landing).

### 3. DNS — flip `app-eu` from placeholder to real

```
A    app-eu          → <EU droplet IP>     # was 0.0.0.0
```

### 4. Tenant routing — choose one

Option A (simple, no code change): every signup form posts to
`app.skillnex.tech`. After signup, if the tenant picked EU, return
a `redirect_to` URL pointing at `app-eu.skillnex.tech/login`. The
EU tenant lives on the EU droplet from that point forward.

Option B (cleaner, small code change): `/login`, `/signup` work on
both hosts. After login, look up the user's tenant region and 302
to the matching host if they're on the wrong one.

**For pilot, do Option A.** It's a one-line change to the signup
response and zero code change to the auth surface.

### 5. Verify region enforcement is working

On the EU droplet, try to sign up with `region: "us"`:

```bash
curl -X POST https://app-eu.skillnex.tech/api/signup \
  -H "Content-Type: application/json" \
  -d '{"company_name":"X","name":"Y","email":"z@z.com","password":"longenough10","region":"us"}'
```

Should return `409 Wrong region for this droplet`. That's
`SKILLNEX_REGION` doing its job — without it, you'd silently create
a US tenant on EU infrastructure and break the DPA on day one.

---

## Backups + recovery

### Automatic — already on
- **DO droplet snapshots**: weekly, retained 4 weeks. ~$5.60/mo per droplet.
  Recovery = "restore droplet from snapshot" in the DO console (~10 min).

### When to add more
| Trigger | Add |
|---|---|
| First paying customer asks about RPO | litestream → DO Spaces, $5/mo per region. RPO drops from 1 week to ~30 sec. |
| Compliance review asks about offsite copy | Same as above — Spaces in a different DO region than the droplet. |
| Customer asks for "delete my tenant in 24 hours" SLA | Build out the cron sweep that hard-deletes 30-day soft-deleted tenants (already designed in `lib/tenant.ts`). |

### Manual backup right now (no cost)
```bash
# On the droplet
sqlite3 /var/skillnex/data/skillnex.db ".backup '/tmp/skillnex-$(date +%F).db'"
scp skillnex@app-us.skillnex.tech:/tmp/skillnex-*.db ./local-backups/
```

Run weekly until you set up litestream.

---

## When to scale

| Signal | Action |
|---|---|
| Sustained RAM > 80% | Resize droplet to 4 vCPU / 8 GB ($48/mo) — in-place, ~30s downtime |
| Sustained CPU > 70% across both cores | Same — bigger droplet first, more droplets second |
| Concurrent narrative streams > 50 | Move LLM calls to a worker droplet behind a queue (Redis or DO Functions) |
| 75+ tenants per region | SQLite → DO Managed Postgres ($15/mo). Audit log stays append-only either way. |
| Narrative latency > 5s p95 | Pre-warm Anthropic prompt cache by issuing a no-op call 5 min before the cycle's expected peak |

---

## Cost ladder

| Stage | Setup | Monthly |
|---|---|---|
| **Today (US-only pilot)** | 1× Premium AMD US droplet + backups | **~$34** |
| First EU pilot signs | + 1× Premium AMD EU droplet + backups | **~$67** |
| First paying customer | + DO Spaces for litestream | **+$5** per active region |
| 25+ tenants / region | Resize each droplet to 4 vCPU / 8 GB | **+$20** per region |
| 75+ tenants / region | + DO Managed Postgres | **+$15** per region |

LLM cost is variable (~$3 / cycle / tenant per current measurements);
not on this ladder because it scales with usage, not infra.
