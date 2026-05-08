/**
 * Build the "This cycle" + "Comparison column" metric groups for the
 * review PDF. Mirrors the logic in app/(app)/people/[key]/page.tsx so
 * the printable copy matches the on-screen sidebar 1:1 — same labels,
 * same units, same HR vs non-HR branching, same dept averages.
 *
 * Kept out of lib/pdf/review.ts to keep that file focused on rendering
 * and to make this Skillnex-domain transformation reusable from any
 * future surface (printed batch reports, scheduled email digests, etc.).
 */
import type { ReviewMetricGroup } from "./review";
import { listEmployees } from "@/lib/db";
import type { EmployeeRecord } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Benchmarks = {
  avgValue: number;
  avgRoi: number | null;
  avgSalary: number | null;
};

function computeBenchmarks(tenant_id: string, dept: string, cycle_label: string): Benchmarks {
  const list = listEmployees(tenant_id, { department: dept, cycle_label });
  const avgValue =
    list.reduce((s, e) => s + (e.computed?.value_score ?? 0), 0) / Math.max(list.length, 1);
  const rois = list.map((e) => e.computed?.roi).filter((r): r is number => r != null);
  const avgRoi = rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null;
  const salaries = list.map((e) => e.salary).filter((s): s is number => s != null);
  const avgSalary =
    salaries.length > 0 ? salaries.reduce((a, b) => a + b, 0) / salaries.length : null;
  return { avgValue, avgRoi, avgSalary };
}

export function buildReviewMetricGroups(
  tenant_id: string,
  employee: EmployeeRecord,
  cycle_label: string,
): ReviewMetricGroup[] {
  const c = employee.computed;
  const isHR = employee.department === "HR";
  const bench = computeBenchmarks(tenant_id, employee.department, cycle_label);

  const thisCycle: ReviewMetricGroup = {
    title: "This cycle",
    rows: [
      {
        label: "Value score",
        value: c ? c.value_score.toFixed(1) : "—",
        unit: "/ 100",
        caption: `dept avg ${bench.avgValue.toFixed(1)}`,
        tone: c ? (c.value_score >= bench.avgValue ? "positive" : "negative") : null,
      },
      isHR
        ? {
            label: "Cost / impacted",
            value: c?.cost_efficiency != null ? formatCurrency(c.cost_efficiency) : "—",
            caption: "lower is better",
          }
        : {
            label: "Contribution",
            value: c?.roi != null ? `${c.roi.toFixed(2)}x` : "—",
            caption:
              bench.avgRoi != null
                ? `dept avg ${bench.avgRoi.toFixed(2)}x · revenue per $1 salary`
                : undefined,
            tone:
              c?.roi != null && bench.avgRoi != null
                ? c.roi >= bench.avgRoi
                  ? "positive"
                  : "negative"
                : null,
          },
      {
        label: "Department rank",
        value: c ? `${c.dept_rank} / ${c.dept_size}` : "—",
      },
      {
        label: "Base salary",
        value: formatCurrency(employee.salary),
        caption:
          bench.avgSalary != null ? `dept avg ${formatCurrency(bench.avgSalary)}` : undefined,
      },
    ],
  };

  if (isHR) {
    thisCycle.rows.push({
      label: "Total cost to company",
      value: formatCurrency(employee.total_cost_to_company),
      caption: "base + bonus + equity + benefits",
    });
  }

  thisCycle.rows.push({
    label: isHR ? "Activities" : "Signals",
    value: formatNumber(
      isHR ? employee.signals.activity_count : Object.keys(employee.signals).length,
    ),
  });

  const comparison: ReviewMetricGroup = {
    title: "Comparison column",
    blurb: "Existing ratings shown for sanity check. Not used in our formula.",
    rows: [
      {
        label: "Performance score",
        value:
          employee.existing_ratings.performance_score != null
            ? employee.existing_ratings.performance_score.toFixed(0)
            : "—",
        unit: employee.existing_ratings.performance_score != null ? "/ 100" : undefined,
      },
      {
        label: "HR rating",
        value:
          employee.existing_ratings.performance_rating != null
            ? employee.existing_ratings.performance_rating.toFixed(1)
            : "—",
        unit: employee.existing_ratings.performance_rating != null ? "/ 5" : undefined,
      },
    ],
  };

  return [thisCycle, comparison];
}
