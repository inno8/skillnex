"use client";

import { useState } from "react";

import { Icons } from "@/components/icons";

/**
 * Action buttons in the employee detail header. Lives in a client
 * component so the Export PDF button can manage its own busy state
 * while the server renders the PDF — keeps the rest of the detail page
 * server-rendered.
 *
 * "Export PDF" hits GET /api/employees/<key>/pdf, which renders the
 * SAME pdfkit document the share endpoint attaches to the email. That
 * way the printable archival copy and the emailed copy are always
 * byte-equivalent — no "the email said X but the PDF says Y" support
 * tickets. Browser sees Content-Disposition: attachment and saves the
 * file directly; no print dialog, no Save-as-PDF dance.
 *
 * "Approve & lock" used to live here as a placeholder. Removed because
 * the workflow isn't designed: see docs/todo-approval-workflow.md for
 * the full Option C design when an enterprise prospect actually asks.
 */
export function EmployeeActions({
  employeeKey,
  hasNarrative,
}: {
  employeeKey: string;
  /** When false the button is disabled — server would 422 anyway, no
   *  point letting the user click into the error. */
  hasNarrative: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportPdf() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(employeeKey)}/pdf`, {
        method: "GET",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      // Pull the filename out of the Content-Disposition header so
      // the saved file matches what the email attachment is called.
      // Falls back to a sensible default if the header is missing.
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `skillnex-review-${employeeKey}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Hand the blob back to the GC — Chrome leaks them otherwise.
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={exportPdf}
          disabled={busy || !hasNarrative}
          title={hasNarrative ? "Download the review as PDF" : "Generate a narrative first"}
        >
          <Icons.Download size={13} /> {busy ? "Exporting…" : "Export PDF"}
        </button>
      </div>
      {error && (
        <div className="t-small" style={{ color: "var(--destructive)" }} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
