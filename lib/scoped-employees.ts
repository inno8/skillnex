/**
 * Role-scoped employee readers. Pages call THESE instead of the raw
 * lib/db readers so the visibility rules are enforced in one place
 * instead of being threaded through every handler.
 *
 * Visibility matrix:
 *   owner      → every employee in the tenant
 *   admin      → every employee in the tenant
 *   manager    → only employees they have a manager_assignments row for
 *   employee   → only the row matching their user.employee_key, if set
 *
 * For pages: feed the AuthContext from requireTenantUserPage()/Api()
 * straight in. The functions return whatever the role + assignments
 * allow, never throw on permission. Callers decide whether an empty
 * result means "no data" or "forbidden" (mostly the former — the
 * former is the more honest UX).
 */
import type { AuthContext } from "@/lib/auth/middleware";
import { assignedKeySet } from "@/lib/manager-assignments";
import { countEmployees, getEmployee, listEmployees } from "@/lib/db";
import type { EmployeeRecord } from "@/lib/types";

export type EmployeeScope =
  | { kind: "all" }
  | { kind: "manager"; assignedKeys: Set<string> }
  | { kind: "employee"; ownKey: string | null };

/** Resolve the scope object once per page render. */
export function resolveScope(ctx: AuthContext): EmployeeScope {
  if (ctx.user.role === "owner" || ctx.user.role === "admin") {
    return { kind: "all" };
  }
  if (ctx.user.role === "manager") {
    return {
      kind: "manager",
      assignedKeys: assignedKeySet(ctx.tenant.id, ctx.user.id),
    };
  }
  return { kind: "employee", ownKey: ctx.user.employee_key };
}

/**
 * Scoped equivalent of listEmployees(). Optional department filter is
 * applied AFTER the scope filter so a manager who happens to have one
 * Sales report and zero Engineering reports sees only the Sales row
 * when querying Sales — not "all Sales reports in the tenant".
 */
export function listEmployeesForUser(ctx: AuthContext, department?: string): EmployeeRecord[] {
  const scope = resolveScope(ctx);
  const all = listEmployees(ctx.tenant.id, department);
  if (scope.kind === "all") return all;
  if (scope.kind === "manager") {
    return all.filter((e) => scope.assignedKeys.has(e.employee_key));
  }
  // employee
  if (!scope.ownKey) return [];
  return all.filter((e) => e.employee_key === scope.ownKey);
}

/**
 * Scoped equivalent of getEmployee(). Returns null when the row exists
 * but the caller's scope can't see it — same shape as "doesn't exist"
 * because we don't want to leak the existence of out-of-scope rows.
 */
export function getEmployeeForUser(ctx: AuthContext, employee_key: string): EmployeeRecord | null {
  const scope = resolveScope(ctx);
  if (scope.kind === "manager" && !scope.assignedKeys.has(employee_key)) {
    return null;
  }
  if (scope.kind === "employee" && scope.ownKey !== employee_key) {
    return null;
  }
  return getEmployee(ctx.tenant.id, employee_key);
}

/** Convenience: count what the caller can see, for headers/badges. */
export function countEmployeesForUser(ctx: AuthContext): number {
  const scope = resolveScope(ctx);
  if (scope.kind === "all") return countEmployees(ctx.tenant.id);
  if (scope.kind === "manager") return scope.assignedKeys.size;
  return scope.ownKey ? 1 : 0;
}
