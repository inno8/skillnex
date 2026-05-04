-- Phase 2.0 Day 1 — multi-tenant foundation
-- Adds: tenants, users, sessions, invitations, manager_assignments, audit_log
-- Does NOT touch the existing employees table — that's migration 0002.

-- Tenant: one company / customer
CREATE TABLE tenants (
  id                 TEXT PRIMARY KEY,                                -- 'tnt_<base32>'
  name               TEXT NOT NULL,                                   -- e.g. 'Ryan Law Firm'
  region             TEXT NOT NULL CHECK (region IN ('us', 'eu')),
  plan               TEXT NOT NULL DEFAULT 'pilot',
  retention_days     INTEGER NOT NULL DEFAULT 90,                      -- post-cancellation grace; capped at 30 for region='eu'
  created_at         TEXT NOT NULL,
  deleted_at         TEXT                                              -- soft-delete; hard-deleted by retention sweep
);

-- Users with auth
CREATE TABLE users (
  id                  TEXT PRIMARY KEY,                                -- 'usr_<base32>'
  tenant_id           TEXT NOT NULL REFERENCES tenants(id),
  email               TEXT NOT NULL,
  email_normalized    TEXT NOT NULL,                                   -- lowercase + trim, used for login lookup
  password_hash       TEXT,                                            -- nullable: SSO users have no password
  role                TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee')),
  name                TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'deleted')),
  employee_key        TEXT,                                            -- if this user IS a reviewed employee, link
  email_verified_at   TEXT,
  created_at          TEXT NOT NULL,
  last_login_at       TEXT,
  soft_deleted_at     TEXT,                                            -- 30-day grace before hard delete
  UNIQUE (tenant_id, email_normalized)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_employee_key ON users(employee_key) WHERE employee_key IS NOT NULL;

-- Server-side sessions (revocable, unlike JWTs)
CREATE TABLE sessions (
  id                 TEXT PRIMARY KEY,                                 -- random 32 bytes, this is the cookie value
  user_id            TEXT NOT NULL REFERENCES users(id),
  tenant_id          TEXT NOT NULL,
  expires_at         TEXT NOT NULL,
  ip_address         TEXT,
  user_agent         TEXT,
  created_at         TEXT NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Manager → list of employee_keys they can see
CREATE TABLE manager_assignments (
  manager_user_id    TEXT NOT NULL REFERENCES users(id),
  employee_key       TEXT NOT NULL,
  tenant_id          TEXT NOT NULL,
  assigned_at        TEXT NOT NULL,
  PRIMARY KEY (manager_user_id, employee_key)
);

CREATE INDEX idx_manager_assignments_tenant ON manager_assignments(tenant_id);
CREATE INDEX idx_manager_assignments_employee ON manager_assignments(tenant_id, employee_key);

-- Pending invitations
CREATE TABLE invitations (
  token              TEXT PRIMARY KEY,                                 -- random URL-safe
  tenant_id          TEXT NOT NULL,
  email              TEXT NOT NULL,
  role               TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee')),
  invited_by_user_id TEXT NOT NULL REFERENCES users(id),
  expires_at         TEXT NOT NULL,                                    -- 7 days
  accepted_at        TEXT,
  created_at         TEXT NOT NULL
);

CREATE INDEX idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX idx_invitations_expires ON invitations(expires_at);

-- Append-only audit log
-- Per Plan 2: kept for tenant lifetime + 1 year. UPDATE/DELETE forbidden.
CREATE TABLE audit_log (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id          TEXT NOT NULL,
  user_id            TEXT,                                             -- null for system events
  action             TEXT NOT NULL,                                    -- 'login', 'view_employee', 'generate_narrative', 'export_data', 'permission_denied', etc.
  target_type        TEXT,                                             -- 'employee' | 'tenant' | 'user' | 'narrative' | 'integration_grant'
  target_id          TEXT,
  ip_address         TEXT,
  user_agent         TEXT,
  details            TEXT,                                             -- JSON for context
  ts                 TEXT NOT NULL                                     -- ISO 8601 UTC
);

CREATE INDEX idx_audit_log_tenant_ts ON audit_log(tenant_id, ts DESC);
CREATE INDEX idx_audit_log_user_ts ON audit_log(user_id, ts DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_action ON audit_log(tenant_id, action, ts DESC);

-- Append-only enforcement: triggers reject UPDATE and DELETE
CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only — UPDATE forbidden');
END;

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_log
WHEN NEW.tenant_id IS NOT NULL OR OLD.tenant_id IS NOT NULL
BEGIN
  -- DELETE allowed only via the retention sweep, which sets a session pragma
  -- before running. Anything else aborts.
  SELECT RAISE(ABORT, 'audit_log is append-only — DELETE only via retention sweep');
END;

-- EU region cap: when retention_days is set above 30 for an EU tenant, clamp it.
CREATE TRIGGER tenants_eu_retention_cap_insert
BEFORE INSERT ON tenants
WHEN NEW.region = 'eu' AND NEW.retention_days > 30
BEGIN
  SELECT RAISE(ABORT, 'EU tenants are capped at 30-day retention');
END;

CREATE TRIGGER tenants_eu_retention_cap_update
BEFORE UPDATE OF retention_days ON tenants
WHEN NEW.region = 'eu' AND NEW.retention_days > 30
BEGIN
  SELECT RAISE(ABORT, 'EU tenants are capped at 30-day retention');
END;
