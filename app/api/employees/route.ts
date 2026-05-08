import { NextResponse } from "next/server";

import { apiHandler, requireTenantUserApi } from "@/lib/auth/middleware";
import { listEmployeesForUser } from "@/lib/scoped-employees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const ctx = await requireTenantUserApi(req);
  const url = new URL(req.url);
  const dept = url.searchParams.get("department") ?? undefined;
  const cycle = url.searchParams.get("cycle") ?? undefined;
  // Role-scoped: owner/admin sees the whole tenant, manager sees only
  // their assigned reports, employee sees only their own row. Cycle
  // defaults to the most recent upload when not supplied.
  const employees = listEmployeesForUser(ctx, { department: dept, cycle_label: cycle });
  return NextResponse.json({ employees });
});
