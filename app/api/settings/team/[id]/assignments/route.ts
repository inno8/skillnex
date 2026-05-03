import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { listAssignedKeys, setAssignments } from "@/lib/manager-assignments";
import { getTeamMember } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const putSchema = z.object({
  employee_keys: z.array(z.string().min(1).max(200)).max(5000),
});

/**
 * GET /api/settings/team/[id]/assignments
 *   → { manager: {...}, employee_keys: string[] }
 *
 * PUT /api/settings/team/[id]/assignments
 *   body: { employee_keys: string[] }
 *   Replaces the manager's whole assignment set in one transaction.
 *   Audited as system_event with the delta (added/removed counts +
 *   the new total).
 *
 * Owner|admin only. Target user must have role=manager — assigning
 * employees to an owner/admin is a no-op (they see everything anyway)
 * and we'd rather refuse than silently store useless rows.
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
      { error: `${target.role} accounts see every employee — no per-user assignment needed.` },
      { status: 422 },
    );
  }
  const employee_keys = listAssignedKeys(ctx.tenant.id, id);
  return NextResponse.json({
    manager: { id: target.id, email: target.email, name: target.name },
    employee_keys,
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
      { error: `Can only assign employees to a manager (target is ${target.role}).` },
      { status: 422 },
    );
  }

  const before = listAssignedKeys(ctx.tenant.id, id);
  const result = setAssignments(ctx.tenant.id, id, parsed.data.employee_keys);
  if (!result.ok) {
    const message =
      result.reason === "manager_not_found"
        ? "Manager not found."
        : "Target is no longer a manager.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const after = listAssignedKeys(ctx.tenant.id, id);
  const added = after.filter((k) => !before.includes(k));
  const removed = before.filter((k) => !after.includes(k));

  auditFromRequest(ctx, req, "system_event", {
    target_type: "user",
    target_id: id,
    details: {
      action: "manager_assignments_updated",
      manager_email: target.email,
      added_count: added.length,
      removed_count: removed.length,
      total: after.length,
    },
  });

  return NextResponse.json({ ok: true, employee_keys: after });
});
