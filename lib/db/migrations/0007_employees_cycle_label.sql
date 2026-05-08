-- Phase 2.6 — quarterly cycle support.
--
-- Pilot reality: HR teams run performance reviews every 3 months (some
-- mid-years and annuals on top). Today, a re-upload wipes the previous
-- cycle's data — no history, no way to compare quarter to quarter, and
-- a typo fix on this quarter's xlsx kills the prior quarter's polished
-- narratives. That's not "we'll fix it later" — that's a feature gap
-- HR teams will not tolerate past pilot.
--
-- Schema change: add `cycle_label` (free-text label like "Q1 2026" /
-- "Annual 2025") and extend the composite PK from (tenant, key) to
-- (tenant, key, cycle_label). Same employee can now exist under
-- multiple cycles, each with its own narrative + computed metrics +
-- manager edits. Cross-cycle comparisons get to live in app code, not
-- be defeated by the schema.
--
-- Backfill: every existing row gets cycle_label='Q1 2026'. The pilot
-- has no production data yet, but the migration tests load demo data
-- and we want them to stay green without rewriting fixtures.
--
-- SQLite cannot ALTER PRIMARY KEY in place — same recreate-table dance
-- as 0004. Each step is independently safe inside the migration's
-- BEGIN/COMMIT envelope.

CREATE TABLE employees_v3 (
  tenant_id             TEXT    NOT NULL,
  employee_key          TEXT    NOT NULL,
  cycle_label           TEXT    NOT NULL DEFAULT 'Q1 2026',
  source_ids            TEXT    NOT NULL,
  name                  TEXT    NOT NULL,
  email                 TEXT,
  department            TEXT    NOT NULL,
  sub_department        TEXT,
  job_title             TEXT,
  level                 TEXT,
  region                TEXT,
  salary                REAL,
  bonus                 REAL,
  equity                REAL,
  total_cost_to_company REAL,
  overtime_hours        REAL,
  hire_date             TEXT,
  location              TEXT,
  signals               TEXT    NOT NULL,
  activities            TEXT,
  existing_ratings      TEXT    NOT NULL,
  computed              TEXT,
  narrative             TEXT,
  snapshot_date_range   TEXT    NOT NULL,
  uploaded_at           TEXT    NOT NULL,
  excluded_from_review  INTEGER NOT NULL DEFAULT 0,
  integration_opt_out   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, employee_key, cycle_label)
);

INSERT INTO employees_v3 (
  tenant_id, employee_key, cycle_label, source_ids, name, email, department,
  sub_department, job_title, level, region, salary, bonus, equity,
  total_cost_to_company, overtime_hours, hire_date, location, signals,
  activities, existing_ratings, computed, narrative, snapshot_date_range,
  uploaded_at, excluded_from_review, integration_opt_out
)
SELECT
  tenant_id, employee_key, 'Q1 2026' AS cycle_label, source_ids, name, email,
  department, sub_department, job_title, level, region, salary, bonus, equity,
  total_cost_to_company, overtime_hours, hire_date, location, signals,
  activities, existing_ratings, computed, narrative, snapshot_date_range,
  uploaded_at, excluded_from_review, integration_opt_out
FROM employees;

DROP TABLE employees;
ALTER TABLE employees_v3 RENAME TO employees;

-- Recreate the indexes from 0004 + 0006. None of them included
-- cycle_label, but several queries filter by (tenant, cycle, dept) so
-- we add a fresh composite that helps the dashboard queries find the
-- right cycle without scanning every row in the tenant.
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_tenant_dept ON employees(tenant_id, department);
CREATE INDEX idx_employees_tenant_cycle ON employees(tenant_id, cycle_label);
CREATE INDEX idx_employees_tenant_cycle_dept ON employees(tenant_id, cycle_label, department);
CREATE INDEX idx_employees_tenant_email ON employees(tenant_id, email) WHERE email IS NOT NULL;

-- The uploads table tracks the audit trail (one row per click of "upload"
-- in the UI). Stamping the cycle here means a manager can answer "which
-- file did Q1 2026's roster come from" by reading uploads alone — no
-- join through employees.
ALTER TABLE uploads ADD COLUMN cycle_label TEXT NOT NULL DEFAULT 'Q1 2026';
CREATE INDEX idx_uploads_tenant_cycle ON uploads(tenant_id, cycle_label);
