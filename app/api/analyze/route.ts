import { NextResponse } from "next/server";

import { getEmployee, listEmployees, saveNarrative } from "@/lib/db";
import { NarrativeGuardError, analyzeEmployee } from "@/lib/llm/analyze-employee";
import { useMock } from "@/lib/llm/client";
import { buildAnalyzeInput } from "@/lib/llm/types";
import { deriveFlags } from "@/lib/anomalies";
import type { EmployeeRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deptContext(dept: string) {
  const list = listEmployees(dept);
  const values = list.map((e) => e.computed?.value_score ?? 0);
  const rois = list
    .map((e) => e.computed?.roi)
    .filter((r): r is number => r != null);
  const salaries = list
    .map((e) => e.salary)
    .filter((s): s is number => s != null);
  const avg_value_score =
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const avg_roi =
    rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null;
  const median_salary =
    salaries.length > 0
      ? salaries.sort((a, b) => a - b)[Math.floor(salaries.length / 2)]
      : null;
  return { avg_value_score, avg_roi, median_salary };
}

function flagsFor(e: EmployeeRecord): string[] {
  const res = deriveFlags([e]);
  return res[0]?.flags ?? [];
}

export async function POST(req: Request) {
  let body: { employee_keys?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const keys = body.employee_keys ?? [];
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "Provide `employee_keys` as a JSON array." },
      { status: 400 },
    );
  }
  if (keys.length > 100) {
    return NextResponse.json(
      { error: "Max 100 employees per analyze call." },
      { status: 400 },
    );
  }

  const mock = useMock();
  const results: Array<{ employee_key: string; ok: boolean; error?: string }> =
    [];

  // Sequential so prompt-caching benefits compound on the real API.
  for (const key of keys) {
    const emp = getEmployee(key);
    if (!emp || !emp.computed) {
      results.push({ employee_key: key, ok: false, error: "Not found or not scored" });
      continue;
    }
    try {
      const ctx = deptContext(emp.department);
      const flags = flagsFor(emp);
      const input = buildAnalyzeInput(emp, ctx, flags);
      const narrative = await analyzeEmployee(input);
      saveNarrative(key, narrative);
      results.push({ employee_key: key, ok: true });
    } catch (err) {
      const msg =
        err instanceof NarrativeGuardError
          ? `Guard rejected: invented numbers ${err.invented.join(", ")} in ${err.offendingFields.join(", ")}`
          : err instanceof Error
            ? err.message
            : "Unknown error";
      results.push({ employee_key: key, ok: false, error: msg });
    }
  }

  return NextResponse.json({
    mode: mock ? "mock" : "anthropic",
    total: keys.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
