import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { listAssignedDepartments, setDepartmentAssignments } from "@/lib/manager-assignments";
import { getTeamMember } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const putSchema = z.object({
  departments: z.array(z.string().trim().min(1).max(100)).max(100),
});

/**
 * GET /api/settings/team/[id]/assignments
 *   → { manager: {...}, departments: string[] }
 *
 * PUT /api/settings/team/[id]/assignments
 *   body: { departments: string[] }
 *   Replaces the manager's whole department set in one transaction.
 *   Audited as system_event with the delta (added/removed/total).
 *
 * Owner|admin only. Target user must have role=manager — assigning
 * departments to an owner/admin is meaningless (they see all departments
 * anyway) and we'd rather refuse than silently store useless rows.
 */

export const GET = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireRoleApi(req, ["owner", "admin"]);
  const { id } = await params;
  const target = getTeamMember(ctx.tenant.id, id);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.role !== "manager") {
    return NextResponse.json(
      {
        error: `${target.role} accounts already see every department — no per-user assignment needed.`,
      },
      { status: 422 },
    );
  }
  const departments = listAssignedDepartments(ctx.tenant.id, id);
  return NextResponse.json({
    manager: { id: target.id, email: target.email, name: target.name },
    departments,
  });
});

export const PUT = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const ctx = await requireRoleApi(req, ["owner", "admin"]);
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assignments payload" }, { status: 422 });
  }

  const target = getTeamMember(ctx.tenant.id, id);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.role !== "manager") {
    return NextResponse.json(
      { error: `Can only assign departments to a manager (target is ${target.role}).` },
      { status: 422 },
    );
  }

  const before = listAssignedDepartments(ctx.tenant.id, id);
  const result = setDepartmentAssignments(
    ctx.tenant.id,
    id,
    parsed.data.departments.map((d) => d.trim()).filter((d) => d.length > 0),
  );
  if (!result.ok) {
    const message =
      result.reason === "manager_not_found"
        ? "Manager not found."
        : "Target is no longer a manager.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const after = listAssignedDepartments(ctx.tenant.id, id);
  const added = after.filter((d) => !before.includes(d));
  const removed = before.filter((d) => !after.includes(d));

  auditFromRequest(ctx, req, "system_event", {
    target_type: "user",
    target_id: id,
    details: {
      action: "manager_departments_updated",
      manager_email: target.email,
      added,
      removed,
      total: after.length,
    },
  });

  return NextResponse.json({ ok: true, departments: after });
});
