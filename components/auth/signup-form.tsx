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
          We sent a verification link to <strong>{state.email}</strong>. Click
          it to finish creating your account, then sign in.
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted-1)" }}>
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
      <Field
        label="Company name"
        name="company_name"
        type="text"
        autoComplete="organization"
        required
        placeholder="Ryan Law Firm"
      />
      <Field
        label="Your name"
        name="name"
        type="text"
        autoComplete="name"
        required
        placeholder="Jane Doe"
      />
      <Field
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="jane@yourcompany.com"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        helper="At least 10 characters."
      />
      <RegionPicker />

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
        {state.kind === "submitting" ? "Creating account…" : "Create account"}
      </button>

      <p
        className="t-small"
        style={{ color: "var(--muted-2)", marginTop: 4, lineHeight: 1.5 }}
      >
        By creating an account you agree to our Terms and acknowledge our
        Privacy Policy. We sign a Data Processing Agreement before any
        employee data is uploaded.
      </p>
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

function RegionPicker() {
  return (
    <fieldset
      style={{
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: 14,
        margin: 0,
      }}
    >
      <legend
        className="t-small"
        style={{
          padding: "0 6px",
          color: "var(--ink)",
          fontWeight: 500,
        }}
      >
        Where should your data be stored?
      </legend>
      <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
        <label
          style={{ display: "flex", gap: 10, cursor: "pointer", padding: 6 }}
        >
          <input
            type="radio"
            name="region"
            value="us"
            defaultChecked
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ display: "block" }}>United States</span>
            <span
              className="t-small"
              style={{ color: "var(--muted-2)", fontSize: 12 }}
            >
              Default. Hosted in DigitalOcean US-East.
            </span>
          </span>
        </label>
        <label
          style={{ display: "flex", gap: 10, cursor: "pointer", padding: 6 }}
        >
          <input type="radio" name="region" value="eu" style={{ marginTop: 3 }} />
          <span>
            <span style={{ display: "block" }}>European Union</span>
            <span
              className="t-small"
              style={{ color: "var(--muted-2)", fontSize: 12 }}
            >
              For EU resident employees. 30-day retention cap. Real EU
              infrastructure ships post-pilot — disclosed in DPA.
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
