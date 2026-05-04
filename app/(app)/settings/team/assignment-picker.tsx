"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inline picker that opens beneath a manager row. Lists every department
 * that exists in the tenant's roster as a checkbox; checked = the manager
 * sees that department (every current and future employee in it). On
 * Save, replaces the manager's whole department set in one PUT.
 *
 * Why department-scope (not per-employee): see lib/manager-assignments.ts.
 * Short version: real managers run departments, and per-employee scope
 * would force re-assignment every cycle as employee_key strings change.
 */
export function AssignmentPicker({
  managerId,
  managerName,
  initialAssigned,
  availableDepartments,
  onSaved,
  onCancel,
}: {
  managerId: string;
  managerName: string;
  initialAssigned: string[];
  availableDepartments: string[];
  onSaved: (newCount: number) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialAssigned));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(dept: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/settings/team/${encodeURIComponent(managerId)}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departments: [...selected] }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? `Couldn't save (${res.status})`);
      return;
    }
    onSaved(selected.size);
    router.refresh();
  }

  // Esc cancels.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: 16,
        margin: "8px 0 4px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <div className="t-micro">Departments {managerName} covers</div>
          <div className="t-small" style={{ color: "var(--muted-1)", marginTop: 2 }}>
            They'll see every employee in the selected departments — current and future uploads
            alike.
          </div>
        </div>
        <div className="t-small" style={{ color: "var(--muted-1)" }}>
          <span className="tabular">{selected.size}</span> /{" "}
          <span className="tabular">{availableDepartments.length}</span> selected
        </div>
      </div>

      {availableDepartments.length === 0 ? (
        <div
          className="t-small"
          style={{
            color: "var(--muted-2)",
            padding: "16px 0",
            textAlign: "center",
          }}
        >
          No departments in your tenant yet — upload a roster on <strong>/ingest</strong> first.
          Once the roster's in, the departments appear here as checkboxes.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 8,
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--surface)",
            padding: 8,
          }}
        >
          {availableDepartments.map((dept) => {
            const checked = selected.has(dept);
            return (
              <label
                key={dept}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderRadius: 4,
                  background: checked ? "var(--accent-tint-weak)" : "transparent",
                  border: `1px solid ${checked ? "var(--accent-tint)" : "var(--border)"}`,
                  transition: "background-color 120ms, border-color 120ms",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(dept)}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{dept}</span>
              </label>
            );
          })}
        </div>
      )}

      {error && (
        <div className="auth-alert" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 14,
        }}
      >
        <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || availableDepartments.length === 0}
          className="btn btn-primary btn-sm"
        >
          {busy ? "Saving…" : selected.size === 0 ? "Save (none)" : `Save (${selected.size})`}
        </button>
      </div>
    </div>
  );
}
