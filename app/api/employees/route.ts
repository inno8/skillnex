import { NextResponse } from "next/server";

import { apiHandler, requireTenantUserApi } from "@/lib/auth/middleware";
import { listEmployeesForUser } from "@/lib/scoped-employees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const ctx = await requireTenantUserApi(req);
  const url = new URL(req.url);
  const dept = url.searchParams.get("department") ?? undefined;
  // Role-scoped: owner/admin sees the whole tenant, manager sees only
  // their assigned reports, employee sees only their own row.
  const employees = listEmployeesForUser(ctx, dept);
  return NextResponse.json({ employees });
});
