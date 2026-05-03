import { NextResponse } from "next/server";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { getTeamMember, suspendUser } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireRoleApi(req, ["owner", "admin"]);
  const { id } = await params;

  if (id === ctx.user.id) {
    return NextResponse.json({ error: "You can't suspend yourself." }, { status: 403 });
  }
  if (ctx.user.role === "admin") {
    const target = getTeamMember(ctx.tenant.id, id);
    if (target?.role === "owner") {
      return NextResponse.json({ error: "Only an owner can suspend an owner." }, { status: 403 });
    }
  }

  const result = suspendUser(ctx.tenant.id, id);
  if (!result.ok) {
    const message =
      result.reason === "not_found" ? "User not found." : "Can't suspend the last active owner.";
    return NextResponse.json(
      { error: message },
      { status: result.reason === "not_found" ? 404 : 409 },
    );
  }

  auditFromRequest(ctx, req, "user_suspended", {
    target_type: "user",
    target_id: id,
    details: { email: result.user.email, role: result.user.role },
  });

  return NextResponse.json({ ok: true, user: result.user });
});
