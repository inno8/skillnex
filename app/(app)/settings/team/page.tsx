import { requireRolePage } from "@/lib/auth/middleware";
import { listAssignedDepartmentsByManager, listTenantDepartments } from "@/lib/manager-assignments";
import { listPendingInvitations, listTeamMembers } from "@/lib/team";

import { InviteForm } from "./invite-form";
import { MemberRow } from "./member-row";
import { InvitationRow } from "./invitation-row";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const ctx = await requireRolePage(["owner", "admin"]);
  const members = listTeamMembers(ctx.tenant.id);
  const invitations = listPendingInvitations(ctx.tenant.id);

  // Per-manager department list — fetched once for the whole table so
  // each row renders without an extra DB call.
  const departmentsByManager = listAssignedDepartmentsByManager(ctx.tenant.id);

  // The picker's option list — every department present in the tenant's
  // current roster. Empty when no upload has happened yet (the picker
  // surfaces a friendly empty state in that case).
  const availableDepartments = listTenantDepartments(ctx.tenant.id);

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="t-h1" style={{ fontSize: "1.875rem", margin: 0 }}>
          Team
        </h1>
        <p className="t-body" style={{ color: "var(--muted-1)", marginTop: 6, marginBottom: 0 }}>
          Invite people to your tenant and assign each manager the departments they're responsible
          for. Owners and admins see every employee. Managers see every employee in their assigned
          departments — current and future uploads alike. Employees see only their own review.
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
        <h2 className="t-h2" style={{ margin: "0 0 4px" }}>
          Members · {members.length}
        </h2>
        <p className="t-small" style={{ color: "var(--muted-2)", margin: "0 0 12px" }}>
          People with login accounts to this tenant. Reviewed employees from your roster live on{" "}
          <strong>People</strong> — they don't need accounts here unless you also want to give them
          access to <strong>/my-review</strong> for their own row (invite them as an Employee).
        </p>
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Member</th>
                <th style={{ width: 120 }}>Role</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 200 }}>Departments</th>
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
                  assignedDepartments={departmentsByManager.get(m.id) ?? []}
                  availableDepartments={availableDepartments}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
