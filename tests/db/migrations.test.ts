import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureDemoTenant, generateId } from "@/lib/db/backfill";
import { listAppliedMigrations, listAvailableMigrations, migrate } from "@/lib/db/migrations";

// Pre-Phase-2 baseline schema so we can prove migrations layer cleanly on top.
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

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(BASELINE_SCHEMA);
});

afterEach(() => {
  db.close();
});

describe("listAvailableMigrations", () => {
  it("finds Phase 2 migrations on disk", () => {
    const migs = listAvailableMigrations();
    const ids = migs.map((m) => m.id);
    expect(ids).toContain("0001_phase2_tenants");
    expect(ids).toContain("0002_phase2_employees_tenant_scope");
    expect(ids).toContain("0004_employees_composite_pk");
    expect(ids).toContain("0005_manager_departments");
  });

  it("returns migrations in lexical order", () => {
    const migs = listAvailableMigrations();
    const ids = migs.map((m) => m.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});

describe("migrate — first run", () => {
  it("creates _migrations table and applies all available migrations", () => {
    const result = migrate(db);
    expect(result.applied).toContain("0001_phase2_tenants");
    expect(result.applied).toContain("0002_phase2_employees_tenant_scope");
    expect(result.skipped).toEqual([]);
  });

  it("creates the tenants table with the expected columns", () => {
    migrate(db);
    const cols = db.prepare("PRAGMA table_info(tenants)").all() as Array<{
      name: string;
    }>;
    const names = cols.map((c) => c.name).sort();
    expect(names).toEqual([
      "created_at",
      "deleted_at",
      "id",
      "name",
      "plan",
      "region",
      "retention_days",
    ]);
  });

  it("creates the user table (better-auth schema, migration 0003) with role + status checks", () => {
    migrate(db);
    db.prepare(
      `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
       VALUES ('tnt_x', 'X', 'us', 'pilot', 90, datetime('now'))`,
    ).run();
    // Valid role + status: succeeds
    expect(() =>
      db
        .prepare(
          `INSERT INTO user (id, email, emailVerified, createdAt, updatedAt, tenant_id, role, status)
           VALUES ('usr_a', 'a@x.com', 0, datetime('now'), datetime('now'), 'tnt_x', 'owner', 'active')`,
        )
        .run(),
    ).not.toThrow();
    // Invalid role: rejected
    expect(() =>
      db
        .prepare(
          `INSERT INTO user (id, email, emailVerified, createdAt, updatedAt, tenant_id, role, status)
           VALUES ('usr_b', 'b@x.com', 0, datetime('now'), datetime('now'), 'tnt_x', 'overlord', 'active')`,
        )
        .run(),
    ).toThrow(/CHECK constraint failed/i);
  });

  it("adds tenant_id + flags to existing employees table", () => {
    migrate(db);
    const cols = db.prepare("PRAGMA table_info(employees)").all() as Array<{
      name: string;
    }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain("tenant_id");
    expect(names).toContain("excluded_from_review");
    expect(names).toContain("integration_opt_out");
  });

  it("makes (tenant_id, employee_key, cycle_label) the composite primary key", () => {
    migrate(db);
    // PRAGMA table_info returns a `pk` column: 0 = not part of PK,
    // 1 = first PK column, 2 = second PK column, etc. After 0007 we
    // expect three: tenant + key + cycle.
    const cols = db.prepare("PRAGMA table_info(employees)").all() as Array<{
      name: string;
      pk: number;
    }>;
    const pkCols = cols
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name);
    expect(pkCols).toEqual(["tenant_id", "employee_key", "cycle_label"]);
  });

  it("allows two tenants to have rows with the same employee_key", () => {
    migrate(db);
    db.prepare(
      `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
       VALUES ('tnt_a', 'A', 'us', 'pilot', 90, datetime('now')),
              ('tnt_b', 'B', 'us', 'pilot', 90, datetime('now'))`,
    ).run();
    const insert = db.prepare(
      `INSERT INTO employees (
        tenant_id, employee_key, source_ids, name, department,
        signals, existing_ratings, snapshot_date_range, uploaded_at
      ) VALUES (?, ?, '{}', ?, 'Sales', '{}', '{}', '{}', datetime('now'))`,
    );
    expect(() => insert.run("tnt_a", "alice|sales", "Alice")).not.toThrow();
    // The bug: pre-0004 this throws UNIQUE constraint failed.
    expect(() => insert.run("tnt_b", "alice|sales", "Alice")).not.toThrow();
    // But re-inserting the same (tenant, key) MUST still fail.
    expect(() => insert.run("tnt_a", "alice|sales", "Alice")).toThrow(/UNIQUE constraint failed/i);
  });

  it("adds tenant_id to uploads table", () => {
    migrate(db);
    const cols = db.prepare("PRAGMA table_info(uploads)").all() as Array<{
      name: string;
    }>;
    expect(cols.map((c) => c.name)).toContain("tenant_id");
  });

  it("EU tenant cannot have retention_days > 30 (insert)", () => {
    migrate(db);
    expect(() =>
      db
        .prepare(
          `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
           VALUES ('tnt_eu', 'EU Co', 'eu', 'pilot', 90, datetime('now'))`,
        )
        .run(),
    ).toThrow(/EU tenants are capped at 30-day retention/);
  });

  it("EU tenant retention_days <= 30 succeeds", () => {
    migrate(db);
    expect(() =>
      db
        .prepare(
          `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
           VALUES ('tnt_eu', 'EU Co', 'eu', 'pilot', 30, datetime('now'))`,
        )
        .run(),
    ).not.toThrow();
  });

  it("EU tenant cannot bump retention_days > 30 (update)", () => {
    migrate(db);
    db.prepare(
      `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
       VALUES ('tnt_eu', 'EU Co', 'eu', 'pilot', 30, datetime('now'))`,
    ).run();
    expect(() =>
      db.prepare("UPDATE tenants SET retention_days = ? WHERE id = ?").run(60, "tnt_eu"),
    ).toThrow(/EU tenants are capped at 30-day retention/);
  });

  it("US tenant can have retention_days = 90", () => {
    migrate(db);
    expect(() =>
      db
        .prepare(
          `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
           VALUES ('tnt_us', 'US Co', 'us', 'pilot', 90, datetime('now'))`,
        )
        .run(),
    ).not.toThrow();
  });
});

describe("migrate — append-only audit_log", () => {
  beforeEach(() => migrate(db));

  it("INSERT into audit_log succeeds", () => {
    db.prepare(
      `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
       VALUES ('tnt_x', 'X', 'us', 'pilot', 90, datetime('now'))`,
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO audit_log (tenant_id, user_id, action, ts)
           VALUES ('tnt_x', NULL, 'system_event', datetime('now'))`,
        )
        .run(),
    ).not.toThrow();
  });

  it("UPDATE on audit_log is rejected by trigger", () => {
    db.prepare(
      `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
       VALUES ('tnt_x', 'X', 'us', 'pilot', 90, datetime('now'))`,
    ).run();
    db.prepare(
      `INSERT INTO audit_log (tenant_id, action, ts) VALUES ('tnt_x', 'a', datetime('now'))`,
    ).run();
    expect(() => db.prepare("UPDATE audit_log SET action = ? WHERE id = 1").run("hacked")).toThrow(
      /append-only/,
    );
  });
});

describe("migrate — idempotency", () => {
  it("second run applies nothing and skips everything", () => {
    const first = migrate(db);
    expect(first.applied.length).toBeGreaterThan(0);

    const second = migrate(db);
    expect(second.applied).toEqual([]);
    expect(second.skipped.sort()).toEqual(first.applied.sort());
  });

  it("listAppliedMigrations matches what was applied", () => {
    const result = migrate(db);
    const applied = listAppliedMigrations(db);
    expect(applied.map((m) => m.id).sort()).toEqual(result.applied.sort());
    for (const m of applied) {
      expect(m.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

describe("ensureDemoTenant", () => {
  beforeEach(() => migrate(db));

  it("creates the demo tenant on first call", () => {
    const result = ensureDemoTenant(db);
    expect(result.created).toBe(true);
    expect(result.tenant_id).toBe("tnt_demo");

    const row = db
      .prepare("SELECT id, name, region, retention_days FROM tenants WHERE id = ?")
      .get("tnt_demo") as { id: string; name: string; region: string; retention_days: number };
    expect(row).toBeDefined();
    expect(row.region).toBe("us");
    expect(row.retention_days).toBe(90);
  });

  it("is a no-op on second call", () => {
    ensureDemoTenant(db);
    const result = ensureDemoTenant(db);
    expect(result.created).toBe(false);
  });

  it("anchors existing employee rows that defaulted to tnt_demo", () => {
    // Pre-Phase-2 rows had no tenant_id column. Migration 0002 added one
    // with DEFAULT 'tnt_demo' so those rows would FK-resolve once 0001's
    // tenants table came into being. Migration 0004 reshaped the table
    // and dropped the column DEFAULT (we now require explicit tenancy at
    // the application layer), so this test inserts tenant_id explicitly
    // to simulate the same anchored-to-demo state.
    ensureDemoTenant(db);
    db.prepare(
      `INSERT INTO employees (
        tenant_id, employee_key, source_ids, name, department, signals,
        existing_ratings, snapshot_date_range, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "tnt_demo",
      "alice|sales",
      "{}",
      "Alice",
      "Sales",
      "{}",
      "{}",
      "{}",
      new Date().toISOString(),
    );

    const emp = db
      .prepare(
        "SELECT employee_key, tenant_id FROM employees WHERE tenant_id = ? AND employee_key = ?",
      )
      .get("tnt_demo", "alice|sales") as { employee_key: string; tenant_id: string };
    expect(emp.tenant_id).toBe("tnt_demo");

    // Foreign-key relationship holds
    const tenant = db.prepare("SELECT id FROM tenants WHERE id = ?").get(emp.tenant_id);
    expect(tenant).toBeDefined();
  });
});

describe("generateId", () => {
  it("produces opaque prefixed ids", () => {
    const tnt = generateId("tnt");
    const usr = generateId("usr");
    expect(tnt).toMatch(/^tnt_[a-z0-9]+$/);
    expect(usr).toMatch(/^usr_[a-z0-9]+$/);
  });

  it("collision-resistant across many calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateId("usr"));
    expect(set.size).toBe(1000);
  });

  it("ids are reasonable length (not too short, not absurd)", () => {
    const id = generateId("usr");
    expect(id.length).toBeGreaterThan(10);
    expect(id.length).toBeLessThan(40);
  });
});
