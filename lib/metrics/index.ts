import type { EmployeeRecord } from "@/lib/types";

import { engineeringRawValue, engineeringRoi } from "./engineering";
import { fallbackRawValue, fallbackRoi } from "./fallback";
import { hrActivityImpact, hrCostEfficiency } from "./hr";
import { normalize, rankDescending } from "./normalize";
import { salesRawValue, salesRoi } from "./sales";

type RawOutcome = { raw: number; breakdown: Record<string, number> };

function computeRaw(e: EmployeeRecord): RawOutcome {
  switch (e.department) {
    case "Sales":
      return salesRawValue(e.signals);
    case "Engineering":
      return engineeringRawValue(e.signals);
    case "HR":
      return hrActivityImpact(e.activities ?? []);
    default:
      return fallbackRawValue(e.signals);
  }
}

/**
 * Score employees in-place, grouping by department for normalization.
 * Mutates the `computed` field on each record and returns the same array.
 */
export function scoreEmployees(employees: EmployeeRecord[]): EmployeeRecord[] {
  const byDept = new Map<string, EmployeeRecord[]>();
  for (const e of employees) {
    const bucket = byDept.get(e.department) ?? [];
    bucket.push(e);
    byDept.set(e.department, bucket);
  }

  for (const [dept, list] of byDept) {
    const raws = list.map((e) => computeRaw(e));
    const values = normalize(raws.map((r) => r.raw));
    const ranks = rankDescending(raws.map((r) => r.raw));
    list.forEach((e, i) => {
      let roi: number | null = null;
      let costEff: number | null = null;
      if (dept === "Sales") {
        roi = salesRoi(e);
      } else if (dept === "Engineering") {
        roi = engineeringRoi(e, raws[i].raw);
      } else if (dept === "HR") {
        // HR: no dollar ROI by design. Report cost efficiency instead.
        roi = null;
        costEff = hrCostEfficiency(e);
      } else {
        roi = fallbackRoi(e, raws[i].raw);
      }
      e.computed = {
        value_score: values[i],
        roi,
        cost_efficiency: costEff,
        dept_rank: ranks[i] + 1, // 1-indexed for display
        dept_size: list.length,
        breakdown: raws[i].breakdown,
      };
    });
  }

  return employees;
}

export { normalize, rankDescending } from "./normalize";
