"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { signIn } from "@/lib/auth/client";

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string }
  >({ kind: "idle" });

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
    setState({ kind: "submitting" });
    const { error } = await signIn.email({
      email,
      password,
      callbackURL: "/dashboard",
    });
    if (error) {
      const msg = error.message ?? "Sign-in failed.";
      const friendly = /email not verified/i.test(msg)
        ? "Your email isn't verified yet. Check your inbox for the verification link."
        : /invalid/i.test(msg)
          ? "Email or password is incorrect."
          : msg;
      setState({ kind: "error", message: friendly });
      return;
    }
    router.push("/dashboard");
    router.refresh();
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

      <button
        type="submit"
        className="btn btn-primary"
        disabled={state.kind === "submitting"}
        style={{ width: "100%", height: 42, fontSize: 15, marginTop: 8 }}
      >
        {state.kind === "submitting" ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
