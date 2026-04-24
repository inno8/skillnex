import Link from "next/link";

import { Icons } from "@/components/icons";
import { Avatar, Chip, KPI, SparkBar } from "@/components/primitives";
import { TopBar } from "@/components/topbar";
import { FLAG_LABELS, FLAG_REASONS, flaggedOnly, groupByFlag, type FlagKey } from "@/lib/anomalies";
import { latestUpload, listEmployees } from "@/lib/db";
import { formatCurrency, initialsFromName } from "@/lib/utils";
import type { EmployeeRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

type DeptStat = {
  dept: string;
  headcount: number;
  avgValue: number;
  totalValue: number;
  avgRoi: number | null;
  totalSalary: number;
  anomalies: number;
};

function aggregateDept(rows: EmployeeRecord[]): DeptStat {
  const dept = rows[0]?.department ?? "—";
  const totalValue = rows.reduce((s, e) => s + (e.computed?.value_score ?? 0), 0);
  const avgValue = rows.length ? totalValue / rows.length : 0;
  const rois = rows
    .map((e) => e.computed?.roi)
    .filter((r): r is number => r != null);
  const avgRoi =
    rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null;
  const totalSalary = rows.reduce((s, e) => s + (e.salary ?? 0), 0);
  return {
    dept,
    headcount: rows.length,
    avgValue,
    totalValue,
    avgRoi,
    totalSalary,
    anomalies: 0,
  };
}

export default function DashboardPage() {
  let employees: EmployeeRecord[] = [];
  let upload = null;
  try {
    employees = listEmployees();
    upload = latestUpload();
  } catch {
    employees = [];
  }

  if (employees.length === 0) {
    return (
      <>
        <TopBar crumbs={[{ label: "Overview" }]} />
        <div
          className="fade-in"
          style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px" }}
        >
          <div className="t-micro">Overview</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            No data yet.
          </h1>
          <p
            className="t-body"
            style={{ color: "var(--muted-1)", marginBottom: 16 }}
          >
            Upload a workbook to populate the dashboard.
          </p>
          <Link href="/" className="btn btn-primary">
            <Icons.Upload size={14} stroke="#fff" /> Go to Ingest
          </Link>
        </div>
      </>
    );
  }

  const byDept = new Map<string, EmployeeRecord[]>();
  for (const e of employees) {
    const bucket = byDept.get(e.department) ?? [];
    bucket.push(e);
    byDept.set(e.department, bucket);
  }
  const deptOrder = ["Sales", "Engineering", "HR"];
  const deptKeys = [...byDept.keys()].sort(
    (a, b) => {
      const ai = deptOrder.indexOf(a);
      const bi = deptOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    },
  );

  const flagged = flaggedOnly(employees);
  const flagsByKey = new Map(flagged.map((f) => [f.employee.employee_key, f.flags]));
  const deptStats: DeptStat[] = deptKeys.map((d) => {
    const rows = byDept.get(d) ?? [];
    const base = aggregateDept(rows);
    const anomalies = rows.filter(
      (r) => (flagsByKey.get(r.employee_key) ?? []).length > 0,
    ).length;
    return { ...base, anomalies };
  });

  const maxTotalValue = Math.max(...deptStats.map((d) => d.totalValue), 1);
  const maxAvgRoi = Math.max(
    ...deptStats.map((d) => d.avgRoi ?? 0),
    0.01,
  );

  const totalHeadcount = employees.length;
  const avgValue =
    employees.reduce((s, e) => s + (e.computed?.value_score ?? 0), 0) /
    totalHeadcount;
  const rois = employees
    .map((e) => e.computed?.roi)
    .filter((r): r is number => r != null);
  const avgRoi =
    rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null;
  const totalPayroll = employees.reduce((s, e) => s + (e.salary ?? 0), 0);
  const anomalyCount = flagged.length;

  const grouped = groupByFlag(flagged);
  const flagOrder: FlagKey[] = [
    "score-vs-rating-mismatch",
    "missing-salary",
    "underpaid-hi-perf",
    "low-roi-senior",
  ];

  return (
    <>
      <TopBar crumbs={[{ label: "Overview" }]} />
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
            marginBottom: 4,
          }}
        >
          <div className="t-micro">
            {upload?.filename ?? "Skillnex"} · Q1 2026 Review Cycle
          </div>
          {upload && (
            <div className="t-small" style={{ color: "var(--muted-2)" }}>
              Updated{" "}
              <span className="tabular">
                {new Date(upload.uploaded_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>
        <h1
          className="t-h1"
          style={{ margin: "4px 0 2px", fontSize: "2rem" }}
        >
          The cycle, in five numbers.
        </h1>
        <p
          className="t-body"
          style={{
            color: "var(--muted-1)",
            maxWidth: "62ch",
            marginBottom: 28,
          }}
        >
          {totalHeadcount} employees across {deptKeys.length}{" "}
          departments. Skillnex joined your roster with compensation and generated
          department-aware scores. Begin where the data disagrees with itself.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
            marginBottom: 36,
          }}
        >
          <KPI
            label="Headcount"
            value={totalHeadcount.toString()}
            footer={`${deptKeys.length} departments`}
          />
          <KPI
            label="Avg. value score"
            value={avgValue.toFixed(1)}
            unit="/ 100"
            footer="across all employees"
          />
          <KPI
            label="Avg. contribution"
            value={avgRoi != null ? `${avgRoi.toFixed(2)}x` : "—"}
            footer={avgRoi != null ? "Sales + Engineering · revenue per $1 salary" : "no contribution data"}
          />
          <KPI
            label="Total payroll"
            value={`$${(totalPayroll / 1_000_000).toFixed(2)}M`}
            footer="annualized base"
          />
          <KPI
            label="Anomalies"
            value={anomalyCount.toString()}
            accent={anomalyCount > 0}
            footer={anomalyCount > 0 ? "need review" : "all clear"}
          />
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32 }}
        >
          <div>
            <div className="section-header">
              <div>
                <h2 className="t-h2">Departments</h2>
                <div
                  className="t-small"
                  style={{ color: "var(--muted-2)", marginTop: 2 }}
                >
                  Click a row to drill into the team.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {deptStats.map((d) => {
                const totalPct = (d.totalValue / maxTotalValue) * 100;
                const roiPct = d.avgRoi != null ? (d.avgRoi / maxAvgRoi) * 100 : 0;
                return (
                  <Link
                    key={d.dept}
                    href={`/people?department=${encodeURIComponent(d.dept)}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "200px 1.2fr 1.2fr 120px 140px 90px 24px",
                      alignItems: "center",
                      gap: 20,
                      padding: "18px 4px",
                      borderBottom: "1px solid var(--border)",
                      textDecoration: "none",
                      color: "var(--ink)",
                      transition: "background-color 180ms ease-out",
                    }}
                    className="hover:bg-paper"
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "1.2rem",
                          fontWeight: 500,
                          letterSpacing: "-0.005em",
                          fontVariationSettings: '"opsz" 36',
                        }}
                      >
                        {d.dept}
                      </div>
                      <div
                        className="t-small"
                        style={{ color: "var(--muted-2)", marginTop: 2 }}
                      >
                        <span className="tabular">{d.headcount}</span> people
                      </div>
                    </div>
                    <div>
                      <div className="t-micro" style={{ marginBottom: 4 }}>
                        Total value
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <SparkBar value={totalPct} width={120} />
                        <span className="t-num-sm">
                          {Math.round(d.totalValue)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="t-micro" style={{ marginBottom: 4 }}>
                        {d.dept === "HR" ? "Impact avg" : "Avg. contribution"}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <SparkBar value={roiPct || d.avgValue} width={120} accent />
                        <span className="t-num-sm">
                          {d.avgRoi != null
                            ? `${d.avgRoi.toFixed(2)}x`
                            : `${d.avgValue.toFixed(0)} / 100`}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="t-micro" style={{ marginBottom: 4 }}>
                        Avg. score
                      </div>
                      <div className="t-num-md">{d.avgValue.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="t-micro" style={{ marginBottom: 4 }}>
                        Payroll
                      </div>
                      <div className="t-num-md">
                        ${(d.totalSalary / 1_000_000).toFixed(2)}M
                      </div>
                    </div>
                    <div>
                      {d.anomalies > 0 ? (
                        <Chip kind="anomaly">
                          {d.anomalies} flag{d.anomalies !== 1 ? "s" : ""}
                        </Chip>
                      ) : (
                        <span
                          className="t-small"
                          style={{ color: "var(--muted-3)" }}
                        >
                          —
                        </span>
                      )}
                    </div>
                    <Icons.Chevron size={14} stroke="var(--muted-3)" />
                  </Link>
                );
              })}
            </div>

            <div style={{ marginTop: 40 }}>
              <div className="section-header">
                <div>
                  <h2 className="t-h2">Value distribution</h2>
                  <div
                    className="t-small"
                    style={{ color: "var(--muted-2)", marginTop: 2 }}
                  >
                    Value scores (0–100) across the org, colored by department.
                  </div>
                </div>
              </div>
              <ValueDistribution employees={employees} />
            </div>
          </div>

          <aside>
            <div className="section-header">
              <h2 className="t-h2">Anomalies</h2>
              <span className="t-small" style={{ color: "var(--muted-2)" }}>
                {flagged.length} flagged
              </span>
            </div>
            <div className="card" style={{ overflow: "hidden" }}>
              {flagOrder.map((flagKey, i, arr) => {
                const list = grouped[flagKey] ?? [];
                if (!list.length) return null;
                return (
                  <div
                    key={flagKey}
                    style={{
                      borderBottom:
                        i < arr.length - 1 ? "1px solid var(--border)" : 0,
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 14px 8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Chip kind="anomaly">{FLAG_LABELS[flagKey]}</Chip>
                      <span
                        className="t-num-sm"
                        style={{ color: "var(--muted-2)" }}
                      >
                        {list.length}
                      </span>
                    </div>
                    <div style={{ padding: "0 14px 12px" }}>
                      <div
                        className="t-small"
                        style={{
                          color: "var(--muted-1)",
                          marginBottom: 8,
                          lineHeight: 1.5,
                        }}
                      >
                        {FLAG_REASONS[flagKey]}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        {list.slice(0, 3).map(({ employee: e }) => (
                          <Link
                            key={e.employee_key}
                            href={`/people/${encodeURIComponent(e.employee_key)}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 8px",
                              margin: "0 -8px",
                              borderRadius: 2,
                              textDecoration: "none",
                              color: "var(--ink)",
                            }}
                          >
                            <Avatar
                              initials={initialsFromName(e.name)}
                              size={22}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>
                                {e.name}
                              </div>
                              <div
                                className="t-small"
                                style={{ color: "var(--muted-2)" }}
                              >
                                {e.department}
                                {e.sub_department ? ` · ${e.sub_department}` : ""}
                              </div>
                            </div>
                            <Icons.Chevron size={12} stroke="var(--muted-3)" />
                          </Link>
                        ))}
                        {list.length > 3 && (
                          <Link
                            href={`/people?flag=${flagKey}`}
                            className="t-small"
                            style={{
                              color: "var(--accent)",
                              padding: "4px 0",
                              fontWeight: 500,
                              textDecoration: "none",
                            }}
                          >
                            +{list.length - 3} more →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {flagged.length === 0 && (
                <div
                  style={{
                    padding: 16,
                    color: "var(--muted-2)",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  No anomalies in this snapshot.
                </div>
              )}
            </div>

            {upload && (
              <div className="card" style={{ padding: 16, marginTop: 20 }}>
                <div className="t-micro" style={{ marginBottom: 8 }}>
                  Last ingest
                </div>
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  <span className="font-mono" style={{ fontSize: 12 }}>
                    {upload.filename}
                  </span>
                </div>
                <div className="t-small" style={{ color: "var(--muted-1)" }}>
                  Shape {upload.shape} ·{" "}
                  <span className="tabular">{upload.employee_count}</span>{" "}
                  employees joined
                </div>
                <div className="rule" style={{ margin: "10px 0" }} />
                <div
                  className="t-small"
                  style={{ color: "var(--muted-1)", lineHeight: 1.6 }}
                >
                  {upload.unjoined_names.length > 0
                    ? `${upload.unjoined_names.length} employees could not be joined to Payroll data.`
                    : "All activity-sheet employees joined cleanly."}
                </div>
                <Link
                  href="/"
                  className="t-small"
                  style={{
                    color: "var(--accent)",
                    fontWeight: 500,
                    marginTop: 8,
                    display: "inline-block",
                    textDecoration: "none",
                  }}
                >
                  Review ingest →
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function ValueDistribution({ employees }: { employees: EmployeeRecord[] }) {
  const BUCKETS = 15;
  const buckets = Array.from({ length: BUCKETS }, () => ({
    count: 0,
    dept: {} as Record<string, number>,
  }));
  for (const e of employees) {
    const v = e.computed?.value_score ?? 0;
    const idx = Math.min(BUCKETS - 1, Math.max(0, Math.floor((v / 100) * BUCKETS)));
    buckets[idx].count++;
    buckets[idx].dept[e.department] = (buckets[idx].dept[e.department] ?? 0) + 1;
  }
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const deptColor: Record<string, string> = {
    Engineering: "var(--ink)",
    Sales: "var(--accent)",
    HR: "var(--muted-1)",
  };
  return (
    <div className="card" style={{ padding: "24px 28px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          height: 160,
          position: "relative",
        }}
      >
        {buckets.map((b, i) => {
          const h = (b.count / max) * 100;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    height: `${h}%`,
                    width: "100%",
                    display: "flex",
                    flexDirection: "column-reverse",
                  }}
                >
                  {Object.entries(b.dept).map(([d, c]) => (
                    <div
                      key={d}
                      style={{
                        height: `${(c / b.count) * 100}%`,
                        background: deptColor[d] ?? "var(--muted-3)",
                        borderTop: "1px solid var(--paper)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted-2)",
        }}
      >
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
      <hr className="rule" style={{ margin: "16px 0 12px" }} />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {Object.entries(deptColor)
          .filter(([d]) => employees.some((e) => e.department === d))
          .map(([d, c]) => (
            <div
              key={d}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--muted-1)",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: c,
                  borderRadius: 1,
                  display: "inline-block",
                }}
              />
              {d}
            </div>
          ))}
      </div>
    </div>
  );
}

// unused import guard
void formatCurrency;
