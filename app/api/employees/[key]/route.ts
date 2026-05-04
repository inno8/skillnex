import { NextResponse } from "next/server";
import { z } from "zod";

import {
  apiHandler,
  auditFromRequest,
  requireRoleApi,
  requireTenantUserApi,
} from "@/lib/auth/middleware";
import { updateEmployeeFields } from "@/lib/db";
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

/**
 * Inline edit of mutable fields on an employee row. Pilot scope is
 * `name` and `email` only — anything else (department, salary, etc.)
 * comes from the source xlsx and shouldn't be hand-edited.
 *
 * Email validation is lenient: empty / whitespace-only is accepted as
 * "clear it"; non-empty is required to look like an email. We don't
 * verify deliverability here — the share-review endpoint catches send
 * failures with a friendlier error than the Zod check would give.
 *
 * Role gate: owner | admin | manager. Managers can only edit employees
 * inside their assigned departments — getEmployeeForUser enforces it.
 */
const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z
    .union([z.string().trim().toLowerCase().email().max(254), z.literal("")])
    .nullable()
    .optional(),
});

export const PATCH = apiHandler(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const ctx = await requireRoleApi(req, ["owner", "admin", "manager"]);
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);

  // Scope check first — same 404-not-403 pattern as GET so we don't
  // leak whether a row exists outside the manager's departments.
  const existing = getEmployeeForUser(ctx, key);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid update",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  // Build the change set. Empty-string email is treated as "clear",
  // distinct from "absent" (= "don't change this field").
  const changes: { name?: string; email?: string | null } = {};
  if (parsed.data.name !== undefined) changes.name = parsed.data.name;
  if (parsed.data.email !== undefined) {
    changes.email = parsed.data.email === "" ? null : parsed.data.email;
  }
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ ok: true, employee: existing });
  }

  try {
    updateEmployeeFields(ctx.tenant.id, key, changes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  auditFromRequest(ctx, req, "system_event", {
    target_type: "employee",
    target_id: key,
    details: {
      action: "employee_fields_updated",
      changed: Object.keys(changes),
      ...(changes.email !== undefined ? { email: changes.email } : {}),
    },
  });

  const refreshed = getEmployeeForUser(ctx, key);
  return NextResponse.json({ ok: true, employee: refreshed });
});
