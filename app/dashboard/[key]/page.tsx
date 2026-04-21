import Link from "next/link";
import { notFound } from "next/navigation";

import { getEmployee } from "@/lib/db";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { EmployeeRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function MetricCard({
  label,
  value,
  sub,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-lg space-y-xs ${
        emphasis ? "border-accent bg-accent-tint/30" : "border-border bg-surface"
      }`}
    >
      <p className="micro">{label}</p>
      <p className="number-lg text-ink">{value}</p>
      {sub && <p className="text-xs text-muted-2">{sub}</p>}
    </div>
  );
}

function ComparisonRow({
  label,
  ours,
  existing,
  scale,
}: {
  label: string;
  ours: number | null | undefined;
  existing: number | null | undefined;
  scale: string;
}) {
  if (existing == null) return null;
  const oursNormalized = ours != null ? ours / 100 : null;
  const existingNormalized =
    scale === "/ 5" && existing != null ? existing / 5 : existing / 100;
  const disagrees =
    oursNormalized != null &&
    existingNormalized != null &&
    Math.abs(oursNormalized - existingNormalized) >= 0.3;
  return (
    <div className="flex items-baseline justify-between py-sm border-b border-border last:border-b-0">
      <div>
        <p className="text-sm text-ink">{label}</p>
        <p className="text-xs text-muted-2">
          Skillnex: {ours != null ? `${formatNumber(ours)} / 100` : "—"}
        </p>
      </div>
      <div className="text-right">
        <p className="number text-ink">
          {existing.toFixed(1)} {scale}
        </p>
        {disagrees && <span className="chip-anomaly mt-xs">Disagrees</span>}
      </div>
    </div>
  );
}

function SalesBreakdown({ employee }: { employee: EmployeeRecord }) {
  const s = employee.signals;
  return (
    <div className="grid grid-cols-2 gap-md text-sm">
      <Row label="Revenue generated" value={formatCurrency(s.revenue_generated)} />
      <Row label="Deals closed" value={formatNumber(s.deals_closed)} />
      <Row label="Opportunities created" value={formatNumber(s.opportunities_created)} />
      <Row label="Meetings booked" value={formatNumber(s.meetings_booked)} />
      <Row label="Calls made" value={formatNumber(s.calls_made)} subtle />
      <Row label="Emails sent" value={formatNumber(s.emails_sent)} subtle />
    </div>
  );
}

function EngineeringBreakdown({ employee }: { employee: EmployeeRecord }) {
  const s = employee.signals;
  return (
    <div className="grid grid-cols-2 gap-md text-sm">
      <Row label="Tasks completed" value={formatNumber(s.tasks_completed)} />
      <Row label="Bugs fixed" value={formatNumber(s.bugs_fixed)} />
      <Row label="Pull requests" value={formatNumber(s.pull_requests)} />
      <Row label="Code commits" value={formatNumber(s.code_commits)} />
      <Row label="Projects assigned" value={formatNumber(s.projects_assigned)} />
    </div>
  );
}

function HRBreakdown({ employee }: { employee: EmployeeRecord }) {
  const s = employee.signals;
  return (
    <div className="grid grid-cols-2 gap-md text-sm">
      <Row label="Total activities" value={formatNumber(s.activity_count)} />
      <Row label="Total hours" value={formatNumber(s.total_hours)} />
      <Row label="Employees impacted" value={formatNumber(s.total_impacted)} />
      <Row
        label="High / critical priority"
        value={formatNumber(s.high_priority_count)}
      />
    </div>
  );
}

function Row({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-xs">
      <span className={`${subtle ? "text-muted-2" : "text-muted-1"}`}>{label}</span>
      <span className={`number ${subtle ? "text-muted-2" : "text-ink"}`}>{value}</span>
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
  const c = employee.computed;
  const isHR = employee.department === "HR";

  return (
    <div className="space-y-3xl">
      <header className="space-y-md">
        <Link
          href="/dashboard"
          className="micro hover:text-accent transition-colors duration-short"
        >
          ← Back to dashboard
        </Link>
        <div className="flex items-baseline justify-between gap-lg flex-wrap">
          <div>
            <h1 className="font-display text-4xl font-medium tracking-tight">
              {employee.name}
            </h1>
            <p className="text-muted-1 mt-xs">
              {employee.department}
              {employee.sub_department && ` · ${employee.sub_department}`}
              {employee.job_title && ` · ${employee.job_title}`}
              {employee.region && ` · ${employee.region}`}
              {employee.location && ` · ${employee.location}`}
            </p>
          </div>
          <div className="text-right text-xs text-muted-2">
            <p>ID: {employee.source_ids.activity_id}</p>
            {employee.source_ids.payroll_id && (
              <p>Payroll: {employee.source_ids.payroll_id}</p>
            )}
            <p>
              Snapshot: {employee.snapshot_date_range.from} →{" "}
              {employee.snapshot_date_range.to}
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-md">
        <MetricCard
          label={isHR ? "Activity Impact" : "Value Score"}
          value={formatNumber(c?.value_score)}
          sub={c ? `Rank ${c.dept_rank} of ${c.dept_size}` : undefined}
          emphasis
        />
        {isHR ? (
          <MetricCard
            label="Cost / Employee Impacted"
            value={
              c?.cost_efficiency != null
                ? formatCurrency(c.cost_efficiency)
                : "—"
            }
            sub="Total cost ÷ total impacted"
          />
        ) : (
          <MetricCard
            label="ROI"
            value={c?.roi != null ? `${c.roi.toFixed(2)}x` : "—"}
            sub="Value ÷ salary"
          />
        )}
        <MetricCard
          label={isHR ? "Total Cost to Company" : "Base Salary"}
          value={formatCurrency(
            isHR ? employee.total_cost_to_company : employee.salary,
          )}
          sub={isHR ? `Base ${formatCurrency(employee.salary)}` : undefined}
        />
        <MetricCard
          label={isHR ? "Hours this period" : "Rank"}
          value={
            isHR
              ? formatNumber(employee.signals.total_hours)
              : c
                ? `#${c.dept_rank}`
                : "—"
          }
          sub={isHR ? `${formatNumber(employee.signals.total_impacted)} impacted` : undefined}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
        <div className="lg:col-span-2 rounded-lg border border-border bg-surface p-xl space-y-lg">
          <div>
            <p className="micro">Signal breakdown</p>
            <h3 className="font-display text-xl font-medium mt-xs">
              What drove this score
            </h3>
          </div>
          {employee.department === "Sales" && (
            <SalesBreakdown employee={employee} />
          )}
          {employee.department === "Engineering" && (
            <EngineeringBreakdown employee={employee} />
          )}
          {isHR && <HRBreakdown employee={employee} />}
        </div>

        <div className="rounded-lg border border-border bg-surface p-xl space-y-md">
          <div>
            <p className="micro">Existing ratings</p>
            <h3 className="font-display text-xl font-medium mt-xs">
              Comparison column
            </h3>
            <p className="text-xs text-muted-2 mt-xs">
              Not used in our calculation. Shown to validate agreement.
            </p>
          </div>
          {employee.existing_ratings.performance_score == null &&
          employee.existing_ratings.performance_rating == null ? (
            <p className="text-sm text-muted-2">No existing ratings provided.</p>
          ) : (
            <div className="space-y-xs">
              <ComparisonRow
                label="Performance score"
                ours={c?.value_score}
                existing={employee.existing_ratings.performance_score}
                scale="/ 100"
              />
              <ComparisonRow
                label="HR rating"
                ours={c?.value_score}
                existing={employee.existing_ratings.performance_rating}
                scale="/ 5"
              />
            </div>
          )}
        </div>
      </section>

      {isHR && employee.activities && employee.activities.length > 0 && (
        <section className="rounded-lg border border-border bg-surface p-xl space-y-lg">
          <div>
            <p className="micro">Activity log</p>
            <h3 className="font-display text-xl font-medium mt-xs">
              {employee.activities.length} activities in this period
            </h3>
          </div>
          <div className="space-y-sm">
            {employee.activities.map((a, idx) => (
              <div
                key={idx}
                className="flex items-baseline gap-md py-sm border-b border-border last:border-b-0"
              >
                <span className="number text-xs text-muted-2 w-[92px] shrink-0">
                  {a.date}
                </span>
                <span
                  className={`text-xs shrink-0 ${
                    a.priority === "Critical"
                      ? "chip-anomaly"
                      : a.priority === "High"
                        ? "chip-anomaly"
                        : "chip-muted"
                  }`}
                >
                  {a.priority}
                </span>
                <span className="text-xs text-muted-1 w-[160px] shrink-0">
                  {a.type}
                </span>
                <span className="text-sm text-ink flex-1">{a.description}</span>
                <span className="number text-xs text-muted-2">
                  {a.duration_hours}h · {a.employees_impacted} impacted
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-dashed border-border bg-paper p-xl">
        <p className="micro">LLM narrative</p>
        <p className="text-sm text-muted-1 mt-xs">
          The review-ready narrative is generated in Day 4 of the build plan.
          Metrics above are deterministic; the narrative layer will cite the
          same numbers — never invent new ones.
        </p>
      </section>
    </div>
  );
}
