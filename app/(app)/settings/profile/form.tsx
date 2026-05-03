"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type FieldState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

export function ProfileForm({
  initialName,
  email,
  role,
  tenantName,
}: {
  initialName: string;
  email: string;
  role: string;
  tenantName: string;
}) {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <NameSection initialName={initialName} />
      <ReadOnlySection email={email} roleLabel={ROLE_LABEL[role] ?? role} tenantName={tenantName} />
      <PasswordSection />
    </div>
  );
}

function NameSection({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [state, setState] = useState<FieldState>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (name.length < 1) {
      setState({ kind: "error", message: "Name can't be empty." });
      return;
    }
    setState({ kind: "saving" });
    const res = await fetch("/api/settings/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
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
    <form onSubmit={onSubmit} className="card" style={{ padding: 20, display: "grid", gap: 14 }}>
      <div>
        <h2 className="t-h2" style={{ margin: 0 }}>
          Name
        </h2>
        <p className="t-small" style={{ color: "var(--muted-2)", marginTop: 4 }}>
          Shown on team rosters and audit log entries you trigger.
        </p>
      </div>
      <input
        name="name"
        type="text"
        defaultValue={initialName}
        className="input"
        autoComplete="name"
        required
        style={{ height: 38 }}
      />
      {state.kind === "error" && <Banner kind="error" message={state.message} />}
      {state.kind === "saved" && <Banner kind="success" message="Saved." />}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : "Save name"}
        </button>
      </div>
    </form>
  );
}

function ReadOnlySection({
  email,
  roleLabel,
  tenantName,
}: {
  email: string;
  roleLabel: string;
  tenantName: string;
}) {
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h2 className="t-h2" style={{ margin: 0 }}>
        Account
      </h2>
      <Row
        label="Email"
        value={email}
        note="Email change requires re-verification — coming Day 4.5."
      />
      <Row label="Role" value={roleLabel} note="Set by your owner / admin." />
      <Row
        label="Tenant"
        value={tenantName}
        note="Read-only — your account is bound to this tenant."
      />
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 16,
        alignItems: "baseline",
      }}
    >
      <div className="t-small" style={{ color: "var(--muted-1)" }}>
        {label}
      </div>
      <div>
        <div style={{ fontSize: 14 }}>{value}</div>
        <div className="t-small" style={{ color: "var(--muted-2)", fontSize: 12, marginTop: 2 }}>
          {note}
        </div>
      </div>
    </div>
  );
}

function PasswordSection() {
  const [state, setState] = useState<FieldState>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (newPassword.length < 10) {
      setState({
        kind: "error",
        message: "New password must be at least 10 characters.",
      });
      return;
    }
    if (newPassword !== confirm) {
      setState({ kind: "error", message: "Passwords don't match." });
      return;
    }
    setState({ kind: "saving" });
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;
      setState({
        kind: "error",
        message: data?.message ?? data?.error ?? `HTTP ${res.status}`,
      });
      return;
    }
    setState({ kind: "saved" });
    (e.currentTarget as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 20, display: "grid", gap: 14 }}>
      <div>
        <h2 className="t-h2" style={{ margin: 0 }}>
          Change password
        </h2>
        <p className="t-small" style={{ color: "var(--muted-2)", marginTop: 4 }}>
          You'll be signed out of every other session. Minimum 10 characters.
        </p>
      </div>
      <Field label="Current password" name="currentPassword" autoComplete="current-password" />
      <Field label="New password" name="newPassword" autoComplete="new-password" minLength={10} />
      <Field
        label="Confirm new password"
        name="confirm"
        autoComplete="new-password"
        minLength={10}
      />
      {state.kind === "error" && <Banner kind="error" message={state.message} />}
      {state.kind === "saved" && <Banner kind="success" message="Password updated." />}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={state.kind === "saving"}>
          {state.kind === "saving" ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  autoComplete,
  minLength,
}: {
  label: string;
  name: string;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="t-small" style={{ color: "var(--ink)", fontWeight: 500 }}>
        {label}
      </span>
      <input
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        minLength={minLength}
        className="input"
        style={{ height: 38 }}
      />
    </label>
  );
}

function Banner({ kind, message }: { kind: "error" | "success"; message: string }) {
  return (
    <div className={`auth-alert ${kind === "success" ? "success" : ""}`} style={{ margin: 0 }}>
      {message}
    </div>
  );
}
