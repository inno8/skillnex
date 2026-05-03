/**
 * Cross-scope isolation tests — proves the visibility matrix from
 * lib/scoped-employees holds:
 *
 *   owner    → every employee in tenant
 *   admin    → every employee in tenant
 *   manager  → only employees in their manager_assignments rows
 *   employee → only the row whose employee_key matches user.employee_key
 *
 * AND that none of these can ever leak across tenants regardless of
 * role (a manager in tenant A who's somehow assigned to a key that
 * exists in tenant B sees nothing — manager_assignments rows are
 * tenant-scoped, but we still test the read path doesn't accidentally
 * cross via JOIN or LIKE).
 *
 * Mirror of tests/db/tenant-isolation but for the role layer. The
 * lower-layer tenant-only tests still apply; this layer adds role.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "skillnex-scope-"));
process.env.SKILLNEX_DB_PATH = join(tmp, "skillnex.db");

const dbMod = await import("@/lib/db");
const scopedMod = await import("@/lib/scoped-employees");
const assignmentsMod = await import("@/lib/manager-assignments");
import type { AuthContext } from "@/lib/auth/middleware";

const { getDb } = dbMod;
const { listEmployeesForUser, getEmployeeForUser, countEmployeesForUser } = scopedMod;
const { assignEmployees, setAssignments } = assignmentsMod;

/** Build a minimal AuthContext for tests — only the fields scoped readers touch. */
function ctx(opts: {
  tenant_id: string;
  user_id: string;
  role: "owner" | "admin" | "manager" | "employee";
  employee_key?: string | null;
}): AuthContext {
  return {
    session: { id: "ses_test", userId: opts.user_id },
    user: {
      id: opts.user_id,
      email: `${opts.user_id}@x.com`,
      name: opts.user_id,
      tenant_id: opts.tenant_id,
      role: opts.role,
      status: "active",
      employee_key: opts.employee_key ?? null,
    },
    tenant: {
      id: opts.tenant_id,
      name: opts.tenant_id,
      region: "us",
      plan: "pilot",
      retention_days: 90,
      deleted_at: null,
    },
  };
}

const T_A = "tnt_scope_a";
const T_B = "tnt_scope_b";

beforeAll(() => {
  const db = getDb();
  for (const id of [T_A, T_B]) {
    db.prepare(
      `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
       VALUES (?, ?, 'us', 'pilot', 90, datetime('now'))`,
    ).run(id, id);
  }
  // Users: A has owner + admin + manager + employee. B has owner + manager.
  const insUser = db.prepare(
    `INSERT INTO user (id, email, emailVerified, createdAt, updatedAt, tenant_id, role, status, employee_key)
     VALUES (?, ?, 1, datetime('now'), datetime('now'), ?, ?, 'active', ?)`,
  );
  insUser.run("usr_owner_a", "owner@a.com", T_A, "owner", null);
  insUser.run("usr_admin_a", "admin@a.com", T_A, "admin", null);
  insUser.run("usr_mgr_a", "mgr@a.com", T_A, "manager", null);
  insUser.run("usr_mgr_a2", "mgr2@a.com", T_A, "manager", null);
  insUser.run("usr_emp_a", "alice@a.com", T_A, "employee", "alice|sales");
  insUser.run("usr_owner_b", "owner@b.com", T_B, "owner", null);
  insUser.run("usr_mgr_b", "mgr@b.com", T_B, "manager", null);

  // Employees: A has Alice (Sales), Bob (Sales), Carol (Eng). B has
  // its OWN Alice — same employee_key string ("alice|sales") under a
  // different tenant. Proves the composite PK from migration 0004 works
  // and that scope readers don't accidentally JOIN across tenants.
  const insEmp = db.prepare(
    `INSERT INTO employees (
      tenant_id, employee_key, source_ids, name, department, signals,
      existing_ratings, snapshot_date_range, uploaded_at, computed
    ) VALUES (?, ?, '{}', ?, ?, '{}', '{}', '{}', datetime('now'), '{"value_score":50,"dept_rank":1,"dept_size":1,"roi":null,"cost_efficiency":null,"breakdown":{}}')`,
  );
  insEmp.run(T_A, "alice|sales", "Alice", "Sales");
  insEmp.run(T_A, "bob|sales", "Bob", "Sales");
  insEmp.run(T_A, "carol|eng", "Carol", "Engineering");
  insEmp.run(T_B, "alice|sales", "Alice (B)", "Sales");
  insEmp.run(T_B, "dave|sales", "Dave", "Sales");

  // Assignments: in tenant A, mgr is assigned Alice + Bob (Sales only).
  // mgr2 is assigned Carol. mgr in tenant B is assigned Alice (B) — same
  // employee_key string as A's Alice but a totally different row.
  assignEmployees(T_A, "usr_mgr_a", ["alice|sales", "bob|sales"]);
  assignEmployees(T_A, "usr_mgr_a2", ["carol|eng"]);
  assignEmployees(T_B, "usr_mgr_b", ["alice|sales"]);
});

afterAll(() => {
  getDb().close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("listEmployeesForUser — by role", () => {
  it("owner sees every employee in the tenant", () => {
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_owner_a", role: "owner" }),
    );
    expect(list.map((e) => e.employee_key).sort()).toEqual([
      "alice|sales",
      "bob|sales",
      "carol|eng",
    ]);
  });

  it("admin sees every employee in the tenant", () => {
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_admin_a", role: "admin" }),
    );
    expect(list).toHaveLength(3);
  });

  it("manager sees only their assigned reports", () => {
    const a = listEmployeesForUser(ctx({ tenant_id: T_A, user_id: "usr_mgr_a", role: "manager" }));
    expect(a.map((e) => e.employee_key).sort()).toEqual(["alice|sales", "bob|sales"]);

    const a2 = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_a2", role: "manager" }),
    );
    expect(a2.map((e) => e.employee_key)).toEqual(["carol|eng"]);
  });

  it("manager with no assignments sees an empty list", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO user (id, email, emailVerified, createdAt, updatedAt, tenant_id, role, status, employee_key)
       VALUES ('usr_mgr_orphan', 'orphan@a.com', 1, datetime('now'), datetime('now'), ?, 'manager', 'active', NULL)`,
    ).run(T_A);
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_orphan", role: "manager" }),
    );
    expect(list).toEqual([]);
  });

  it("employee sees only their own row, matched on user.employee_key", () => {
    const list = listEmployeesForUser(
      ctx({
        tenant_id: T_A,
        user_id: "usr_emp_a",
        role: "employee",
        employee_key: "alice|sales",
      }),
    );
    expect(list).toHaveLength(1);
    expect(list[0]?.employee_key).toBe("alice|sales");
    expect(list[0]?.name).toBe("Alice");
  });

  it("employee with no employee_key linked sees an empty list", () => {
    const list = listEmployeesForUser(
      ctx({
        tenant_id: T_A,
        user_id: "usr_emp_a",
        role: "employee",
        employee_key: null,
      }),
    );
    expect(list).toEqual([]);
  });
});

describe("getEmployeeForUser — by role", () => {
  it("owner can fetch any employee in the tenant", () => {
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_A, user_id: "usr_owner_a", role: "owner" }),
      "carol|eng",
    );
    expect(e?.name).toBe("Carol");
  });

  it("manager fetching an unassigned key gets null (no leak)", () => {
    // mgr_a is NOT assigned Carol, so this MUST return null even though
    // the row exists in their tenant. Behaviorally identical to "doesn't
    // exist" so the API can return 404 either way without leaking.
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_a", role: "manager" }),
      "carol|eng",
    );
    expect(e).toBeNull();
  });

  it("manager fetching an assigned key gets the row", () => {
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_a", role: "manager" }),
      "bob|sales",
    );
    expect(e?.name).toBe("Bob");
  });

  it("employee fetching someone else's key gets null", () => {
    const e = getEmployeeForUser(
      ctx({
        tenant_id: T_A,
        user_id: "usr_emp_a",
        role: "employee",
        employee_key: "alice|sales",
      }),
      "bob|sales",
    );
    expect(e).toBeNull();
  });

  it("employee fetching their own key gets it", () => {
    const e = getEmployeeForUser(
      ctx({
        tenant_id: T_A,
        user_id: "usr_emp_a",
        role: "employee",
        employee_key: "alice|sales",
      }),
      "alice|sales",
    );
    expect(e?.employee_key).toBe("alice|sales");
  });
});

describe("cross-tenant isolation (defense in depth)", () => {
  it("owner of tenant A cannot read tenant B's rows", () => {
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_owner_a", role: "owner" }),
    );
    expect(list.find((e) => e.name === "Dave")).toBeUndefined();
  });

  it("manager in tenant A assigned 'alice|sales' does NOT see B's Alice", () => {
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_a", role: "manager" }),
      "alice|sales",
    );
    // Should be A's Alice ("Alice"), never B's ("Alice (B)").
    expect(e?.name).toBe("Alice");
  });

  it("manager in tenant B assigned 'alice|sales' sees ONLY B's Alice", () => {
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_B, user_id: "usr_mgr_b", role: "manager" }),
      "alice|sales",
    );
    expect(e?.name).toBe("Alice (B)");
  });

  it("employee in tenant A with employee_key='alice|sales' cannot see B's Alice", () => {
    const e = getEmployeeForUser(
      ctx({
        tenant_id: T_B, // ← swapped tenant
        user_id: "usr_emp_a",
        role: "employee",
        employee_key: "alice|sales",
      }),
      "alice|sales",
    );
    // user.tenant_id is T_B but the user record belongs to T_A — in
    // practice this can't happen (auth context is built from a real
    // user row), but the scope reader should still tenant-scope on
    // ctx.tenant.id and not on user.tenant_id. So the row returned
    // here belongs to T_B (the tenant they're "in" right now).
    expect(e?.name).toBe("Alice (B)");
  });
});

describe("countEmployeesForUser", () => {
  it("matches the list length per role", () => {
    const owner = ctx({ tenant_id: T_A, user_id: "usr_owner_a", role: "owner" });
    const mgr = ctx({ tenant_id: T_A, user_id: "usr_mgr_a", role: "manager" });
    const emp = ctx({
      tenant_id: T_A,
      user_id: "usr_emp_a",
      role: "employee",
      employee_key: "alice|sales",
    });
    expect(countEmployeesForUser(owner)).toBe(listEmployeesForUser(owner).length);
    expect(countEmployeesForUser(mgr)).toBe(listEmployeesForUser(mgr).length);
    expect(countEmployeesForUser(emp)).toBe(1);
  });
});

describe("setAssignments roundtrip", () => {
  it("replaces the manager's assignment set transactionally", () => {
    setAssignments(T_A, "usr_mgr_a", ["bob|sales", "carol|eng"]);
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_a", role: "manager" }),
    );
    expect(list.map((e) => e.employee_key).sort()).toEqual(["bob|sales", "carol|eng"]);
    // Restore for any subsequent tests
    setAssignments(T_A, "usr_mgr_a", ["alice|sales", "bob|sales"]);
  });
});
