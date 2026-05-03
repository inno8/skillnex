/**
 * Manager → department assignments.
 *
 * Schema: manager_departments (manager_user_id, department, tenant_id,
 * assigned_at). One row per (manager, department) pair. A manager sees
 * every employee whose `department` matches one of their assigned values;
 * owners/admins see everything in the tenant; an employee sees only their
 * own row (matched on user.employee_key).
 *
 * Why department-scope instead of per-employee:
 *   - Real-world managers manage departments. "You handle Sales" is the
 *     operating model, not "you handle Alice + Bob + Carol".
 *   - Per-employee assignment forces re-assignment every cycle because
 *     each xlsx upload generates fresh employee_key strings; a manager
 *     would silently lose visibility otherwise.
 *
 * Tenant scoping: every reader and writer takes a tenant_id. Cross-tenant
 * isolation is covered in tests/db/tenant-isolation + tests/scope/.
 */
import { getDb } from "@/lib/db";

export type DepartmentAssignment = {
  manager_user_id: string;
  department: string;
  tenant_id: string;
  assigned_at: string;
};

/** All departments assigned to one manager, in alphabetical order. */
export function listAssignedDepartments(tenant_id: string, manager_user_id: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT department FROM manager_departments
        WHERE tenant_id = ? AND manager_user_id = ?
        ORDER BY department`,
    )
    .all(tenant_id, manager_user_id) as Array<{ department: string }>;
  return rows.map((r) => r.department);
}

/** Set of departments assigned to one manager — handy for in-memory filters. */
export function assignedDepartmentSet(tenant_id: string, manager_user_id: string): Set<string> {
  return new Set(listAssignedDepartments(tenant_id, manager_user_id));
}

export type AssignResult =
  | { ok: true; added: number; alreadyAssigned: number }
  | { ok: false; reason: "manager_not_found" | "manager_wrong_role" };

/**
 * Add zero-or-more departments to a manager's scope. Idempotent — keys
 * already assigned are counted in `alreadyAssigned` rather than triggering
 * a UNIQUE constraint failure.
 */
export function assignDepartments(
  tenant_id: string,
  manager_user_id: string,
  departments: string[],
): AssignResult {
  const db = getDb();

  // Verify the target exists in this tenant + has manager role. Owners +
  // admins see everything; assigning departments to them creates rows
  // that have no effect — refuse instead of silently storing useless data.
  const mgr = db
    .prepare(
      `SELECT role FROM user
        WHERE tenant_id = ? AND id = ? AND status != 'deleted'`,
    )
    .get(tenant_id, manager_user_id) as { role: string } | undefined;
  if (!mgr) return { ok: false, reason: "manager_not_found" };
  if (mgr.role !== "manager") return { ok: false, reason: "manager_wrong_role" };

  const insert = db.prepare(
    `INSERT OR IGNORE INTO manager_departments
       (manager_user_id, department, tenant_id, assigned_at)
     VALUES (?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();

  let added = 0;
  let alreadyAssigned = 0;
  const tx = db.transaction((deps: string[]) => {
    for (const dept of deps) {
      const info = insert.run(manager_user_id, dept, tenant_id, now);
      if (info.changes > 0) added += 1;
      else alreadyAssigned += 1;
    }
  });
  tx(departments);

  return { ok: true, added, alreadyAssigned };
}

/** Remove specific (manager, department) rows. Returns rows actually deleted. */
export function unassignDepartments(
  tenant_id: string,
  manager_user_id: string,
  departments: string[],
): number {
  const db = getDb();
  const del = db.prepare(
    `DELETE FROM manager_departments
      WHERE tenant_id = ? AND manager_user_id = ? AND department = ?`,
  );
  let total = 0;
  const tx = db.transaction((deps: string[]) => {
    for (const dept of deps) total += del.run(tenant_id, manager_user_id, dept).changes;
  });
  tx(departments);
  return total;
}

/** Replace a manager's whole department set in one transaction. */
export function setDepartmentAssignments(
  tenant_id: string,
  manager_user_id: string,
  departments: string[],
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

  const desired = new Set(departments);
  const current = assignedDepartmentSet(tenant_id, manager_user_id);
  const toAdd = [...desired].filter((d) => !current.has(d));
  const toRemove = [...current].filter((d) => !desired.has(d));

  const tx = db.transaction(() => {
    if (toRemove.length > 0) unassignDepartments(tenant_id, manager_user_id, toRemove);
    if (toAdd.length > 0) assignDepartments(tenant_id, manager_user_id, toAdd);
  });
  tx();

  return {
    ok: true,
    added: toAdd.length,
    alreadyAssigned: current.size - toRemove.length,
  };
}

/**
 * Per-manager department list, for the team page badge. Returns a Map of
 * manager_user_id → string[] (alphabetized) so the row can render
 * "Sales, HR" without N+1 queries.
 */
export function listAssignedDepartmentsByManager(tenant_id: string): Map<string, string[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT manager_user_id, department
         FROM manager_departments
        WHERE tenant_id = ?
        ORDER BY manager_user_id, department`,
    )
    .all(tenant_id) as Array<{ manager_user_id: string; department: string }>;
  const out = new Map<string, string[]>();
  for (const r of rows) {
    const arr = out.get(r.manager_user_id) ?? [];
    arr.push(r.department);
    out.set(r.manager_user_id, arr);
  }
  return out;
}

/**
 * Distinct departments present in this tenant's roster — the canonical
 * list of options the assignment picker should show. Source of truth is
 * what's actually been ingested; we don't currently let owners "pre-
 * declare" departments before any employee lives in them.
 */
export function listTenantDepartments(tenant_id: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT department
         FROM employees
        WHERE tenant_id = ?
        ORDER BY department`,
    )
    .all(tenant_id) as Array<{ department: string }>;
  return rows.map((r) => r.department);
}
