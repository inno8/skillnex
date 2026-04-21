import { describe, expect, it } from "vitest";

import { engineeringRawValue } from "@/lib/metrics/engineering";
import { hrActivityImpact } from "@/lib/metrics/hr";
import { salesRawValue } from "@/lib/metrics/sales";
import { scoreEmployees } from "@/lib/metrics";
import type { EmployeeRecord, HRActivity } from "@/lib/types";

function makeEmployee(partial: Partial<EmployeeRecord>): EmployeeRecord {
  return {
    employee_key: "test|sales",
    source_ids: { activity_id: "T001", payroll_id: "EMP-T001" },
    name: "Test",
    department: "Sales",
    sub_department: null,
    job_title: null,
    level: null,
    region: null,
    salary: 80000,
    bonus: null,
    equity: null,
    total_cost_to_company: 80000,
    overtime_hours: null,
    hire_date: null,
    location: null,
    signals: {},
    activities: null,
    existing_ratings: { performance_score: null, performance_rating: null },
    computed: null,
    narrative: null,
    snapshot_date_range: { from: "2026-03-01", to: "2026-03-05" },
    ...partial,
  };
}

describe("salesRawValue", () => {
  it("weights revenue primarily, with pipeline bonuses", () => {
    const { raw, breakdown } = salesRawValue({
      revenue_generated: 50000,
      deals_closed: 2,
      opportunities_created: 5,
      meetings_booked: 10,
    });
    expect(breakdown.revenue).toBe(50000);
    expect(breakdown.deals).toBe(30000);
    expect(breakdown.opportunities).toBe(10000);
    expect(breakdown.meetings).toBe(3000);
    expect(raw).toBe(93000);
  });

  it("calls_made and emails_sent are not weighted", () => {
    const a = salesRawValue({ revenue_generated: 1000 });
    const b = salesRawValue({ revenue_generated: 1000, calls_made: 500, emails_sent: 1000 });
    expect(a.raw).toBe(b.raw);
  });

  it("zero signals produce zero raw value", () => {
    expect(salesRawValue({}).raw).toBe(0);
  });
});

describe("engineeringRawValue", () => {
  it("weights bugs and PRs above tasks", () => {
    const { raw, breakdown } = engineeringRawValue({
      tasks_completed: 10,
      bugs_fixed: 5,
      pull_requests: 3,
      code_commits: 20,
      projects_assigned: 2,
    });
    expect(breakdown.tasks).toBe(5000);
    expect(breakdown.bugs).toBe(7500);
    expect(breakdown.pull_requests).toBe(6000);
    expect(breakdown.commits).toBe(2000);
    expect(breakdown.projects).toBe(6000);
    expect(raw).toBe(26500);
  });

  it("Performance_Score is not an input", () => {
    // Engineering raw value takes only a signals record — performance_score
    // is stored separately. Verify by providing it and seeing no effect.
    const a = engineeringRawValue({ tasks_completed: 5 });
    const b = engineeringRawValue({
      tasks_completed: 5,
      performance_score: 99,
    });
    expect(a.raw).toBe(b.raw);
  });
});

describe("hrActivityImpact", () => {
  const baseActivity: HRActivity = {
    date: "2026-03-01",
    type: "Test",
    description: "",
    duration_hours: 2,
    employees_impacted: 3,
    priority: "Medium",
    status: "Completed",
  };

  it("priority weights: Critical 2.0, High 1.5, Medium 1.0, Low 0.5", () => {
    const acts: HRActivity[] = [
      { ...baseActivity, priority: "Critical" },
      { ...baseActivity, priority: "High" },
      { ...baseActivity, priority: "Medium" },
      { ...baseActivity, priority: "Low" },
    ];
    const { raw, breakdown } = hrActivityImpact(acts);
    // Each activity: 2h * 3 impacted = 6 before weight.
    expect(breakdown.Critical).toBe(12);
    expect(breakdown.High).toBe(9);
    expect(breakdown.Medium).toBe(6);
    expect(breakdown.Low).toBe(3);
    expect(raw).toBe(30);
  });

  it("employees_impacted=0 is floored to 1, not zeroed", () => {
    const { raw } = hrActivityImpact([
      { ...baseActivity, employees_impacted: 0 },
    ]);
    // 2h * max(0,1) * 1.0 = 2
    expect(raw).toBe(2);
  });

  it("empty activity list produces zero", () => {
    expect(hrActivityImpact([]).raw).toBe(0);
  });
});

describe("scoreEmployees — end to end", () => {
  const employees: EmployeeRecord[] = [
    makeEmployee({
      employee_key: "a|sales",
      name: "A",
      signals: { revenue_generated: 100000, deals_closed: 3 },
    }),
    makeEmployee({
      employee_key: "b|sales",
      name: "B",
      signals: { revenue_generated: 50000, deals_closed: 1 },
    }),
    makeEmployee({
      employee_key: "c|sales",
      name: "C",
      signals: { revenue_generated: 10000, deals_closed: 0 },
    }),
  ];

  it("ranks and normalizes across department", () => {
    scoreEmployees(employees);
    expect(employees[0].computed?.value_score).toBe(100);
    expect(employees[2].computed?.value_score).toBe(0);
    expect(employees[0].computed?.dept_rank).toBe(1);
    expect(employees[2].computed?.dept_rank).toBe(3);
    expect(employees[0].computed?.dept_size).toBe(3);
  });

  it("Sales ROI uses revenue_generated only, not weighted value", () => {
    scoreEmployees(employees);
    // A: revenue 100000 / salary 80000 = 1.25
    expect(employees[0].computed?.roi).toBeCloseTo(100000 / 80000, 4);
  });

  it("HR gets null ROI (by design), cost_efficiency populated", () => {
    const hrEmp = makeEmployee({
      employee_key: "h|hr",
      name: "H",
      department: "HR",
      salary: 85000,
      total_cost_to_company: 100000,
      activities: [
        {
          date: "2026-03-01",
          type: "Onboarding",
          description: "",
          duration_hours: 4,
          employees_impacted: 2,
          priority: "High",
          status: "Completed",
        },
      ],
      signals: {
        activity_count: 1,
        total_hours: 4,
        total_impacted: 2,
        high_priority_count: 1,
      },
    });
    scoreEmployees([hrEmp]);
    expect(hrEmp.computed?.roi).toBeNull();
    expect(hrEmp.computed?.cost_efficiency).toBe(100000 / 2);
  });

  it("null salary → null ROI", () => {
    const noPay = makeEmployee({
      employee_key: "n|sales",
      name: "N",
      salary: null,
      total_cost_to_company: null,
      signals: { revenue_generated: 30000 },
    });
    scoreEmployees([noPay]);
    expect(noPay.computed?.roi).toBeNull();
    // value_score still computed
    expect(noPay.computed?.value_score).toBe(50);
  });
});
