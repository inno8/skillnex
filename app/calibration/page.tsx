import Link from "next/link";

import { Icons } from "@/components/icons";
import { TopBar } from "@/components/topbar";
import { deriveFlags } from "@/lib/anomalies";
import { listEmployees } from "@/lib/db";
import { initialsFromName, formatCurrency } from "@/lib/utils";
import type { EmployeeRecord } from "@/lib/types";

import { CalibrationBoard } from "./board";

export const dynamic = "force-dynamic";

type Search = { department?: string };

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { department } = await searchParams;
  const deptFilter = department ?? "all";
  let employees: EmployeeRecord[] = [];
  try {
    employees = listEmployees();
  } catch {
    employees = [];
  }

  if (employees.length === 0) {
    return (
      <>
        <TopBar crumbs={[{ label: "Calibration" }]} />
        <div
          className="fade-in"
          style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px" }}
        >
          <div className="t-micro">Calibration</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            No employees yet.
          </h1>
          <p
            className="t-body"
            style={{ color: "var(--muted-1)", marginBottom: 16 }}
          >
            Upload a workbook first.
          </p>
          <Link href="/" className="btn btn-primary">
            <Icons.Upload size={14} stroke="#fff" /> Go to Ingest
          </Link>
        </div>
      </>
    );
  }

  const depts = Array.from(new Set(employees.map((e) => e.department))).sort();
  const list =
    deptFilter === "all"
      ? employees
      : employees.filter((e) => e.department === deptFilter);

  const flagsByKey = new Map(
    deriveFlags(employees).map((f) => [f.employee.employee_key, f.flags]),
  );

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
      flagged: (flagsByKey.get(e.employee_key) ?? []).some(
        (f) => f !== "top-performer",
      ),
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
          <form
            method="GET"
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <select
              name="department"
              defaultValue={deptFilter}
              className="input"
            >
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
          Each dot is one employee. X-axis is our normalized value score. Y-axis
          is contribution (revenue per salary dollar) for Sales and Engineering,
          or cost-per-employee-impacted for HR. Upper-right is where promotions
          compound. Lower-left is where a scope conversation is due — the data
          backing the conversation lives one click away.
        </p>

        <CalibrationBoard
          points={points}
          hasROI={deptFilter !== "HR" && depts.includes("Sales") || depts.includes("Engineering")}
          deptFilter={deptFilter}
        />
      </div>
    </>
  );
}
