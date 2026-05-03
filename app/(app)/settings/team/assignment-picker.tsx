"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Icons } from "@/components/icons";

export type RosterEntry = {
  employee_key: string;
  name: string;
  department: string;
  job_title: string | null;
};

/**
 * Inline picker that opens beneath a manager row. Shows the full
 * tenant roster as checkboxes with a search box; checked = assigned.
 * On Save, replaces the manager's whole assignment set.
 *
 * Roster is passed in from the server-rendered parent so opening the
 * picker doesn't trigger a network request — fast for pilot-sized
 * tenants (<300 employees). For 1000+ rows, swap to an autocomplete
 * over a paginated search; not needed yet.
 */
export function AssignmentPicker({
  managerId,
  managerName,
  initialAssigned,
  roster,
  onSaved,
  onCancel,
}: {
  managerId: string;
  managerName: string;
  initialAssigned: string[];
  roster: RosterEntry[];
  onSaved: (newCount: number) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialAssigned));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((e) =>
      [e.name, e.department, e.job_title ?? "", e.employee_key].join(" ").toLowerCase().includes(q),
    );
  }, [query, roster]);

  // Bucket by department for skim-ability — same departments people
  // already see on /people.
  const byDept = useMemo(() => {
    const map = new Map<string, RosterEntry[]>();
    for (const e of filtered) {
      const arr = map.get(e.department) ?? [];
      arr.push(e);
      map.set(e.department, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllInDept(dept: string, dir: "add" | "remove") {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of roster) {
        if (e.department !== dept) continue;
        if (dir === "add") next.add(e.employee_key);
        else next.delete(e.employee_key);
      }
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/settings/team/${encodeURIComponent(managerId)}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_keys: [...selected] }),
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

  // Keyboard escape to cancel.
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
          <div className="t-micro">Assigned reports for</div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{managerName}</div>
        </div>
        <div className="t-small" style={{ color: "var(--muted-1)" }}>
          <span className="tabular">{selected.size}</span> selected ·{" "}
          <span className="tabular">{roster.length}</span> total
        </div>
      </div>

      {roster.length === 0 ? (
        <div
          className="t-small"
          style={{
            color: "var(--muted-2)",
            padding: "16px 0",
            textAlign: "center",
          }}
        >
          No employees in your tenant yet — upload a roster on /ingest first.
        </div>
      ) : (
        <>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Filter by name, department, ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input"
              style={{ width: "100%", paddingLeft: 30, height: 34 }}
            />
            <span
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            >
              <Icons.Search size={14} stroke="var(--muted-2)" />
            </span>
          </div>

          <div
            style={{
              maxHeight: 320,
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--surface)",
            }}
          >
            {byDept.length === 0 ? (
              <div
                className="t-small"
                style={{
                  color: "var(--muted-2)",
                  padding: 12,
                  textAlign: "center",
                }}
              >
                No matches.
              </div>
            ) : (
              byDept.map(([dept, list]) => {
                const allChecked = list.every((e) => selected.has(e.employee_key));
                return (
                  <div
                    key={dept}
                    style={{
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "var(--paper)",
                        position: "sticky",
                        top: 0,
                      }}
                    >
                      <span className="t-micro">
                        {dept} · {list.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => selectAllInDept(dept, allChecked ? "remove" : "add")}
                        className="t-small"
                        style={{
                          color: "var(--accent)",
                          background: "transparent",
                          border: 0,
                          cursor: "pointer",
                          padding: 0,
                          fontWeight: 500,
                        }}
                      >
                        {allChecked ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    {list.map((e) => {
                      const checked = selected.has(e.employee_key);
                      return (
                        <label
                          key={e.employee_key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            cursor: "pointer",
                            borderTop: "1px solid var(--border)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(e.employee_key)}
                            style={{ cursor: "pointer" }}
                          />
                          <span style={{ flex: 1, fontSize: 13 }}>
                            <span style={{ fontWeight: 500 }}>{e.name}</span>
                            {e.job_title && (
                              <span
                                className="t-small"
                                style={{ color: "var(--muted-2)", marginLeft: 8 }}
                              >
                                {e.job_title}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </>
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
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm">
          {busy ? "Saving…" : `Save (${selected.size})`}
        </button>
      </div>
    </div>
  );
}
