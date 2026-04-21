import Link from "next/link";

import { latestUpload, listEmployees } from "@/lib/db";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function DeptSection({
  dept,
  rows,
}: {
  dept: string;
  rows: ReturnType<typeof listEmployees>;
}) {
  if (rows.length === 0) return null;
  const isHR = dept === "HR";

  return (
    <section className="space-y-md">
      <div className="flex items-baseline gap-md">
        <h2 className="font-display text-2xl font-medium">{dept}</h2>
        <p className="text-sm text-muted-1">
          {rows.length} {rows.length === 1 ? "employee" : "employees"}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper">
            <tr className="text-left text-muted-1 border-b border-border">
              <th className="px-lg py-md font-medium w-10">#</th>
              <th className="px-lg py-md font-medium">Employee</th>
              {isHR ? (
                <th className="px-lg py-md font-medium text-right">
                  Impact Score
                </th>
              ) : (
                <>
                  <th className="px-lg py-md font-medium text-right">
                    Value Score
                  </th>
                  <th className="px-lg py-md font-medium text-right">ROI</th>
                </>
              )}
              <th className="px-lg py-md font-medium text-right">
                {isHR ? "Activities" : "Salary"}
              </th>
              <th className="px-lg py-md font-medium text-right">
                Existing rating
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const c = e.computed;
              const rating =
                e.existing_ratings.performance_rating != null
                  ? `${e.existing_ratings.performance_rating.toFixed(1)} / 5`
                  : e.existing_ratings.performance_score != null
                    ? `${e.existing_ratings.performance_score.toFixed(0)} / 100`
                    : "—";
              return (
                <tr
                  key={e.employee_key}
                  className="border-b border-border last:border-b-0 hover:bg-paper transition-colors duration-short"
                >
                  <td className="px-lg py-md text-muted-2 number">
                    {c?.dept_rank ?? "—"}
                  </td>
                  <td className="px-lg py-md">
                    <Link
                      href={`/dashboard/${encodeURIComponent(e.employee_key)}`}
                      className="text-ink hover:text-accent underline-offset-4 hover:underline font-medium"
                    >
                      {e.name}
                    </Link>
                    <div className="text-xs text-muted-2">
                      {e.sub_department ?? e.region ?? e.job_title ?? "—"}
                      {e.salary == null && (
                        <span className="chip-muted ml-sm">No salary data</span>
                      )}
                    </div>
                  </td>
                  {isHR ? (
                    <td className="px-lg py-md text-right number">
                      {formatNumber(c?.value_score)}
                    </td>
                  ) : (
                    <>
                      <td className="px-lg py-md text-right number">
                        {formatNumber(c?.value_score)}
                      </td>
                      <td className="px-lg py-md text-right number">
                        {c?.roi != null ? `${c.roi.toFixed(2)}x` : "—"}
                      </td>
                    </>
                  )}
                  <td className="px-lg py-md text-right number text-muted-1">
                    {isHR
                      ? formatNumber(e.signals.activity_count)
                      : formatCurrency(e.salary)}
                  </td>
                  <td className="px-lg py-md text-right text-muted-1">
                    {rating}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const employees = listEmployees();
  const upload = latestUpload();
  const byDept = new Map<string, typeof employees>();
  for (const e of employees) {
    const bucket = byDept.get(e.department) ?? [];
    bucket.push(e);
    byDept.set(e.department, bucket);
  }

  if (employees.length === 0) {
    return (
      <div className="space-y-xl max-w-prose">
        <p className="micro">Dashboard</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          No data yet.
        </h1>
        <p className="text-muted-1 leading-relaxed">
          Upload a workbook on the{" "}
          <Link href="/" className="underline hover:text-accent">
            home page
          </Link>{" "}
          to populate this dashboard.
        </p>
      </div>
    );
  }

  const deptOrder = ["Sales", "Engineering", "HR"];
  const sortedDepts = [...byDept.keys()].sort(
    (a, b) => deptOrder.indexOf(a) - deptOrder.indexOf(b),
  );

  return (
    <div className="space-y-3xl">
      <header className="space-y-md">
        <p className="micro">Dashboard</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {employees.length} employees · {byDept.size} departments
        </h1>
        {upload && (
          <p className="text-sm text-muted-1">
            Last upload:{" "}
            <span className="font-mono text-xs">{upload.filename}</span>{" "}
            (Shape {upload.shape}) — {upload.employee_count} rows scored.{" "}
            {upload.unjoined_names.length > 0 && (
              <span className="chip-anomaly">
                {upload.unjoined_names.length} without salary
              </span>
            )}
          </p>
        )}
      </header>
      {sortedDepts.map((dept) => (
        <DeptSection key={dept} dept={dept} rows={byDept.get(dept) ?? []} />
      ))}
    </div>
  );
}
