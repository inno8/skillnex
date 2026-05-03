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
    const email = String(form.get("email") ?? "").trim().toLowerCase();
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
        console.error(
          "request-password-reset error",
          res.status,
          await res.text(),
        );
      }
    } catch (err) {
      console.error("request-password-reset network error", err);
    }
    setState({ kind: "sent", email });
  }

  if (state.kind === "sent") {
    return (
      <div
        className="card fade-in"
        style={{
          padding: "20px 24px",
          background: "var(--success-tint)",
          borderColor: "rgba(22,101,52,0.3)",
        }}
      >
        <p
          className="t-h3"
          style={{ marginTop: 0, marginBottom: 6, color: "var(--success)" }}
        >
          Check your inbox
        </p>
        <p style={{ margin: 0, color: "var(--ink)" }}>
          If an account exists for <strong>{state.email}</strong>, we sent a
          password reset link. The link is valid for 1 hour.
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted-1)" }}>
          Don't see it? Check spam, or try again with a different email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span
          className="t-small"
          style={{ color: "var(--ink)", fontWeight: 500 }}
        >
          Work email
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@yourcompany.com"
          className="input"
          style={{ width: "100%" }}
        />
      </label>

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
        {state.kind === "submitting" ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
