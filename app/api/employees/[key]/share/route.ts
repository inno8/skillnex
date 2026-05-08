import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { resolveCycle, updateEmployeeFields } from "@/lib/db";
import { sendReviewEmail } from "@/lib/email/resend";
import { buildReviewMetricGroups } from "@/lib/pdf/metric-groups";
import { renderReviewPdf } from "@/lib/pdf/review";
import { getEmployeeForUser } from "@/lib/scoped-employees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Email a finalized performance review to an employee.
 *
 * Recipient resolution:
 *   1. If `recipient_email` is provided in the body, use it AND persist
 *      it on the employee row (employees.email) for future cycles.
 *      This is the path the share modal takes for employees who didn't
 *      come in with an Email column on the xlsx.
 *   2. Otherwise, use the employee's stored email.
 *   3. If neither is available → 422 with code='email_required' so the
 *      modal knows to ask.
 *
 * Doesn't lock the narrative or change its status (Option C deferred).
 * Audited as review_emailed with recipient + Resend message id so a
 * support request like "did Alice get her review?" can be answered
 * from the audit log alone.
 */

const schema = z.object({
  recipient_email: z
    .union([z.string().trim().toLowerCase().email().max(254), z.literal("")])
    .nullable()
    .optional(),
  cover_note: z.string().trim().max(2000).optional(),
});

export const POST = apiHandler(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const ctx = await requireRoleApi(req, ["owner", "admin", "manager"]);
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const url = new URL(req.url);
  const cycleLabel = resolveCycle(ctx.tenant.id, url.searchParams.get("cycle") ?? undefined);

  // Scope check first — managers can't share narratives outside their
  // department. 404 (not 403) so the row's existence isn't leaked.
  const employee = getEmployeeForUser(ctx, key, cycleLabel);
  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!employee.narrative) {
    return NextResponse.json(
      { error: "Generate the narrative draft first.", code: "narrative_missing" },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid share payload",
        issues: parsed.error.issues.map((i) => i.message),
      },
      { status: 422 },
    );
  }

  const supplied =
    parsed.data.recipient_email && parsed.data.recipient_email !== ""
      ? parsed.data.recipient_email
      : null;
  const recipient = supplied ?? employee.email;
  if (!recipient) {
    return NextResponse.json(
      {
        error: "No email on file for this employee. Add one and retry.",
        code: "email_required",
      },
      { status: 422 },
    );
  }

  // Persist a manager-typed email so the next cycle doesn't re-prompt.
  // Skip if the address matches what we already have (no point flogging
  // the audit log with a no-op write).
  let email_persisted = false;
  if (supplied && supplied !== employee.email) {
    try {
      updateEmployeeFields(ctx.tenant.id, key, { email: supplied });
      email_persisted = true;
    } catch (err) {
      // Persistence failure is non-fatal — the email send is the
      // important action. Log + continue so a flaky disk doesn't block
      // the manager finishing their review cycle.
      console.error("share: failed to persist recipient email", err);
    }
  }

  // Render a printable PDF copy as an attachment. Failure here is
  // non-fatal — better to send the email body alone than block the
  // whole flow because pdfkit choked on something weird in the text.
  // Capture the error message so we can include it in the audit row +
  // server log (not in the API response, since the email still went).
  let pdfBuffer: Buffer | null = null;
  let pdfError: string | null = null;
  try {
    pdfBuffer = await renderReviewPdf({
      employeeName: employee.name,
      reviewerName: ctx.user.name ?? ctx.user.email,
      tenantName: ctx.tenant.name,
      cycleLabel,
      summary: employee.narrative.summary,
      reviewParagraph: employee.narrative.review_paragraph,
      strengths: employee.narrative.strengths,
      watchItems: employee.narrative.watch_items,
      coverNote: parsed.data.cover_note?.trim() || undefined,
      metricGroups: buildReviewMetricGroups(ctx.tenant.id, employee, cycleLabel),
    });
    console.log(`share: PDF rendered for ${employee.name} · ${pdfBuffer.length} bytes`);
  } catch (err) {
    pdfError = err instanceof Error ? err.message : String(err);
    console.error("share: PDF render failed, sending email without attachment", err);
  }

  const pdfFilename = `skillnex-review-${employee.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}.pdf`;

  const sendResult = await sendReviewEmail({
    to: recipient,
    employeeName: employee.name,
    reviewerName: ctx.user.name ?? ctx.user.email,
    tenantName: ctx.tenant.name,
    cycleLabel,
    reviewParagraph: employee.narrative.review_paragraph,
    summary: employee.narrative.summary,
    strengths: employee.narrative.strengths,
    watchItems: employee.narrative.watch_items,
    coverNote: parsed.data.cover_note?.trim() || undefined,
    attachments: pdfBuffer
      ? [
          {
            filename: pdfFilename,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : undefined,
  });

  if (!sendResult.ok) {
    auditFromRequest(ctx, req, "review_emailed", {
      target_type: "employee",
      target_id: key,
      details: {
        recipient,
        email_persisted,
        ok: false,
        error: sendResult.error,
        pdf_attached: pdfBuffer != null,
        pdf_size_bytes: pdfBuffer?.length ?? 0,
      },
    });
    return NextResponse.json(
      { error: `Send failed: ${sendResult.error}`, code: "send_failed" },
      { status: 502 },
    );
  }

  auditFromRequest(ctx, req, "review_emailed", {
    target_type: "employee",
    target_id: key,
    details: {
      recipient,
      email_persisted,
      ok: true,
      message_id: sendResult.id,
      cover_note_length: parsed.data.cover_note?.length ?? 0,
      pdf_attached: pdfBuffer != null,
      pdf_size_bytes: pdfBuffer?.length ?? 0,
      pdf_error: pdfError,
    },
  });

  return NextResponse.json({
    ok: true,
    recipient,
    message_id: sendResult.id,
    email_persisted,
  });
});
