/**
 * Cross-scope isolation tests — proves the visibility matrix from
 * lib/scoped-employees holds for the department-based model:
 *
 *   owner    → every employee in tenant
 *   admin    → every employee in tenant
 *   manager  → only employees whose department is in their
 *              manager_departments rows
 *   employee → only the row whose employee_key matches user.employee_key
 *
 * Key property of the department model: a NEW employee uploaded into a
 * department a manager already covers is automatically in their cohort
 * — proven below by adding a row mid-test.
 *
 * Cross-tenant: the manager_departments rows are tenant-scoped, but we
 * also test the read path doesn't accidentally cross via JOIN or LIKE.
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
const { assignDepartments, setDepartmentAssignments, listTenantDepartments } = assignmentsMod;

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
  // Users
  const insUser = db.prepare(
    `INSERT INTO user (id, email, emailVerified, createdAt, updatedAt, tenant_id, role, status, employee_key)
     VALUES (?, ?, 1, datetime('now'), datetime('now'), ?, ?, 'active', ?)`,
  );
  insUser.run("usr_owner_a", "owner@a.com", T_A, "owner", null);
  insUser.run("usr_admin_a", "admin@a.com", T_A, "admin", null);
  insUser.run("usr_mgr_sales_a", "mgr_sales@a.com", T_A, "manager", null);
  insUser.run("usr_mgr_eng_a", "mgr_eng@a.com", T_A, "manager", null);
  insUser.run("usr_mgr_orphan_a", "mgr_orphan@a.com", T_A, "manager", null);
  insUser.run("usr_emp_a", "alice@a.com", T_A, "employee", "alice|sales");
  insUser.run("usr_owner_b", "owner@b.com", T_B, "owner", null);
  insUser.run("usr_mgr_sales_b", "mgr_sales@b.com", T_B, "manager", null);

  // Employees: A has Alice (Sales), Bob (Sales), Carol (Engineering),
  // Dana (HR). B has its OWN Sales employee — same employee_key string
  // ("alice|sales") under a different tenant — proves composite PK +
  // tenant scoping survive the role layer.
  const insEmp = db.prepare(
    `INSERT INTO employees (
      tenant_id, employee_key, source_ids, name, department, signals,
      existing_ratings, snapshot_date_range, uploaded_at, computed
    ) VALUES (?, ?, '{}', ?, ?, '{}', '{}', '{}', datetime('now'),
              '{"value_score":50,"dept_rank":1,"dept_size":1,"roi":null,"cost_efficiency":null,"breakdown":{}}')`,
  );
  insEmp.run(T_A, "alice|sales", "Alice", "Sales");
  insEmp.run(T_A, "bob|sales", "Bob", "Sales");
  insEmp.run(T_A, "carol|engineering", "Carol", "Engineering");
  insEmp.run(T_A, "dana|hr", "Dana", "HR");
  insEmp.run(T_B, "alice|sales", "Alice (B)", "Sales");
  insEmp.run(T_B, "evan|sales", "Evan", "Sales");

  // Department assignments
  assignDepartments(T_A, "usr_mgr_sales_a", ["Sales"]);
  assignDepartments(T_A, "usr_mgr_eng_a", ["Engineering", "HR"]);
  assignDepartments(T_B, "usr_mgr_sales_b", ["Sales"]);
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
    expect(list.map((e) => e.name).sort()).toEqual(["Alice", "Bob", "Carol", "Dana"]);
  });

  it("admin sees every employee in the tenant", () => {
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_admin_a", role: "admin" }),
    );
    expect(list).toHaveLength(4);
  });

  it("manager sees only employees in their assigned departments", () => {
    const sales = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_sales_a", role: "manager" }),
    );
    expect(sales.map((e) => e.name).sort()).toEqual(["Alice", "Bob"]);

    const engHr = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_eng_a", role: "manager" }),
    );
    expect(engHr.map((e) => e.name).sort()).toEqual(["Carol", "Dana"]);
  });

  it("manager with no department assignments sees an empty list", () => {
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_orphan_a", role: "manager" }),
    );
    expect(list).toEqual([]);
  });

  it("employee sees only their own row", () => {
    const list = listEmployeesForUser(
      ctx({
        tenant_id: T_A,
        user_id: "usr_emp_a",
        role: "employee",
        employee_key: "alice|sales",
      }),
    );
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Alice");
  });

  it("employee with no employee_key linked sees an empty list", () => {
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_emp_a", role: "employee", employee_key: null }),
    );
    expect(list).toEqual([]);
  });
});

describe("getEmployeeForUser — by role", () => {
  it("owner can fetch any employee in the tenant", () => {
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_A, user_id: "usr_owner_a", role: "owner" }),
      "carol|engineering",
    );
    expect(e?.name).toBe("Carol");
  });

  it("manager fetching an out-of-department key gets null (no leak)", () => {
    // Sales manager isn't assigned Engineering → should not see Carol.
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_sales_a", role: "manager" }),
      "carol|engineering",
    );
    expect(e).toBeNull();
  });

  it("manager fetching an in-department key gets the row", () => {
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_sales_a", role: "manager" }),
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
});

describe("durability across uploads — the whole point of department scope", () => {
  it("a newly-uploaded employee in a covered department is automatically visible", () => {
    // Sales manager currently sees Alice + Bob. Simulate a new ingest
    // that adds a Sales employee — they should appear without any
    // assignment change.
    const db = getDb();
    db.prepare(
      `INSERT INTO employees (
        tenant_id, employee_key, source_ids, name, department, signals,
        existing_ratings, snapshot_date_range, uploaded_at, computed
      ) VALUES (?, 'frank|sales', '{}', 'Frank', 'Sales', '{}', '{}', '{}', datetime('now'), NULL)`,
    ).run(T_A);

    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_sales_a", role: "manager" }),
    );
    expect(list.map((e) => e.name).sort()).toEqual(["Alice", "Bob", "Frank"]);
  });

  it("a new department in the same upload does NOT appear unless the manager covers it", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO employees (
        tenant_id, employee_key, source_ids, name, department, signals,
        existing_ratings, snapshot_date_range, uploaded_at, computed
      ) VALUES (?, 'gina|finance', '{}', 'Gina', 'Finance', '{}', '{}', '{}', datetime('now'), NULL)`,
    ).run(T_A);

    const sales = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_sales_a", role: "manager" }),
    );
    expect(sales.find((e) => e.name === "Gina")).toBeUndefined();

    // Owner sees Gina though
    const owner = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_owner_a", role: "owner" }),
    );
    expect(owner.find((e) => e.name === "Gina")).toBeDefined();

    // listTenantDepartments now includes Finance — the picker would
    // surface it as an option for the next assignment edit.
    expect(listTenantDepartments(T_A)).toContain("Finance");
  });
});

describe("cross-tenant isolation (defense in depth)", () => {
  it("owner of tenant A cannot read tenant B's rows", () => {
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_owner_a", role: "owner" }),
    );
    expect(list.find((e) => e.name === "Evan")).toBeUndefined();
  });

  it("manager in tenant A assigned 'Sales' does NOT see B's Sales rows", () => {
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_sales_a", role: "manager" }),
      "alice|sales",
    );
    expect(e?.name).toBe("Alice");
    expect(e?.name).not.toBe("Alice (B)");
  });

  it("manager in tenant B assigned 'Sales' sees ONLY B's Sales rows", () => {
    const e = getEmployeeForUser(
      ctx({ tenant_id: T_B, user_id: "usr_mgr_sales_b", role: "manager" }),
      "alice|sales",
    );
    expect(e?.name).toBe("Alice (B)");
  });
});

describe("countEmployeesForUser", () => {
  it("matches list length per role", () => {
    const owner = ctx({ tenant_id: T_A, user_id: "usr_owner_a", role: "owner" });
    const mgrSales = ctx({ tenant_id: T_A, user_id: "usr_mgr_sales_a", role: "manager" });
    const emp = ctx({
      tenant_id: T_A,
      user_id: "usr_emp_a",
      role: "employee",
      employee_key: "alice|sales",
    });
    expect(countEmployeesForUser(owner)).toBe(listEmployeesForUser(owner).length);
    expect(countEmployeesForUser(mgrSales)).toBe(listEmployeesForUser(mgrSales).length);
    expect(countEmployeesForUser(emp)).toBe(1);
  });
});

describe("setDepartmentAssignments roundtrip", () => {
  it("replaces the manager's department set transactionally", () => {
    setDepartmentAssignments(T_A, "usr_mgr_sales_a", ["Engineering"]);
    const list = listEmployeesForUser(
      ctx({ tenant_id: T_A, user_id: "usr_mgr_sales_a", role: "manager" }),
    );
    expect(list.map((e) => e.name).sort()).toEqual(["Carol"]);
    // Restore so any later test that depends on Sales manager still works
    setDepartmentAssignments(T_A, "usr_mgr_sales_a", ["Sales"]);
  });
});
