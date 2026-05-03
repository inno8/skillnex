import { NextResponse } from "next/server";

import { apiHandler, auditFromRequest, requireRoleApi } from "@/lib/auth/middleware";
import { getInvitationByToken, revokeInvitation } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = apiHandler(
  async (req, { params }: { params: Promise<{ token: string }> }) => {
    const ctx = await requireRoleApi(req, ["owner", "admin"]);
    const { token } = await params;
    const decoded = decodeURIComponent(token);

    // Cross-tenant guard — getInvitationByToken doesn't scope by tenant
    // (it's used by /accept-invite too), so we check the invite belongs
    // to this tenant before letting the caller revoke it.
    const invite = getInvitationByToken(decoded);
    if (!invite || invite.tenant_id !== ctx.tenant.id) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const removed = revokeInvitation(ctx.tenant.id, decoded);
    if (!removed) {
      // Either already accepted or already revoked.
      return NextResponse.json(
        { error: "Invitation can't be revoked (already accepted or expired)." },
        { status: 410 },
      );
    }

    auditFromRequest(ctx, req, "system_event", {
      target_type: "invitation",
      target_id: decoded,
      details: { action: "revoked", email: invite.email, role: invite.role },
    });

    return NextResponse.json({ ok: true });
  },
);
