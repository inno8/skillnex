import { NextResponse } from "next/server";

import { saveUpload } from "@/lib/db";
import { scoreEmployees } from "@/lib/metrics";
import { ParseError, parseSkillnexWorkbook } from "@/lib/parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send as multipart form-data under field 'file'." },
        { status: 400 },
      );
    }
    const buf = new Uint8Array(await file.arrayBuffer());

    const parse = parseSkillnexWorkbook(buf);
    const scored = scoreEmployees(parse.employees);
    const { upload_id, employee_count } = saveUpload({
      filename: file.name,
      parse,
      scored,
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
    if (err instanceof ParseError) {
      return NextResponse.json(
        { error: err.message, details: err.details },
        { status: 422 },
      );
    }
    console.error("Upload failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
