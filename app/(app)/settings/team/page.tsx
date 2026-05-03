import { requireRolePage } from "@/lib/auth/middleware";
import { listPendingInvitations, listTeamMembers } from "@/lib/team";

import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";
import { InvitationRow } from "./invitation-row";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const ctx = await requireRolePage(["owner", "admin"]);
  const members = listTeamMembers(ctx.tenant.id);
  const invitations = listPendingInvitations(ctx.tenant.id);

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="t-h1" style={{ fontSize: "1.875rem", margin: 0 }}>
          Team
        </h1>
        <p className="t-body" style={{ color: "var(--muted-1)", marginTop: 6, marginBottom: 0 }}>
          Invite people to your tenant. Owners and admins manage membership; managers see only their
          assigned reports; employees see only their own review.
        </p>
      </header>

      <section style={{ marginBottom: 32 }}>
        <h2 className="t-h2" style={{ margin: "0 0 12px" }}>
          Invite a teammate
        </h2>
        <InviteForm />
      </section>

      {invitations.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 className="t-h2" style={{ margin: "0 0 12px" }}>
            Pending invitations · {invitations.length}
          </h2>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Email</th>
                  <th style={{ width: 120 }}>Role</th>
                  <th style={{ width: 160 }}>Expires</th>
                  <th style={{ width: 140 }}>Invited by</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <InvitationRow key={inv.token} invitation={inv} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="t-h2" style={{ margin: "0 0 12px" }}>
          Members · {members.length}
        </h2>
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th style={{ width: 120 }}>Role</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 160 }}>Last sign-in</th>
                <th style={{ width: 130 }}></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  currentUserId={ctx.user.id}
                  currentUserRole={ctx.user.role}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
