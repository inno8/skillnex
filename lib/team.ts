/**
 * Team management — roster + invitations + role/status changes.
 *
 * Read side returns plain rows the UI can render directly. Write side
 * returns the row that changed (or throws) so callers can audit the
 * delta with the right target_id without re-querying.
 *
 * Tenant scoping: every reader and writer takes a tenant_id and
 * scopes to it. The cross-tenant tests in tests/db/tenant-isolation
 * cover the contract.
 */
import { randomBytes } from "node:crypto";

import { getDb } from "@/lib/db";

export type Role = "owner" | "admin" | "manager" | "employee";
export type Status = "active" | "invited" | "suspended" | "deleted";

export type TeamMember = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: Status;
  emailVerified: number;
  last_login_at: string | null;
  createdAt: string;
};

export type Invitation = {
  token: string;
  tenant_id: string;
  email: string;
  role: Role;
  invited_by_user_id: string;
  invited_by_email: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export function listTeamMembers(tenant_id: string): TeamMember[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, email, name, role, status, emailVerified, last_login_at, createdAt
         FROM user
        WHERE tenant_id = ? AND status != 'deleted'
        ORDER BY
          CASE role
            WHEN 'owner' THEN 0
            WHEN 'admin' THEN 1
            WHEN 'manager' THEN 2
            ELSE 3
          END,
          email`,
    )
    .all(tenant_id) as TeamMember[];
}

export function listPendingInvitations(tenant_id: string): Invitation[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT i.token, i.tenant_id, i.email, i.role, i.invited_by_user_id,
              u.email AS invited_by_email,
              i.expires_at, i.accepted_at, i.created_at
         FROM invitations i
         LEFT JOIN user u ON u.id = i.invited_by_user_id
        WHERE i.tenant_id = ?
          AND i.accepted_at IS NULL
          AND i.expires_at > datetime('now')
        ORDER BY i.created_at DESC`,
    )
    .all(tenant_id) as Invitation[];
}

export function getInvitationByToken(token: string): Invitation | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT i.token, i.tenant_id, i.email, i.role, i.invited_by_user_id,
              u.email AS invited_by_email,
              i.expires_at, i.accepted_at, i.created_at
         FROM invitations i
         LEFT JOIN user u ON u.id = i.invited_by_user_id
        WHERE i.token = ?`,
    )
    .get(token) as Invitation | undefined;
  return row ?? null;
}

/** Generate a URL-safe random invitation token (~190 bits of entropy). */
export function newInvitationToken(): string {
  return randomBytes(24)
    .toString("base64")
    .replace(/[+/]/g, (c) => (c === "+" ? "-" : "_"))
    .replace(/=+$/, "");
}

export type CreateInvitationInput = {
  tenant_id: string;
  email: string;
  role: Role;
  invited_by_user_id: string;
  expiresInDays?: number;
};

export type CreateInvitationResult =
  | { ok: true; invitation: Invitation }
  | { ok: false; reason: "already_member" | "already_invited" };

export function createInvitation(input: CreateInvitationInput): CreateInvitationResult {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const days = Math.max(1, Math.min(input.expiresInDays ?? 7, 30));

  // Reject if a non-deleted user with this email already exists in
  // the tenant. Cross-tenant clashes are fine — different tenant means
  // a fresh user row, distinct from any other tenant's members.
  const existingMember = db
    .prepare(
      `SELECT id FROM user
        WHERE tenant_id = ? AND email = ? AND status != 'deleted'`,
    )
    .get(input.tenant_id, email);
  if (existingMember) return { ok: false, reason: "already_member" };

  // Reject if there's already a live (un-accepted, un-expired) invite
  // for this email in this tenant. Owner can revoke + reissue if they
  // want a fresh link.
  const existingInvite = db
    .prepare(
      `SELECT token FROM invitations
        WHERE tenant_id = ? AND email = ?
          AND accepted_at IS NULL AND expires_at > datetime('now')`,
    )
    .get(input.tenant_id, email);
  if (existingInvite) return { ok: false, reason: "already_invited" };

  const token = newInvitationToken();
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  db.prepare(
    `INSERT INTO invitations
       (token, tenant_id, email, role, invited_by_user_id, expires_at,
        accepted_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    token,
    input.tenant_id,
    email,
    input.role,
    input.invited_by_user_id,
    expires.toISOString(),
    now.toISOString(),
  );

  return { ok: true, invitation: getInvitationByToken(token) as Invitation };
}

export function revokeInvitation(tenant_id: string, token: string): boolean {
  const db = getDb();
  const info = db
    .prepare(
      `DELETE FROM invitations
        WHERE tenant_id = ? AND token = ? AND accepted_at IS NULL`,
    )
    .run(tenant_id, token);
  return info.changes > 0;
}

export function markInvitationAccepted(token: string): void {
  const db = getDb();
  db.prepare(`UPDATE invitations SET accepted_at = ? WHERE token = ?`).run(
    new Date().toISOString(),
    token,
  );
}

/* --------------------- role + status changes --------------------- */

export type ChangeRoleResult =
  | { ok: true; user: TeamMember }
  | { ok: false; reason: "not_found" | "would_orphan_owner" };

/**
 * Promote/demote. The "would_orphan_owner" guard prevents demoting the
 * last owner — every tenant must keep at least one owner row so /api
 * destructive endpoints have a responsible party.
 */
export function changeRole(tenant_id: string, user_id: string, newRole: Role): ChangeRoleResult {
  const db = getDb();
  const target = db
    .prepare(
      `SELECT id, role FROM user
        WHERE tenant_id = ? AND id = ? AND status != 'deleted'`,
    )
    .get(tenant_id, user_id) as { id: string; role: Role } | undefined;
  if (!target) return { ok: false, reason: "not_found" };

  if (target.role === "owner" && newRole !== "owner") {
    const otherOwners = db
      .prepare(
        `SELECT COUNT(*) AS n FROM user
          WHERE tenant_id = ? AND role = 'owner' AND status = 'active'
            AND id != ?`,
      )
      .get(tenant_id, user_id) as { n: number };
    if (otherOwners.n === 0) return { ok: false, reason: "would_orphan_owner" };
  }

  db.prepare(`UPDATE user SET role = ?, updatedAt = ? WHERE tenant_id = ? AND id = ?`).run(
    newRole,
    new Date().toISOString(),
    tenant_id,
    user_id,
  );

  return { ok: true, user: getTeamMember(tenant_id, user_id) as TeamMember };
}

export type ChangeStatusResult =
  | { ok: true; user: TeamMember }
  | { ok: false; reason: "not_found" | "would_orphan_owner" };

export function suspendUser(tenant_id: string, user_id: string): ChangeStatusResult {
  const db = getDb();
  const target = db
    .prepare(
      `SELECT id, role, status FROM user
        WHERE tenant_id = ? AND id = ?`,
    )
    .get(tenant_id, user_id) as { id: string; role: Role; status: Status } | undefined;
  if (!target) return { ok: false, reason: "not_found" };

  if (target.role === "owner") {
    const otherActiveOwners = db
      .prepare(
        `SELECT COUNT(*) AS n FROM user
          WHERE tenant_id = ? AND role = 'owner' AND status = 'active'
            AND id != ?`,
      )
      .get(tenant_id, user_id) as { n: number };
    if (otherActiveOwners.n === 0) return { ok: false, reason: "would_orphan_owner" };
  }

  db.prepare(
    `UPDATE user SET status = 'suspended', updatedAt = ?
      WHERE tenant_id = ? AND id = ?`,
  ).run(new Date().toISOString(), tenant_id, user_id);

  // Best-effort: kill every live session for this user so the suspend
  // takes effect immediately (otherwise they keep working until their
  // cookie cache TTL expires).
  db.prepare(`DELETE FROM session WHERE userId = ?`).run(user_id);

  return { ok: true, user: getTeamMember(tenant_id, user_id) as TeamMember };
}

export function restoreUser(tenant_id: string, user_id: string): ChangeStatusResult {
  const db = getDb();
  const target = db
    .prepare(`SELECT id FROM user WHERE tenant_id = ? AND id = ?`)
    .get(tenant_id, user_id);
  if (!target) return { ok: false, reason: "not_found" };

  db.prepare(
    `UPDATE user SET status = 'active', updatedAt = ?
      WHERE tenant_id = ? AND id = ?`,
  ).run(new Date().toISOString(), tenant_id, user_id);

  return { ok: true, user: getTeamMember(tenant_id, user_id) as TeamMember };
}

export function getTeamMember(tenant_id: string, user_id: string): TeamMember | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, email, name, role, status, emailVerified, last_login_at, createdAt
         FROM user
        WHERE tenant_id = ? AND id = ?`,
    )
    .get(tenant_id, user_id) as TeamMember | undefined;
  return row ?? null;
}
