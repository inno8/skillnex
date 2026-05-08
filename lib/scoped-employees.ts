/**
 * Role-scoped employee readers. Pages call THESE instead of the raw
 * lib/db readers so the visibility rules are enforced in one place
 * instead of being threaded through every handler.
 *
 * Visibility matrix:
 *   owner      → every employee in the tenant
 *   admin      → every employee in the tenant
 *   manager    → only employees whose `department` is in their
 *                manager_departments rows for this tenant
 *   employee   → only the row matching their user.employee_key, if set
 *
 * Out-of-scope rows return null (same shape as "doesn't exist") so the
 * API never leaks the existence of unauthorized rows.
 */
import type { AuthContext } from "@/lib/auth/middleware";
import { assignedDepartmentSet } from "@/lib/manager-assignments";
import { countEmployees, getEmployee, listEmployees } from "@/lib/db";
import type { EmployeeRecord } from "@/lib/types";

export type EmployeeScope =
  | { kind: "all" }
  | { kind: "manager"; assignedDepartments: Set<string> }
  | { kind: "employee"; ownKey: string | null };

/** Resolve the scope object once per page render. */
export function resolveScope(ctx: AuthContext): EmployeeScope {
  if (ctx.user.role === "owner" || ctx.user.role === "admin") {
    return { kind: "all" };
  }
  if (ctx.user.role === "manager") {
    return {
      kind: "manager",
      assignedDepartments: assignedDepartmentSet(ctx.tenant.id, ctx.user.id),
    };
  }
  return { kind: "employee", ownKey: ctx.user.employee_key };
}

/**
 * Scoped equivalent of listEmployees(). Optional department filter is
 * applied AFTER the scope filter — a manager filtered to a department
 * they don't cover sees an empty list rather than other managers' data.
 *
 * `cycle_label` defaults to the most recent cycle for the tenant when
 * omitted; pages that have a cycle param threaded through the URL pass
 * it explicitly so the user's TopBar selection is honored.
 */
export function listEmployeesForUser(
  ctx: AuthContext,
  opts: { department?: string; cycle_label?: string } = {},
): EmployeeRecord[] {
  const scope = resolveScope(ctx);
  const all = listEmployees(ctx.tenant.id, {
    department: opts.department,
    cycle_label: opts.cycle_label,
  });
  if (scope.kind === "all") return all;
  if (scope.kind === "manager") {
    return all.filter((e) => scope.assignedDepartments.has(e.department));
  }
  // employee
  if (!scope.ownKey) return [];
  return all.filter((e) => e.employee_key === scope.ownKey);
}

/**
 * Scoped equivalent of getEmployee(). Returns null when the row exists
 * but the caller's scope can't see it.
 */
export function getEmployeeForUser(
  ctx: AuthContext,
  employee_key: string,
  cycle_label?: string,
): EmployeeRecord | null {
  const scope = resolveScope(ctx);
  // For manager scope we need the row to know which department it's in,
  // then check the department membership. Cheaper than fetching all rows.
  const row = getEmployee(ctx.tenant.id, employee_key, cycle_label);
  if (!row) return null;
  if (scope.kind === "manager" && !scope.assignedDepartments.has(row.department)) {
    return null;
  }
  if (scope.kind === "employee" && scope.ownKey !== employee_key) {
    return null;
  }
  return row;
}

/** Convenience: count what the caller can see, for headers/badges. */
export function countEmployeesForUser(ctx: AuthContext, cycle_label?: string): number {
  const scope = resolveScope(ctx);
  if (scope.kind === "all") return countEmployees(ctx.tenant.id, cycle_label);
  if (scope.kind === "manager") {
    if (scope.assignedDepartments.size === 0) return 0;
    const all = listEmployees(ctx.tenant.id, { cycle_label });
    return all.filter((e) => scope.assignedDepartments.has(e.department)).length;
  }
  return scope.ownKey ? 1 : 0;
}
