"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export function InviteForm() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const role = String(form.get("role") ?? "manager");
    if (!email) {
      setState({ kind: "error", message: "Email is required." });
      return;
    }
    setState({ kind: "submitting" });
    const res = await fetch("/api/settings/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setState({ kind: "error", message: data?.error ?? `HTTP ${res.status}` });
      return;
    }
    setState({ kind: "sent", email });
    (e.currentTarget as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 200px auto",
          gap: 12,
          alignItems: "end",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span className="t-small" style={{ color: "var(--ink)", fontWeight: 500 }}>
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="teammate@yourcompany.com"
            className="input"
            style={{ height: 38 }}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="t-small" style={{ color: "var(--ink)", fontWeight: 500 }}>
            Role
          </span>
          <select name="role" defaultValue="manager" className="input" style={{ height: 38 }}>
            <option value="admin">Admin · everything except deleting the tenant</option>
            <option value="manager">Manager · upload + write reviews</option>
            <option value="employee">Employee · read their own review only</option>
          </select>
        </label>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={state.kind === "submitting"}
          style={{ height: 38 }}
        >
          {state.kind === "submitting" ? "Sending…" : "Send invitation"}
        </button>
      </div>
      {state.kind === "sent" && (
        <div className="auth-alert success" style={{ margin: 0 }}>
          Invitation sent to <strong>{state.email}</strong>. The link is valid for 7 days.
        </div>
      )}
      {state.kind === "error" && (
        <div className="auth-alert" style={{ margin: 0 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}
