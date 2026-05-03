-- Phase 2.0 Day 1 — extend employees with tenant_id + flags
-- Adds tenant_id (mandatory column), excluded_from_review (partner-data exclusion per privacy guide),
-- and integration_opt_out (per Plan 3 — employee one-click opt-out).
--
-- NOTE: SQLite ALTER TABLE ADD COLUMN cannot use NOT NULL without a default. We add tenant_id
-- with a default of 'tnt_demo' (which the backfill creates), then enforce non-null at the
-- application layer via scopedDb. Same approach for the integer flags.

ALTER TABLE employees ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'tnt_demo';
ALTER TABLE employees ADD COLUMN excluded_from_review INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN integration_opt_out INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_tenant_dept ON employees(tenant_id, department);

-- Same treatment for the uploads table — every upload belongs to a tenant
ALTER TABLE uploads ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'tnt_demo';
CREATE INDEX idx_uploads_tenant ON uploads(tenant_id);
