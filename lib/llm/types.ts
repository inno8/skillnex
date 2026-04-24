/**
 * LLM narrative output — the shape HR pastes into a review doc.
 *
 * Kept intentionally narrow. Phase 1 (this session): 4 string fields, strict
 * narration. Phase 2 will add `segments` with metric-annotation anchors to
 * enable hover-to-highlight between narrative and metric rail.
 */

import type { EmployeeRecord } from "@/lib/types";

export type NarrativeOutput = {
  summary: string;
  strengths: string[];
  watch_items: string[];
  review_paragraph: string;
  generated_at: string;
  model: string;
  mode: "mock" | "anthropic";
};

export type AnalyzeInput = {
  employee: {
    name: string;
    department: string;
    sub_department: string | null;
    job_title: string | null;
    region: string | null;
    salary: number | null;
    total_cost_to_company: number | null;
  };
  signals: Record<string, number>;
  computed: {
    value_score: number;
    roi: number | null;
    cost_efficiency: number | null;
    dept_rank: number;
    dept_size: number;
  };
  existing_ratings: {
    performance_score: number | null;
    performance_rating: number | null;
  };
  dept_context: {
    avg_value_score: number;
    avg_roi: number | null;
    median_salary: number | null;
    /**
     * Pre-computed comparisons so the LLM can cite them verbatim instead of
     * computing them from raw inputs (which defeats the post-LLM guard).
     * See SAFETY_RULES[0] in prompts.ts.
     */
    value_vs_avg_diff: number; // value_score - avg_value_score
    value_vs_avg_ratio: number; // value_score / avg_value_score (0 if avg is 0)
    roi_vs_avg_ratio: number | null; // roi / avg_roi
    roi_vs_avg_pct_diff: number | null; // (roi - avg_roi) / avg_roi * 100
    rank_percentile: number; // dept_rank / dept_size, as a 0-1 fraction
    top_percent_int: number; // e.g. rank 1 of 50 → 2 (top 2%)
    percentile_int: number; // e.g. rank 1 of 50 → 98 (better than 98% of peers)
  };
  flags: string[];
};

export function buildAnalyzeInput(
  e: EmployeeRecord,
  ctx: {
    avg_value_score: number;
    avg_roi: number | null;
    median_salary: number | null;
  },
  flags: string[],
): AnalyzeInput {
  if (!e.computed) throw new Error(`Employee ${e.employee_key} has no computed metrics`);

  const c = e.computed;
  const value_vs_avg_diff = c.value_score - ctx.avg_value_score;
  const value_vs_avg_ratio =
    ctx.avg_value_score > 0 ? c.value_score / ctx.avg_value_score : 0;
  const roi_vs_avg_ratio =
    c.roi != null && ctx.avg_roi != null && ctx.avg_roi > 0
      ? c.roi / ctx.avg_roi
      : null;
  const roi_vs_avg_pct_diff =
    c.roi != null && ctx.avg_roi != null && ctx.avg_roi > 0
      ? ((c.roi - ctx.avg_roi) / ctx.avg_roi) * 100
      : null;
  const rank_percentile = c.dept_size > 0 ? c.dept_rank / c.dept_size : 0;
  const top_percent_int =
    c.dept_size > 0 ? Math.max(1, Math.round((c.dept_rank / c.dept_size) * 100)) : 0;
  const percentile_int =
    c.dept_size > 0
      ? Math.max(0, Math.round((1 - c.dept_rank / c.dept_size) * 100))
      : 0;

  const dept_context: AnalyzeInput["dept_context"] = {
    ...ctx,
    value_vs_avg_diff,
    value_vs_avg_ratio,
    roi_vs_avg_ratio,
    roi_vs_avg_pct_diff,
    rank_percentile,
    top_percent_int,
    percentile_int,
  };

  return {
    employee: {
      name: e.name,
      department: e.department,
      sub_department: e.sub_department,
      job_title: e.job_title,
      region: e.region,
      salary: e.salary,
      total_cost_to_company: e.total_cost_to_company,
    },
    signals: e.signals,
    computed: {
      value_score: c.value_score,
      roi: c.roi,
      cost_efficiency: c.cost_efficiency,
      dept_rank: c.dept_rank,
      dept_size: c.dept_size,
    },
    existing_ratings: e.existing_ratings,
    dept_context,
    flags,
  };
}

export const NARRATIVE_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "2-3 sentence plain-English summary of the numbers. Must cite specific metric values from the input. No invented numbers, no HR recommendations, no predictions.",
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description:
        "0-3 signal-backed strengths. Each one must reference a specific metric from signals or computed. Empty array if nothing stands out.",
    },
    watch_items: {
      type: "array",
      items: { type: "string" },
      description:
        "0-3 signal-backed concerns. Each one must reference a specific metric or flag from the input. Empty array if none apply.",
    },
    review_paragraph: {
      type: "string",
      description:
        "One paragraph (4-6 sentences, ~80-120 words) HR can paste into a performance review doc. Strict narration mode: describe what the numbers show. Do not recommend HR actions (fire/promote/raise/stretch). Do not speculate about causes. Do not predict. Neutral language only.",
    },
  },
  required: ["summary", "strengths", "watch_items", "review_paragraph"],
  additionalProperties: false,
} as const;
