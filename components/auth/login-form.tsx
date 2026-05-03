"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { signIn } from "@/lib/auth/client";

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
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
      // Friendlier messaging for the common failure modes
      const friendly =
        /email not verified/i.test(msg)
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
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@yourcompany.com"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        helper={
          <a
            href="/forgot-password"
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            Forgot password?
          </a>
        }
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
        {state.kind === "submitting" ? "Signing in…" : "Sign in"}
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
  helper?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          className="t-small"
          style={{ color: "var(--ink)", fontWeight: 500 }}
        >
          {label}
        </span>
        {helper && <span className="t-small">{helper}</span>}
      </span>
      <input {...input} className="input" style={{ width: "100%" }} />
    </label>
  );
}
