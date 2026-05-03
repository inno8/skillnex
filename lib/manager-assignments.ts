/**
 * Manager → employee assignments.
 *
 * Schema: manager_assignments (manager_user_id, employee_key, tenant_id,
 * assigned_at). One row per (manager, employee) pair. A manager sees ONLY
 * the employees they're assigned to; owners/admins see everything in the
 * tenant; an employee sees only their own row (matched on user.employee_key).
 *
 * Tenant scoping: every reader and writer takes a tenant_id. The cross-
 * tenant tests in tests/db/tenant-isolation cover the contract.
 */
import { getDb } from "@/lib/db";

export type Assignment = {
  manager_user_id: string;
  employee_key: string;
  tenant_id: string;
  assigned_at: string;
};

/** All employee_keys assigned to one manager, in deterministic order. */
export function listAssignedKeys(tenant_id: string, manager_user_id: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT employee_key FROM manager_assignments
        WHERE tenant_id = ? AND manager_user_id = ?
        ORDER BY employee_key`,
    )
    .all(tenant_id, manager_user_id) as Array<{ employee_key: string }>;
  return rows.map((r) => r.employee_key);
}

/** Set of employee_keys assigned to one manager — handy for in-memory filters. */
export function assignedKeySet(tenant_id: string, manager_user_id: string): Set<string> {
  return new Set(listAssignedKeys(tenant_id, manager_user_id));
}

export type AssignResult =
  | { ok: true; added: number; alreadyAssigned: number }
  | { ok: false; reason: "manager_not_found" | "manager_wrong_role" };

/**
 * Add zero-or-more employee_keys to a manager's scope. Idempotent — keys
 * that are already assigned are counted in `alreadyAssigned` rather than
 * triggering a UNIQUE constraint failure.
 */
export function assignEmployees(
  tenant_id: string,
  manager_user_id: string,
  employee_keys: string[],
): AssignResult {
  const db = getDb();

  // Verify the manager exists in this tenant + has the right role.
  // Owners/admins don't need assignments (they see everything), so this
  // refuses to create rows for them — keeps the table small + the
  // "manager has assignments" invariant clean.
  const mgr = db
    .prepare(
      `SELECT role FROM user
        WHERE tenant_id = ? AND id = ? AND status != 'deleted'`,
    )
    .get(tenant_id, manager_user_id) as { role: string } | undefined;
  if (!mgr) return { ok: false, reason: "manager_not_found" };
  if (mgr.role !== "manager") return { ok: false, reason: "manager_wrong_role" };

  const insert = db.prepare(
    `INSERT OR IGNORE INTO manager_assignments
       (manager_user_id, employee_key, tenant_id, assigned_at)
     VALUES (?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();

  let added = 0;
  let alreadyAssigned = 0;
  const tx = db.transaction((keys: string[]) => {
    for (const key of keys) {
      const info = insert.run(manager_user_id, key, tenant_id, now);
      if (info.changes > 0) added += 1;
      else alreadyAssigned += 1;
    }
  });
  tx(employee_keys);

  return { ok: true, added, alreadyAssigned };
}

/** Remove specific (manager, employee_key) rows. Returns how many actually deleted. */
export function unassignEmployees(
  tenant_id: string,
  manager_user_id: string,
  employee_keys: string[],
): number {
  const db = getDb();
  const del = db.prepare(
    `DELETE FROM manager_assignments
      WHERE tenant_id = ? AND manager_user_id = ? AND employee_key = ?`,
  );
  let total = 0;
  const tx = db.transaction((keys: string[]) => {
    for (const key of keys) total += del.run(tenant_id, manager_user_id, key).changes;
  });
  tx(employee_keys);
  return total;
}

/** Replace a manager's whole assignment set in one transaction. */
export function setAssignments(
  tenant_id: string,
  manager_user_id: string,
  employee_keys: string[],
): AssignResult {
  const db = getDb();
  const mgr = db
    .prepare(
      `SELECT role FROM user
        WHERE tenant_id = ? AND id = ? AND status != 'deleted'`,
    )
    .get(tenant_id, manager_user_id) as { role: string } | undefined;
  if (!mgr) return { ok: false, reason: "manager_not_found" };
  if (mgr.role !== "manager") return { ok: false, reason: "manager_wrong_role" };

  const desired = new Set(employee_keys);
  const current = assignedKeySet(tenant_id, manager_user_id);
  const toAdd = [...desired].filter((k) => !current.has(k));
  const toRemove = [...current].filter((k) => !desired.has(k));

  const tx = db.transaction(() => {
    if (toRemove.length > 0) unassignEmployees(tenant_id, manager_user_id, toRemove);
    if (toAdd.length > 0) assignEmployees(tenant_id, manager_user_id, toAdd);
  });
  tx();

  return { ok: true, added: toAdd.length, alreadyAssigned: current.size - toRemove.length };
}

/** Map of manager_user_id → assigned key count, for the team page. */
export function countAssignmentsByManager(tenant_id: string): Map<string, number> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT manager_user_id, COUNT(*) AS n
         FROM manager_assignments
        WHERE tenant_id = ?
        GROUP BY manager_user_id`,
    )
    .all(tenant_id) as Array<{ manager_user_id: string; n: number }>;
  return new Map(rows.map((r) => [r.manager_user_id, r.n]));
}
