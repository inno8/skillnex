import { requireRolePage } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

export default async function DataSettingsPage() {
  const ctx = await requireRolePage(["owner"]);
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="t-h1" style={{ fontSize: "1.875rem", margin: 0 }}>
          Data
        </h1>
        <p className="t-body" style={{ color: "var(--muted-1)", marginTop: 6 }}>
          Region, retention, export-everything, and tenant deletion (soft-delete with 30-day grace).
        </p>
      </header>
      <div
        className="card"
        style={{
          padding: "32px 24px",
          textAlign: "center",
          color: "var(--muted-2)",
        }}
      >
        Region: <strong>{ctx.tenant.region.toUpperCase()}</strong> · Retention:{" "}
        <strong>{ctx.tenant.retention_days} days</strong>
        <div style={{ marginTop: 12, fontSize: 12 }}>
          Edit + export + delete UI ships in the next commit (Day 4 part C).
        </div>
      </div>
    </div>
  );
}
