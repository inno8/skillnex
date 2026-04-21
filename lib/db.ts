import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";

import type { EmployeeRecord, ParseResult } from "@/lib/types";

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
 * Persist a parsed + scored set of employees. Replaces prior rows for the
 * departments present in the upload. Other departments are untouched.
 */
export function saveUpload(opts: {
  filename: string;
  parse: ParseResult;
  scored: EmployeeRecord[];
}): { upload_id: number; employee_count: number } {
  const db = getDb();
  const uploadedAt = new Date().toISOString();
  const affectedDepts = new Set(opts.scored.map((e) => e.department));

  const tx = db.transaction(() => {
    const deleteByDept = db.prepare(
      "DELETE FROM employees WHERE department = ?",
    );
    for (const dept of affectedDepts) deleteByDept.run(dept);

    const insert = db.prepare(
      `INSERT INTO employees (
        employee_key, source_ids, name, department, sub_department, job_title,
        level, region, salary, bonus, equity, total_cost_to_company,
        overtime_hours, hire_date, location, signals, activities,
        existing_ratings, computed, narrative, snapshot_date_range, uploaded_at
      ) VALUES (
        @employee_key, @source_ids, @name, @department, @sub_department, @job_title,
        @level, @region, @salary, @bonus, @equity, @total_cost_to_company,
        @overtime_hours, @hire_date, @location, @signals, @activities,
        @existing_ratings, @computed, @narrative, @snapshot_date_range, @uploaded_at
      )`,
    );
    for (const e of opts.scored) insert.run(toRow(e, uploadedAt));

    const uploadInsert = db.prepare(
      `INSERT INTO uploads (filename, shape, sheet_names, row_counts,
        unjoined_names, employee_count, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const info = uploadInsert.run(
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

export function listEmployees(department?: string): EmployeeRecord[] {
  const db = getDb();
  const rows = department
    ? (db
        .prepare(
          "SELECT * FROM employees WHERE department = ? ORDER BY department, json_extract(computed, '$.dept_rank')",
        )
        .all(department) as EmployeeRow[])
    : (db
        .prepare(
          "SELECT * FROM employees ORDER BY department, json_extract(computed, '$.dept_rank')",
        )
        .all() as EmployeeRow[]);
  return rows.map(fromRow);
}

export function getEmployee(key: string): EmployeeRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM employees WHERE employee_key = ?")
    .get(key) as EmployeeRow | undefined;
  return row ? fromRow(row) : null;
}

export function latestUpload(): {
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
    .prepare("SELECT * FROM uploads ORDER BY id DESC LIMIT 1")
    .get() as
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
