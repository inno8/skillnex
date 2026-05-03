import Link from "next/link";

import { Avatar, Chip } from "@/components/primitives";
import { NarrativeCard } from "@/components/narrative-card";
import { TopBar } from "@/components/topbar";
import { FLAG_LABELS, deriveFlags } from "@/lib/anomalies";
import { auditLog } from "@/lib/auth/audit";
import { requireTenantUserPage } from "@/lib/auth/middleware";
import { getEmployee } from "@/lib/db";
import { formatCurrency, initialsFromName } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * /my-review — the personal performance-review surface for any user
 * whose user.employee_key is set. Employees only ever see this page
 * (sidebar hides everything else for them). Owners/admins/managers
 * who are also reviewed (rare but possible — the founder running
 * Skillnex on themselves, for example) can navigate here too.
 *
 * Strict scope: shows ONLY the row whose employee_key matches the
 * signed-in user's. No tenant-wide context, no benchmarks against
 * other employees — comparisons live on /people for staff who can
 * see them.
 */
export default async function MyReviewPage() {
  const ctx = await requireTenantUserPage();
  const employeeKey = ctx.user.employee_key;

  // No linked employee row → tell them politely. This is the realistic
  // case for owners/admins who never get added to a roster, and for
  // employees whose HR hasn't run their first import yet.
  if (!employeeKey) {
    return (
      <>
        <TopBar crumbs={[{ label: "My review" }]} />
        <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px" }}>
          <div className="t-micro">My review</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            No review yet.
          </h1>
          <p className="t-body" style={{ color: "var(--muted-1)", marginBottom: 16 }}>
            Your account isn't linked to an employee record. Once your HR team uploads the next
            roster and matches it to your email, your review will appear here.
          </p>
          {ctx.user.role !== "employee" && (
            <Link href="/dashboard" className="auth-link">
              Go to dashboard →
            </Link>
          )}
        </div>
      </>
    );
  }

  const employee = getEmployee(ctx.tenant.id, employeeKey);
  if (!employee) {
    return (
      <>
        <TopBar crumbs={[{ label: "My review" }]} />
        <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px" }}>
          <div className="t-micro">My review</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            Your review is being prepared.
          </h1>
          <p className="t-body" style={{ color: "var(--muted-1)" }}>
            Your employee record exists but hasn't been scored in this cycle yet. Check back after
            your HR team runs the next ingest.
          </p>
        </div>
      </>
    );
  }

  // Audit every self-view. Lets the audit log show "employee X read
  // their own review on Y" — useful when an employee asks "who saw
  // this?" during a sensitive performance conversation.
  try {
    auditLog({
      tenant_id: ctx.tenant.id,
      user_id: ctx.user.id,
      action: "view_employee",
      target_type: "employee",
      target_id: employee.employee_key,
      details: { self_view: true, department: employee.department },
    });
  } catch (err) {
    console.error("audit my-review view failed", err);
  }

  const c = employee.computed;
  const flagged = deriveFlags([employee])[0];

  return (
    <>
      <TopBar crumbs={[{ label: "My review" }]} />
      <div
        className="fade-in"
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "32px 24px 64px",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 18,
            paddingBottom: 24,
            borderBottom: "1px solid var(--border)",
            marginBottom: 28,
          }}
        >
          <Avatar initials={initialsFromName(employee.name)} size={56} />
          <div style={{ flex: 1 }}>
            <div className="t-micro">
              {employee.department}
              {employee.sub_department ? ` · ${employee.sub_department}` : ""}
            </div>
            <h1 className="t-h1" style={{ margin: "4px 0 6px", fontSize: "2rem" }}>
              {employee.name}
            </h1>
            <div className="t-body" style={{ color: "var(--muted-1)" }}>
              {employee.job_title ?? "Employee"}
              {employee.level ? ` · ${employee.level}` : ""}
            </div>
            {flagged.flags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                {flagged.flags.map((f) => (
                  <Chip key={f} kind={f === "top-performer" ? "success" : "anomaly"}>
                    {FLAG_LABELS[f]}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </header>

        <div
          className="card"
          style={{
            padding: 20,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <Stat
            label="Value score"
            value={c ? c.value_score.toFixed(1) : "—"}
            unit={c ? "/ 100" : undefined}
          />
          <Stat label="Department rank" value={c ? `${c.dept_rank} / ${c.dept_size}` : "—"} />
          <Stat
            label={employee.department === "HR" ? "Cost / impacted" : "Contribution"}
            value={
              employee.department === "HR"
                ? c?.cost_efficiency != null
                  ? formatCurrency(c.cost_efficiency)
                  : "—"
                : c?.roi != null
                  ? `${c.roi.toFixed(2)}x`
                  : "—"
            }
          />
        </div>

        <NarrativeCard
          employeeKey={employee.employee_key}
          employeeName={employee.name}
          narrative={employee.narrative}
          disabled={!employee.computed}
        />

        <div
          style={{
            marginTop: 32,
            padding: "14px 18px",
            background: "var(--paper)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 13,
            color: "var(--muted-1)",
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: "var(--ink)" }}>How to read this.</strong> Every number above is
          from data your HR team uploaded — payroll, activity, performance ratings. Skillnex doesn't
          add anything that isn't in those source rows. If a number looks wrong, that's a
          conversation to have with your manager and HR.
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="t-micro" style={{ color: "var(--muted-2)" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="t-num-md">{value}</span>
        {unit && (
          <span className="t-small" style={{ color: "var(--muted-2)" }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
