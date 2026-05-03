"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 10) {
      setState({ kind: "error", message: "Password must be at least 10 characters." });
      return;
    }
    if (password !== confirm) {
      setState({ kind: "error", message: "Passwords don't match." });
      return;
    }
    setState({ kind: "submitting" });
    let res: Response;
    try {
      res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password, token }),
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { message?: string }
        | null;
      const msg = data?.message ?? "Reset failed.";
      const friendly = /token|invalid/i.test(msg)
        ? "This reset link is no longer valid. Request a new one."
        : msg;
      setState({ kind: "error", message: friendly });
      return;
    }
    router.push("/login?reset=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        helper="At least 10 characters."
      />
      <Field
        label="Confirm password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
      />

      {state.kind === "error" && (
        <div
          className="card"
          style={{
            padding: "10px 14px",
            background: "var(--destructive-tint)",
            color: "var(--destructive)",
            fontSize: 13,
            borderColor: "rgba(153,27,27,0.3)",
          }}
        >
          {state.message}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={state.kind === "submitting"}
        style={{ height: 40, marginTop: 4 }}
      >
        {state.kind === "submitting" ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

function Field({
  label,
  helper,
  ...input
}: {
  label: string;
  helper?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span className="t-small" style={{ color: "var(--ink)", fontWeight: 500 }}>
        {label}
      </span>
      <input {...input} className="input" style={{ width: "100%" }} />
      {helper && (
        <span className="t-small" style={{ color: "var(--muted-2)", fontSize: 12 }}>
          {helper}
        </span>
      )}
    </label>
  );
}
