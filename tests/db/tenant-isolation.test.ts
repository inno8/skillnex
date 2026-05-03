/**
 * Cross-tenant isolation tests.
 *
 * The contract: every read/write in lib/db.ts is keyed on tenant_id, and
 * tenant A queries can never see tenant B rows. We exercise this by inserting
 * employees + uploads under two tenants and asserting:
 *   - listEmployees(A) returns only A
 *   - getEmployee(A, key) returns null when key belongs to B
 *   - latestUpload(A) returns A's latest, even if B's upload was newer
 *   - saveUpload(A, ...) deletes only A's rows in the affected departments
 *   - countEmployees(A) is scoped
 *
 * We point getDb() at an in-memory DB by setting SKILLNEX_DB_PATH before the
 * import. Each test file runs in isolation (vitest fresh worker) so resetting
 * the module cache once at top is enough.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "skillnex-isolation-"));
process.env.SKILLNEX_DB_PATH = join(tmp, "skillnex.db");

// Imports must come after env mutation so getDb() resolves the fresh path.
const dbMod = await import("@/lib/db");
const backfillMod = await import("@/lib/db/backfill");

const { getDb, listEmployees, getEmployee, latestUpload, saveUpload, countEmployees } = dbMod;
const { generateId } = backfillMod;

const TENANT_A = "tnt_iso_a";
const TENANT_B = "tnt_iso_b";

function seedTenant(id: string, label: string) {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO tenants (id, name, region, plan, retention_days, created_at)
     VALUES (?, ?, 'us', 'pilot', 90, datetime('now'))`,
  ).run(id, label);
}

function fakeEmployee(name: string, dept: string) {
  return {
    employee_key: `${name}|${dept}`,
    source_ids: { activity_id: name, payroll_id: null },
    name,
    department: dept,
    sub_department: null,
    job_title: null,
    level: null,
    region: null,
    salary: 100000,
    bonus: null,
    equity: null,
    total_cost_to_company: null,
    overtime_hours: null,
    hire_date: null,
    location: null,
    signals: { activity_count: 1 },
    activities: null,
    existing_ratings: { performance_score: null, performance_rating: null },
    computed: {
      value_score: 50,
      dept_rank: 1,
      dept_size: 1,
      roi: null,
      cost_efficiency: null,
      breakdown: {},
    },
    narrative: null,
    snapshot_date_range: { from: "2026-01-01", to: "2026-03-31" },
  } as Parameters<typeof saveUpload>[1]["scored"][number];
}

function fakeParse(rowCounts: Record<string, number>) {
  return {
    shape: "A" as const,
    row_counts: rowCounts,
    unjoined_names: [],
    date_range: { from: "2026-01-01", to: "2026-03-31" },
    employees: [],
  } as Parameters<typeof saveUpload>[1]["parse"];
}

beforeAll(() => {
  // ensureDemoTenant runs in getDb(); we add A + B alongside.
  seedTenant(TENANT_A, "Tenant A Inc");
  seedTenant(TENANT_B, "Tenant B Inc");

  saveUpload(TENANT_A, {
    filename: "tenant_a_upload.xlsx",
    parse: fakeParse({ Sales: 2 }),
    scored: [fakeEmployee("Alice", "Sales"), fakeEmployee("Bob", "Sales")],
  });
  // Tiny pause-equivalent: timestamps are ISO strings; ensure B is newer.
  saveUpload(TENANT_B, {
    filename: "tenant_b_upload.xlsx",
    parse: fakeParse({ Sales: 1, Engineering: 1 }),
    scored: [fakeEmployee("Carol", "Sales"), fakeEmployee("Dave", "Engineering")],
  });
});

afterAll(() => {
  const db = getDb();
  db.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("cross-tenant isolation", () => {
  it("listEmployees returns only the requesting tenant's rows", () => {
    const a = listEmployees(TENANT_A);
    const b = listEmployees(TENANT_B);
    expect(a.map((e) => e.name).sort()).toEqual(["Alice", "Bob"]);
    expect(b.map((e) => e.name).sort()).toEqual(["Carol", "Dave"]);
  });

  it("listEmployees with a department filter is also scoped", () => {
    const aSales = listEmployees(TENANT_A, "Sales");
    const bSales = listEmployees(TENANT_B, "Sales");
    expect(aSales.map((e) => e.name).sort()).toEqual(["Alice", "Bob"]);
    expect(bSales.map((e) => e.name)).toEqual(["Carol"]);
  });

  it("getEmployee returns null when the key belongs to another tenant", () => {
    // Carol's employee_key was inserted under TENANT_B. TENANT_A asking for
    // it must get null, NOT the row, NOT a 200 with someone else's data.
    expect(getEmployee(TENANT_A, "Carol|Sales")).toBeNull();
    expect(getEmployee(TENANT_B, "Carol|Sales")).not.toBeNull();
    expect(getEmployee(TENANT_A, "Alice|Sales")?.name).toBe("Alice");
  });

  it("latestUpload is per-tenant, even if another tenant uploaded later", () => {
    const a = latestUpload(TENANT_A);
    const b = latestUpload(TENANT_B);
    expect(a?.filename).toBe("tenant_a_upload.xlsx");
    expect(b?.filename).toBe("tenant_b_upload.xlsx");
  });

  it("countEmployees is per-tenant", () => {
    expect(countEmployees(TENANT_A)).toBe(2);
    expect(countEmployees(TENANT_B)).toBe(2);
  });

  it("saveUpload(A) replacement does NOT delete rows from B", () => {
    // Re-upload Sales for A with a single employee. B's Sales row (Carol) and
    // Engineering row (Dave) must survive.
    saveUpload(TENANT_A, {
      filename: "tenant_a_resnap.xlsx",
      parse: fakeParse({ Sales: 1 }),
      scored: [fakeEmployee("Alice2", "Sales")],
    });
    const a = listEmployees(TENANT_A);
    const b = listEmployees(TENANT_B);
    expect(a.map((e) => e.name)).toEqual(["Alice2"]);
    expect(b.map((e) => e.name).sort()).toEqual(["Carol", "Dave"]);
  });
});

describe("tenant_id is required by every public reader", () => {
  // Compile-time test: TypeScript will have already caught a missing arg.
  // Runtime: passing a tenant that doesn't exist returns empty results, not
  // someone else's rows.
  it("listEmployees('tnt_does_not_exist') returns []", () => {
    const rows = listEmployees("tnt_does_not_exist");
    expect(rows).toEqual([]);
  });

  it("countEmployees of unknown tenant is 0", () => {
    expect(countEmployees("tnt_does_not_exist")).toBe(0);
  });

  it("generateId helper is still tenant-prefixed correctly", () => {
    expect(generateId("tnt")).toMatch(/^tnt_/);
  });
});
