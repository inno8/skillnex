import Link from "next/link";

import { redirect } from "next/navigation";

import { Icons } from "@/components/icons";
import { TopBar } from "@/components/topbar";
import { deriveFlags } from "@/lib/anomalies";
import { requireTenantUserPage } from "@/lib/auth/middleware";
import { listEmployeesForUser } from "@/lib/scoped-employees";
import { initialsFromName, formatCurrency } from "@/lib/utils";
import type { EmployeeRecord } from "@/lib/types";

import { CalibrationBoard } from "./board";

export const dynamic = "force-dynamic";

type Search = { department?: string };

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireTenantUserPage();
  // Calibration scatter is for owner/admin/manager only — for an
  // employee the scatter would be a single dot which is meaningless.
  if (ctx.user.role === "employee") redirect("/my-review");

  const { department } = await searchParams;
  const deptFilter = department ?? "all";
  let employees: EmployeeRecord[] = [];
  try {
    // Manager: scoped to assigned reports.
    employees = listEmployeesForUser(ctx);
  } catch {
    employees = [];
  }

  if (employees.length === 0) {
    return (
      <>
        <TopBar crumbs={[{ label: "Calibration" }]} />
        <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px" }}>
          <div className="t-micro">Calibration</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            No employees yet.
          </h1>
          <p className="t-body" style={{ color: "var(--muted-1)", marginBottom: 16 }}>
            Upload a workbook first.
          </p>
          <Link href="/ingest" className="btn btn-primary">
            <Icons.Upload size={14} stroke="#fff" /> Go to Ingest
          </Link>
        </div>
      </>
    );
  }

  const depts = Array.from(new Set(employees.map((e) => e.department))).sort();
  const list =
    deptFilter === "all" ? employees : employees.filter((e) => e.department === deptFilter);

  const flagsByKey = new Map(deriveFlags(employees).map((f) => [f.employee.employee_key, f.flags]));

  const points = list.map((e) => {
    // x = value_score (0-100), y = ROI if available, else cost_efficiency normalized.
    // For HR: plot value_score vs inverse cost_efficiency (higher = more efficient).
    const vs = e.computed?.value_score ?? 0;
    const roi = e.computed?.roi ?? null;
    const costEff = e.computed?.cost_efficiency ?? null;
    return {
      key: e.employee_key,
      name: e.name,
      initials: initialsFromName(e.name),
      department: e.department,
      value_score: vs,
      roi,
      cost_efficiency: costEff,
      salary: e.salary,
      flagged: (flagsByKey.get(e.employee_key) ?? []).some((f) => f !== "top-performer"),
      salaryFormatted: formatCurrency(e.salary),
    };
  });

  return (
    <>
      <TopBar crumbs={[{ label: "Calibration" }]} />
      <div
        className="fade-in"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "28px 24px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <div>
            <div className="t-micro">Calibration</div>
            <h1 className="t-h1" style={{ margin: "4px 0 0", fontSize: "2rem" }}>
              Value against contribution.
            </h1>
          </div>
          <form method="GET" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select name="department" defaultValue={deptFilter} className="input">
              <option value="all">All departments</option>
              {depts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" type="submit">
              Apply
            </button>
          </form>
        </div>
        <p
          className="t-body"
          style={{
            color: "var(--muted-1)",
            maxWidth: "62ch",
            marginBottom: 24,
          }}
        >
          Each dot is one employee. X-axis is our normalized value score. Y-axis is contribution
          (revenue per salary dollar) for Sales and Engineering, or cost-per-employee-impacted for
          HR. Upper-right is where promotions compound. Lower-left is where a scope conversation is
          due — the data backing the conversation lives one click away.
        </p>

        {/* Pick the Y-axis up front so the empty-state condition matches
            what the board would actually try to draw. The board uses
            cost_efficiency when deptFilter === "HR", ROI otherwise — so
            for an HR-only roster viewed in "all" mode we have to push
            the filter to "HR" or the board lands every dot at y=0
            (this was the "calibration is empty" bug a user hit). */}
        {(() => {
          const anyROI = points.some((p) => p.roi != null);
          const anyCostEff = points.some((p) => p.cost_efficiency != null);
          const effectiveFilter = deptFilter === "all" && !anyROI && anyCostEff ? "HR" : deptFilter;
          const useCostEff = effectiveFilter === "HR";
          const hasYData = useCostEff ? anyCostEff : anyROI;
          if (!hasYData) {
            return (
              <NoContributionData deptFilter={deptFilter} depts={depts} count={points.length} />
            );
          }
          return (
            <CalibrationBoard points={points} hasROI={!useCostEff} deptFilter={effectiveFilter} />
          );
        })()}
      </div>
    </>
  );
}

function NoContributionData({
  deptFilter,
  depts,
  count,
}: {
  deptFilter: string;
  depts: string[];
  count: number;
}) {
  const isHrOnly = depts.length === 1 && depts[0] === "HR";
  const isHrFilter = deptFilter === "HR";
  return (
    <div
      className="card"
      style={{
        padding: "40px 32px",
        textAlign: "center",
        background: "var(--paper)",
        borderStyle: "dashed",
      }}
    >
      <div className="t-micro" style={{ marginBottom: 8 }}>
        Calibration needs a contribution axis
      </div>
      <h3
        className="t-h2"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.4rem",
          fontWeight: 500,
          margin: "0 0 10px",
          fontVariationSettings: '"opsz" 36',
        }}
      >
        {isHrOnly
          ? "Calibration scatter is for revenue-generating departments."
          : isHrFilter
            ? "HR doesn't have a contribution ratio."
            : "No contribution data in this snapshot."}
      </h3>
      <p
        className="t-body"
        style={{
          color: "var(--muted-1)",
          maxWidth: "52ch",
          margin: "0 auto 16px",
          lineHeight: 1.55,
        }}
      >
        The scatter plots value score against revenue-per-salary (contribution) for Sales and
        Engineering, or cost-per-impacted-employee for HR. Without that Y-axis data — for {count}{" "}
        {count === 1 ? "person" : "people"} in this view — every dot lands on the same line and the
        chart says nothing.
      </p>
      <div
        className="t-small"
        style={{ color: "var(--muted-2)", maxWidth: "52ch", margin: "0 auto" }}
      >
        {isHrOnly
          ? "Upload a roster that includes Sales or Engineering departments to unlock calibration."
          : "Use the People list for a flat ranking, or filter by Sales / Engineering above."}
      </div>
    </div>
  );
}
