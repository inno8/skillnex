#!/usr/bin/env bash
#
# Skillnex on-droplet SQLite backup. Runs as the `skillnex` user (or
# root) — uses sqlite3 .backup so the file is consistent even if the
# app is mid-write. Output goes to /var/skillnex/backups/.
#
# Pair with cron until you set up litestream (see docs/deploy.md):
#   0 3 * * *  /home/skillnex/app/scripts/deploy/backup.sh >> /var/log/skillnex-backup.log 2>&1
#
# Then scp them off-host periodically, e.g. from your laptop:
#   rsync -av skillnex@app-us.skillnex.tech:/var/skillnex/backups/ ./local-backups/

set -euo pipefail

DB_PATH="${SKILLNEX_DB_PATH:-/var/skillnex/data/skillnex.db}"
OUT_DIR="${SKILLNEX_BACKUP_DIR:-/var/skillnex/backups}"
KEEP_DAYS="${SKILLNEX_BACKUP_KEEP_DAYS:-14}"

mkdir -p "$OUT_DIR"
ts="$(date +%Y%m%d-%H%M%S)"
out="$OUT_DIR/skillnex-$ts.db"

if [[ ! -f "$DB_PATH" ]]; then
  echo "[backup] DB not found at $DB_PATH — nothing to back up." >&2
  exit 1
fi

# .backup is the safe online backup API — locks briefly per page,
# never sees a torn write. cp/scp on a live SQLite file is NOT safe.
sqlite3 "$DB_PATH" ".backup '$out'"

# Compress to save space + transfer time. ~5x for our row sizes.
gzip "$out"
out="$out.gz"

echo "[backup] wrote $out ($(du -h "$out" | cut -f1))"

# Prune old backups beyond KEEP_DAYS — DO snapshots cover the rest.
find "$OUT_DIR" -name 'skillnex-*.db.gz' -type f -mtime "+$KEEP_DAYS" -print -delete
