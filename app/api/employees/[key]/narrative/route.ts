import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { saveNarrative } from "@/lib/db";
import { getEmployeeForUser } from "@/lib/scoped-employees";
import type { NarrativeOutput } from "@/lib/llm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual narrative edit. The Anthropic-generated draft becomes the
 * starting point; the manager rewords whatever they disagree with and
 * saves. Their edit replaces the stored narrative — same JSON shape.
 *
 * Why no post-LLM number guard here: the guard exists to catch the
 * model inventing numbers that don't appear in the source data. A
 * human manager editing the draft is presumed responsible for what
 * they ship. If they want to add a number that's not in the input
 * (e.g. a quota figure HR didn't upload), that's their call to make.
 *
 * Provenance: we set `edited_at` + `edited_by_user_id` so the audit
 * surface and the email template can show "Last edited by Jane Doe
 * on 2026-04-30" instead of pretending the manager's text came from
 * the model.
 */

const patchSchema = z.object({
  summary: z.string().trim().min(1).max(2000).optional(),
  review_paragraph: z.string().trim().min(1).max(8000).optional(),
  strengths: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  watch_items: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
});

export const PUT = apiHandler(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const ctx = await requireRoleApi(req, ["owner", "admin", "manager"]);
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);

  // Scope check first — managers can't edit narratives outside their
  // department. 404 (not 403) so we don't leak the row's existence.
  const existing = getEmployeeForUser(ctx, key);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!existing.narrative) {
    return NextResponse.json({ error: "Generate the draft narrative first." }, { status: 422 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid edit",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  // Track which fields actually changed for the audit row.
  const changed: string[] = [];
  const next: NarrativeOutput = { ...existing.narrative };
  if (parsed.data.summary !== undefined && parsed.data.summary !== existing.narrative.summary) {
    next.summary = parsed.data.summary;
    changed.push("summary");
  }
  if (
    parsed.data.review_paragraph !== undefined &&
    parsed.data.review_paragraph !== existing.narrative.review_paragraph
  ) {
    next.review_paragraph = parsed.data.review_paragraph;
    changed.push("review_paragraph");
  }
  if (parsed.data.strengths !== undefined) {
    const cleaned = parsed.data.strengths.filter((s) => s.length > 0);
    if (JSON.stringify(cleaned) !== JSON.stringify(existing.narrative.strengths)) {
      next.strengths = cleaned;
      changed.push("strengths");
    }
  }
  if (parsed.data.watch_items !== undefined) {
    const cleaned = parsed.data.watch_items.filter((s) => s.length > 0);
    if (JSON.stringify(cleaned) !== JSON.stringify(existing.narrative.watch_items)) {
      next.watch_items = cleaned;
      changed.push("watch_items");
    }
  }

  if (changed.length === 0) {
    return NextResponse.json({ ok: true, narrative: existing.narrative });
  }

  next.edited_at = new Date().toISOString();
  next.edited_by_user_id = ctx.user.id;

  saveNarrative(ctx.tenant.id, key, next);

  auditFromRequest(ctx, req, "narrative_edited", {
    target_type: "employee",
    target_id: key,
    details: { changed },
  });

  return NextResponse.json({ ok: true, narrative: next });
});
