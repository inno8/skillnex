/**
 * Unit tests for lib/team — invitation flow + role/status guards.
 *
 * The guards we care most about:
 *   - last-owner-can't-be-demoted (would_orphan_owner)
 *   - last-owner-can't-be-suspended (would_orphan_owner)
 *   - cross-tenant invites/role-changes can't reach across tenants
 *   - invitation reissue blocked while a live one exists
 *
 * Uses an isolated in-memory DB per test file via SKILLNEX_DB_PATH,
 * same pattern as tests/db/tenant-isolation.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "skillnex-team-"));
process.env.SKILLNEX_DB_PATH = join(tmp, "skillnex.db");

const dbMod = await import("@/lib/db");
const teamMod = await import("@/lib/team");

const { getDb } = dbMod;
const {
  changeRole,
  createInvitation,
  getInvitationByToken,
  listPendingInvitations,
  listTeamMembers,
  markInvitationAccepted,
  restoreUser,
  revokeInvitation,
  suspendUser,
} = teamMod;

const TENANT_A = "tnt_team_a";
const TENANT_B = "tnt_team_b";
const OWNER_A = "usr_owner_a";
const ADMIN_A = "usr_admin_a";
const MGR_A = "usr_mgr_a";
const OWNER_B = "usr_owner_b";

beforeAll(() => {
  const db = getDb();
  for (const id of [TENANT_A, TENANT_B]) {
    db.prepare(
      `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
       VALUES (?, ?, 'us', 'pilot', 90, datetime('now'))`,
    ).run(id, id);
  }
  const insUser = db.prepare(
    `INSERT INTO user (id, email, emailVerified, createdAt, updatedAt, tenant_id, role, status)
     VALUES (?, ?, 1, datetime('now'), datetime('now'), ?, ?, 'active')`,
  );
  insUser.run(OWNER_A, "owner@a.com", TENANT_A, "owner");
  insUser.run(ADMIN_A, "admin@a.com", TENANT_A, "admin");
  insUser.run(MGR_A, "mgr@a.com", TENANT_A, "manager");
  insUser.run(OWNER_B, "owner@b.com", TENANT_B, "owner");
});

afterAll(() => {
  getDb().close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("listTeamMembers", () => {
  it("returns members of one tenant only, owner-first", () => {
    const a = listTeamMembers(TENANT_A);
    expect(a.map((m) => m.email)).toEqual(["owner@a.com", "admin@a.com", "mgr@a.com"]);
    const b = listTeamMembers(TENANT_B);
    expect(b.map((m) => m.email)).toEqual(["owner@b.com"]);
  });
});

describe("createInvitation", () => {
  it("creates a pending invitation row with a token", () => {
    const r = createInvitation({
      tenant_id: TENANT_A,
      email: "new1@a.com",
      role: "manager",
      invited_by_user_id: OWNER_A,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invitation.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(r.invitation.email).toBe("new1@a.com");
    expect(r.invitation.role).toBe("manager");
    expect(r.invitation.accepted_at).toBeNull();
    expect(listPendingInvitations(TENANT_A).map((i) => i.email)).toContain("new1@a.com");
  });

  it("lowercases + trims the email", () => {
    const r = createInvitation({
      tenant_id: TENANT_A,
      email: "  Mixed.Case@A.COM  ",
      role: "employee",
      invited_by_user_id: OWNER_A,
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.invitation.email).toBe("mixed.case@a.com");
  });

  it("refuses to invite an existing tenant member", () => {
    const r = createInvitation({
      tenant_id: TENANT_A,
      email: "admin@a.com",
      role: "manager",
      invited_by_user_id: OWNER_A,
    });
    expect(r).toEqual({ ok: false, reason: "already_member" });
  });

  it("refuses to issue a duplicate live invitation", () => {
    createInvitation({
      tenant_id: TENANT_A,
      email: "dup@a.com",
      role: "manager",
      invited_by_user_id: OWNER_A,
    });
    const second = createInvitation({
      tenant_id: TENANT_A,
      email: "dup@a.com",
      role: "manager",
      invited_by_user_id: OWNER_A,
    });
    expect(second).toEqual({ ok: false, reason: "already_invited" });
  });

  it("revoking lets you reissue", () => {
    const first = createInvitation({
      tenant_id: TENANT_A,
      email: "reissue@a.com",
      role: "manager",
      invited_by_user_id: OWNER_A,
    });
    if (!first.ok) throw new Error("first invite should succeed");
    expect(revokeInvitation(TENANT_A, first.invitation.token)).toBe(true);
    const second = createInvitation({
      tenant_id: TENANT_A,
      email: "reissue@a.com",
      role: "admin",
      invited_by_user_id: OWNER_A,
    });
    expect(second.ok).toBe(true);
  });

  it("invitation in tenant B doesn't block invitation in tenant A", () => {
    createInvitation({
      tenant_id: TENANT_B,
      email: "shared@x.com",
      role: "manager",
      invited_by_user_id: OWNER_B,
    });
    const r = createInvitation({
      tenant_id: TENANT_A,
      email: "shared@x.com",
      role: "manager",
      invited_by_user_id: OWNER_A,
    });
    expect(r.ok).toBe(true);
  });
});

describe("changeRole guards", () => {
  it("can promote an admin to owner", () => {
    const r = changeRole(TENANT_A, ADMIN_A, "owner");
    expect(r.ok).toBe(true);
    // restore for following tests
    changeRole(TENANT_A, ADMIN_A, "admin");
  });

  it("refuses to demote the last owner", () => {
    const r = changeRole(TENANT_A, OWNER_A, "admin");
    expect(r).toEqual({ ok: false, reason: "would_orphan_owner" });
  });

  it("can demote an owner if another active owner exists", () => {
    changeRole(TENANT_A, ADMIN_A, "owner");
    const r = changeRole(TENANT_A, OWNER_A, "admin");
    expect(r.ok).toBe(true);
    // restore
    changeRole(TENANT_A, OWNER_A, "owner");
    changeRole(TENANT_A, ADMIN_A, "admin");
  });

  it("refuses to change a user from another tenant", () => {
    const r = changeRole(TENANT_A, OWNER_B, "admin");
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("suspendUser / restoreUser guards", () => {
  it("refuses to suspend the last active owner", () => {
    const r = suspendUser(TENANT_A, OWNER_A);
    expect(r).toEqual({ ok: false, reason: "would_orphan_owner" });
  });

  it("can suspend an admin", () => {
    const r = suspendUser(TENANT_A, ADMIN_A);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.status).toBe("suspended");
  });

  it("restoring flips status back to active", () => {
    const r = restoreUser(TENANT_A, ADMIN_A);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.status).toBe("active");
  });

  it("can suspend an owner if another active owner exists", () => {
    changeRole(TENANT_A, ADMIN_A, "owner");
    const r = suspendUser(TENANT_A, OWNER_A);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.status).toBe("suspended");
    // restore for subsequent tests
    restoreUser(TENANT_A, OWNER_A);
    changeRole(TENANT_A, ADMIN_A, "admin");
  });

  it("refuses to suspend a user from another tenant", () => {
    const r = suspendUser(TENANT_A, OWNER_B);
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("markInvitationAccepted", () => {
  it("flips accepted_at and removes the row from pending", () => {
    const r = createInvitation({
      tenant_id: TENANT_A,
      email: "accept@a.com",
      role: "manager",
      invited_by_user_id: OWNER_A,
    });
    if (!r.ok) throw new Error("invite should succeed");
    markInvitationAccepted(r.invitation.token);
    const fetched = getInvitationByToken(r.invitation.token);
    expect(fetched?.accepted_at).not.toBeNull();
    const pending = listPendingInvitations(TENANT_A);
    expect(pending.find((i) => i.email === "accept@a.com")).toBeUndefined();
  });
});
