import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";

import type { EmployeeRecord, ParseResult } from "@/lib/types";

import { ensureDemoTenant } from "./db/backfill";
import { migrate } from "./db/migrations";

const DB_PATH = process.env.SKILLNEX_DB_PATH
  ? resolve(process.cwd(), process.env.SKILLNEX_DB_PATH)
  : resolve(process.cwd(), "data", "skillnex.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!existsSync(dirname(DB_PATH))) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  // Phase 2: apply migrations (idempotent) + ensure the demo tenant exists
  // so existing rows with the default tenant_id='tnt_demo' are anchored.
  migrate(db);
  ensureDemoTenant(db);
  _db = db;
  return db;
}

const SCHEMA = `
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

CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department);

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

export type EmployeeRow = {
  employee_key: string;
  source_ids: string;
  name: string;
  email: string | null;
  department: string;
  sub_department: string | null;
  job_title: string | null;
  level: string | null;
  region: string | null;
  salary: number | null;
  bonus: number | null;
  equity: number | null;
  total_cost_to_company: number | null;
  overtime_hours: number | null;
  hire_date: string | null;
  location: string | null;
  signals: string;
  activities: string | null;
  existing_ratings: string;
  computed: string | null;
  narrative: string | null;
  snapshot_date_range: string;
  uploaded_at: string;
};

function toRow(e: EmployeeRecord, uploadedAt: string): EmployeeRow {
  return {
    employee_key: e.employee_key,
    source_ids: JSON.stringify(e.source_ids),
    name: e.name,
    email: normalizeEmail(e.email),
    department: e.department,
    sub_department: e.sub_department,
    job_title: e.job_title,
    level: e.level,
    region: e.region,
    salary: e.salary,
    bonus: e.bonus,
    equity: e.equity,
    total_cost_to_company: e.total_cost_to_company,
    overtime_hours: e.overtime_hours,
    hire_date: e.hire_date,
    location: e.location,
    signals: JSON.stringify(e.signals),
    activities: e.activities ? JSON.stringify(e.activities) : null,
    existing_ratings: JSON.stringify(e.existing_ratings),
    computed: e.computed ? JSON.stringify(e.computed) : null,
    narrative: e.narrative ? JSON.stringify(e.narrative) : null,
    snapshot_date_range: JSON.stringify(e.snapshot_date_range),
    uploaded_at: uploadedAt,
  };
}

function fromRow(row: EmployeeRow): EmployeeRecord {
  return {
    employee_key: row.employee_key,
    source_ids: JSON.parse(row.source_ids),
    name: row.name,
    email: row.email,
    department: row.department,
    sub_department: row.sub_department,
    job_title: row.job_title,
    level: row.level,
    region: row.region,
    salary: row.salary,
    bonus: row.bonus,
    equity: row.equity,
    total_cost_to_company: row.total_cost_to_company,
    overtime_hours: row.overtime_hours,
    hire_date: row.hire_date,
    location: row.location,
    signals: JSON.parse(row.signals),
    activities: row.activities ? JSON.parse(row.activities) : null,
    existing_ratings: JSON.parse(row.existing_ratings),
    computed: row.computed ? JSON.parse(row.computed) : null,
    narrative: row.narrative ? JSON.parse(row.narrative) : null,
    snapshot_date_range: JSON.parse(row.snapshot_date_range),
  };
}

/**
 * Persist a parsed + scored set of employees, scoped to a tenant.
 *
 * Replacement semantics: we delete prior rows for the affected (tenant_id,
 * department) pairs only. Other tenants are never touched. Other departments
 * within the same tenant are untouched.
 */
export function saveUpload(
  tenant_id: string,
  opts: {
    filename: string;
    parse: ParseResult;
    scored: EmployeeRecord[];
  },
): { upload_id: number; employee_count: number } {
  const db = getDb();
  const uploadedAt = new Date().toISOString();
  const affectedDepts = new Set(opts.scored.map((e) => e.department));

  const tx = db.transaction(() => {
    // Preserve manager-entered emails across re-uploads. If the new
    // xlsx doesn't include an Email column (most pilot xlsx don't) we
    // don't want to erase what the manager typed via the share-review
    // modal or /people inline edit. Snapshot before DELETE, restore
    // for any inserted row that comes in with a null email.
    const previousEmails = new Map<string, string>();
    const emailSnap = db.prepare(
      `SELECT employee_key, email FROM employees
        WHERE tenant_id = ? AND department = ? AND email IS NOT NULL`,
    );
    for (const dept of affectedDepts) {
      for (const r of emailSnap.all(tenant_id, dept) as Array<{
        employee_key: string;
        email: string;
      }>) {
        previousEmails.set(r.employee_key, r.email);
      }
    }

    const deleteByDept = db.prepare("DELETE FROM employees WHERE tenant_id = ? AND department = ?");
    for (const dept of affectedDepts) deleteByDept.run(tenant_id, dept);

    const insert = db.prepare(
      `INSERT INTO employees (
        tenant_id, employee_key, source_ids, name, email, department, sub_department, job_title,
        level, region, salary, bonus, equity, total_cost_to_company,
        overtime_hours, hire_date, location, signals, activities,
        existing_ratings, computed, narrative, snapshot_date_range, uploaded_at,
        excluded_from_review, integration_opt_out
      ) VALUES (
        @tenant_id, @employee_key, @source_ids, @name, @email, @department, @sub_department, @job_title,
        @level, @region, @salary, @bonus, @equity, @total_cost_to_company,
        @overtime_hours, @hire_date, @location, @signals, @activities,
        @existing_ratings, @computed, @narrative, @snapshot_date_range, @uploaded_at,
        0, 0
      )`,
    );
    for (const e of opts.scored) {
      const row = toRow(e, uploadedAt);
      // If the new xlsx didn't carry an email but we had one before,
      // bring it forward so manager edits survive re-uploads.
      if (row.email == null && previousEmails.has(e.employee_key)) {
        row.email = previousEmails.get(e.employee_key) ?? null;
      }
      insert.run({ ...row, tenant_id });
    }

    const uploadInsert = db.prepare(
      `INSERT INTO uploads (tenant_id, filename, shape, sheet_names, row_counts,
        unjoined_names, employee_count, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const info = uploadInsert.run(
      tenant_id,
      opts.filename,
      opts.parse.shape,
      JSON.stringify(Object.keys(opts.parse.row_counts)),
      JSON.stringify(opts.parse.row_counts),
      JSON.stringify(opts.parse.unjoined_names),
      opts.scored.length,
      uploadedAt,
    );
    return Number(info.lastInsertRowid);
  });

  const upload_id = tx();
  return { upload_id, employee_count: opts.scored.length };
}

export function listEmployees(tenant_id: string, department?: string): EmployeeRecord[] {
  const db = getDb();
  const rows = department
    ? (db
        .prepare(
          "SELECT * FROM employees WHERE tenant_id = ? AND department = ? ORDER BY department, json_extract(computed, '$.dept_rank')",
        )
        .all(tenant_id, department) as EmployeeRow[])
    : (db
        .prepare(
          "SELECT * FROM employees WHERE tenant_id = ? ORDER BY department, json_extract(computed, '$.dept_rank')",
        )
        .all(tenant_id) as EmployeeRow[]);
  return rows.map(fromRow);
}

export function getEmployee(tenant_id: string, key: string): EmployeeRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM employees WHERE tenant_id = ? AND employee_key = ?")
    .get(tenant_id, key) as EmployeeRow | undefined;
  return row ? fromRow(row) : null;
}

export function saveNarrative(
  tenant_id: string,
  employee_key: string,
  narrative: EmployeeRecord["narrative"],
): boolean {
  const db = getDb();
  const info = db
    .prepare("UPDATE employees SET narrative = ? WHERE tenant_id = ? AND employee_key = ?")
    .run(narrative ? JSON.stringify(narrative) : null, tenant_id, employee_key);
  return info.changes > 0;
}

export function latestUpload(tenant_id: string): {
  id: number;
  filename: string;
  shape: string;
  row_counts: Record<string, number>;
  unjoined_names: string[];
  employee_count: number;
  uploaded_at: string;
} | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM uploads WHERE tenant_id = ? ORDER BY id DESC LIMIT 1")
    .get(tenant_id) as
    | {
        id: number;
        filename: string;
        shape: string;
        row_counts: string;
        unjoined_names: string[];
        employee_count: number;
        uploaded_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    ...row,
    row_counts: JSON.parse(row.row_counts as unknown as string),
    unjoined_names: JSON.parse(row.unjoined_names as unknown as string),
  };
}

/**
 * Count employees for a tenant. Used by the sidebar to show a badge without
 * loading all rows.
 */
export function countEmployees(tenant_id: string): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as n FROM employees WHERE tenant_id = ?")
    .get(tenant_id) as { n: number };
  return row.n;
}

/** Lowercase + trim, return null on empty/whitespace-only/missing input. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Mutable, manager-editable fields on the employee row. Only `name` and
 * `email` for now — anything else (department, salary, etc.) comes from
 * the source xlsx and shouldn't be overridden in the app.
 *
 * Returns true if at least one row changed. The caller decides whether
 * a no-op is an error or a success (likely success — re-saving the same
 * values isn't a bug).
 */
export function updateEmployeeFields(
  tenant_id: string,
  employee_key: string,
  fields: { name?: string; email?: string | null },
): boolean {
  const db = getDb();
  const sets: string[] = [];
  const params: Array<string | null> = [];
  if (typeof fields.name === "string") {
    const trimmed = fields.name.trim();
    if (trimmed.length === 0) {
      throw new Error("name cannot be empty");
    }
    sets.push("name = ?");
    params.push(trimmed);
  }
  if (Object.hasOwn(fields, "email")) {
    sets.push("email = ?");
    params.push(normalizeEmail(fields.email ?? null));
  }
  if (sets.length === 0) return false;
  params.push(tenant_id, employee_key);
  const info = db
    .prepare(
      `UPDATE employees SET ${sets.join(", ")}
        WHERE tenant_id = ? AND employee_key = ?`,
    )
    .run(...params);
  return info.changes > 0;
}
