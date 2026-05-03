import { NextResponse } from "next/server";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { getTeamMember, restoreUser } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireRoleApi(req, ["owner", "admin"]);
  const { id } = await params;

  if (ctx.user.role === "admin") {
    const target = getTeamMember(ctx.tenant.id, id);
    if (target?.role === "owner") {
      return NextResponse.json({ error: "Only an owner can restore an owner." }, { status: 403 });
    }
  }

  const result = restoreUser(ctx.tenant.id, id);
  if (!result.ok) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  auditFromRequest(ctx, req, "user_restored", {
    target_type: "user",
    target_id: id,
    details: { email: result.user.email, role: result.user.role },
  });

  return NextResponse.json({ ok: true, user: result.user });
});
