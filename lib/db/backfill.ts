/**
 * Backfill helpers for Phase 2 migrations.
 *
 * The migrations themselves only add columns/tables. Application data
 * needs to be moved into the new structure — that work happens here so
 * it's testable and idempotent.
 *
 * Idempotency: each backfill checks whether the target state already exists
 * and is a no-op on second run. Safe to call on every app boot.
 */

import { randomBytes } from "node:crypto";

import type Database from "better-sqlite3";

const DEMO_TENANT_ID = "tnt_demo";

/**
 * Ensure the demo tenant exists. Existing employee rows that were created
 * before Phase 2 already carry tenant_id='tnt_demo' as a column default;
 * this function just makes the matching tenants row real so foreign-key
 * relationships hold.
 */
export function ensureDemoTenant(db: Database.Database): {
  created: boolean;
  tenant_id: string;
} {
  const existing = db
    .prepare("SELECT id FROM tenants WHERE id = ?")
    .get(DEMO_TENANT_ID);
  if (existing) return { created: false, tenant_id: DEMO_TENANT_ID };

  db.prepare(
    `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    DEMO_TENANT_ID,
    "Skillnex Demo",
    "us",
    "pilot",
    90,
    new Date().toISOString(),
  );

  return { created: true, tenant_id: DEMO_TENANT_ID };
}

/**
 * Generate a tenant-scoped ID. Format: `<prefix>_<base32>`.
 * Phase 2.0 uses opaque prefixed IDs (tnt_, usr_, ses_, inv_) for clarity
 * in logs and URLs without leaking integer counts.
 */
export function generateId(prefix: "tnt" | "usr" | "ses" | "inv"): string {
  // 16 bytes = 26 base32 chars; collision-safe for hundreds of millions of rows
  const bytes = randomBytes(16);
  const base32 = bytes
    .toString("base64")
    .replace(/[+/]/g, "")
    .replace(/=+$/, "")
    .toLowerCase()
    .slice(0, 22);
  return `${prefix}_${base32}`;
}
