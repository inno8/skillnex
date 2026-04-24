import Link from "next/link";
import { notFound } from "next/navigation";

import { Icons } from "@/components/icons";
import { NarrativeCard } from "@/components/narrative-card";
import { Avatar, Chip } from "@/components/primitives";
import { TopBar } from "@/components/topbar";
import { FLAG_LABELS, deriveFlags } from "@/lib/anomalies";
import { getEmployee, listEmployees } from "@/lib/db";
import { formatCurrency, formatNumber, initialsFromName } from "@/lib/utils";
import type { EmployeeRecord, HRActivity } from "@/lib/types";

export const dynamic = "force-dynamic";

type Benchmarks = {
  avgValue: number;
  avgRoi: number | null;
  avgSalary: number | null;
  medianRating: number | null;
};

function benchmarks(dept: string): Benchmarks {
  const list = listEmployees(dept);
  const avgValue =
    list.reduce((s, e) => s + (e.computed?.value_score ?? 0), 0) /
      Math.max(list.length, 1);
  const rois = list
    .map((e) => e.computed?.roi)
    .filter((r): r is number => r != null);
  const avgRoi =
    rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null;
  const salaries = list
    .map((e) => e.salary)
    .filter((s): s is number => s != null);
  const avgSalary =
    salaries.length > 0 ? salaries.reduce((a, b) => a + b, 0) / salaries.length : null;
  const ratings = list
    .map((e) => e.existing_ratings.performance_rating)
    .filter((r): r is number => r != null);
  const medianRating =
    ratings.length > 0
      ? ratings.sort((a, b) => a - b)[Math.floor(ratings.length / 2)]
      : null;
  return { avgValue, avgRoi, avgSalary, medianRating };
}

function peers(e: EmployeeRecord): EmployeeRecord[] {
  const list = listEmployees(e.department).filter(
    (p) => p.employee_key !== e.employee_key,
  );
  list.sort(
    (a, b) =>
      Math.abs((a.computed?.value_score ?? 0) - (e.computed?.value_score ?? 0)) -
      Math.abs((b.computed?.value_score ?? 0) - (e.computed?.value_score ?? 0)),
  );
  return list.slice(0, 4);
}

function MetricRow({
  label,
  value,
  unit,
  benchmark,
  benchmarkLabel,
  positive,
  last,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  benchmark?: number | null;
  benchmarkLabel?: string;
  positive?: "up" | "down" | null;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: last ? 0 : "1px solid var(--border)",
      }}
    >
      <div>
        <div className="t-small" style={{ color: "var(--muted-1)" }}>
          {label}
        </div>
        {benchmarkLabel && benchmark != null && (
          <div
            className="t-small"
            style={{ color: "var(--muted-3)", fontSize: 11 }}
          >
            {benchmarkLabel}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <span
          className="t-num-md"
          style={{
            color:
              positive === "down"
                ? "var(--destructive)"
                : positive === "up"
                  ? "var(--success)"
                  : "var(--ink)",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="t-small"
            style={{ marginLeft: 3, color: "var(--muted-2)" }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function ActivityLog({ activities }: { activities: HRActivity[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {activities.map((a, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "baseline",
            padding: "10px 0",
            borderBottom:
              idx < activities.length - 1 ? "1px solid var(--border)" : 0,
          }}
        >
          <div
            className="font-mono tabular"
            style={{
              fontSize: 11,
              color: "var(--muted-2)",
              width: 80,
              flexShrink: 0,
            }}
          >
            {a.date}
          </div>
          <div style={{ flexShrink: 0 }}>
            <Chip
              kind={
                a.priority === "Critical" || a.priority === "High"
                  ? "anomaly"
                  : "neutral"
              }
            >
              {a.priority}
            </Chip>
          </div>
          <div
            className="t-small"
            style={{ color: "var(--muted-1)", flexShrink: 0, width: 150 }}
          >
            {a.type}
          </div>
          <div style={{ flex: 1, fontSize: 14 }}>{a.description}</div>
          <div
            className="t-num-sm"
            style={{ color: "var(--muted-2)", flexShrink: 0 }}
          >
            <span className="tabular">{a.duration_hours}h</span> ·{" "}
            <span className="tabular">{a.employees_impacted}</span> impacted
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const employee = getEmployee(decodeURIComponent(key));
  if (!employee) notFound();

  const isHR = employee.department === "HR";
  const c = employee.computed;
  const bench = benchmarks(employee.department);
  const flagged = deriveFlags([employee])[0];
  const peerList = peers(employee);

  return (
    <>
      <TopBar
        crumbs={[
          { label: "People", href: "/people" },
          {
            label: employee.department,
            href: `/people?department=${encodeURIComponent(employee.department)}`,
          },
          { label: employee.name },
        ]}
      />
      <div
        className="fade-in"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "24px 24px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 20,
            paddingBottom: 24,
            borderBottom: "1px solid var(--border)",
            marginBottom: 28,
          }}
        >
          <Avatar initials={initialsFromName(employee.name)} size={56} />
          <div style={{ flex: 1 }}>
            <div className="t-micro">
              {employee.source_ids.activity_id} · {employee.department}
            </div>
            <h1
              className="t-h1"
              style={{ margin: "4px 0 6px", fontSize: "2rem" }}
            >
              {employee.name}
            </h1>
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span className="t-body" style={{ color: "var(--muted-1)" }}>
                {employee.job_title ?? (isHR ? "HR contributor" : "—")}
                {employee.level ? ` · ${employee.level}` : ""}
              </span>
              {(employee.sub_department || employee.region) && (
                <>
                  <span style={{ color: "var(--muted-3)" }}>·</span>
                  <span
                    className="t-small"
                    style={{ color: "var(--muted-1)" }}
                  >
                    {employee.sub_department ?? employee.region}
                  </span>
                </>
              )}
              {employee.location && (
                <>
                  <span style={{ color: "var(--muted-3)" }}>·</span>
                  <span
                    className="t-small"
                    style={{ color: "var(--muted-1)" }}
                  >
                    {employee.location}
                  </span>
                </>
              )}
              <span style={{ color: "var(--muted-3)" }}>·</span>
              <span className="t-small" style={{ color: "var(--muted-1)" }}>
                Snapshot{" "}
                <span className="tabular">
                  {employee.snapshot_date_range.from}
                </span>{" "}
                →{" "}
                <span className="tabular">
                  {employee.snapshot_date_range.to}
                </span>
              </span>
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
                  <Chip
                    key={f}
                    kind={f === "top-performer" ? "success" : "anomaly"}
                  >
                    {FLAG_LABELS[f]}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" type="button">
              <Icons.Download size={13} /> Export PDF
            </button>
            <button className="btn btn-primary btn-sm" type="button">
              Approve & lock
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: 48,
            alignItems: "start",
          }}
        >
          <article>
            <NarrativeCard
              employeeKey={employee.employee_key}
              employeeName={employee.name}
              narrative={employee.narrative}
              disabled={!employee.computed}
            />

            {isHR && employee.activities && employee.activities.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div className="section-header">
                  <div>
                    <h2 className="t-h2">Activity log</h2>
                    <div
                      className="t-small"
                      style={{ color: "var(--muted-2)", marginTop: 2 }}
                    >
                      Every row from the HR Activity Log sheet for this employee.
                    </div>
                  </div>
                </div>
                <div className="card" style={{ padding: "4px 20px" }}>
                  <ActivityLog activities={employee.activities} />
                </div>
              </div>
            )}

            {!isHR && (
              <div style={{ marginTop: 32 }}>
                <div className="section-header">
                  <div>
                    <h2 className="t-h2">Signal breakdown</h2>
                    <div
                      className="t-small"
                      style={{ color: "var(--muted-2)", marginTop: 2 }}
                    >
                      Every value in the cycle rolls up from these raw signals.
                    </div>
                  </div>
                </div>
                <div className="card" style={{ padding: "4px 20px" }}>
                  <SignalTable signals={employee.signals} department={employee.department} />
                </div>
              </div>
            )}
          </article>

          <aside style={{ position: "sticky", top: 80 }}>
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="t-micro" style={{ marginBottom: 12 }}>
                This cycle
              </div>
              <MetricRow
                label="Value score"
                value={c ? c.value_score.toFixed(1) : "—"}
                unit="/ 100"
                benchmark={bench.avgValue}
                benchmarkLabel={`dept avg ${bench.avgValue.toFixed(1)}`}
                positive={
                  c && c.value_score >= bench.avgValue ? "up" : "down"
                }
              />
              {isHR ? (
                <MetricRow
                  label="Cost / impacted"
                  value={
                    c?.cost_efficiency != null
                      ? formatCurrency(c.cost_efficiency)
                      : "—"
                  }
                  benchmarkLabel="lower is better"
                />
              ) : (
                <MetricRow
                  label="Contribution"
                  value={c?.roi != null ? `${c.roi.toFixed(2)}x` : "—"}
                  benchmark={bench.avgRoi}
                  benchmarkLabel={
                    bench.avgRoi != null
                      ? `dept avg ${bench.avgRoi.toFixed(2)}x · revenue per $1 salary`
                      : undefined
                  }
                  positive={
                    c?.roi != null && bench.avgRoi != null
                      ? c.roi >= bench.avgRoi
                        ? "up"
                        : "down"
                      : null
                  }
                />
              )}
              <MetricRow
                label="Department rank"
                value={c ? `${c.dept_rank} / ${c.dept_size}` : "—"}
              />
              <MetricRow
                label="Base salary"
                value={formatCurrency(employee.salary)}
                benchmark={bench.avgSalary}
                benchmarkLabel={
                  bench.avgSalary != null
                    ? `dept avg ${formatCurrency(bench.avgSalary)}`
                    : undefined
                }
              />
              {isHR && (
                <MetricRow
                  label="Total cost to company"
                  value={formatCurrency(employee.total_cost_to_company)}
                  benchmarkLabel="base + bonus + equity + benefits"
                />
              )}
              <MetricRow
                label={isHR ? "Activities" : "Signals"}
                value={formatNumber(
                  isHR
                    ? employee.signals.activity_count
                    : Object.keys(employee.signals).length,
                )}
                last
              />
            </div>

            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <div className="t-micro" style={{ marginBottom: 12 }}>
                Comparison column
              </div>
              <div className="t-small" style={{ color: "var(--muted-1)" }}>
                Existing ratings shown for sanity check. Not used in our formula.
              </div>
              <div style={{ marginTop: 12 }}>
                <MetricRow
                  label="Performance score"
                  value={
                    employee.existing_ratings.performance_score != null
                      ? employee.existing_ratings.performance_score.toFixed(0)
                      : "—"
                  }
                  unit={
                    employee.existing_ratings.performance_score != null
                      ? "/ 100"
                      : undefined
                  }
                />
                <MetricRow
                  label="HR rating"
                  value={
                    employee.existing_ratings.performance_rating != null
                      ? employee.existing_ratings.performance_rating.toFixed(1)
                      : "—"
                  }
                  unit={
                    employee.existing_ratings.performance_rating != null
                      ? "/ 5"
                      : undefined
                  }
                  last
                />
              </div>
            </div>

            {peerList.length > 0 && (
              <div className="card" style={{ overflow: "hidden" }}>
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div className="t-micro">
                    Nearest peers · {employee.department}
                  </div>
                </div>
                {peerList.map((p, i) => (
                  <Link
                    key={p.employee_key}
                    href={`/people/${encodeURIComponent(p.employee_key)}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 16px",
                      borderBottom:
                        i < peerList.length - 1
                          ? "1px solid var(--border)"
                          : 0,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <Avatar initials={initialsFromName(p.name)} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {p.name}
                      </div>
                      <div
                        className="t-small"
                        style={{ color: "var(--muted-2)" }}
                      >
                        {p.sub_department ?? p.job_title ?? p.source_ids.activity_id}
                      </div>
                    </div>
                    <div
                      className="t-num-sm"
                      style={{ color: "var(--muted-1)" }}
                    >
                      {p.computed?.value_score.toFixed(0) ?? "—"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function SignalTable({
  signals,
  department,
}: {
  signals: Record<string, number>;
  department: string;
}) {
  const KNOWN_LABELS: Record<string, string> = {
    revenue_generated: "Revenue generated",
    deals_closed: "Deals closed",
    opportunities_created: "Opportunities created",
    meetings_booked: "Meetings booked",
    calls_made: "Calls made",
    emails_sent: "Emails sent",
    tasks_completed: "Tasks completed",
    bugs_fixed: "Bugs fixed",
    pull_requests: "Pull requests",
    code_commits: "Code commits",
    projects_assigned: "Projects assigned",
  };
  const money = new Set(["revenue_generated"]);
  const entries = Object.entries(signals).filter(
    ([, v]) => typeof v === "number" && Number.isFinite(v),
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {entries.map(([k, v], i) => (
        <div
          key={k}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "10px 0",
            borderBottom:
              i < entries.length - 1 ? "1px solid var(--border)" : 0,
          }}
        >
          <span style={{ color: "var(--muted-1)", fontSize: 14 }}>
            {KNOWN_LABELS[k] ?? k}
          </span>
          <span className="t-num-md">
            {money.has(k) ? formatCurrency(v) : formatNumber(v)}
          </span>
        </div>
      ))}
      {entries.length === 0 && (
        <div
          className="t-small"
          style={{
            color: "var(--muted-2)",
            padding: "14px 0",
            textAlign: "center",
          }}
        >
          No signals for {department}.
        </div>
      )}
    </div>
  );
}
