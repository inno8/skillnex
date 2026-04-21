"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type UploadResult = {
  ok: true;
  upload_id: number;
  shape: "A" | "B";
  employee_count: number;
  unjoined_names: string[];
  row_counts: Record<string, number>;
  date_range: { from: string; to: string };
};

type UploadError = { error: string; details?: unknown };

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "hover" }
    | { kind: "uploading"; filename: string }
    | { kind: "success"; result: UploadResult; filename: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function submit(file: File) {
    setState({ kind: "uploading", filename: file.name });
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", body });
    const data = (await res.json()) as UploadResult | UploadError;
    if (!res.ok || !("ok" in data)) {
      setState({
        kind: "error",
        message: "error" in data ? data.error : "Upload failed",
      });
      return;
    }
    setState({ kind: "success", result: data, filename: file.name });
    router.refresh();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void submit(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void submit(file);
  }

  const hover = state.kind === "hover";
  const busy = state.kind === "uploading";

  return (
    <div className="space-y-md">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setState({ kind: "hover" });
        }}
        onDragLeave={() => setState({ kind: "idle" })}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-4xl text-center space-y-md cursor-pointer transition-colors duration-short ${
          hover
            ? "border-accent bg-accent-tint/40"
            : "border-border bg-surface shadow-card"
        } ${busy ? "opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onChange}
          className="hidden"
        />
        {state.kind === "uploading" ? (
          <>
            <p className="micro text-muted-2">Processing</p>
            <p className="font-display text-2xl font-medium text-ink">
              {state.filename}
            </p>
            <p className="text-sm text-muted-1">
              Parsing, joining, scoring…
            </p>
          </>
        ) : state.kind === "success" ? (
          <>
            <p className="micro" style={{ color: "var(--success)" }}>
              Uploaded — Shape {state.result.shape}
            </p>
            <p className="font-display text-2xl font-medium text-ink">
              {state.filename}
            </p>
            <p className="text-sm text-muted-1">
              {state.result.employee_count} employees scored
              {state.result.unjoined_names.length > 0
                ? ` · ${state.result.unjoined_names.length} missing salary`
                : ""}
              {" · "}
              {state.result.date_range.from} → {state.result.date_range.to}
            </p>
          </>
        ) : (
          <>
            <p className="micro text-muted-2">Drag-drop or click to upload</p>
            <p className="font-display text-2xl font-medium text-ink">
              .xlsx workbook
            </p>
            <p className="text-sm text-muted-1">
              Sales Team + Engineering + Payroll — or HR Activity Log +
              Employee Compensation. Both shapes detected automatically.
            </p>
          </>
        )}
      </div>
      {state.kind === "error" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-lg py-md text-sm text-destructive">
          {state.message}
        </div>
      )}
    </div>
  );
}
