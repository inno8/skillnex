/**
 * Stratified real-API narrative review.
 *
 * Picks ~20 employees across departments + all score-vs-rating mismatches,
 * calls Claude Haiku 4.5 for each, runs the post-LLM guard, and reports:
 * - guard rejections with the specific invented numbers
 * - HR-action-language leaks (fire/promote/raise/PIP/stretch)
 * - prose samples for manual quality review
 * - cache-hit stats (prompt caching savings)
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   pnpm exec tsx scripts/llm-review.ts
 */

import "dotenv/config";
import { readFileSync } from "node:fs";

import { deriveFlags } from "@/lib/anomalies";
import { callAnthropic, MODEL } from "@/lib/llm/client";
import { guardNarrative } from "@/lib/llm/guard";
import { buildAnalyzeInput, type NarrativeOutput } from "@/lib/llm/types";
import { scoreEmployees } from "@/lib/metrics";
import { parseSkillnexWorkbook } from "@/lib/parsers";
import type { EmployeeRecord } from "@/lib/types";

const BANNED_LANGUAGE =
  /\b(fire|terminate|promote|raise salary|raise their|stretch assignment|PIP|performance improvement plan|compensation adjust|out[-\s]of[-\s]cycle|increase their (pay|comp|salary))\b/i;

function deptContext(all: EmployeeRecord[], dept: string) {
  const list = all.filter((e) => e.department === dept);
  const avg_value_score =
    list.reduce((s, e) => s + (e.computed?.value_score ?? 0), 0) /
    Math.max(list.length, 1);
  const rois = list
    .map((e) => e.computed?.roi)
    .filter((r): r is number => r != null);
  const avg_roi =
    rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null;
  const salaries = list
    .map((e) => e.salary)
    .filter((s): s is number => s != null)
    .sort((a, b) => a - b);
  const median_salary =
    salaries.length > 0
      ? salaries[Math.floor(salaries.length / 2)]
      : null;
  return { avg_value_score, avg_roi, median_salary };
}

async function main() {
  const buf = readFileSync("public/samples/skillnex-demo.xlsx");
  const parsed = parseSkillnexWorkbook(buf);
  scoreEmployees(parsed.employees);

  const allFlags = new Map(
    deriveFlags(parsed.employees).map((f) => [f.employee.employee_key, f.flags]),
  );

  // Stratified sample
  const byDept = new Map<string, EmployeeRecord[]>();
  for (const e of parsed.employees) {
    const b = byDept.get(e.department) ?? [];
    b.push(e);
    byDept.set(e.department, b);
  }
  const sample: EmployeeRecord[] = [];
  for (const [, list] of byDept) {
    const sorted = [...list].sort(
      (a, b) => (b.computed?.value_score ?? 0) - (a.computed?.value_score ?? 0),
    );
    if (sorted.length === 0) continue;
    // 2 top, 2 middle, 2 bottom per dept — compact for iteration
    const n = sorted.length;
    sample.push(...sorted.slice(0, Math.min(2, n)));
    if (n > 4) {
      const mid = Math.floor(n / 2);
      sample.push(...sorted.slice(mid - 1, mid + 1));
    }
    if (n > 2) sample.push(...sorted.slice(Math.max(n - 2, 0)));
  }
  const unique = Array.from(
    new Map(sample.map((e) => [e.employee_key, e])).values(),
  );

  console.log(`Stratified sample: ${unique.length} employees`);
  console.log(`Model: ${MODEL}`);
  console.log("");

  const findings = {
    total: unique.length,
    guard_rejections: 0,
    banned_language_hits: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cache_reads: 0,
    rejections: [] as Array<{ name: string; invented: number[]; fields: string[] }>,
    leaks: [] as Array<{ name: string; match: string; context: string }>,
    samples: [] as Array<{ name: string; narrative: NarrativeOutput }>,
  };

  let idx = 0;
  for (const e of unique) {
    idx++;
    const ctx = deptContext(parsed.employees, e.department);
    const flags = allFlags.get(e.employee_key) ?? [];
    const input = buildAnalyzeInput(e, ctx, flags);

    process.stdout.write(`  [${idx}/${unique.length}] ${e.name} (${e.department}) … `);
    try {
      const { narrative: raw, usage } = await callAnthropic(
        JSON.stringify(input, null, 2),
      );
      findings.total_input_tokens += usage.input_tokens;
      findings.total_output_tokens += usage.output_tokens;
      findings.total_cache_reads += usage.cache_read_input_tokens ?? 0;
      const narrative: NarrativeOutput = {
        summary: String(raw.summary ?? ""),
        strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String) : [],
        watch_items: Array.isArray(raw.watch_items) ? raw.watch_items.map(String) : [],
        review_paragraph: String(raw.review_paragraph ?? ""),
        generated_at: new Date().toISOString(),
        model: MODEL,
        mode: "anthropic",
      };

      const g = guardNarrative(narrative, input);
      if (!g.ok) {
        findings.guard_rejections++;
        findings.rejections.push({
          name: e.name,
          invented: g.inventedNumbers,
          fields: g.offendingFields,
        });
        console.log(`❌ guard rejected: [${g.inventedNumbers.join(", ")}]`);
        // Dump the offending narrative for analysis
        console.log(`     SUMMARY: ${narrative.summary}`);
        console.log(`     REVIEW:  ${narrative.review_paragraph}`);
        continue;
      }

      const allText = [
        narrative.summary,
        ...narrative.strengths,
        ...narrative.watch_items,
        narrative.review_paragraph,
      ].join(" ");
      const leak = allText.match(BANNED_LANGUAGE);
      if (leak) {
        findings.banned_language_hits++;
        findings.leaks.push({
          name: e.name,
          match: leak[0],
          context: allText.slice(
            Math.max(0, (leak.index ?? 0) - 40),
            (leak.index ?? 0) + leak[0].length + 40,
          ),
        });
        console.log(`⚠️  banned language: "${leak[0]}"`);
        continue;
      }

      findings.samples.push({ name: e.name, narrative });
      console.log(`✅`);
    } catch (err) {
      console.log(`🔥 ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\n\n================= FINDINGS =================");
  console.log(
    `Pass: ${findings.samples.length}/${findings.total} · Guard rejections: ${findings.guard_rejections} · Banned-language leaks: ${findings.banned_language_hits}`,
  );
  console.log(
    `Tokens: ${findings.total_input_tokens} in / ${findings.total_output_tokens} out · Cache reads: ${findings.total_cache_reads}`,
  );
  const cacheRate =
    findings.total_input_tokens > 0
      ? ((findings.total_cache_reads / findings.total_input_tokens) * 100).toFixed(1)
      : "0.0";
  console.log(`Cache hit rate: ${cacheRate}%`);

  if (findings.rejections.length > 0) {
    console.log("\n--- GUARD REJECTIONS ---");
    for (const r of findings.rejections) {
      console.log(`  ${r.name}: invented [${r.invented.join(", ")}] in ${r.fields.join(", ")}`);
    }
  }

  if (findings.leaks.length > 0) {
    console.log("\n--- BANNED-LANGUAGE LEAKS ---");
    for (const l of findings.leaks) {
      console.log(`  ${l.name}: "${l.match}" in "${l.context}"`);
    }
  }

  console.log("\n--- QUALITY SAMPLES (first 3) ---");
  for (const s of findings.samples.slice(0, 3)) {
    console.log(`\n${s.name}`);
    console.log(`  SUMMARY: ${s.narrative.summary}`);
    console.log(`  REVIEW: ${s.narrative.review_paragraph}`);
    if (s.narrative.strengths.length) {
      console.log(`  STRENGTHS:`);
      for (const x of s.narrative.strengths) console.log(`    - ${x}`);
    }
    if (s.narrative.watch_items.length) {
      console.log(`  WATCH:`);
      for (const x of s.narrative.watch_items) console.log(`    - ${x}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
