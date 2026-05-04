/**
 * Tenant lifecycle — region/retention edits, export, soft-delete +
 * 30-day grace period.
 *
 * Soft-delete model: setting tenants.deleted_at flips the tenant
 * "out of view" everywhere (the requireTenantUserPage / Api gates
 * reject sessions for deleted tenants). Data isn't actually wiped
 * for 30 days; a future cron sweep handles the hard delete. The
 * owner can restore by clearing deleted_at within that window.
 *
 * EU 30-day retention cap is enforced by the SQL trigger from
 * migration 0001 — we just surface the same constraint at the API
 * layer for a friendlier error message.
 */
import { getDb } from "@/lib/db";

export type Region = "us" | "eu";

export type TenantSettings = {
  id: string;
  name: string;
  region: Region;
  plan: string;
  retention_days: number;
  created_at: string;
  deleted_at: string | null;
  member_count: number;
  employee_count: number;
  upload_count: number;
};

export function getTenantSettings(tenant_id: string): TenantSettings | null {
  const db = getDb();
  const t = db
    .prepare(
      `SELECT id, name, region, plan, retention_days, created_at, deleted_at
         FROM tenants WHERE id = ?`,
    )
    .get(tenant_id) as
    | (Omit<TenantSettings, "member_count" | "employee_count" | "upload_count"> & {
        deleted_at: string | null;
      })
    | undefined;
  if (!t) return null;
  const counts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM user WHERE tenant_id = ? AND status != 'deleted') AS members,
         (SELECT COUNT(*) FROM employees WHERE tenant_id = ?) AS employees,
         (SELECT COUNT(*) FROM uploads WHERE tenant_id = ?) AS uploads`,
    )
    .get(tenant_id, tenant_id, tenant_id) as {
    members: number;
    employees: number;
    uploads: number;
  };
  return {
    ...t,
    member_count: counts.members,
    employee_count: counts.employees,
    upload_count: counts.uploads,
  };
}

export type UpdateRetentionResult = { ok: true } | { ok: false; reason: "out_of_range" | "eu_cap" };

const MIN_RETENTION = 7;
const MAX_RETENTION = 365;

export function updateRetention(tenant_id: string, retention_days: number): UpdateRetentionResult {
  if (
    !Number.isInteger(retention_days) ||
    retention_days < MIN_RETENTION ||
    retention_days > MAX_RETENTION
  ) {
    return { ok: false, reason: "out_of_range" };
  }
  const db = getDb();
  try {
    db.prepare(`UPDATE tenants SET retention_days = ? WHERE id = ?`).run(retention_days, tenant_id);
    return { ok: true };
  } catch (err) {
    // Migration 0001's trigger raises ABORT with this message text on
    // an EU tenant trying to bump retention above 30. Catch the SQL-
    // level enforcement and translate it for the UI layer.
    const message = err instanceof Error ? err.message : String(err);
    if (/EU tenants are capped at 30-day retention/i.test(message)) {
      return { ok: false, reason: "eu_cap" };
    }
    throw err;
  }
}

export type SoftDeleteResult = { ok: true } | { ok: false; reason: "already_deleted" };

export function softDeleteTenant(tenant_id: string): SoftDeleteResult {
  const db = getDb();
  const row = db.prepare(`SELECT deleted_at FROM tenants WHERE id = ?`).get(tenant_id) as
    | { deleted_at: string | null }
    | undefined;
  if (!row) throw new Error(`tenant ${tenant_id} not found`);
  if (row.deleted_at) return { ok: false, reason: "already_deleted" };
  db.prepare(`UPDATE tenants SET deleted_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    tenant_id,
  );
  // Sign every user in the tenant out — sessions become invalid as
  // soon as the next request hits requireTenantUserPage / Api.
  db.prepare(`DELETE FROM session WHERE userId IN (SELECT id FROM user WHERE tenant_id = ?)`).run(
    tenant_id,
  );
  return { ok: true };
}

export type ExportSnapshot = {
  generated_at: string;
  tenant: {
    id: string;
    name: string;
    region: Region;
    retention_days: number;
    created_at: string;
  };
  members: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    created_at: string;
  }>;
  employees: Array<Record<string, unknown>>;
  uploads: Array<Record<string, unknown>>;
  audit_log: Array<Record<string, unknown>>;
};

/**
 * Build a JSON snapshot of every row Skillnex holds for this tenant.
 * Used by /api/settings/data/export which streams it as a .json file.
 * Audit log is included so the export is fully self-describing.
 */
export function buildExportSnapshot(tenant_id: string): ExportSnapshot {
  const db = getDb();
  const tenant = db
    .prepare(`SELECT id, name, region, retention_days, created_at FROM tenants WHERE id = ?`)
    .get(tenant_id) as ExportSnapshot["tenant"] | undefined;
  if (!tenant) throw new Error(`tenant ${tenant_id} not found`);
  const members = db
    .prepare(
      `SELECT id, email, name, role, status, createdAt AS created_at
         FROM user WHERE tenant_id = ?`,
    )
    .all(tenant_id) as ExportSnapshot["members"];
  const employees = db
    .prepare(`SELECT * FROM employees WHERE tenant_id = ?`)
    .all(tenant_id) as ExportSnapshot["employees"];
  const uploads = db
    .prepare(`SELECT * FROM uploads WHERE tenant_id = ?`)
    .all(tenant_id) as ExportSnapshot["uploads"];
  const audit_log = db
    .prepare(`SELECT * FROM audit_log WHERE tenant_id = ? ORDER BY id`)
    .all(tenant_id) as ExportSnapshot["audit_log"];
  return {
    generated_at: new Date().toISOString(),
    tenant,
    members,
    employees,
    uploads,
    audit_log,
  };
}

export const RETENTION_LIMITS = {
  min: MIN_RETENTION,
  max: MAX_RETENTION,
  eu_max: 30,
};
