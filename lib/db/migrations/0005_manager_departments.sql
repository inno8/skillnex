-- Phase 2.0 Day 5.5 — switch manager scope from per-employee_key to per-department.
--
-- The original manager_assignments table tied a manager to specific
-- employee_keys. That was wrong for two reasons:
--   1. Real managers manage departments (or sub-departments), not arbitrary
--      lists of names. "You handle Sales" is the operating model, not
--      "you handle Alice + Bob + Carol".
--   2. Each cycle's xlsx upload creates fresh employee_key strings (derived
--      from "name|department"). With per-employee assignment, the owner
--      would have to re-assign every quarter or the manager's cohort would
--      silently empty out as old keys disappear.
--
-- Switching to per-department is durable: "manager X covers Sales" stays
-- true across uploads, and a new hire that lands in Sales is automatically
-- in their cohort the moment the next ingest runs.
--
-- Pilot has not shipped — no production rows in manager_assignments — so
-- a clean drop+create is safe.

DROP TABLE IF EXISTS manager_assignments;

CREATE TABLE manager_departments (
  manager_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  department      TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  assigned_at     TEXT NOT NULL,
  PRIMARY KEY (manager_user_id, department)
);

CREATE INDEX idx_manager_departments_tenant ON manager_departments(tenant_id);
CREATE INDEX idx_manager_departments_lookup ON manager_departments(tenant_id, manager_user_id);
