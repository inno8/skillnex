import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { sendInvitationEmail } from "@/lib/email/resend";
import { createInvitation } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "manager", "employee"]),
  // Note: 'owner' deliberately excluded — promotion to owner happens
  // via /api/settings/team/[id]/role on an existing member, never via
  // a fresh invite. Keeps the surface area smaller.
});

export const POST = apiHandler(async (req) => {
  const ctx = await requireRoleApi(req, ["owner", "admin"]);

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
        error: "Invalid invitation",
        issues: parsed.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`),
      },
      { status: 422 },
    );
  }

  const result = createInvitation({
    tenant_id: ctx.tenant.id,
    email: parsed.data.email,
    role: parsed.data.role,
    invited_by_user_id: ctx.user.id,
    expiresInDays: 7,
  });

  if (!result.ok) {
    const message =
      result.reason === "already_member"
        ? `${parsed.data.email} is already a member of your tenant.`
        : `${parsed.data.email} already has a pending invitation. Revoke it before sending a new one.`;
    return NextResponse.json({ error: message }, { status: 409 });
  }

  // Email is best-effort — if it fails, the invitation row still exists
  // and the inviter can copy the URL from /settings/team. We log the
  // outcome so a failed delivery is investigable.
  const baseUrl = process.env.SKILLNEX_BASE_URL ?? "http://localhost:3000";
  const acceptUrl = `${baseUrl}/accept-invite/${encodeURIComponent(result.invitation.token)}`;
  const sendResult = await sendInvitationEmail({
    to: result.invitation.email,
    inviterName: ctx.user.name ?? ctx.user.email,
    tenantName: ctx.tenant.name,
    role: parsed.data.role,
    acceptUrl,
  });

  auditFromRequest(ctx, req, "user_invited", {
    target_type: "invitation",
    target_id: result.invitation.token,
    details: {
      email: result.invitation.email,
      role: result.invitation.role,
      email_sent: sendResult.ok,
      email_error: sendResult.ok ? undefined : sendResult.error,
    },
  });

  return NextResponse.json({
    ok: true,
    invitation: {
      token: result.invitation.token,
      email: result.invitation.email,
      role: result.invitation.role,
      expires_at: result.invitation.expires_at,
    },
    accept_url: acceptUrl,
    email_sent: sendResult.ok,
  });
});
