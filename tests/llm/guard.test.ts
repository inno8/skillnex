import { describe, expect, it } from "vitest";

import { guardNarrative } from "@/lib/llm/guard";
import type { AnalyzeInput, NarrativeOutput } from "@/lib/llm/types";

function input(overrides?: Partial<AnalyzeInput>): AnalyzeInput {
  return {
    employee: {
      name: "Jane Doe",
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
    ...overrides,
  };
}

function n(overrides: Partial<NarrativeOutput>): NarrativeOutput {
  return {
    summary: "",
    strengths: [],
    watch_items: [],
    review_paragraph: "",
    generated_at: "2026-04-24T10:00:00.000Z",
    model: "test",
    mode: "mock",
    ...overrides,
  };
}

describe("guardNarrative", () => {
  it("passes when narrative only cites input numbers", () => {
    const res = guardNarrative(
      n({
        summary:
          "Jane ranked 1 of 50 with a value score of 100 and contribution of 0.54x.",
        review_paragraph:
          "Revenue generated reached $62K across 4 closed deals. Department average contribution: 0.38x.",
      }),
      input(),
    );
    expect(res.ok).toBe(true);
  });

  it("allows small integers unconditionally (counts, ordinals)", () => {
    const res = guardNarrative(
      n({
        review_paragraph:
          "Jane is 1 of 3 people we flagged. She had 7 opportunities.",
      }),
      input(),
    );
    expect(res.ok).toBe(true);
  });

  it("allows calendar years", () => {
    const res = guardNarrative(
      n({ review_paragraph: "This cycle covers Q1 2026. Prepared April 2026." }),
      input(),
    );
    expect(res.ok).toBe(true);
  });

  it("rejects an invented revenue figure", () => {
    const res = guardNarrative(
      n({
        review_paragraph: "Jane generated $880,000 in revenue this cycle.",
      }),
      input(),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.inventedNumbers).toContain(880000);
      expect(res.offendingFields).toContain("review_paragraph");
    }
  });

  it("rejects an invented department average", () => {
    const res = guardNarrative(
      n({
        summary:
          "Contribution of 0.54x against a department average of 2.1x.",
      }),
      input(),
    );
    expect(res.ok).toBe(false);
  });

  it("tolerates K/M/$ formatting of the same number", () => {
    const res = guardNarrative(
      n({ review_paragraph: "Revenue: $62K. Salary: $115,000." }),
      input(),
    );
    expect(res.ok).toBe(true);
  });

  it("allows standard scale denominators (/100, /5)", () => {
    const res = guardNarrative(
      n({
        review_paragraph:
          "A value score of 89.9/100 and an HR rating of 3.0/5 this cycle.",
      }),
      input({
        computed: {
          value_score: 89.9,
          roi: null,
          cost_efficiency: null,
          dept_rank: 2,
          dept_size: 50,
        },
        existing_ratings: { performance_score: null, performance_rating: 3.0 },
      }),
    );
    expect(res.ok).toBe(true);
  });

  it("accepts simple arithmetic between input numbers (pct diff)", () => {
    // (0.54 - 0.38) / 0.38 * 100 ≈ 42.1 — a valid derivation
    const res = guardNarrative(
      n({
        review_paragraph:
          "Contribution of 0.54x exceeds the department average of 0.38x by 42.1%.",
      }),
      input(),
    );
    expect(res.ok).toBe(true);
  });

  it("accepts absolute differences between input numbers", () => {
    // 115000 - 92000 = 23000 — valid derivation
    const res = guardNarrative(
      n({
        review_paragraph:
          "Salary of $115,000 sits $23,000 above the department median of $92,000.",
      }),
      input(),
    );
    expect(res.ok).toBe(true);
  });

  it("does not misread letters after a digit as a multiplier suffix", () => {
    // Regression: " b" in " bugs" should not be read as 9 billion.
    const res = guardNarrative(
      n({ review_paragraph: "Bugs fixed this period: 9 bugs across 3 repos." }),
      input(),
    );
    expect(res.ok).toBe(true);
  });

  it("catches invented numbers in strengths list", () => {
    const res = guardNarrative(
      n({ strengths: ["Revenue of $999K exceeded plan."] }),
      input(),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.offendingFields[0]).toMatch(/strengths/);
  });
});
