"use client";

import { useState, type FormEvent } from "react";

type SignupResult =
  | {
      ok: true;
      tenant_id: string;
      user_id: string;
      email: string;
      message: string;
    }
  | { error: string; issues?: Array<{ path: string; message: string }> };

export function SignupForm() {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "success"; email: string; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ kind: "submitting" });
    const payload = {
      company_name: String(form.get("company_name") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
      region: String(form.get("region") ?? "us"),
    };
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as SignupResult;
    if (!res.ok || "error" in data) {
      if ("error" in data) {
        const issues = data.issues ?? [];
        const detail = issues.length
          ? `${data.error}: ${issues.map((i) => `${i.path} — ${i.message}`).join("; ")}`
          : data.error;
        setState({ kind: "error", message: detail });
      } else {
        setState({ kind: "error", message: "Signup failed" });
      }
      return;
    }
    setState({ kind: "success", email: data.email, message: data.message });
  }

  if (state.kind === "success") {
    return (
      <div className="auth-alert success" style={{ padding: "16px 20px" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Check your inbox</div>
        <div style={{ color: "var(--ink)", fontSize: 14, lineHeight: 1.5 }}>
          We sent a verification link to <strong>{state.email}</strong>. Click it to finish creating
          your account, then sign in.
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted-1)" }}>{state.message}</div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="input-group">
        <label className="input-label" htmlFor="signup-company">
          Company name
        </label>
        <input
          id="signup-company"
          name="company_name"
          type="text"
          autoComplete="organization"
          className="input"
          placeholder="Ryan Law Firm"
          required
          autoFocus
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="signup-name">
          Your name
        </label>
        <input
          id="signup-name"
          name="name"
          type="text"
          autoComplete="name"
          className="input"
          placeholder="Jane Doe"
          required
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="signup-email">
          Work email
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          className="input"
          placeholder="jane@yourcompany.com"
          required
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="signup-password">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="input"
          placeholder="••••••••"
          required
          minLength={10}
        />
        <div className="input-helper">At least 10 characters.</div>
      </div>

      <div className="input-group">
        <span className="input-label">Where should your data live?</span>
        <div className="region-picker">
          <label className="region-option">
            <input type="radio" name="region" value="us" defaultChecked />
            <span>
              <span className="region-option-label">United States</span>
              <span className="region-option-desc">Default. Hosted in DigitalOcean US-East.</span>
            </span>
          </label>
          <label className="region-option">
            <input type="radio" name="region" value="eu" />
            <span>
              <span className="region-option-label">European Union</span>
              <span className="region-option-desc">
                For EU resident employees. 30-day retention cap. Real EU infrastructure ships
                post-pilot — disclosed in DPA.
              </span>
            </span>
          </label>
        </div>
      </div>

      {state.kind === "error" && <div className="auth-alert">{state.message}</div>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={state.kind === "submitting"}
        style={{ width: "100%", height: 42, fontSize: 15, marginTop: 8 }}
      >
        {state.kind === "submitting" ? "Creating account…" : "Create account"}
      </button>

      <p
        className="t-small"
        style={{
          color: "var(--muted-2)",
          marginTop: 14,
          lineHeight: 1.5,
          fontSize: 12,
        }}
      >
        By creating an account you agree to our Terms and acknowledge our Privacy Policy. We sign a
        DPA before any employee data is uploaded.
      </p>
    </form>
  );
}
