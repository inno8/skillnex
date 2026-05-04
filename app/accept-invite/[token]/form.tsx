"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (!name) {
      setState({ kind: "error", message: "Please enter your name." });
      return;
    }
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
    const res = await fetch("/api/accept-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setState({
        kind: "error",
        message: data?.error ?? `Couldn't accept invite (${res.status})`,
      });
      return;
    }
    router.push("/login?invited=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="input-group">
        <label className="input-label" htmlFor="invite-email">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          disabled
          className="input"
          style={{ background: "var(--paper)", color: "var(--muted-1)" }}
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="invite-name">
          Your name
        </label>
        <input
          id="invite-name"
          name="name"
          type="text"
          className="input"
          autoComplete="name"
          required
          autoFocus
          placeholder="Jane Doe"
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="invite-password">
          Choose a password
        </label>
        <input
          id="invite-password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={10}
          placeholder="••••••••"
        />
        <div className="input-helper">At least 10 characters.</div>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor="invite-confirm">
          Confirm password
        </label>
        <input
          id="invite-confirm"
          name="confirm"
          type="password"
          className="input"
          autoComplete="new-password"
          required
          minLength={10}
          placeholder="••••••••"
        />
      </div>

      {state.kind === "error" && <div className="auth-alert">{state.message}</div>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={state.kind === "submitting"}
        style={{ width: "100%", height: 42, fontSize: 15, marginTop: 8 }}
      >
        {state.kind === "submitting" ? "Creating account…" : "Accept and continue"}
      </button>
    </form>
  );
}
