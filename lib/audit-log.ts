/**
 * Read-side helpers for the audit_log table. The write side lives in
 * lib/auth/audit.ts (auditLog + auditFromRequest); this is the query
 * side used by /settings/audit-log and any future audit surfaces.
 */
import { getDb } from "@/lib/db";

export type AuditLogRow = {
  id: number;
  tenant_id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
  ts: string;
};

/**
 * List audit entries for one tenant, newest first. Joins user.email so
 * the UI can show "who did this" without the caller having to do the
 * lookup. user_email is null for system events (signup tenant_created
 * before the user row exists, retention sweeps, etc.).
 */
export function listAuditLog(
  tenant_id: string,
  opts: { action?: string; limit?: number } = {},
): AuditLogRow[] {
  const db = getDb();
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 1000));
  const rows = opts.action
    ? (db
        .prepare(
          `SELECT a.id, a.tenant_id, a.user_id, u.email AS user_email,
                  a.action, a.target_type, a.target_id, a.ip_address,
                  a.user_agent, a.details, a.ts
             FROM audit_log a
             LEFT JOIN user u ON u.id = a.user_id
            WHERE a.tenant_id = ? AND a.action = ?
            ORDER BY a.id DESC
            LIMIT ?`,
        )
        .all(tenant_id, opts.action, limit) as AuditLogRow[])
    : (db
        .prepare(
          `SELECT a.id, a.tenant_id, a.user_id, u.email AS user_email,
                  a.action, a.target_type, a.target_id, a.ip_address,
                  a.user_agent, a.details, a.ts
             FROM audit_log a
             LEFT JOIN user u ON u.id = a.user_id
            WHERE a.tenant_id = ?
            ORDER BY a.id DESC
            LIMIT ?`,
        )
        .all(tenant_id, limit) as AuditLogRow[]);
  return rows;
}

/** Distinct action strings present in this tenant's audit log. */
export function listAuditActions(tenant_id: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT DISTINCT action FROM audit_log WHERE tenant_id = ? ORDER BY action`)
    .all(tenant_id) as Array<{ action: string }>;
  return rows.map((r) => r.action);
}
