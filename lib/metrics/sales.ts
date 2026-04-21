import type { EmployeeRecord } from "@/lib/types";

import { SALES_WEIGHTS } from "./config";

export function salesRawValue(signals: Record<string, number>): {
  raw: number;
  breakdown: Record<string, number>;
} {
  const revenue = (signals.revenue_generated ?? 0) * SALES_WEIGHTS.revenue_generated;
  const deals = (signals.deals_closed ?? 0) * SALES_WEIGHTS.deals_closed;
  const opps =
    (signals.opportunities_created ?? 0) * SALES_WEIGHTS.opportunities_created;
  const meetings = (signals.meetings_booked ?? 0) * SALES_WEIGHTS.meetings_booked;
  const raw = revenue + deals + opps + meetings;
  return {
    raw,
    breakdown: {
      revenue,
      deals,
      opportunities: opps,
      meetings,
    },
  };
}

export function salesRoi(employee: EmployeeRecord): number | null {
  if (employee.salary == null || employee.salary <= 0) return null;
  const revenue = employee.signals.revenue_generated ?? 0;
  return revenue / employee.salary;
}
