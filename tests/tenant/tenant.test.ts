/**
 * Unit tests for lib/tenant — retention guards, soft-delete, export.
 *
 * The retention-out-of-range test runs in pure JS; the EU-cap test
 * relies on the SQL trigger from migration 0001 firing — so this file
 * also indirectly covers that the trigger is still wired correctly.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmp = mkdtempSync(join(tmpdir(), "skillnex-tenant-"));
process.env.SKILLNEX_DB_PATH = join(tmp, "skillnex.db");

const dbMod = await import("@/lib/db");
const tenantMod = await import("@/lib/tenant");

const { getDb } = dbMod;
const {
  RETENTION_LIMITS,
  buildExportSnapshot,
  getTenantSettings,
  softDeleteTenant,
  updateRetention,
} = tenantMod;

const T_US = "tnt_lcyc_us";
const T_EU = "tnt_lcyc_eu";

beforeAll(() => {
  const db = getDb();
  db.prepare(
    `INSERT INTO tenants (id, name, region, plan, retention_days, created_at)
     VALUES (?, 'US Co', 'us', 'pilot', 90, datetime('now')),
            (?, 'EU Co', 'eu', 'pilot', 30, datetime('now'))`,
  ).run(T_US, T_EU);

  // Seed a user + employee + upload + audit row in T_US so the export
  // snapshot has something to serialize.
  db.prepare(
    `INSERT INTO user (id, email, emailVerified, createdAt, updatedAt, tenant_id, role, status)
     VALUES ('usr_owner_us', 'owner@us.com', 1, datetime('now'), datetime('now'), ?, 'owner', 'active')`,
  ).run(T_US);
  db.prepare(
    `INSERT INTO employees (
      tenant_id, employee_key, source_ids, name, department, signals,
      existing_ratings, snapshot_date_range, uploaded_at
    ) VALUES (?, 'alice|sales', '{}', 'Alice', 'Sales', '{}', '{}', '{}', datetime('now'))`,
  ).run(T_US);
  db.prepare(
    `INSERT INTO uploads (tenant_id, filename, shape, sheet_names, row_counts,
      unjoined_names, employee_count, uploaded_at)
     VALUES (?, 'roster.xlsx', 'A', '[]', '{}', '[]', 1, datetime('now'))`,
  ).run(T_US);
  db.prepare(
    `INSERT INTO audit_log (tenant_id, user_id, action, ts)
     VALUES (?, 'usr_owner_us', 'login', datetime('now'))`,
  ).run(T_US);
});

afterAll(() => {
  getDb().close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("getTenantSettings", () => {
  it("returns settings + counts for a real tenant", () => {
    const s = getTenantSettings(T_US);
    expect(s).not.toBeNull();
    if (!s) return;
    expect(s.region).toBe("us");
    expect(s.retention_days).toBe(90);
    expect(s.deleted_at).toBeNull();
    expect(s.member_count).toBe(1);
    expect(s.employee_count).toBe(1);
    expect(s.upload_count).toBe(1);
  });

  it("returns null for an unknown tenant", () => {
    expect(getTenantSettings("tnt_does_not_exist")).toBeNull();
  });
});

describe("updateRetention", () => {
  it("rejects values out of range", () => {
    expect(updateRetention(T_US, 0)).toEqual({
      ok: false,
      reason: "out_of_range",
    });
    expect(updateRetention(T_US, RETENTION_LIMITS.max + 1)).toEqual({
      ok: false,
      reason: "out_of_range",
    });
    expect(updateRetention(T_US, 30.5)).toEqual({
      ok: false,
      reason: "out_of_range",
    });
  });

  it("accepts a valid value for a US tenant", () => {
    expect(updateRetention(T_US, 60)).toEqual({ ok: true });
    expect(getTenantSettings(T_US)?.retention_days).toBe(60);
  });

  it("rejects > 30 days for an EU tenant via the SQL trigger", () => {
    expect(updateRetention(T_EU, 60)).toEqual({ ok: false, reason: "eu_cap" });
    // EU tenant retention should still be 30
    expect(getTenantSettings(T_EU)?.retention_days).toBe(30);
  });

  it("accepts <= 30 days for an EU tenant", () => {
    expect(updateRetention(T_EU, 14)).toEqual({ ok: true });
    expect(getTenantSettings(T_EU)?.retention_days).toBe(14);
  });
});

describe("softDeleteTenant", () => {
  it("flips deleted_at and kills sessions", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO session (id, userId, expiresAt, token, createdAt, updatedAt)
       VALUES ('ses_test', 'usr_owner_us', datetime('now', '+30 days'),
               'tok_test', datetime('now'), datetime('now'))`,
    ).run();
    expect(
      (
        db.prepare("SELECT COUNT(*) AS n FROM session WHERE userId = ?").get("usr_owner_us") as {
          n: number;
        }
      ).n,
    ).toBe(1);

    const result = softDeleteTenant(T_US);
    expect(result).toEqual({ ok: true });
    expect(getTenantSettings(T_US)?.deleted_at).not.toBeNull();
    // Sessions wiped
    expect(
      (
        db.prepare("SELECT COUNT(*) AS n FROM session WHERE userId = ?").get("usr_owner_us") as {
          n: number;
        }
      ).n,
    ).toBe(0);
  });

  it("is idempotent — second call reports already_deleted", () => {
    expect(softDeleteTenant(T_US)).toEqual({
      ok: false,
      reason: "already_deleted",
    });
  });
});

describe("buildExportSnapshot", () => {
  it("returns every category for one tenant only", () => {
    const snap = buildExportSnapshot(T_EU);
    expect(snap.tenant.id).toBe(T_EU);
    // T_EU has nothing seeded, so collections are empty — proves the
    // export is tenant-scoped (T_US has a user/employee/upload/audit).
    expect(snap.members).toEqual([]);
    expect(snap.employees).toEqual([]);
    expect(snap.uploads).toEqual([]);
    expect(snap.audit_log).toEqual([]);
  });

  it("includes T_US's seeded rows in T_US's snapshot", () => {
    const snap = buildExportSnapshot(T_US);
    expect(snap.members.map((m) => m.email)).toEqual(["owner@us.com"]);
    expect(snap.employees.length).toBe(1);
    expect(snap.uploads.length).toBe(1);
    // login row + the seed row + retention_changed audits from earlier tests
    expect(snap.audit_log.length).toBeGreaterThanOrEqual(1);
  });
});
