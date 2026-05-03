import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { changeRole, getTeamMember } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["owner", "admin", "manager", "employee"]),
});

export const POST = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireRoleApi(req, ["owner", "admin"]);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 422 });
  }
  const newRole = parsed.data.role;

  // Self-edit guard: callers can't change their own role (otherwise
  // the only owner could demote themselves and orphan the tenant).
  if (id === ctx.user.id) {
    return NextResponse.json({ error: "You can't change your own role." }, { status: 403 });
  }

  // Admins can't grant or modify the Owner role.
  if (ctx.user.role === "admin") {
    const target = getTeamMember(ctx.tenant.id, id);
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (target.role === "owner" || newRole === "owner") {
      return NextResponse.json({ error: "Only an owner can change owner roles." }, { status: 403 });
    }
  }

  const result = changeRole(ctx.tenant.id, id, newRole);
  if (!result.ok) {
    const message =
      result.reason === "not_found"
        ? "User not found."
        : "Can't demote the last owner — promote someone else first.";
    return NextResponse.json(
      { error: message },
      { status: result.reason === "not_found" ? 404 : 409 },
    );
  }

  auditFromRequest(ctx, req, "role_changed", {
    target_type: "user",
    target_id: id,
    details: { new_role: newRole, email: result.user.email },
  });

  return NextResponse.json({ ok: true, user: result.user });
});
