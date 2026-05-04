"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Icons } from "@/components/icons";
import { Avatar, Chip, SparkBar } from "@/components/primitives";
import { FLAG_LABELS, type FlagKey } from "@/lib/anomalies";
import { formatCurrency, initialsFromName } from "@/lib/utils";

export type PeopleRowProps = {
  employee_key: string;
  name: string;
  email: string | null;
  department: string;
  sub_department: string | null;
  job_title: string | null;
  region: string | null;
  location: string | null;
  level: string | null;
  source_ids_activity_id: string;
  salary: number | null;
  computed: {
    value_score: number;
    roi: number | null;
    dept_rank: number;
    dept_size: number;
  } | null;
  flags: FlagKey[];
  /** owner|admin|manager can edit; managers can only edit within their
   *  assigned departments — the API enforces it but we hide the button
   *  for the employee role to keep the UI honest. */
  canEdit: boolean;
};

/**
 * One row in the /people table. Plain text by default; click the small
 * pencil to swap Name + Email into inline inputs with Save / Cancel.
 *
 * Save PATCHes /api/employees/[key]. Only `name` and `email` are
 * editable here on purpose — every other field comes from the source
 * xlsx and shouldn't be hand-overridden.
 */
export function PeopleRow({ row }: { row: PeopleRowProps }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(row.name);
  const [email, setEmail] = useState(row.email ?? "");

  const c = row.computed;
  const displayFlags = row.flags.filter((f) => f !== "top-performer");

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/employees/${encodeURIComponent(row.employee_key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? `Save failed (${res.status})`);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function cancel() {
    setName(row.name);
    setEmail(row.email ?? "");
    setError(null);
    setEditing(false);
  }

  return (
    <tr>
      <td>
        {displayFlags.length === 0 ? (
          <span className="t-small" style={{ color: "var(--muted-3)" }}>
            —
          </span>
        ) : (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Chip kind="anomaly">{FLAG_LABELS[displayFlags[0]]}</Chip>
            {displayFlags.length > 1 && <Chip kind="neutral">+{displayFlags.length - 1}</Chip>}
          </div>
        )}
      </td>
      <td>
        {editing ? (
          <input
            type="text"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            disabled={busy}
            className="input"
            style={{ width: "100%", height: 30, fontSize: 13 }}
            placeholder="Full name"
            required
          />
        ) : (
          <Link
            href={`/people/${encodeURIComponent(row.employee_key)}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <Avatar initials={initialsFromName(row.name)} />
            <div>
              <div style={{ fontWeight: 500 }}>{row.name}</div>
              <div className="t-small" style={{ color: "var(--muted-2)" }}>
                {row.job_title ?? row.source_ids_activity_id}
              </div>
            </div>
          </Link>
        )}
      </td>
      <td>
        {editing ? (
          <input
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            disabled={busy}
            className="input"
            style={{ width: "100%", height: 30, fontSize: 13 }}
            placeholder="employee@company.com"
          />
        ) : row.email ? (
          <span className="t-small" style={{ color: "var(--ink)" }}>
            {row.email}
          </span>
        ) : (
          <span className="t-small" style={{ color: "var(--muted-3)" }}>
            —
          </span>
        )}
        {error && (
          <div style={{ color: "var(--destructive)", fontSize: 12, marginTop: 4 }}>{error}</div>
        )}
      </td>
      <td>
        <div>{row.department}</div>
        <div className="t-small" style={{ color: "var(--muted-2)" }}>
          {row.sub_department ?? row.region ?? row.location ?? row.level ?? "—"}
        </div>
      </td>
      <td className="num" style={{ textAlign: "right" }}>
        {c ? `${c.dept_rank} / ${c.dept_size}` : "—"}
      </td>
      <td className="num" style={{ textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <SparkBar value={c?.value_score ?? 0} width={56} />
          <span style={{ minWidth: 40, textAlign: "right" }}>
            {c ? c.value_score.toFixed(1) : "—"}
          </span>
        </div>
      </td>
      <td className="num" style={{ textAlign: "right" }}>
        {c?.roi != null ? `${c.roi.toFixed(2)}x` : "—"}
      </td>
      <td className="num" style={{ textAlign: "right" }}>
        {formatCurrency(row.salary)}
      </td>
      <td style={{ textAlign: "right" }}>
        {row.canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-ghost btn-sm"
            style={{ padding: "0 8px", height: 26, fontSize: 12 }}
            title="Edit name + email"
          >
            <Icons.Settings size={12} />
            Edit
          </button>
        )}
        {editing && (
          <form onSubmit={save} style={{ display: "inline-flex", gap: 4 }}>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="btn btn-ghost btn-sm"
              style={{ padding: "0 8px", height: 26, fontSize: 12 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary btn-sm"
              style={{ padding: "0 8px", height: 26, fontSize: 12 }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}
