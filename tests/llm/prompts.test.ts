import { describe, expect, it } from "vitest";

import { NARRATIVE_TOOL, SAFETY_RULES, SYSTEM_PROMPT } from "@/lib/llm/prompts";
import { NARRATIVE_JSON_SCHEMA } from "@/lib/llm/types";

describe("SAFETY_RULES", () => {
  it("has exactly 7 rules (phase 1 strict narration)", () => {
    expect(SAFETY_RULES).toHaveLength(7);
  });

  it("all rules appear verbatim in the system prompt", () => {
    for (const rule of SAFETY_RULES) {
      expect(SYSTEM_PROMPT).toContain(rule);
    }
  });

  it("explicitly forbids HR action recommendations", () => {
    const rule = SAFETY_RULES.find((r) => r.toLowerCase().includes("hr action"));
    expect(rule).toBeDefined();
    expect(rule).toMatch(/fire|promote|raise/i);
  });

  it("explicitly forbids predictions and causal inference", () => {
    const rule = SAFETY_RULES.find((r) =>
      r.toLowerCase().includes("predict"),
    );
    expect(rule).toBeDefined();
  });

  it("requires score-vs-rating disagreement to be stated neutrally", () => {
    const rule = SAFETY_RULES.find((r) =>
      r.toLowerCase().includes("existing_ratings"),
    );
    expect(rule).toBeDefined();
    expect(rule).toMatch(/neutral/i);
  });
});

describe("SYSTEM_PROMPT", () => {
  it("labels itself strict narration mode phase 1", () => {
    expect(SYSTEM_PROMPT).toMatch(/STRICT NARRATION MODE/);
  });

  it("tells the model to call save_narrative exactly once", () => {
    expect(SYSTEM_PROMPT).toContain("save_narrative");
    expect(SYSTEM_PROMPT).toMatch(/exactly once/i);
  });

  it("prefers contribution framing over ROI for HR audiences (Q12)", () => {
    expect(SYSTEM_PROMPT).toMatch(/contribution ratio/i);
    expect(SYSTEM_PROMPT).toMatch(/Employee ROI/);
    expect(SYSTEM_PROMPT).toMatch(/dehumanizing/i);
  });
});

describe("NARRATIVE_TOOL", () => {
  it("is named save_narrative", () => {
    expect(NARRATIVE_TOOL.name).toBe("save_narrative");
  });

  it("input_schema requires the four narrative fields", () => {
    expect(NARRATIVE_JSON_SCHEMA.required).toEqual([
      "summary",
      "strengths",
      "watch_items",
      "review_paragraph",
    ]);
    expect(NARRATIVE_JSON_SCHEMA.additionalProperties).toBe(false);
  });
});
