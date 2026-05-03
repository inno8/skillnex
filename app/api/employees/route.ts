import { NextResponse } from "next/server";

import { apiHandler, requireTenantUserApi } from "@/lib/auth/middleware";
import { listEmployees } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const ctx = await requireTenantUserApi(req);
  const url = new URL(req.url);
  const dept = url.searchParams.get("department") ?? undefined;
  const employees = listEmployees(ctx.tenant.id, dept);
  return NextResponse.json({ employees });
});
