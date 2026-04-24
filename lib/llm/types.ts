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
  };
  flags: string[];
};

export function buildAnalyzeInput(
  e: EmployeeRecord,
  dept_context: AnalyzeInput["dept_context"],
  flags: string[],
): AnalyzeInput {
  if (!e.computed) throw new Error(`Employee ${e.employee_key} has no computed metrics`);
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
      value_score: e.computed.value_score,
      roi: e.computed.roi,
      cost_efficiency: e.computed.cost_efficiency,
      dept_rank: e.computed.dept_rank,
      dept_size: e.computed.dept_size,
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
