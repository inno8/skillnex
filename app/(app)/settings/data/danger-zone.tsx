"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function DangerZone({ tenantName }: { tenantName: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const typed = String(form.get("confirm") ?? "");
    if (typed !== tenantName) {
      setState({
        kind: "error",
        message: `Tenant name doesn't match. Type "${tenantName}" exactly to confirm.`,
      });
      return;
    }
    if (
      !confirm(
        `Soft-delete tenant "${tenantName}"? You'll be signed out immediately. Data is recoverable for 30 days, then permanently removed.`,
      )
    ) {
      return;
    }
    setState({ kind: "submitting" });
    const res = await fetch("/api/settings/data/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setState({
        kind: "error",
        message: data?.error ?? `Delete failed (${res.status})`,
      });
      return;
    }
    // Tenant is soft-deleted; the next request will fail the auth gate.
    // Bounce through /logout for cleanliness.
    router.push("/logout");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card"
      style={{
        padding: 20,
        display: "grid",
        gap: 12,
        borderColor: "rgba(153,27,27,0.3)",
        background: "var(--destructive-tint)",
      }}
    >
      <p className="t-small" style={{ color: "var(--ink)", marginTop: 0 }}>
        Deleting your tenant signs every member out and starts a 30-day grace period. Within 30 days
        you can request restore by emailing support; after that the data is permanently gone.
      </p>
      <p className="t-small" style={{ color: "var(--ink)", marginTop: 0 }}>
        Type the tenant name <strong>{tenantName}</strong> below to confirm.
      </p>
      <input
        name="confirm"
        type="text"
        autoComplete="off"
        required
        className="input"
        placeholder={tenantName}
        style={{ height: 38 }}
      />
      {state.kind === "error" && (
        <div className="auth-alert" style={{ margin: 0 }}>
          {state.message}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={state.kind === "submitting"}
          className="btn"
          style={{
            background: "var(--destructive)",
            color: "#fff",
            height: 38,
          }}
        >
          {state.kind === "submitting" ? "Deleting…" : "Soft-delete tenant"}
        </button>
      </div>
    </form>
  );
}
