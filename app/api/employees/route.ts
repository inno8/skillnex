import { NextResponse } from "next/server";

import { listEmployees } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dept = url.searchParams.get("department") ?? undefined;
  const employees = listEmployees(dept);
  return NextResponse.json({ employees });
}
