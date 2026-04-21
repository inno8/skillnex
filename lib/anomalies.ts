import type { EmployeeRecord } from "@/lib/types";

export type FlagKey =
  | "missing-salary"
  | "score-vs-rating-mismatch"
  | "low-roi-senior"
  | "underpaid-hi-perf"
  | "top-performer";

export const FLAG_LABELS: Record<FlagKey, string> = {
  "missing-salary": "Missing salary",
  "score-vs-rating-mismatch": "Score vs. rating mismatch",
  "low-roi-senior": "Low ROI · senior",
  "underpaid-hi-perf": "Underpaid · high perf",
  "top-performer": "Top performer",
};

export const FLAG_REASONS: Record<FlagKey, string> = {
  "missing-salary":
    "Activity data exists but no Payroll/Compensation row was joined. ROI cannot be computed.",
  "score-vs-rating-mismatch":
    "Our value score and the existing performance rating diverge by ≥30 points (normalized). Worth investigating.",
  "low-roi-senior":
    "Higher salary band with value score in the bottom half of the department. Scope-of-work conversation candidate.",
  "underpaid-hi-perf":
    "Top-quartile value score paired with below-median salary for the department. Compensation review candidate.",
  "top-performer":
    "Ranked #1 in their department this period. Consider highlighting in calibration.",
};

function medianSalary(rows: EmployeeRecord[]): number | null {
  const salaries = rows
    .map((r) => r.salary)
    .filter((s): s is number => s != null);
  if (salaries.length === 0) return null;
  const sorted = [...salaries].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type Flagged = {
  employee: EmployeeRecord;
  flags: FlagKey[];
};

/**
 * Derive anomaly flags from scored employees. Runs per-department so
 * thresholds are local.
 */
export function deriveFlags(employees: EmployeeRecord[]): Flagged[] {
  const byDept = new Map<string, EmployeeRecord[]>();
  for (const e of employees) {
    const bucket = byDept.get(e.department) ?? [];
    bucket.push(e);
    byDept.set(e.department, bucket);
  }

  const flagsByKey = new Map<string, FlagKey[]>();

  for (const [, list] of byDept) {
    const median = medianSalary(list);
    for (const e of list) {
      const flags: FlagKey[] = [];
      const c = e.computed;

      if (e.salary == null) flags.push("missing-salary");

      if (c) {
        // Score disagrees with existing rating
        const existing100 =
          e.existing_ratings.performance_score != null
            ? e.existing_ratings.performance_score
            : e.existing_ratings.performance_rating != null
              ? (e.existing_ratings.performance_rating / 5) * 100
              : null;
        if (existing100 != null && Math.abs(c.value_score - existing100) >= 30) {
          flags.push("score-vs-rating-mismatch");
        }

        // Top performer in dept
        if (c.dept_rank === 1 && c.dept_size > 1) {
          flags.push("top-performer");
        }

        // Underpaid high-perf: top quartile score, salary below dept median
        if (
          median != null &&
          e.salary != null &&
          c.dept_rank <= Math.ceil(c.dept_size / 4) &&
          e.salary < median
        ) {
          flags.push("underpaid-hi-perf");
        }

        // Low ROI senior: salary above dept median, rank in bottom half
        if (
          median != null &&
          e.salary != null &&
          e.salary > median &&
          c.dept_rank > c.dept_size / 2
        ) {
          flags.push("low-roi-senior");
        }
      }

      flagsByKey.set(e.employee_key, flags);
    }
  }

  return employees.map((e) => ({
    employee: e,
    flags: flagsByKey.get(e.employee_key) ?? [],
  }));
}

export function flaggedOnly(employees: EmployeeRecord[]): Flagged[] {
  // Exclude "top-performer" (positive signal) from the anomaly count,
  // since the dashboard's "Anomalies" strip is about items needing review.
  const ANOMALY_ONLY: FlagKey[] = [
    "missing-salary",
    "score-vs-rating-mismatch",
    "low-roi-senior",
    "underpaid-hi-perf",
  ];
  return deriveFlags(employees)
    .map((f) => ({
      ...f,
      flags: f.flags.filter((k) => ANOMALY_ONLY.includes(k)),
    }))
    .filter((f) => f.flags.length > 0);
}

export function groupByFlag(flagged: Flagged[]): Record<FlagKey, Flagged[]> {
  const out: Record<string, Flagged[]> = {};
  for (const f of flagged) {
    for (const k of f.flags) {
      if (!out[k]) out[k] = [];
      out[k].push(f);
    }
  }
  return out as Record<FlagKey, Flagged[]>;
}
