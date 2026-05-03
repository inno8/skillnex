"use client";

import { useEffect, useState, type FormEvent } from "react";

/**
 * Confirm-and-send modal for the "Email review to employee" flow.
 *
 * Two scenarios:
 *   - Employee already has an email on file → modal pre-fills it,
 *     manager can override or just hit Send.
 *   - No email on file → modal asks for one. The send endpoint
 *     persists what they type so future cycles don't re-prompt.
 *
 * Optional cover note is appended above the review body in the email.
 */
export function ShareReviewModal({
  employeeName,
  defaultRecipient,
  onClose,
  onSent,
  endpoint,
}: {
  employeeName: string;
  defaultRecipient: string | null;
  onClose: () => void;
  onSent: (info: { recipient: string; messageId: string }) => void;
  /** POST endpoint — `/api/employees/<key>/share`. */
  endpoint: string;
}) {
  const [recipient, setRecipient] = useState(defaultRecipient ?? "");
  const [coverNote, setCoverNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc closes.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [busy, onClose]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_email: recipient.trim() || null,
        cover_note: coverNote.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? `Send failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as { recipient: string; message_id: string };
    onSent({ recipient: data.recipient, messageId: data.message_id });
  }

  return (
    <>
      <div
        // backdrop
        onClick={busy ? undefined : onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(11,15,25,0.4)",
          zIndex: 100,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-review-title"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          width: "min(540px, calc(100vw - 32px))",
          zIndex: 101,
          boxShadow: "0 24px 64px rgba(11,15,25,0.18)",
        }}
      >
        <div className="t-micro" style={{ marginBottom: 6 }}>
          Email performance review
        </div>
        <h2
          id="share-review-title"
          className="t-h2"
          style={{
            margin: "0 0 6px",
            fontFamily: "var(--font-display)",
            fontSize: "1.4rem",
            fontWeight: 500,
            fontVariationSettings: '"opsz" 36',
          }}
        >
          Send {employeeName.split(" ")[0]}'s review.
        </h2>
        <p className="t-small" style={{ color: "var(--muted-1)", marginTop: 0, marginBottom: 18 }}>
          The full review paragraph + bullets go into the body. Optional cover note is added above.{" "}
          {defaultRecipient
            ? "Recipient is pre-filled — change it if needed."
            : "We don't have an email on file for this employee — type one and we'll save it for next cycle."}
        </p>

        <form onSubmit={send} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="t-small" style={{ color: "var(--ink)", fontWeight: 500 }}>
              Recipient email
            </span>
            <input
              type="email"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="employee@company.com"
              disabled={busy}
              autoFocus={!defaultRecipient}
              className="input"
              style={{ height: 38 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="t-small" style={{ color: "var(--ink)", fontWeight: 500 }}>
              Cover note{" "}
              <span style={{ color: "var(--muted-2)", fontWeight: 400 }}>(optional)</span>
            </span>
            <textarea
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              rows={4}
              disabled={busy}
              placeholder="Adds a personal note above the review body. Skip if you don't need one."
              className="input"
              style={{
                width: "100%",
                height: "auto",
                padding: "10px 12px",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                lineHeight: 1.5,
                resize: "vertical",
              }}
            />
          </label>

          {error && (
            <div className="auth-alert" style={{ margin: 0 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
              {busy ? "Sending…" : "Send review"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
