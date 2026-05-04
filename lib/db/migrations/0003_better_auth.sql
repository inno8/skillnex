-- Phase 2.0 Day 2 — swap placeholder users/sessions for better-auth schema
-- with our extension fields (tenant_id, role, employee_key, status).
--
-- Better-auth manages: user, session, account (passwords + OAuth), verification.
-- We add tenant-aware columns to user. Manager assignments + invitations + audit_log
-- stay as we already have them; they reference user.id by foreign key.

-- Drop the placeholder tables from migration 0001 — no production data on this branch.
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- Better-auth's required user table + our extension fields.
CREATE TABLE user (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,                                 -- better-auth requirement
  emailVerified   INTEGER NOT NULL DEFAULT 0,
  name            TEXT,
  image           TEXT,
  createdAt       TEXT NOT NULL,
  updatedAt       TEXT NOT NULL,

  -- Extension fields (Skillnex domain)
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  role            TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'deleted')),
  employee_key    TEXT,                                                  -- if this user IS a reviewed employee
  soft_deleted_at TEXT,                                                  -- 30-day grace before hard delete
  last_login_at   TEXT
);

CREATE INDEX idx_user_tenant ON user(tenant_id);
CREATE INDEX idx_user_employee_key ON user(employee_key) WHERE employee_key IS NOT NULL;

-- Better-auth's session table
CREATE TABLE session (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expiresAt TEXT NOT NULL,
  token     TEXT NOT NULL UNIQUE,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX idx_session_user ON session(userId);
CREATE INDEX idx_session_token ON session(token);
CREATE INDEX idx_session_expires ON session(expiresAt);

-- Better-auth's account table — holds password hash for email/password auth,
-- and OAuth tokens for SSO providers (post-pilot).
CREATE TABLE account (
  id                    TEXT PRIMARY KEY,
  userId                TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accountId             TEXT NOT NULL,                                    -- email for credential, providerUserId for OAuth
  providerId            TEXT NOT NULL,                                    -- 'credential' | 'google' | 'github' | etc.
  password              TEXT,                                             -- argon2id hash for credential provider
  accessToken           TEXT,
  refreshToken          TEXT,
  idToken               TEXT,
  accessTokenExpiresAt  TEXT,
  refreshTokenExpiresAt TEXT,
  scope                 TEXT,
  createdAt             TEXT NOT NULL,
  updatedAt             TEXT NOT NULL
);

CREATE INDEX idx_account_user ON account(userId);
CREATE UNIQUE INDEX idx_account_provider ON account(providerId, accountId);

-- Better-auth's verification table — email verification, magic links, password resets.
CREATE TABLE verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,                                                -- usually the email
  value      TEXT NOT NULL,                                                -- the token
  expiresAt  TEXT NOT NULL,
  createdAt  TEXT NOT NULL,
  updatedAt  TEXT NOT NULL
);

CREATE INDEX idx_verification_identifier ON verification(identifier);

-- Recreate manager_assignments + invitations to point to the new user table.
DROP TABLE IF EXISTS manager_assignments;
CREATE TABLE manager_assignments (
  manager_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  employee_key    TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  assigned_at     TEXT NOT NULL,
  PRIMARY KEY (manager_user_id, employee_key)
);
CREATE INDEX idx_manager_assignments_tenant ON manager_assignments(tenant_id);
CREATE INDEX idx_manager_assignments_employee ON manager_assignments(tenant_id, employee_key);

DROP TABLE IF EXISTS invitations;
CREATE TABLE invitations (
  token              TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  email              TEXT NOT NULL,
  role               TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee')),
  invited_by_user_id TEXT NOT NULL REFERENCES user(id),
  expires_at         TEXT NOT NULL,
  accepted_at        TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX idx_invitations_expires ON invitations(expires_at);
