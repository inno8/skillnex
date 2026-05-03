import { NextResponse } from "next/server";

import { apiHandler, requireTenantUserApi } from "@/lib/auth/middleware";
import { getEmployee } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const ctx = await requireTenantUserApi(req);
  const { key } = await params;
  const employee = getEmployee(ctx.tenant.id, decodeURIComponent(key));
  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ employee });
});
