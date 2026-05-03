import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { softDeleteTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  confirm: z.string().min(1),
});

/**
 * Soft-delete the tenant. Body must include `confirm` matching the
 * tenant's name (defense-in-depth on top of the modal confirm in the
 * UI). Sets tenants.deleted_at and kills every session in the tenant
 * — the owner is bounced through /logout client-side.
 *
 * Hard delete is the job of a future cron sweep that runs 30 days
 * after deleted_at; that's the grace window owners get to email
 * support and request restore.
 */
export const POST = apiHandler(async (req) => {
  const ctx = await requireRoleApi(req, ["owner"]);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation text required." }, { status: 422 });
  }
  if (parsed.data.confirm !== ctx.tenant.name) {
    return NextResponse.json(
      {
        error: `Confirmation didn't match. Type the tenant name "${ctx.tenant.name}" exactly.`,
      },
      { status: 422 },
    );
  }

  // Audit BEFORE softDelete — once the tenant's gone the FK to
  // tenants stays valid but the user gets signed out.
  auditFromRequest(ctx, req, "delete_tenant", {
    target_type: "tenant",
    target_id: ctx.tenant.id,
    details: {
      tenant_name: ctx.tenant.name,
      grace_days: 30,
      delete_kind: "soft",
    },
  });

  const result = softDeleteTenant(ctx.tenant.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Tenant is already scheduled for deletion." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
});
