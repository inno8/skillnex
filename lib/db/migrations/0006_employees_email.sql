-- Phase 2.5 — add email column to employees so the manager-edits-and-emails-
-- the-review flow has somewhere to land the recipient address.
--
-- Picked up automatically by the xlsx parser (any 'Email' column on the
-- Payroll or HR Compensation sheet). When absent at ingest time, the
-- "Send to employee" modal asks the manager to type it once and persists
-- it here so future cycles don't re-prompt.
--
-- Lower-cased + trimmed at write time; we do not enforce uniqueness because
-- the same email could legitimately appear under multiple tenants (a
-- contractor reviewed by two clients), and within one tenant duplicates
-- usually mean a data quality issue HR should see, not a constraint
-- violation that breaks the upload.

ALTER TABLE employees ADD COLUMN email TEXT;
CREATE INDEX idx_employees_tenant_email ON employees(tenant_id, email) WHERE email IS NOT NULL;
