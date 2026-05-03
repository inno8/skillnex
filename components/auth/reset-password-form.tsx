"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 10) {
      setState({
        kind: "error",
        message: "Password must be at least 10 characters.",
      });
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
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
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
    <form onSubmit={onSubmit} noValidate>
      <div className="input-group">
        <label className="input-label" htmlFor="reset-password">
          New password
        </label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="input"
          placeholder="••••••••"
          required
          minLength={10}
          autoFocus
        />
        <div className="input-helper">At least 10 characters.</div>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="reset-confirm">
          Confirm password
        </label>
        <input
          id="reset-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          className="input"
          placeholder="••••••••"
          required
          minLength={10}
        />
      </div>

      {state.kind === "error" && <div className="auth-alert">{state.message}</div>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={state.kind === "submitting"}
        style={{ width: "100%", height: 42, fontSize: 15, marginTop: 8 }}
      >
        {state.kind === "submitting" ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
