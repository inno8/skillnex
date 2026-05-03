"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Avatar } from "@/components/primitives";
import { initialsFromName } from "@/lib/utils";
import type { Role, TeamMember } from "@/lib/team";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

export function MemberRow({
  member,
  currentUserId,
  currentUserRole,
}: {
  member: TeamMember;
  currentUserId: string;
  currentUserRole: Role;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSelf = member.id === currentUserId;
  // Admins can change managers/employees but can't touch owners. Only
  // owners can change other owners (and the lib/team guards still
  // refuse to orphan the last owner).
  const canEditRole =
    !isSelf &&
    (currentUserRole === "owner" || (currentUserRole === "admin" && member.role !== "owner"));
  const canSuspend =
    !isSelf &&
    (currentUserRole === "owner" || (currentUserRole === "admin" && member.role !== "owner"));

  async function changeRole(newRole: Role) {
    if (newRole === member.role) return;
    setError(null);
    setBusy("role");
    const res = await fetch(`/api/settings/team/${encodeURIComponent(member.id)}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? `Couldn't change role (${res.status})`);
      return;
    }
    router.refresh();
  }

  async function toggleStatus() {
    setError(null);
    const action = member.status === "suspended" ? "restore" : "suspend";
    setBusy(action);
    const res = await fetch(`/api/settings/team/${encodeURIComponent(member.id)}/${action}`, {
      method: "POST",
    });
    setBusy(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? `Couldn't ${action} (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <tr style={member.status === "suspended" ? { opacity: 0.6 } : undefined}>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar initials={initialsFromName(member.name ?? member.email)} />
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {member.name ?? member.email.split("@")[0]}
              {isSelf && (
                <span className="t-small" style={{ color: "var(--muted-2)", marginLeft: 6 }}>
                  (you)
                </span>
              )}
            </div>
            <div className="t-small" style={{ color: "var(--muted-2)" }}>
              {member.email}
            </div>
            {error && (
              <div
                style={{
                  color: "var(--destructive)",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>
      </td>
      <td>
        {canEditRole ? (
          <select
            value={member.role}
            onChange={(e) => changeRole(e.target.value as Role)}
            disabled={busy === "role"}
            className="input"
            style={{ height: 30, fontSize: 13, padding: "0 8px" }}
          >
            {(Object.keys(ROLE_LABEL) as Role[])
              // Admins can't grant Owner.
              .filter((r) => currentUserRole === "owner" || r !== "owner")
              .map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
          </select>
        ) : (
          <span className="chip chip-neutral">{ROLE_LABEL[member.role]}</span>
        )}
      </td>
      <td>
        <StatusChip status={member.status} verified={member.emailVerified === 1} />
      </td>
      <td className="t-small" style={{ color: "var(--muted-1)" }}>
        {member.last_login_at ? new Date(member.last_login_at).toLocaleDateString() : "—"}
      </td>
      <td style={{ textAlign: "right" }}>
        {canSuspend && (
          <button
            type="button"
            onClick={toggleStatus}
            disabled={busy === "suspend" || busy === "restore"}
            className="btn btn-ghost btn-sm"
            style={
              member.status === "suspended"
                ? { color: "var(--success)" }
                : { color: "var(--destructive)" }
            }
          >
            {busy === "suspend"
              ? "Suspending…"
              : busy === "restore"
                ? "Restoring…"
                : member.status === "suspended"
                  ? "Restore"
                  : "Suspend"}
          </button>
        )}
      </td>
    </tr>
  );
}

function StatusChip({ status, verified }: { status: TeamMember["status"]; verified: boolean }) {
  if (status === "suspended") return <span className="chip chip-warning">Suspended</span>;
  if (status === "deleted") return <span className="chip chip-anomaly">Deleted</span>;
  if (status === "invited") return <span className="chip chip-neutral">Invited</span>;
  if (!verified) return <span className="chip chip-warning">Email unverified</span>;
  return <span className="chip chip-success">Active</span>;
}
