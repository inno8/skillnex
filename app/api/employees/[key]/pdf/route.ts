import { NextResponse } from "next/server";

import { apiHandler, requireRoleApi } from "@/lib/auth/middleware";
import { buildReviewMetricGroups } from "@/lib/pdf/metric-groups";
import { renderReviewPdf } from "@/lib/pdf/review";
import { getEmployeeForUser } from "@/lib/scoped-employees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download the same PDF that the share endpoint attaches to the email.
 *
 * Powers the "Export PDF" button on the employee detail page. The
 * narrative MUST already exist (no on-the-fly LLM call here — that
 * would surprise the manager with a token spend they didn't ask for).
 *
 * Scoped just like /share: managers can only export PDFs for employees
 * in their assigned departments. 404 (not 403) so row existence isn't
 * leaked across departments.
 */
export const GET = apiHandler(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const ctx = await requireRoleApi(req, ["owner", "admin", "manager"]);
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);

  const employee = getEmployeeForUser(ctx, key);
  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!employee.narrative) {
    return NextResponse.json(
      { error: "Generate the narrative draft first.", code: "narrative_missing" },
      { status: 422 },
    );
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderReviewPdf({
      employeeName: employee.name,
      reviewerName: ctx.user.name ?? ctx.user.email,
      tenantName: ctx.tenant.name,
      cycleLabel: "Q1 2026",
      summary: employee.narrative.summary,
      reviewParagraph: employee.narrative.review_paragraph,
      strengths: employee.narrative.strengths,
      watchItems: employee.narrative.watch_items,
      metricGroups: buildReviewMetricGroups(ctx.tenant.id, employee),
    });
  } catch (err) {
    console.error("pdf: render failed", err);
    return NextResponse.json(
      { error: "Could not render the PDF. Try again, or use Send to email it instead." },
      { status: 500 },
    );
  }

  const filename = `skillnex-review-${employee.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}.pdf`;

  // Stream the buffer back as an attachment. RFC 5987 filename* gives
  // browsers a UTF-8-safe filename when the employee name has accents
  // (everyday case in HR data); the bare filename= is the ASCII fallback.
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdfBuffer.length),
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
