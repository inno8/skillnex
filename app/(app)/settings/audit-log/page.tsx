import { requireRolePage } from "@/lib/auth/middleware";
import { listAuditActions, listAuditLog, type AuditLogRow } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  signup: "Sign up",
  login: "Sign in",
  logout: "Sign out",
  password_reset_requested: "Password reset requested",
  password_changed: "Password changed",
  email_verified: "Email verified",
  tenant_created: "Tenant created",
  user_invited: "User invited",
  invitation_accepted: "Invitation accepted",
  user_suspended: "User suspended",
  user_restored: "User restored",
  role_changed: "Role changed",
  permission_denied: "Permission denied",
  view_employee: "Employee viewed",
  generate_narrative: "Narrative generated",
  narrative_edited: "Narrative edited",
  review_emailed: "Review emailed",
  export_data: "Data exported",
  delete_employee: "Employee deleted",
  delete_tenant: "Tenant deleted",
  integration_connected: "Integration connected",
  integration_disconnected: "Integration disconnected",
  system_event: "System event",
};

const ROW_LIMIT = 200;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const ctx = await requireRolePage(["owner", "admin"]);
  const params = await searchParams;
  const filter = params.action ?? "all";
  const rows = listAuditLog(ctx.tenant.id, {
    action: filter === "all" ? undefined : filter,
    limit: ROW_LIMIT,
  });

  const allActions = listAuditActions(ctx.tenant.id);

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 className="t-h1" style={{ fontSize: "1.875rem", margin: 0 }}>
            Audit log
          </h1>
          <p
            className="t-body"
            style={{
              color: "var(--muted-1)",
              marginTop: 6,
              marginBottom: 0,
            }}
          >
            Append-only — every state-changing action across your tenant. Showing the most recent{" "}
            <span className="tabular">{rows.length}</span> of up to{" "}
            <span className="tabular">{ROW_LIMIT}</span>.
          </p>
        </div>
        <form method="GET" style={{ display: "flex", gap: 8 }}>
          <select name="action" defaultValue={filter} className="input">
            <option value="all">All actions</option>
            {allActions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary btn-sm">
            Apply
          </button>
        </form>
      </header>

      {rows.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "32px 24px",
            textAlign: "center",
            color: "var(--muted-2)",
          }}
        >
          No audit entries yet. Actions like sign-in, narrative generation, or team changes will
          appear here.
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 180 }}>When</th>
                <th style={{ width: 200 }}>Action</th>
                <th>Target</th>
                <th>Actor</th>
                <th style={{ width: 140 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <AuditRow key={r.id} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AuditRow({ row }: { row: AuditLogRow }) {
  const ts = new Date(row.ts);
  return (
    <tr>
      <td className="num" style={{ whiteSpace: "nowrap" }}>
        <div style={{ fontSize: 13 }}>{ts.toLocaleDateString()}</div>
        <div className="t-small" style={{ color: "var(--muted-2)", fontSize: 11 }}>
          {ts.toLocaleTimeString()}
        </div>
      </td>
      <td>
        <span
          className={`chip ${row.action === "permission_denied" ? "chip-anomaly" : "chip-neutral"}`}
        >
          {ACTION_LABELS[row.action] ?? row.action}
        </span>
      </td>
      <td className="t-small" style={{ color: "var(--muted-1)" }}>
        {row.target_type ? (
          <>
            <span style={{ color: "var(--muted-2)" }}>{row.target_type}</span>
            {row.target_id ? (
              <>
                {" · "}
                <span className="font-mono" style={{ fontSize: 12 }}>
                  {row.target_id}
                </span>
              </>
            ) : null}
          </>
        ) : (
          "—"
        )}
        {row.details && (
          <div
            className="font-mono"
            style={{
              fontSize: 11,
              color: "var(--muted-2)",
              marginTop: 4,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {row.details}
          </div>
        )}
      </td>
      <td className="t-small" style={{ color: "var(--muted-1)" }}>
        {row.user_email ?? <span style={{ color: "var(--muted-3)" }}>system</span>}
      </td>
      <td className="font-mono" style={{ fontSize: 12, color: "var(--muted-2)" }}>
        {row.ip_address ?? "—"}
      </td>
    </tr>
  );
}
