/**
 * Deterministic narrative generator. No LLM call.
 *
 * Used when ANTHROPIC_API_KEY is missing or SKILLNEX_MOCK_LLM=true. Produces
 * a believable review paragraph templated from the employee record so the
 * demo still runs offline and tests can run without network.
 */

import type { AnalyzeInput, NarrativeOutput } from "./types";

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  // Only shorten to K when the rounding loss is <1% (≥$100K range).
  // Below that, print exact dollars so the guard can match precisely.
  if (abs >= 100_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function describeExistingRating(input: AnalyzeInput): {
  disagrees: boolean;
  line: string;
} {
  const er = input.existing_ratings;
  const vs = input.computed.value_score;
  // Cite the raw rating values so the guard can trivially match them in the input.
  if (er.performance_score != null) {
    const diff = Math.abs(vs - er.performance_score);
    if (diff >= 30) {
      return {
        disagrees: true,
        line: `Rating disagrees with data: existing performance score of ${er.performance_score}/100 against a computed value of ${vs.toFixed(0)}/100.`,
      };
    }
    return {
      disagrees: false,
      line: `Computed score and existing performance score of ${er.performance_score}/100 are in agreement.`,
    };
  }
  if (er.performance_rating != null) {
    const diff = Math.abs(vs - (er.performance_rating / 5) * 100);
    if (diff >= 30) {
      return {
        disagrees: true,
        line: `Rating disagrees with data: HR rating of ${er.performance_rating.toFixed(1)}/5 against a computed value of ${vs.toFixed(0)}/100.`,
      };
    }
    return {
      disagrees: false,
      line: `Computed score and HR rating of ${er.performance_rating.toFixed(1)}/5 are in agreement.`,
    };
  }
  return { disagrees: false, line: "" };
}

export function mockNarrative(input: AnalyzeInput): NarrativeOutput {
  const fn = firstName(input.employee.name);
  const dept = input.employee.department;
  const isHR = dept === "HR";
  const c = input.computed;
  const dc = input.dept_context;
  const salary = input.employee.salary;
  const s = input.signals;
  const existing = describeExistingRating(input);

  const strengths: string[] = [];
  const watch: string[] = [];

  if (dept === "Sales") {
    const rev = s.revenue_generated ?? 0;
    if (dc.median_salary != null && rev > 1.5 * (dc.median_salary ?? 0)) {
      strengths.push(
        `Revenue generated ${fmtMoney(rev)} exceeded department reference level.`,
      );
    }
    if ((s.deals_closed ?? 0) >= 3)
      strengths.push(`Closed ${s.deals_closed} deals this period.`);
    if (c.roi != null && dc.avg_roi != null && c.roi < dc.avg_roi * 0.5) {
      watch.push(
        `Contribution ratio ${c.roi.toFixed(2)}x is below half the department average of ${dc.avg_roi.toFixed(2)}x.`,
      );
    }
  } else if (dept === "Engineering") {
    if ((s.pull_requests ?? 0) >= 10)
      strengths.push(
        `${s.pull_requests} pull requests merged this period.`,
      );
    if ((s.bugs_fixed ?? 0) >= 8)
      strengths.push(`${s.bugs_fixed} bugs fixed this period.`);
    if (c.roi != null && dc.avg_roi != null && c.roi < dc.avg_roi * 0.5) {
      watch.push(
        `Contribution ratio ${c.roi.toFixed(2)}x is below half the department average of ${dc.avg_roi.toFixed(2)}x.`,
      );
    }
  } else if (isHR) {
    if ((s.activity_count ?? 0) >= 4)
      strengths.push(`${s.activity_count} distinct activities logged this period.`);
    if ((s.total_impacted ?? 0) >= 20)
      strengths.push(
        `${s.total_impacted} employees impacted across the period.`,
      );
    if (c.cost_efficiency != null && c.cost_efficiency > 5000)
      watch.push(
        `Cost-per-impacted of ${fmtMoney(c.cost_efficiency)} is high — fewer employees served per dollar of total compensation.`,
      );
  }

  if (salary == null)
    watch.push("No compensation row matched this employee. Contribution cannot be computed.");

  if (existing.disagrees) {
    watch.push(existing.line);
  }

  const summary = isHR
    ? `${fn} logged ${s.activity_count ?? 0} activities across ${s.total_hours ?? 0} hours, impacting ${s.total_impacted ?? 0} employees. Ranked ${c.dept_rank} of ${c.dept_size} in ${dept} on activity impact.`
    : `${fn} ranked ${c.dept_rank} of ${c.dept_size} in ${dept} with a value score of ${c.value_score.toFixed(1)}/100${c.roi != null ? ` and a contribution ratio of ${c.roi.toFixed(2)}x` : ""}. Department average value: ${dc.avg_value_score.toFixed(1)}.`;

  const cmpLine = existing.line;

  const review_paragraph = isHR
    ? [
        `${fn} logged ${s.activity_count ?? 0} activities totaling ${s.total_hours ?? 0} hours this period, with ${s.total_impacted ?? 0} employees impacted across the work.`,
        c.cost_efficiency != null
          ? `Cost-per-impacted came in at ${fmtMoney(c.cost_efficiency)}.`
          : "",
        `Activity Impact Score of ${c.value_score.toFixed(1)}/100 places ${fn} at rank ${c.dept_rank} of ${c.dept_size} in ${dept}.`,
        cmpLine,
      ]
        .filter(Boolean)
        .join(" ")
    : [
        `${fn} recorded a value score of ${c.value_score.toFixed(1)}/100 this period, ranking ${c.dept_rank} of ${c.dept_size} in ${dept}.`,
        c.roi != null
          ? `Contribution ratio landed at ${c.roi.toFixed(2)}x, compared to a department average of ${dc.avg_roi?.toFixed(2) ?? "—"}x.`
          : salary == null
            ? "No salary on file, so contribution ratio could not be computed."
            : "",
        dept === "Sales" && s.revenue_generated != null
          ? `Revenue generated reached ${fmtMoney(s.revenue_generated)} across ${s.deals_closed ?? 0} closed deals.`
          : dept === "Engineering" && s.tasks_completed != null
            ? `Output included ${s.tasks_completed} tasks, ${s.pull_requests ?? 0} pull requests, and ${s.bugs_fixed ?? 0} bugs fixed.`
            : "",
        cmpLine,
      ]
        .filter(Boolean)
        .join(" ");

  return {
    summary,
    strengths,
    watch_items: watch,
    review_paragraph,
    generated_at: new Date().toISOString(),
    model: "mock-v1",
    mode: "mock",
  };
}
