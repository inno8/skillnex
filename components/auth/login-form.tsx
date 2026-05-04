"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { signIn } from "@/lib/auth/client";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "needs_verification"; email: string }
  | { kind: "resending" }
  | { kind: "resent"; email: string }
  | { kind: "error"; message: string };

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [emailValue, setEmailValue] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setState({ kind: "error", message: "Email and password required." });
      return;
    }
    setEmailValue(email);
    setState({ kind: "submitting" });
    const { error } = await signIn.email({
      email,
      password,
      callbackURL: "/dashboard",
    });
    if (error) {
      const msg = error.message ?? "Sign-in failed.";
      // The "not verified" branch needs its own state so we can render
      // a Resend-verification action — the user can't fix this with a
      // password retry, no point hiding it behind a generic error pill.
      if (/email.*not.*verified|verify.*email/i.test(msg)) {
        setState({ kind: "needs_verification", email });
        return;
      }
      const friendly = /invalid/i.test(msg) ? "Email or password is incorrect." : msg;
      setState({ kind: "error", message: friendly });
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function resendVerification(email: string) {
    setState({ kind: "resending" });
    try {
      // better-auth exposes /api/auth/send-verification-email when
      // emailVerification is configured. We don't get a typed client
      // method for it on the React SDK in 1.6, so go raw.
      const res = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, callbackURL: "/login?verified=1" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message ?? `HTTP ${res.status}`);
      }
      setState({ kind: "resent", email });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error
            ? `Couldn't send: ${err.message}`
            : "Couldn't send verification email.",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="input-group">
        <label className="input-label" htmlFor="login-email">
          Work email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          className="input"
          placeholder="you@yourcompany.com"
          required
          autoFocus
          defaultValue={emailValue}
        />
      </div>

      <div className="input-group">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <label className="input-label" htmlFor="login-password">
            Password
          </label>
          <a href="/forgot-password" className="auth-link" style={{ fontSize: 13 }}>
            Forgot password?
          </a>
        </div>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="input"
          placeholder="••••••••"
          required
        />
      </div>

      {state.kind === "error" && <div className="auth-alert">{state.message}</div>}

      {state.kind === "needs_verification" && (
        <div
          className="auth-alert"
          style={{
            background: "var(--warning-tint)",
            color: "var(--warning)",
            borderColor: "rgba(146,64,14,0.3)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Email not verified yet</div>
          <div style={{ marginBottom: 10, color: "var(--ink)" }}>
            We sent a verification link to <strong>{state.email}</strong> when you signed up. Click
            it before signing in — or send a fresh link.
          </div>
          <button
            type="button"
            onClick={() => resendVerification(state.email)}
            className="btn btn-secondary btn-sm"
            style={{ background: "var(--surface)" }}
          >
            Resend verification email
          </button>
        </div>
      )}

      {state.kind === "resending" && (
        <div
          className="auth-alert"
          style={{
            background: "var(--paper)",
            color: "var(--muted-1)",
            borderColor: "var(--border)",
          }}
        >
          Sending fresh verification link…
        </div>
      )}

      {state.kind === "resent" && (
        <div className="auth-alert success">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Verification email sent</div>
          <div style={{ color: "var(--ink)" }}>
            Check the inbox for <strong>{state.email}</strong> (and the spam folder). Click the
            link, then come back here to sign in.
          </div>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={state.kind === "submitting" || state.kind === "resending"}
        style={{ width: "100%", height: 42, fontSize: 15, marginTop: 8 }}
      >
        {state.kind === "submitting" ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
