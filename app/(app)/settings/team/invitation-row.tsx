"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { Invitation, Role } from "@/lib/team";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

export function InvitationRow({ invitation }: { invitation: Invitation }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    if (!confirm(`Revoke the invitation to ${invitation.email}?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/settings/team/invite/${encodeURIComponent(invitation.token)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Couldn't revoke");
      return;
    }
    router.refresh();
  }

  const expires = new Date(invitation.expires_at);
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  return (
    <tr>
      <td>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{invitation.email}</div>
        {error && (
          <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 4 }}>{error}</div>
        )}
      </td>
      <td>
        <span className="chip chip-neutral">{ROLE_LABEL[invitation.role]}</span>
      </td>
      <td className="t-small" style={{ color: "var(--muted-1)" }}>
        in {daysLeft} day{daysLeft === 1 ? "" : "s"}
      </td>
      <td className="t-small" style={{ color: "var(--muted-1)" }}>
        {invitation.invited_by_email ?? "—"}
      </td>
      <td style={{ textAlign: "right" }}>
        <button
          type="button"
          onClick={revoke}
          disabled={busy}
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--destructive)" }}
        >
          {busy ? "Revoking…" : "Revoke"}
        </button>
      </td>
    </tr>
  );
}
