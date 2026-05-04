import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { getDb } from "@/lib/db";
import { getInvitationByToken } from "@/lib/team";

import { AcceptInviteForm } from "./form";

export const metadata: Metadata = {
  title: "Accept invitation · Skillnex",
};

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const invitation = getInvitationByToken(decoded);

  if (!invitation) {
    return <ExpiredOrInvalid reason="not_found" />;
  }
  if (invitation.accepted_at) {
    return <ExpiredOrInvalid reason="already_accepted" />;
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return <ExpiredOrInvalid reason="expired" />;
  }

  // Cross-check: if a user with this email already exists in the same
  // tenant, the invite is moot. Don't let them create a duplicate row.
  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM user WHERE tenant_id = ? AND email = ? AND status != 'deleted'`)
    .get(invitation.tenant_id, invitation.email);
  if (existing) return <ExpiredOrInvalid reason="already_member" />;

  // Tenant name for display
  const tenant = db.prepare(`SELECT name FROM tenants WHERE id = ?`).get(invitation.tenant_id) as
    | { name: string }
    | undefined;

  return (
    <AuthShell variant="register">
      <h1 className="auth-title">You're invited to {tenant?.name ?? "Skillnex"}.</h1>
      <p className="auth-subtitle">
        {invitation.invited_by_email ? (
          <>
            <strong>{invitation.invited_by_email}</strong> invited you to join as a{" "}
            <strong>{invitation.role}</strong>. Set a password and you're in.
          </>
        ) : (
          <>
            You've been invited to join as a <strong>{invitation.role}</strong>. Set a password and
            you're in.
          </>
        )}
      </p>
      <AcceptInviteForm token={decoded} email={invitation.email} />
    </AuthShell>
  );
}

function ExpiredOrInvalid({
  reason,
}: {
  reason: "not_found" | "expired" | "already_accepted" | "already_member";
}) {
  const titles: Record<typeof reason, string> = {
    not_found: "Invitation not found.",
    expired: "This invitation expired.",
    already_accepted: "Already accepted.",
    already_member: "You're already a member.",
  };
  const bodies: Record<typeof reason, string> = {
    not_found: "Double-check the link, or ask your admin to send a fresh invitation.",
    expired: "Invitations are valid for 7 days. Ask your admin to send a new one.",
    already_accepted: "This invitation has already been used. Sign in to your account instead.",
    already_member: "This email is already on the team. Sign in to your account instead.",
  };
  return (
    <AuthShell variant="register">
      <h1 className="auth-title">{titles[reason]}</h1>
      <p className="auth-subtitle">{bodies[reason]}</p>
      <a
        href="/login"
        className="btn btn-primary"
        style={{
          width: "100%",
          height: 42,
          fontSize: 15,
          justifyContent: "center",
        }}
      >
        Go to sign in
      </a>
    </AuthShell>
  );
}
