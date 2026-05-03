import { NextResponse } from "next/server";
import { z } from "zod";

import { auditLog } from "@/lib/auth/audit";
import { auth } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { getInvitationByToken, markInvitationAccepted } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(8),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(10).max(128),
});

/**
 * Public endpoint — anyone with a valid token can accept. We re-check
 * the invite is live (not expired, not accepted, no shadow user) before
 * creating anything; cross-tenant safety is guaranteed because the
 * invite carries its own tenant_id.
 *
 * Created users are auto-verified — they came in through a link sent
 * to a verified mailbox, no need to re-verify.
 */
export async function POST(req: Request) {
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
        error: "Invalid input",
        issues: parsed.error.issues.map((i) => i.message),
      },
      { status: 422 },
    );
  }
  const { token, name, password } = parsed.data;

  const invitation = getInvitationByToken(token);
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }
  if (invitation.accepted_at) {
    return NextResponse.json(
      { error: "This invitation has already been accepted." },
      { status: 410 },
    );
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
  }

  const db = getDb();
  const existingUser = db
    .prepare(`SELECT id FROM user WHERE tenant_id = ? AND email = ? AND status != 'deleted'`)
    .get(invitation.tenant_id, invitation.email);
  if (existingUser) {
    // Mark invite accepted so the row goes away from /settings/team.
    markInvitationAccepted(token);
    return NextResponse.json(
      { error: "An account with this email already exists in the tenant." },
      { status: 409 },
    );
  }

  // Create via better-auth's programmatic signUpEmail (same path used
  // by /api/signup) so the password gets the standard argon2id hash
  // and the additionalFields plumbing fires.
  type SignUpResult = { user?: { id?: string } };
  let signupResult: SignUpResult;
  try {
    signupResult = (await auth.api.signUpEmail({
      body: {
        email: invitation.email,
        password,
        name,
        tenant_id: invitation.tenant_id,
        role: invitation.role,
        status: "active",
      },
    } as never)) as SignUpResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signup failed";
    console.error("accept-invite signUpEmail failed", invitation.email, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const userId = signupResult.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "User creation failed (no id returned)" }, { status: 500 });
  }

  // Skip the email-verification gate — they reached this page via a
  // link sent to their mailbox, the email is already proven.
  db.prepare(`UPDATE user SET emailVerified = 1, updatedAt = ? WHERE id = ?`).run(
    new Date().toISOString(),
    userId,
  );

  markInvitationAccepted(token);

  auditLog({
    tenant_id: invitation.tenant_id,
    user_id: userId,
    action: "invitation_accepted",
    target_type: "user",
    target_id: userId,
    ip_address: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent"),
    details: {
      email: invitation.email,
      role: invitation.role,
      invited_by_user_id: invitation.invited_by_user_id,
    },
  });

  return NextResponse.json({ ok: true, user_id: userId });
}
