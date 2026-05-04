"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function RetentionForm({
  initial,
  region,
  min,
  max,
}: {
  initial: number;
  region: "us" | "eu";
  min: number;
  max: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const days = Number(form.get("days"));
    if (!Number.isFinite(days)) {
      setState({ kind: "error", message: "Enter a number." });
      return;
    }
    setState({ kind: "saving" });
    const res = await fetch("/api/settings/data/retention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retention_days: days }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setState({ kind: "error", message: data?.error ?? `HTTP ${res.status}` });
      return;
    }
    setState({ kind: "saved" });
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <p className="t-small" style={{ color: "var(--muted-1)", marginTop: 0 }}>
        Snapshots older than retention are pruned by the nightly sweep.
        {region === "eu"
          ? " EU tenants are capped at 30 days — enforced as a SQL trigger, not a policy."
          : " US tenants can keep up to 365 days for trend analysis."}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "200px auto auto",
          gap: 12,
          alignItems: "end",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span className="t-small" style={{ color: "var(--ink)", fontWeight: 500 }}>
            Retention (days)
          </span>
          <input
            name="days"
            type="number"
            defaultValue={initial}
            min={min}
            max={max}
            step={1}
            required
            className="input"
            style={{ height: 38 }}
          />
        </label>
        <span className="t-small" style={{ color: "var(--muted-2)" }}>
          {min}–{max} days allowed
        </span>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={state.kind === "saving"}
          style={{ height: 38 }}
        >
          {state.kind === "saving" ? "Saving…" : "Save retention"}
        </button>
      </div>
      {state.kind === "error" && (
        <div className="auth-alert" style={{ margin: 0 }}>
          {state.message}
        </div>
      )}
      {state.kind === "saved" && (
        <div className="auth-alert success" style={{ margin: 0 }}>
          Retention updated.
        </div>
      )}
    </form>
  );
}
