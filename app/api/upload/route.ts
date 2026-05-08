import { NextResponse } from "next/server";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { saveUpload } from "@/lib/db";
import { scoreEmployees } from "@/lib/metrics";
import {
  FlexibleParseError,
  MultiSheetPickError,
  ParseError,
  parseSkillnexWorkbook,
} from "@/lib/parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accepts either:
 *   - .xlsx / .xls workbook → tries Shape A (Sales/Eng/Payroll), then
 *     Shape B (HR Activity + Compensation), then Shape C (flexible).
 *   - .csv file → goes straight to Shape C against the implicit single
 *     sheet.
 *
 * If the workbook has multiple sheets and matches no known shape, the
 * 422 response includes `code: 'pick_sheet'` plus the sheet list. The
 * UI shows a picker, the user re-submits with `?sheet=<name>`, and we
 * lock onto that sheet for Shape C parsing.
 */

export const POST = apiHandler(async (req) => {
  // Owners + admins + managers can upload. Employees cannot (would let an
  // employee replace the dataset their own review is built from).
  const ctx = await requireRoleApi(req, ["owner", "admin", "manager"]);

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send as multipart form-data under field 'file'." },
        { status: 400 },
      );
    }

    // Sheet hint is optional — only present on the second-attempt
    // upload after the picker. Trim + reject the empty string so an
    // accidental "?sheet=" doesn't override Shape A/B detection.
    const sheetHintRaw = form.get("sheet");
    const sheetHint =
      typeof sheetHintRaw === "string" && sheetHintRaw.trim().length > 0
        ? sheetHintRaw.trim()
        : undefined;

    const buf = new Uint8Array(await file.arrayBuffer());

    const parse = parseSkillnexWorkbook(buf, { sheetHint });
    const scored = scoreEmployees(parse.employees);
    const { upload_id, employee_count } = saveUpload(ctx.tenant.id, {
      filename: file.name,
      parse,
      scored,
    });

    auditFromRequest(ctx, req, "system_event", {
      target_type: "upload",
      target_id: String(upload_id),
      details: {
        filename: file.name,
        shape: parse.shape,
        employee_count,
        sheet_hint: sheetHint ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      upload_id,
      shape: parse.shape,
      employee_count,
      unjoined_names: parse.unjoined_names,
      row_counts: parse.row_counts,
      date_range: parse.date_range,
    });
  } catch (err) {
    // Multi-sheet workbook + no known shape → ask the user which sheet
    // has the people. Surface the sheet list so the UI can render a
    // picker; the user comes back with `sheet=<name>` and we run
    // Shape C against that one.
    if (err instanceof MultiSheetPickError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "pick_sheet",
          sheets: err.sheets,
        },
        { status: 422 },
      );
    }
    if (err instanceof FlexibleParseError) {
      return NextResponse.json(
        { error: err.message, code: "flexible_parse_failed", details: err.details },
        { status: 422 },
      );
    }
    if (err instanceof ParseError) {
      return NextResponse.json({ error: err.message, details: err.details }, { status: 422 });
    }
    console.error("Upload failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
});
