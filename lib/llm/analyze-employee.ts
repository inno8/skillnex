/**
 * Per-employee narrative generator. Dispatches to mock or Anthropic based on
 * env config, runs the post-LLM guard, and returns a NarrativeOutput ready
 * for persistence.
 */

import { MODEL, callAnthropic, useMock } from "./client";
import { guardNarrative } from "./guard";
import { mockNarrative } from "./mock";
import type { AnalyzeInput, NarrativeOutput } from "./types";

export class NarrativeGuardError extends Error {
  constructor(
    message: string,
    public invented: number[],
    public offendingFields: string[],
  ) {
    super(message);
    this.name = "NarrativeGuardError";
  }
}

export async function analyzeEmployee(input: AnalyzeInput): Promise<NarrativeOutput> {
  if (useMock()) {
    const n = mockNarrative(input);
    // Mock still runs through the guard — it's our own code and we want to
    // prove by construction that our mock never invents numbers.
    const check = guardNarrative(n, input);
    if (!check.ok) {
      throw new NarrativeGuardError(
        `Mock narrative failed the number-citation guard: [${check.inventedNumbers.join(", ")}] in ${check.offendingFields.join(", ")}`,
        check.inventedNumbers,
        check.offendingFields,
      );
    }
    return n;
  }

  const { narrative } = await callAnthropic(JSON.stringify(input, null, 2));
  const out: NarrativeOutput = {
    ...narrative,
    generated_at: new Date().toISOString(),
    model: MODEL,
    mode: "anthropic",
  };
  const check = guardNarrative(out, input);
  if (!check.ok) {
    throw new NarrativeGuardError(
      `LLM narrative failed the number-citation guard: [${check.inventedNumbers.join(", ")}] in ${check.offendingFields.join(", ")}`,
      check.inventedNumbers,
      check.offendingFields,
    );
  }
  return out;
}
