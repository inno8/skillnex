"use client";

import { useState } from "react";

import { Icons } from "@/components/icons";

export function ExportButton() {
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "downloading" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function downloadExport() {
    setState({ kind: "downloading" });
    try {
      const res = await fetch("/api/settings/data/export");
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setState({
          kind: "error",
          message: data?.error ?? `Export failed (${res.status})`,
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Tenant id + ISO date in the filename for readability.
      const cd = res.headers.get("content-disposition") ?? "";
      const fnMatch = /filename="([^"]+)"/.exec(cd);
      a.download = fnMatch?.[1] ?? `skillnex-export.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState({ kind: "idle" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
      <button
        type="button"
        onClick={downloadExport}
        disabled={state.kind === "downloading"}
        className="btn btn-secondary"
      >
        <Icons.Download size={14} />
        {state.kind === "downloading" ? "Building export…" : "Download tenant export (JSON)"}
      </button>
      {state.kind === "error" && (
        <span style={{ color: "var(--destructive)", fontSize: 13 }}>{state.message}</span>
      )}
    </div>
  );
}
