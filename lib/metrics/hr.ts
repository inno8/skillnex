import type { EmployeeRecord, HRActivity } from "@/lib/types";

import { HR_PRIORITY_WEIGHTS } from "./config";

export function hrActivityImpact(activities: HRActivity[]): {
  raw: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };
  let raw = 0;
  for (const a of activities) {
    const weight = HR_PRIORITY_WEIGHTS[a.priority];
    const impactMult = Math.max(a.employees_impacted, 1);
    const contribution = a.duration_hours * impactMult * weight;
    raw += contribution;
    breakdown[a.priority] = (breakdown[a.priority] ?? 0) + contribution;
  }
  return { raw, breakdown };
}

export function hrCostEfficiency(employee: EmployeeRecord): number | null {
  const totalImpacted = employee.signals.total_impacted ?? 0;
  const cost = employee.total_cost_to_company;
  if (cost == null || cost <= 0) return null;
  if (totalImpacted === 0) return null;
  return cost / totalImpacted;
}
