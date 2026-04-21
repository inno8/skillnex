import type { EmployeeRecord } from "@/lib/types";

/**
 * Generic fallback for unknown departments.
 * Sum of non-cost numeric signals, each min-max normalized within dept first.
 * The caller handles inter-employee normalization; this just gives raw_value.
 */
export function fallbackRawValue(signals: Record<string, number>): {
  raw: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {};
  let raw = 0;
  for (const [k, v] of Object.entries(signals)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    breakdown[k] = v;
    raw += v;
  }
  return { raw, breakdown };
}

export function fallbackRoi(
  employee: EmployeeRecord,
  rawValue: number,
): number | null {
  if (employee.salary == null || employee.salary <= 0) return null;
  return rawValue / employee.salary;
}
