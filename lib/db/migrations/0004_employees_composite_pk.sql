-- Phase 2.0 Day 3.5 — fix employees primary key to be (tenant_id, employee_key)
--
-- The original schema (pre-Phase 2) had employee_key as the sole PRIMARY KEY.
-- That worked when there was one tenant. With multi-tenancy, two companies
-- can legitimately have employees with the same employee_key (it's derived
-- from "name|department" and there's no global namespace), and the upload
-- fails with `UNIQUE constraint failed: employees.employee_key` the moment
-- a second tenant tries to ingest a roster that overlaps with anyone else's.
--
-- SQLite cannot ALTER a primary key in place. Standard recreate-table dance:
--   1. create employees_new with the composite PK
--   2. copy every column over
--   3. drop the old table
--   4. rename
--   5. recreate the indexes that lived on the old table
--
-- Note on FKs: nothing currently references employees by foreign key
-- (manager_assignments references user.id, not employee_key) so the
-- DROP TABLE is safe. We cannot toggle PRAGMA foreign_keys inside a
-- transaction anyway — SQLite silently ignores it — and the migration
-- runner wraps every file in BEGIN/COMMIT. If a future migration adds
-- a FK from another table to employees, it will need to run BEFORE
-- this one, or this whole dance has to move out of a transaction
-- boundary.

-- Bonus fix: the audit_log_no_delete trigger from migration 0001 has a
-- WHEN clause that references NEW.tenant_id. DELETE triggers don't have
-- a NEW row, so this clause is invalid SQL. SQLite is lazy about
-- validating it — until something mutates the schema (like the DROP
-- TABLE below), at which point it re-checks every trigger and aborts
-- the whole migration with `no such column: NEW.tenant_id`.
--
-- Migrations are append-only so we can't fix 0001 in place. Drop and
-- recreate the trigger here with the WHEN clause removed (every DELETE
-- on audit_log should be blocked, not just rows with tenant_id set).
DROP TRIGGER IF EXISTS audit_log_no_delete;
CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only — DELETE only via retention sweep');
END;

CREATE TABLE employees_new (
  tenant_id             TEXT    NOT NULL,
  employee_key          TEXT    NOT NULL,
  source_ids            TEXT    NOT NULL,
  name                  TEXT    NOT NULL,
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
  PRIMARY KEY (tenant_id, employee_key)
);

INSERT INTO employees_new (
  tenant_id, employee_key, source_ids, name, department, sub_department,
  job_title, level, region, salary, bonus, equity, total_cost_to_company,
  overtime_hours, hire_date, location, signals, activities, existing_ratings,
  computed, narrative, snapshot_date_range, uploaded_at, excluded_from_review,
  integration_opt_out
)
SELECT
  tenant_id, employee_key, source_ids, name, department, sub_department,
  job_title, level, region, salary, bonus, equity, total_cost_to_company,
  overtime_hours, hire_date, location, signals, activities, existing_ratings,
  computed, narrative, snapshot_date_range, uploaded_at, excluded_from_review,
  integration_opt_out
FROM employees;

DROP TABLE employees;
ALTER TABLE employees_new RENAME TO employees;

-- Recreate the indexes that lived on the old table. CREATE INDEX is not
-- IF NOT EXISTS-guarded for the tenant indexes because the DROP TABLE above
-- removes them implicitly — but we use IF NOT EXISTS for the dept index
-- because it predates Phase 2 and the original SCHEMA may have already
-- created it on a fresh DB.
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_tenant_dept ON employees(tenant_id, department);
