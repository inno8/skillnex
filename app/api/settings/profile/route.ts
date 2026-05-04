import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, auditFromRequest, requireTenantUserApi } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
});

/**
 * Update the signed-in user's display name. Other profile fields
 * (email, role, tenant) are intentionally NOT settable here:
 * - email needs re-verification (Day 4.5)
 * - role is owner/admin gated and lives on /api/settings/team
 * - tenant is immutable post-signup
 */
export const POST = apiHandler(async (req) => {
  const ctx = await requireTenantUserApi(req);
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
        error: "Invalid name",
        issues: parsed.error.issues.map((i) => i.message),
      },
      { status: 422 },
    );
  }
  const db = getDb();
  db.prepare(`UPDATE user SET name = ?, updatedAt = ? WHERE id = ?`).run(
    parsed.data.name,
    new Date().toISOString(),
    ctx.user.id,
  );
  auditFromRequest(ctx, req, "system_event", {
    target_type: "user",
    target_id: ctx.user.id,
    details: { changed: "name" },
  });
  return NextResponse.json({ ok: true });
});
