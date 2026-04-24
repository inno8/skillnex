import { describe, expect, it } from "vitest";

import { guardNarrative } from "@/lib/llm/guard";
import { mockNarrative } from "@/lib/llm/mock";
import type { AnalyzeInput } from "@/lib/llm/types";

function salesInput(): AnalyzeInput {
  return {
    employee: {
      name: "Sophia Martinez",
      department: "Sales",
      sub_department: null,
      job_title: null,
      region: "Europe",
      salary: 115000,
      total_cost_to_company: 120000,
    },
    signals: {
      revenue_generated: 62000,
      deals_closed: 4,
      opportunities_created: 7,
      meetings_booked: 12,
      calls_made: 60,
      emails_sent: 160,
    },
    computed: {
      value_score: 100,
      roi: 0.54,
      cost_efficiency: null,
      dept_rank: 1,
      dept_size: 50,
    },
    existing_ratings: { performance_score: null, performance_rating: 4.7 },
    dept_context: {
      avg_value_score: 38,
      avg_roi: 0.38,
      median_salary: 92000,
      value_vs_avg_diff: 62,
      value_vs_avg_ratio: 2.63,
      roi_vs_avg_ratio: 1.42,
      roi_vs_avg_pct_diff: 42.1,
      rank_percentile: 0.02,
      top_percent_int: 2,
      percentile_int: 98,
    },
    flags: ["top-performer"],
  };
}

function hrInput(): AnalyzeInput {
  return {
    employee: {
      name: "Keisha Daniels",
      department: "HR",
      sub_department: "Payroll",
      job_title: "Payroll Manager",
      region: null,
      salary: 98000,
      total_cost_to_company: 125000,
    },
    signals: {
      activity_count: 5,
      total_hours: 18,
      total_impacted: 647,
      high_priority_count: 3,
      critical_priority_count: 1,
    },
    computed: {
      value_score: 100,
      roi: null,
      cost_efficiency: 193.2,
      dept_rank: 1,
      dept_size: 11,
    },
    existing_ratings: { performance_score: null, performance_rating: null },
    dept_context: {
      avg_value_score: 45,
      avg_roi: null,
      median_salary: 90000,
      value_vs_avg_diff: 55,
      value_vs_avg_ratio: 2.22,
      roi_vs_avg_ratio: null,
      roi_vs_avg_pct_diff: null,
      rank_percentile: 0.09,
      top_percent_int: 9,
      percentile_int: 91,
    },
    flags: ["top-performer"],
  };
}

describe("mockNarrative", () => {
  it("produces a non-empty narrative for Sales", () => {
    const n = mockNarrative(salesInput());
    expect(n.summary.length).toBeGreaterThan(20);
    expect(n.review_paragraph.length).toBeGreaterThan(50);
    expect(n.mode).toBe("mock");
  });

  it("Sales narrative passes the guard (no invented numbers)", () => {
    const input = salesInput();
    const n = mockNarrative(input);
    const g = guardNarrative(n, input);
    if (!g.ok) {
      console.log("Offending:", g);
      console.log("Narrative:", n);
    }
    expect(g.ok).toBe(true);
  });

  it("HR narrative passes the guard", () => {
    const input = hrInput();
    const n = mockNarrative(input);
    const g = guardNarrative(n, input);
    if (!g.ok) {
      console.log("Offending:", g);
      console.log("Narrative:", n);
    }
    expect(g.ok).toBe(true);
  });

  it("HR narrative uses Activity Impact framing, not ROI", () => {
    const n = mockNarrative(hrInput());
    expect(n.review_paragraph.toLowerCase()).toContain("activity impact");
    expect(n.review_paragraph.toLowerCase()).not.toMatch(/\broi\b/);
  });

  it("does not recommend HR actions", () => {
    const banned = /\b(fire|promote|raise|stretch assignment|PIP)\b/i;
    for (const input of [salesInput(), hrInput()]) {
      const n = mockNarrative(input);
      expect(n.review_paragraph).not.toMatch(banned);
      expect(n.summary).not.toMatch(banned);
    }
  });
});
