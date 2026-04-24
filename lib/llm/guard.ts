/**
 * Post-LLM guard: verify the narrative only cites numbers present in the input.
 *
 * The LLM's biggest failure mode is inventing plausible-sounding numbers.
 * This guard scans every numeric token in the output and rejects if a number
 * doesn't appear in (or isn't trivially derived from) the input.
 *
 * Tolerance: rounded and formatted variations of input numbers pass (e.g.
 * input 540000 → output "$540K" or "$540,000" both allowed). Integers ≤ 12
 * are allowed unconditionally (dates, ordinals, small counts).
 */

import type { AnalyzeInput, NarrativeOutput } from "./types";

const SMALL_INT_MAX = 12;

function extractNumbers(text: string): number[] {
  // Match a number token: optional minus, optional $, digits with optional
  // commas, optional decimal. Multiplier suffix K/M/B must be attached (no
  // space) and case-sensitive — otherwise " b" inside " bugs" is read as B.
  // Optional x or % suffix also attached.
  const matches = text.matchAll(
    /-?\$?\d+(?:,\d{3})*(?:\.\d+)?(?:[KMB]|x|%)?/g,
  );
  const out: number[] = [];
  for (const m of matches) {
    const raw = m[0];
    const cleaned = raw.replace(/[$,%x]/g, "");
    const last = cleaned[cleaned.length - 1];
    let mult = 1;
    let numStr = cleaned;
    if (last === "K") {
      mult = 1_000;
      numStr = cleaned.slice(0, -1);
    } else if (last === "M") {
      mult = 1_000_000;
      numStr = cleaned.slice(0, -1);
    } else if (last === "B") {
      mult = 1_000_000_000;
      numStr = cleaned.slice(0, -1);
    }
    const n = Number(numStr);
    if (Number.isFinite(n)) out.push(n * mult);
  }
  return out;
}

// Scale denominators that appear as "/100", "/ 5", etc. in narrative text.
// Any of these match as a legitimate token wherever they appear.
const STANDARD_SCALES = [100, 5, 10, 1000];

/**
 * Expand the base input numbers with simple arithmetic derivations —
 * differences, sums, ratios, and percentage differences between any two.
 * This accepts narratives that say things like "$7,991 below the median"
 * (= salary − median) or "16.4% below average" (= pct diff) as legitimate
 * derivations without forcing us to precompute every possible pairing.
 *
 * Size is O(N²) but N is typically ~25-30 input numbers.
 */
function expandWithDerivations(base: number[], references: number[]): number[] {
  const all = [...base];
  // Derivations pair any input number A with a *reference* number B (dept
  // average, median, or standard scale). Haiku regularly writes "above" /
  // "below" phrasing that converts negative diffs to their absolute value,
  // so every derivation is also registered as |derivation|.
  for (const a of base) {
    for (const b of references) {
      if (a === b) continue;
      const diff = a - b;
      all.push(diff);
      all.push(Math.abs(diff));
      if (b !== 0) {
        const ratio = a / b;
        all.push(ratio);
        all.push(Math.abs(ratio));
        // "X is Y% of Z" — the ratio written as a percentage.
        all.push(ratio * 100);
        all.push(Math.abs(ratio * 100));
        const pctDiff = ((a - b) / b) * 100;
        all.push(pctDiff);
        all.push(Math.abs(pctDiff));
      }
    }
  }
  return all;
}

function collectInputNumbers(input: AnalyzeInput): {
  all: number[];
  references: number[];
} {
  const ns: number[] = [...STANDARD_SCALES];
  if (input.employee.salary != null) ns.push(input.employee.salary);
  if (input.employee.total_cost_to_company != null)
    ns.push(input.employee.total_cost_to_company);
  for (const v of Object.values(input.signals)) if (typeof v === "number") ns.push(v);
  const c = input.computed;
  ns.push(c.value_score, c.dept_rank, c.dept_size);
  if (c.roi != null) ns.push(c.roi);
  if (c.cost_efficiency != null) ns.push(c.cost_efficiency);
  const er = input.existing_ratings;
  if (er.performance_score != null) ns.push(er.performance_score);
  if (er.performance_rating != null) ns.push(er.performance_rating);
  for (const v of Object.values(input.dept_context)) {
    if (typeof v === "number" && Number.isFinite(v)) ns.push(v);
  }

  // "References" = values Haiku treats as denominators when writing things
  // like "X below the median" or "Y% of the average". Restricting derivations
  // to these avoids accidental A/B matches between unrelated employee fields.
  const references: number[] = [...STANDARD_SCALES];
  const dc = input.dept_context;
  references.push(dc.avg_value_score);
  if (dc.avg_roi != null) references.push(dc.avg_roi);
  if (dc.median_salary != null) references.push(dc.median_salary);
  references.push(c.dept_size);

  return { all: ns, references };
}

function matchesAny(out: number, candidates: number[], tolerancePct = 0.02): boolean {
  for (const c of candidates) {
    if (c === 0) {
      if (Math.abs(out) < 1) return true;
      continue;
    }
    // Exact match after rounding to any practical display precision (0, 1, 2dp).
    for (const places of [0, 1, 2]) {
      const rounded = Number(c.toFixed(places));
      if (out === rounded) return true;
    }
    // Percentage tolerance handles typos in larger numbers.
    const diff = Math.abs(out - c) / Math.abs(c);
    if (diff <= tolerancePct) return true;
    // Allow /1000 and /1_000_000 representations (e.g. $62K from 62000).
    if (Math.abs(out - c / 1000) / Math.abs(c / 1000 || 1) <= tolerancePct)
      return true;
    if (Math.abs(out - c / 1_000_000) / Math.abs(c / 1_000_000 || 1) <= tolerancePct)
      return true;
  }
  return false;
}

export type GuardResult =
  | { ok: true }
  | { ok: false; inventedNumbers: number[]; offendingFields: string[] };

export function guardNarrative(
  narrative: NarrativeOutput,
  input: AnalyzeInput,
): GuardResult {
  const { all, references } = collectInputNumbers(input);
  const inputNumbers = expandWithDerivations(all, references);
  const fields: Array<[string, string]> = [
    ["summary", narrative.summary],
    ...narrative.strengths.map(
      (s, i) => [`strengths[${i}]`, s] as [string, string],
    ),
    ...narrative.watch_items.map(
      (s, i) => [`watch_items[${i}]`, s] as [string, string],
    ),
    ["review_paragraph", narrative.review_paragraph],
  ];

  const invented: number[] = [];
  const offending: string[] = [];

  for (const [fieldName, text] of fields) {
    const nums = extractNumbers(text);
    for (const n of nums) {
      // Small ints are free (counts, ordinals)
      if (Number.isInteger(n) && Math.abs(n) <= SMALL_INT_MAX) continue;
      // Calendar-year references like 2026 are allowed
      if (Number.isInteger(n) && n >= 1900 && n <= 2100) continue;
      if (!matchesAny(n, inputNumbers)) {
        invented.push(n);
        offending.push(fieldName);
      }
    }
  }

  if (invented.length > 0) {
    return { ok: false, inventedNumbers: invented, offendingFields: offending };
  }
  return { ok: true };
}
