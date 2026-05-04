import { requireRolePage } from "@/lib/auth/middleware";
import { RETENTION_LIMITS, getTenantSettings } from "@/lib/tenant";

import { RetentionForm } from "./retention-form";
import { ExportButton } from "./export-button";
import { DangerZone } from "./danger-zone";

export const dynamic = "force-dynamic";

export default async function DataSettingsPage() {
  const ctx = await requireRolePage(["owner"]);
  const settings = getTenantSettings(ctx.tenant.id);
  if (!settings) throw new Error("Tenant settings not found");

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="t-h1" style={{ fontSize: "1.875rem", margin: 0 }}>
          Data
        </h1>
        <p className="t-body" style={{ color: "var(--muted-1)", marginTop: 6, marginBottom: 0 }}>
          Region, retention, full export, and tenant deletion. Owner-only — these decisions are
          written to the audit log.
        </p>
      </header>

      <section className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h2 className="t-h2" style={{ margin: "0 0 14px" }}>
          Snapshot
        </h2>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
            margin: 0,
          }}
        >
          <Stat label="Region" value={settings.region.toUpperCase()} />
          <Stat label="Retention" value={`${settings.retention_days} days`} />
          <Stat
            label="Members"
            value={settings.member_count.toString()}
            hint="active users in this tenant"
          />
          <Stat
            label="Employees scored"
            value={settings.employee_count.toString()}
            hint="rows in the latest snapshot"
          />
          <Stat
            label="Uploads"
            value={settings.upload_count.toString()}
            hint="lifetime workbook ingests"
          />
          <Stat label="Created" value={new Date(settings.created_at).toLocaleDateString()} />
        </dl>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="t-h2" style={{ margin: "0 0 12px" }}>
          Region
        </h2>
        <div className="card" style={{ padding: 20 }}>
          <p className="t-small" style={{ color: "var(--muted-1)", marginTop: 0 }}>
            Tenant region is fixed at signup and migrating it requires moving data between physical
            regions. Open a ticket if you need it changed — we'll do it manually with a fresh DPA.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 8,
            }}
          >
            <span className="chip chip-neutral">Current: {settings.region.toUpperCase()}</span>
            <span className="t-small" style={{ color: "var(--muted-2)" }}>
              {settings.region === "eu"
                ? "Hosted region: EU. 30-day retention cap enforced in SQL."
                : "Hosted region: US-East."}
            </span>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="t-h2" style={{ margin: "0 0 12px" }}>
          Retention
        </h2>
        <RetentionForm
          initial={settings.retention_days}
          region={settings.region}
          min={RETENTION_LIMITS.min}
          max={settings.region === "eu" ? RETENTION_LIMITS.eu_max : RETENTION_LIMITS.max}
        />
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="t-h2" style={{ margin: "0 0 12px" }}>
          Export
        </h2>
        <div className="card" style={{ padding: 20 }}>
          <p className="t-small" style={{ color: "var(--muted-1)", marginTop: 0 }}>
            One JSON file with every row Skillnex stores for this tenant — tenants, users,
            employees, uploads, full audit log. Useful for your security review or before deletion.
          </p>
          <ExportButton />
        </div>
      </section>

      <section>
        <h2 className="t-h2" style={{ margin: "0 0 12px", color: "var(--destructive)" }}>
          Danger zone
        </h2>
        <DangerZone tenantName={settings.name} />
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="t-micro" style={{ color: "var(--muted-2)" }}>
        {label}
      </dt>
      <dd style={{ margin: "4px 0 0" }}>
        <span className="t-num-md">{value}</span>
        {hint && (
          <div className="t-small" style={{ color: "var(--muted-2)", fontSize: 12 }}>
            {hint}
          </div>
        )}
      </dd>
    </div>
  );
}
