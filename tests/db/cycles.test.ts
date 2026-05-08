/**
 * Cycle scoping — every read/write that happens inside a single
 * (tenant, cycle) tuple must be invisible from another cycle. Pilot
 * customers run reviews quarterly; if the wrong cycle's narrative
 * shows up on a re-upload, the manager's edits get clobbered.
 */

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { migrate } from "@/lib/db/migrations";

// Force a fresh in-memory DB for each test, sidestepping the module-
// level cache in lib/db. Same pattern as tests/db/migrations.test.ts.
let _testDb: Database.Database | null = null;
vi.mock("@/lib/db.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...original,
    getDb: () => {
      if (!_testDb) throw new Error("test db not initialized");
      return _testDb;
    },
  };
});

const TENANT_A = "tnt_a";
const ALICE_KEY = "alice|sales";

// Pre-Phase-2 baseline schema — migrations layer cleanly on top.
// Same approach as tests/db/migrations.test.ts.
const BASELINE_SCHEMA = `
CREATE TABLE IF NOT EXISTS employees (
  employee_key TEXT PRIMARY KEY,
  source_ids TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  sub_department TEXT,
  job_title TEXT,
  level TEXT,
  region TEXT,
  salary REAL,
  bonus REAL,
  equity REAL,
  total_cost_to_company REAL,
  overtime_hours REAL,
  hire_date TEXT,
  location TEXT,
  signals TEXT NOT NULL,
  activities TEXT,
  existing_ratings TEXT NOT NULL,
  computed TEXT,
  narrative TEXT,
  snapshot_date_range TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  shape TEXT NOT NULL,
  sheet_names TEXT NOT NULL,
  row_counts TEXT NOT NULL,
  unjoined_names TEXT NOT NULL,
  employee_count INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL
);
`;

beforeEach(() => {
  _testDb = new Database(":memory:");
  _testDb.pragma("journal_mode = WAL");
  _testDb.pragma("foreign_keys = ON");
  _testDb.exec(BASELINE_SCHEMA);
  migrate(_testDb);
  _testDb
    .prepare(
      `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
       VALUES (?, 'Acme', 'us', 'pilot', 90, datetime('now'))`,
    )
    .run(TENANT_A);
});

afterEach(() => {
  _testDb?.close();
  _testDb = null;
});

async function loadDb() {
  return await import("@/lib/db");
}

function alice(cycle: string) {
  return {
    employee_key: ALICE_KEY,
    source_ids: { activity_id: "S001", payroll_id: null },
    name: "Alice",
    email: null,
    department: "Sales",
    sub_department: null,
    job_title: null,
    level: null,
    region: null,
    salary: 80000,
    bonus: null,
    equity: null,
    total_cost_to_company: null,
    overtime_hours: null,
    hire_date: null,
    location: null,
    signals: { deals_closed: 5 },
    activities: null,
    existing_ratings: { performance_score: null, performance_rating: null },
    computed: {
      value_score: 50,
      roi: 1.2,
      cost_efficiency: null,
      dept_rank: 1,
      dept_size: 1,
      breakdown: {},
    },
    narrative: null,
    snapshot_date_range: { from: "2026-01-01", to: "2026-03-31" },
    _cycle: cycle,
  };
}

describe("cycle scoping", () => {
  it("two uploads under different cycle labels coexist", async () => {
    const { saveUpload, listEmployees, listCycles } = await loadDb();
    saveUpload(TENANT_A, {
      filename: "q1.xlsx",
      parse: {
        shape: "C",
        employees: [alice("Q1")],
        unjoined_names: [],
        row_counts: { Sheet1: 1 },
        date_range: { from: "2026-01-01", to: "2026-03-31" },
      },
      scored: [alice("Q1")],
      cycleLabel: "Q1 2026",
    });
    saveUpload(TENANT_A, {
      filename: "q2.xlsx",
      parse: {
        shape: "C",
        employees: [alice("Q2")],
        unjoined_names: [],
        row_counts: { Sheet1: 1 },
        date_range: { from: "2026-04-01", to: "2026-06-30" },
      },
      scored: [alice("Q2")],
      cycleLabel: "Q2 2026",
    });

    const cycles = listCycles(TENANT_A);
    expect(cycles).toEqual(["Q2 2026", "Q1 2026"]);

    const q1 = listEmployees(TENANT_A, { cycle_label: "Q1 2026" });
    const q2 = listEmployees(TENANT_A, { cycle_label: "Q2 2026" });
    expect(q1).toHaveLength(1);
    expect(q2).toHaveLength(1);
    // Default (no cycle) returns the latest.
    const latest = listEmployees(TENANT_A);
    expect(latest).toHaveLength(1);
  });

  it("re-uploading the same cycle preserves an existing narrative", async () => {
    const { saveUpload, saveNarrative, getEmployee } = await loadDb();
    saveUpload(TENANT_A, {
      filename: "q1.xlsx",
      parse: {
        shape: "C",
        employees: [alice("Q1")],
        unjoined_names: [],
        row_counts: { Sheet1: 1 },
        date_range: { from: "2026-01-01", to: "2026-03-31" },
      },
      scored: [alice("Q1")],
      cycleLabel: "Q1 2026",
    });
    const narrative = {
      summary: "Strong cycle.",
      strengths: ["Closed 5 deals"],
      watch_items: [],
      review_paragraph: "Alice closed five deals…",
      generated_at: "2026-04-01T00:00:00Z",
      model: "claude-haiku-4.5",
      mode: "anthropic" as const,
    };
    expect(saveNarrative(TENANT_A, ALICE_KEY, narrative, "Q1 2026")).toBe(true);

    // Same cycle, same employee — re-upload (e.g. typo fix).
    saveUpload(TENANT_A, {
      filename: "q1-fixed.xlsx",
      parse: {
        shape: "C",
        employees: [alice("Q1")],
        unjoined_names: [],
        row_counts: { Sheet1: 1 },
        date_range: { from: "2026-01-01", to: "2026-03-31" },
      },
      scored: [alice("Q1")],
      cycleLabel: "Q1 2026",
    });

    const after = getEmployee(TENANT_A, ALICE_KEY, "Q1 2026");
    expect(after?.narrative).not.toBeNull();
    expect(after?.narrative?.summary).toBe("Strong cycle.");
  });

  it("a different cycle does NOT inherit the previous cycle's narrative", async () => {
    const { saveUpload, saveNarrative, getEmployee } = await loadDb();
    saveUpload(TENANT_A, {
      filename: "q1.xlsx",
      parse: {
        shape: "C",
        employees: [alice("Q1")],
        unjoined_names: [],
        row_counts: { Sheet1: 1 },
        date_range: { from: "2026-01-01", to: "2026-03-31" },
      },
      scored: [alice("Q1")],
      cycleLabel: "Q1 2026",
    });
    saveNarrative(
      TENANT_A,
      ALICE_KEY,
      {
        summary: "Q1 narrative.",
        strengths: [],
        watch_items: [],
        review_paragraph: "Q1 paragraph",
        generated_at: "2026-04-01T00:00:00Z",
        model: "claude-haiku-4.5",
        mode: "anthropic",
      },
      "Q1 2026",
    );

    // New cycle — should have NO narrative because it's a different
    // snapshot, not a typo fix on the same one.
    saveUpload(TENANT_A, {
      filename: "q2.xlsx",
      parse: {
        shape: "C",
        employees: [alice("Q2")],
        unjoined_names: [],
        row_counts: { Sheet1: 1 },
        date_range: { from: "2026-04-01", to: "2026-06-30" },
      },
      scored: [alice("Q2")],
      cycleLabel: "Q2 2026",
    });

    const q2 = getEmployee(TENANT_A, ALICE_KEY, "Q2 2026");
    expect(q2?.narrative).toBeNull();
    const q1 = getEmployee(TENANT_A, ALICE_KEY, "Q1 2026");
    expect(q1?.narrative?.summary).toBe("Q1 narrative.");
  });

  it("manager-typed email flows across cycles via the employee's key", async () => {
    const { saveUpload, updateEmployeeFields, getEmployee } = await loadDb();
    saveUpload(TENANT_A, {
      filename: "q1.xlsx",
      parse: {
        shape: "C",
        employees: [alice("Q1")],
        unjoined_names: [],
        row_counts: { Sheet1: 1 },
        date_range: { from: "2026-01-01", to: "2026-03-31" },
      },
      scored: [alice("Q1")],
      cycleLabel: "Q1 2026",
    });
    saveUpload(TENANT_A, {
      filename: "q2.xlsx",
      parse: {
        shape: "C",
        employees: [alice("Q2")],
        unjoined_names: [],
        row_counts: { Sheet1: 1 },
        date_range: { from: "2026-04-01", to: "2026-06-30" },
      },
      scored: [alice("Q2")],
      cycleLabel: "Q2 2026",
    });

    // Inline edit on /people sets email — cross-cycle by design.
    updateEmployeeFields(TENANT_A, ALICE_KEY, { email: "alice@acme.io" });

    const q1 = getEmployee(TENANT_A, ALICE_KEY, "Q1 2026");
    const q2 = getEmployee(TENANT_A, ALICE_KEY, "Q2 2026");
    expect(q1?.email).toBe("alice@acme.io");
    expect(q2?.email).toBe("alice@acme.io");
  });
});
