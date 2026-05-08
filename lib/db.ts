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

/**
 * Default cycle label for a fresh install. Migration 0007 backfills
 * existing rows with this same string; the upload route falls back to
 * it when the user didn't provide an explicit cycle. Single source of
 * truth so a dev who runs migrations against an older snapshot and
 * tests with the upload UI lands on the same string both ways.
 */
export const DEFAULT_CYCLE_LABEL = "Q1 2026";

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
  cycle_label: string;
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

function toRow(e: EmployeeRecord, uploadedAt: string, cycleLabel: string): EmployeeRow {
  return {
    employee_key: e.employee_key,
    cycle_label: cycleLabel,
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
 * Persist a parsed + scored set of employees under a specific review
 * cycle. Cycle-scoped semantics:
 *
 *   - DELETE only rows in (tenant, department, cycle_label) that match
 *     the upload. Prior cycles stay intact — that's the whole point of
 *     having a cycle column.
 *   - Within the cycle being written, manager-entered emails AND the
 *     existing narrative + computed are snapshotted by employee_key,
 *     then restored on the new INSERT when the new file matches the
 *     same employee. This makes "manager re-uploads to fix a typo"
 *     non-destructive: same cycle + same key = narrative survives.
 *   - Different-cycle uploads NEVER inherit narrative or email from
 *     other cycles. Each cycle is its own snapshot of truth.
 *   - Other tenants are never touched. Other departments within the
 *     same tenant + cycle are untouched. Other cycles within the same
 *     tenant + dept are untouched.
 */
export function saveUpload(
  tenant_id: string,
  opts: {
    filename: string;
    parse: ParseResult;
    scored: EmployeeRecord[];
    /** Free-text label like "Q1 2026" / "Annual 2025". Defaults to
     *  DEFAULT_CYCLE_LABEL when the upload route didn't carry one. */
    cycleLabel?: string;
  },
): { upload_id: number; employee_count: number; cycle_label: string } {
  const db = getDb();
  const uploadedAt = new Date().toISOString();
  const cycleLabel = (opts.cycleLabel ?? DEFAULT_CYCLE_LABEL).trim() || DEFAULT_CYCLE_LABEL;
  const affectedDepts = new Set(opts.scored.map((e) => e.department));

  const tx = db.transaction(() => {
    // Snapshot manager-entered emails for this (tenant, dept, cycle)
    // BEFORE we DELETE — same pattern as before, just cycle-scoped.
    const previousEmails = new Map<string, string>();
    const emailSnap = db.prepare(
      `SELECT employee_key, email FROM employees
        WHERE tenant_id = ? AND department = ? AND cycle_label = ? AND email IS NOT NULL`,
    );
    for (const dept of affectedDepts) {
      for (const r of emailSnap.all(tenant_id, dept, cycleLabel) as Array<{
        employee_key: string;
        email: string;
      }>) {
        previousEmails.set(r.employee_key, r.email);
      }
    }

    // Snapshot narratives + computed metrics so a same-cycle re-upload
    // (typo fix, schema tweak) doesn't wipe a manager's polished work.
    // We restore narrative ONLY when the same employee_key shows up in
    // the new dataset; if they're missing (left the company), the
    // narrative is dropped along with the row.
    const previousNarratives = new Map<string, string>();
    const narrativeSnap = db.prepare(
      `SELECT employee_key, narrative FROM employees
        WHERE tenant_id = ? AND department = ? AND cycle_label = ? AND narrative IS NOT NULL`,
    );
    for (const dept of affectedDepts) {
      for (const r of narrativeSnap.all(tenant_id, dept, cycleLabel) as Array<{
        employee_key: string;
        narrative: string;
      }>) {
        previousNarratives.set(r.employee_key, r.narrative);
      }
    }

    const deleteByDept = db.prepare(
      "DELETE FROM employees WHERE tenant_id = ? AND department = ? AND cycle_label = ?",
    );
    for (const dept of affectedDepts) deleteByDept.run(tenant_id, dept, cycleLabel);

    const insert = db.prepare(
      `INSERT INTO employees (
        tenant_id, employee_key, cycle_label, source_ids, name, email, department,
        sub_department, job_title, level, region, salary, bonus, equity,
        total_cost_to_company, overtime_hours, hire_date, location, signals,
        activities, existing_ratings, computed, narrative, snapshot_date_range,
        uploaded_at, excluded_from_review, integration_opt_out
      ) VALUES (
        @tenant_id, @employee_key, @cycle_label, @source_ids, @name, @email, @department,
        @sub_department, @job_title, @level, @region, @salary, @bonus, @equity,
        @total_cost_to_company, @overtime_hours, @hire_date, @location, @signals,
        @activities, @existing_ratings, @computed, @narrative, @snapshot_date_range,
        @uploaded_at, 0, 0
      )`,
    );
    for (const e of opts.scored) {
      const row = toRow(e, uploadedAt, cycleLabel);
      if (row.email == null && previousEmails.has(e.employee_key)) {
        row.email = previousEmails.get(e.employee_key) ?? null;
      }
      // Carry forward an existing narrative ONLY when the new row
      // didn't already produce one (which a fresh parse never does).
      // Belt + braces — if the parser ever starts emitting narratives,
      // we don't want to silently overwrite them with a stale snapshot.
      if (row.narrative == null && previousNarratives.has(e.employee_key)) {
        row.narrative = previousNarratives.get(e.employee_key) ?? null;
      }
      insert.run({ ...row, tenant_id });
    }

    const uploadInsert = db.prepare(
      `INSERT INTO uploads (tenant_id, filename, shape, sheet_names, row_counts,
        unjoined_names, employee_count, uploaded_at, cycle_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      cycleLabel,
    );
    return Number(info.lastInsertRowid);
  });

  const upload_id = tx();
  return { upload_id, employee_count: opts.scored.length, cycle_label: cycleLabel };
}

/**
 * Resolve the cycle to read from — explicit `cycle_label` if the caller
 * passed one, otherwise the most recent cycle the tenant has uploaded.
 * Falls back to DEFAULT_CYCLE_LABEL when the tenant has no uploads at
 * all (fresh empty state).
 */
export function resolveCycle(tenant_id: string, cycle_label?: string): string {
  if (cycle_label && cycle_label.trim().length > 0) return cycle_label.trim();
  const db = getDb();
  const row = db
    .prepare("SELECT cycle_label FROM uploads WHERE tenant_id = ? ORDER BY id DESC LIMIT 1")
    .get(tenant_id) as { cycle_label: string } | undefined;
  return row?.cycle_label ?? DEFAULT_CYCLE_LABEL;
}

/**
 * Distinct cycle labels for a tenant, most-recent first. Powers the
 * TopBar cycle picker. Empty array when the tenant has never uploaded.
 */
export function listCycles(tenant_id: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT cycle_label, MAX(id) AS latest_id FROM uploads
        WHERE tenant_id = ?
        GROUP BY cycle_label
        ORDER BY latest_id DESC`,
    )
    .all(tenant_id) as Array<{ cycle_label: string; latest_id: number }>;
  return rows.map((r) => r.cycle_label);
}

export function listEmployees(
  tenant_id: string,
  departmentOrOpts?: string | { department?: string; cycle_label?: string },
): EmployeeRecord[] {
  const db = getDb();
  const opts =
    typeof departmentOrOpts === "string"
      ? { department: departmentOrOpts }
      : (departmentOrOpts ?? {});
  const cycle = resolveCycle(tenant_id, opts.cycle_label);
  const rows = opts.department
    ? (db
        .prepare(
          `SELECT * FROM employees
             WHERE tenant_id = ? AND department = ? AND cycle_label = ?
             ORDER BY department, json_extract(computed, '$.dept_rank')`,
        )
        .all(tenant_id, opts.department, cycle) as EmployeeRow[])
    : (db
        .prepare(
          `SELECT * FROM employees
             WHERE tenant_id = ? AND cycle_label = ?
             ORDER BY department, json_extract(computed, '$.dept_rank')`,
        )
        .all(tenant_id, cycle) as EmployeeRow[]);
  return rows.map(fromRow);
}

export function getEmployee(
  tenant_id: string,
  key: string,
  cycle_label?: string,
): EmployeeRecord | null {
  const db = getDb();
  const cycle = resolveCycle(tenant_id, cycle_label);
  const row = db
    .prepare(
      `SELECT * FROM employees
         WHERE tenant_id = ? AND employee_key = ? AND cycle_label = ?`,
    )
    .get(tenant_id, key, cycle) as EmployeeRow | undefined;
  return row ? fromRow(row) : null;
}

export function saveNarrative(
  tenant_id: string,
  employee_key: string,
  narrative: EmployeeRecord["narrative"],
  cycle_label?: string,
): boolean {
  const db = getDb();
  const cycle = resolveCycle(tenant_id, cycle_label);
  const info = db
    .prepare(
      `UPDATE employees SET narrative = ?
         WHERE tenant_id = ? AND employee_key = ? AND cycle_label = ?`,
    )
    .run(narrative ? JSON.stringify(narrative) : null, tenant_id, employee_key, cycle);
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
  cycle_label: string;
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
        cycle_label: string;
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
 * Count employees for the active cycle of a tenant — powers the sidebar
 * badge. Defaults to the most recent cycle, but can be pinned to a
 * specific cycle when the user has selected one in the TopBar picker.
 */
export function countEmployees(tenant_id: string, cycle_label?: string): number {
  const db = getDb();
  const cycle = resolveCycle(tenant_id, cycle_label);
  const row = db
    .prepare("SELECT COUNT(*) as n FROM employees WHERE tenant_id = ? AND cycle_label = ?")
    .get(tenant_id, cycle) as { n: number };
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
 * Identity-level fields propagate across ALL cycles for the same
 * (tenant, employee_key) — a person's name + email don't change because
 * we moved into Q2. Cycle-specific things (narrative, computed metrics)
 * are NOT touched here.
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
