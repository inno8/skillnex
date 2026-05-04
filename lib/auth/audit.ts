import { getDb } from "@/lib/db";

export type AuditAction =
  | "signup"
  | "login"
  | "logout"
  | "password_reset_requested"
  | "password_changed"
  | "email_verified"
  | "tenant_created"
  | "user_invited"
  | "invitation_accepted"
  | "user_suspended"
  | "user_restored"
  | "role_changed"
  | "permission_denied"
  | "view_employee"
  | "generate_narrative"
  | "narrative_edited"
  | "review_emailed"
  | "export_data"
  | "delete_employee"
  | "delete_tenant"
  | "integration_connected"
  | "integration_disconnected"
  | "system_event";

export type AuditEntry = {
  tenant_id: string;
  user_id?: string | null;
  action: AuditAction;
  target_type?: string;
  target_id?: string;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown>;
};

export function auditLog(entry: AuditEntry): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log
      (tenant_id, user_id, action, target_type, target_id, ip_address, user_agent, details, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.tenant_id,
    entry.user_id ?? null,
    entry.action,
    entry.target_type ?? null,
    entry.target_id ?? null,
    entry.ip_address ?? null,
    entry.user_agent ?? null,
    entry.details ? JSON.stringify(entry.details) : null,
    new Date().toISOString(),
  );
}
