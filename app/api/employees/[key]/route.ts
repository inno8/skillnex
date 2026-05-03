import { NextResponse } from "next/server";

import { apiHandler, requireTenantUserApi } from "@/lib/auth/middleware";
import { getEmployeeForUser } from "@/lib/scoped-employees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const ctx = await requireTenantUserApi(req);
  const { key } = await params;
  // Out-of-scope rows return 404 (not 403) so the API doesn't leak the
  // existence of employees a manager isn't assigned to.
  const employee = getEmployeeForUser(ctx, decodeURIComponent(key));
  if (!employee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ employee });
});
