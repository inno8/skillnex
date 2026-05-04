import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { RETENTION_LIMITS, updateRetention } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  retention_days: z.number().int().min(RETENTION_LIMITS.min).max(RETENTION_LIMITS.max),
});

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
    return NextResponse.json(
      {
        error: `Retention must be an integer between ${RETENTION_LIMITS.min} and ${RETENTION_LIMITS.max} days.`,
      },
      { status: 422 },
    );
  }

  const result = updateRetention(ctx.tenant.id, parsed.data.retention_days);
  if (!result.ok) {
    const message =
      result.reason === "eu_cap"
        ? `EU tenants are capped at ${RETENTION_LIMITS.eu_max}-day retention. To go higher, change region (manual support process).`
        : `Retention out of range (${RETENTION_LIMITS.min}–${RETENTION_LIMITS.max} days).`;
    return NextResponse.json({ error: message }, { status: 422 });
  }

  auditFromRequest(ctx, req, "system_event", {
    target_type: "tenant",
    target_id: ctx.tenant.id,
    details: {
      action: "retention_changed",
      from: ctx.tenant.retention_days,
      to: parsed.data.retention_days,
    },
  });

  return NextResponse.json({ ok: true, retention_days: parsed.data.retention_days });
});
