import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { listEmployees, saveNarrative } from "@/lib/db";
import { getEmployeeForUser } from "@/lib/scoped-employees";
import { deriveFlags } from "@/lib/anomalies";
import { NarrativeGuardError } from "@/lib/llm/analyze-employee";
import { MODEL, callAnthropicStream, useMock } from "@/lib/llm/client";
import { guardNarrative } from "@/lib/llm/guard";
import { mockNarrative } from "@/lib/llm/mock";
import type { AnalyzeInput, NarrativeOutput } from "@/lib/llm/types";
import { buildAnalyzeInput } from "@/lib/llm/types";
import type { EmployeeRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/analyze/stream — Server-Sent Events variant of /api/analyze
 * for a single employee.
 *
 * Why a separate route: /api/analyze is the bulk endpoint (up to 100
 * employees per call, JSON response, used by future "regenerate the whole
 * cycle" flows). Streaming a single employee's narrative is the per-row
 * UX path — different return shape, different concurrency story, easier
 * to keep them apart than to multiplex.
 *
 * Wire format: text/event-stream. Three event types:
 *   event: text   data: "<chunk of paragraph>"
 *   event: done   data: <full NarrativeOutput JSON>
 *   event: error  data: { error: "<message>" }
 *
 * The `text` events stream the review_paragraph field as it's built by
 * the model (see callAnthropicStream's extractPartialField). The `done`
 * event fires once with the complete validated NarrativeOutput so the
 * client can swap from the streaming text view into the rich structured
 * view (strengths, watch items, copy paragraph button).
 */

function deptContext(tenant_id: string, dept: string) {
  const list = listEmployees(tenant_id, dept);
  const values = list.map((e) => e.computed?.value_score ?? 0);
  const rois = list.map((e) => e.computed?.roi).filter((r): r is number => r != null);
  const salaries = list.map((e) => e.salary).filter((s): s is number => s != null);
  const avg_value_score = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const avg_roi = rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null;
  const median_salary =
    salaries.length > 0 ? salaries.sort((a, b) => a - b)[Math.floor(salaries.length / 2)] : null;
  return { avg_value_score, avg_roi, median_salary };
}

function flagsFor(e: EmployeeRecord): string[] {
  const res = deriveFlags([e]);
  return res[0]?.flags ?? [];
}

const enc = new TextEncoder();
function sse(event: string, data: unknown): Uint8Array {
  return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const POST = apiHandler(async (req) => {
  const ctx = await requireRoleApi(req, ["owner", "admin", "manager"]);

  let body: { employee_key?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const key = body.employee_key;
  if (!key) {
    return new Response(JSON.stringify({ error: "Provide `employee_key` in the request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Scoped fetch — a manager who tries to generate a narrative for an
  // unassigned employee gets 404 instead of being able to silently
  // inject prompts/spend Anthropic credits on out-of-scope rows.
  const emp = getEmployeeForUser(ctx, key);
  if (!emp || !emp.computed) {
    return new Response(JSON.stringify({ error: "Employee not found or not scored." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dctx = deptContext(ctx.tenant.id, emp.department);
  const flags = flagsFor(emp);
  const input: AnalyzeInput = buildAnalyzeInput(emp, dctx, flags);
  const mock = useMock();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (mock) {
          // Generate the full mock up-front, then stream the paragraph
          // word-by-word with a small delay so the user sees the same
          // typewriter effect as the real LLM. ~15ms per token feels live
          // without dragging out a demo.
          const n = mockNarrative(input);
          const check = guardNarrative(n, input);
          if (!check.ok) {
            throw new NarrativeGuardError(
              `Mock narrative failed guard: [${check.inventedNumbers.join(", ")}] in ${check.offendingFields.join(", ")}`,
              check.inventedNumbers,
              check.offendingFields,
            );
          }
          const tokens = n.review_paragraph.split(/(\s+)/);
          for (const t of tokens) {
            if (t === "") continue;
            controller.enqueue(sse("text", t));
            await new Promise((r) => setTimeout(r, 15));
          }
          saveNarrative(ctx.tenant.id, key, n);
          auditFromRequest(ctx, req, "generate_narrative", {
            target_type: "employee",
            target_id: key,
            details: { mode: "mock", streamed: true },
          });
          controller.enqueue(sse("done", n));
        } else {
          let lastNarrative: NarrativeOutput | null = null;
          for await (const event of callAnthropicStream(JSON.stringify(input, null, 2))) {
            if (event.type === "text_delta") {
              controller.enqueue(sse("text", event.text));
            } else if (event.type === "done") {
              const out: NarrativeOutput = {
                ...event.narrative,
                generated_at: new Date().toISOString(),
                model: MODEL,
                mode: "anthropic",
              };
              const check = guardNarrative(out, input);
              if (!check.ok) {
                throw new NarrativeGuardError(
                  `LLM narrative failed guard: [${check.inventedNumbers.join(", ")}] in ${check.offendingFields.join(", ")}`,
                  check.inventedNumbers,
                  check.offendingFields,
                );
              }
              saveNarrative(ctx.tenant.id, key, out);
              lastNarrative = out;
              controller.enqueue(sse("done", out));
            }
          }
          if (lastNarrative) {
            auditFromRequest(ctx, req, "generate_narrative", {
              target_type: "employee",
              target_id: key,
              details: { mode: "anthropic", streamed: true },
            });
          }
        }
      } catch (err) {
        const msg =
          err instanceof NarrativeGuardError
            ? `Guard rejected: invented numbers ${err.invented.join(", ")} in ${err.offendingFields.join(", ")}`
            : err instanceof Error
              ? err.message
              : "Unknown error";
        controller.enqueue(sse("error", { error: msg }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disables nginx/edge proxy buffering. No-op locally; matters in prod.
      "X-Accel-Buffering": "no",
    },
  });
});
