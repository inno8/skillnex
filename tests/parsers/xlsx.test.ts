import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseSkillnexWorkbook } from "@/lib/parsers";
import { detectShape } from "@/lib/parsers/schema";

const ROOT = resolve(__dirname, "../..");
const DEMO_XLSX = resolve(ROOT, "public/samples/skillnex-demo.xlsx");
const HR_XLSX = resolve(ROOT, "public/samples/skillnex_HR_Sample_Data.xlsx");

function loadBuffer(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path));
}

describe("detectShape", () => {
  it("detects Shape A when required sheets present", () => {
    expect(
      detectShape(["Sales Team", "Engineering", "Payroll data", "HR team"]),
    ).toBe("A");
  });

  it("detects Shape B when required sheets present", () => {
    expect(
      detectShape(["HR Activity Log", "Employee Compensation", "Summary Dashboard"]),
    ).toBe("B");
  });

  it("returns null when neither shape matches", () => {
    expect(detectShape(["Random", "Sheet"])).toBeNull();
  });
});

describe("parseSkillnexWorkbook — Shape A (skillnex-demo.xlsx)", () => {
  const result = parseSkillnexWorkbook(loadBuffer(DEMO_XLSX));

  it("detects Shape A", () => {
    expect(result.shape).toBe("A");
  });

  it("produces 50 Sales + 50 Engineering + HR employees", () => {
    const sales = result.employees.filter((e) => e.department === "Sales");
    const eng = result.employees.filter((e) => e.department === "Engineering");
    expect(sales.length).toBe(50);
    expect(eng.length).toBe(50);
    // HR rows from HR team short sheet — 10 unique
    const hr = result.employees.filter((e) => e.department === "HR");
    expect(hr.length).toBeGreaterThan(0);
  });

  it("has 100% salary coverage for Sales + Engineering after regeneration", () => {
    const salesEng = result.employees.filter(
      (e) => e.department === "Sales" || e.department === "Engineering",
    );
    const withSalary = salesEng.filter((e) => e.salary != null);
    expect(withSalary.length).toBe(100);
    expect(result.unjoined_names).toEqual([]);
  });

  it("preserves source activity IDs", () => {
    const first = result.employees[0];
    expect(first.source_ids.activity_id).toMatch(/^(SR|EN|HR)/);
    expect(first.source_ids.payroll_id).toMatch(/^EMP/);
  });

  it("includes aggregated signals for Sales", () => {
    const sales = result.employees.find((e) => e.department === "Sales")!;
    expect(sales.signals.revenue_generated).toBeGreaterThan(0);
    expect(sales.signals.deals_closed).toBeGreaterThanOrEqual(1);
  });

  it("includes Performance_Score on Engineering employees", () => {
    const eng = result.employees.find((e) => e.department === "Engineering")!;
    expect(eng.existing_ratings.performance_score).not.toBeNull();
    expect(eng.existing_ratings.performance_score).toBeGreaterThan(0);
  });

  it("includes Performance_Rating from Payroll", () => {
    const withRating = result.employees.filter(
      (e) => e.existing_ratings.performance_rating != null,
    );
    expect(withRating.length).toBeGreaterThan(0);
  });

  it("date range covers March 1-5 2026", () => {
    expect(result.date_range.from).toBe("2026-03-01");
    expect(result.date_range.to).toBe("2026-03-05");
  });
});

describe("parseSkillnexWorkbook — Shape B (skillnex_HR_Sample_Data.xlsx)", () => {
  const result = parseSkillnexWorkbook(loadBuffer(HR_XLSX));

  it("detects Shape B", () => {
    expect(result.shape).toBe("B");
  });

  it("produces 11 unique HR employees from 55 activity rows", () => {
    expect(result.employees.length).toBe(11);
    expect(result.employees.every((e) => e.department === "HR")).toBe(true);
  });

  it("preserves sub-department from HR Activity Log", () => {
    const depts = new Set(result.employees.map((e) => e.sub_department));
    expect(depts.has("Talent Acquisition")).toBe(true);
    expect(depts.has("HR Business Partner")).toBe(true);
  });

  it("joins all employees to Compensation (0 unjoined)", () => {
    expect(result.unjoined_names).toEqual([]);
    expect(result.employees.every((e) => e.salary != null)).toBe(true);
  });

  it("computes Total_Cost_to_Company when formula cells were blank", () => {
    // Every employee has a computed total_cost_to_company > base salary
    for (const e of result.employees) {
      expect(e.total_cost_to_company).not.toBeNull();
      expect(e.total_cost_to_company!).toBeGreaterThan(e.salary!);
    }
  });

  it("preserves the activity log per employee", () => {
    const jordan = result.employees.find((e) =>
      e.name.startsWith("Jordan"),
    );
    expect(jordan).toBeDefined();
    expect(jordan!.activities).not.toBeNull();
    expect(jordan!.activities!.length).toBeGreaterThanOrEqual(3);
    expect(jordan!.signals.activity_count).toBe(jordan!.activities!.length);
  });

  it("preserves unicode names without mojibake", () => {
    const tomas = result.employees.find((e) => e.name.includes("Tom"));
    expect(tomas).toBeDefined();
    // Either Tomás (correct) or Tom�s (mojibake from the source file).
    // The parser should not corrupt it further.
    expect(tomas!.name).toMatch(/Tom.+s Rivera/);
  });

  it("captures priority signal from activity log", () => {
    const hasHighPriority = result.employees.some(
      (e) => (e.signals.high_priority_count ?? 0) > 0,
    );
    expect(hasHighPriority).toBe(true);
  });
});
