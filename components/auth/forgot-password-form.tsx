"use client";

import { useState, type FormEvent } from "react";

export function ForgotPasswordForm() {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "sent"; email: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (!email) {
      setState({ kind: "error", message: "Email is required." });
      return;
    }
    setState({ kind: "submitting" });
    // better-auth 1.6 uses /api/auth/request-password-reset.
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo: "/reset-password" }),
      });
      if (!res.ok) {
        // Don't leak whether the email exists — show success either way
        // per standard auth UX. Internal error logs catch real failures.
        console.error("request-password-reset error", res.status, await res.text());
      }
    } catch (err) {
      console.error("request-password-reset network error", err);
    }
    setState({ kind: "sent", email });
  }

  if (state.kind === "sent") {
    return (
      <>
        <div className="auth-alert success" style={{ padding: "16px 20px" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Check your inbox</div>
          <div style={{ color: "var(--ink)", fontSize: 14, lineHeight: 1.5 }}>
            If an account exists for <strong>{state.email}</strong>, we sent a password reset link.
            The link is valid for 1 hour.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "100%", height: 42, fontSize: 14 }}
          onClick={() => setState({ kind: "idle" })}
        >
          Try a different email
        </button>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="input-group">
        <label className="input-label" htmlFor="forgot-email">
          Work email
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          className="input"
          placeholder="you@yourcompany.com"
          required
          autoFocus
        />
      </div>

      {state.kind === "error" && <div className="auth-alert">{state.message}</div>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={state.kind === "submitting"}
        style={{ width: "100%", height: 42, fontSize: 15, marginTop: 8 }}
      >
        {state.kind === "submitting" ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
