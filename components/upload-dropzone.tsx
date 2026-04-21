"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { Icons } from "./icons";
import { Chip } from "./primitives";

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
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<
    | { kind: "idle" }
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
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void submit(file);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void submit(file);
  }

  const busy = state.kind === "uploading";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        className={`dropzone ${dragging ? "active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: "56px 32px",
          textAlign: "center",
          cursor: "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onChange}
          style={{ display: "none" }}
        />
        <div
          style={{
            display: "inline-flex",
            padding: 14,
            border: "1px solid var(--border)",
            borderRadius: "50%",
            marginBottom: 16,
            background: "var(--paper)",
          }}
        >
          {busy ? (
            <span
              className="spin"
              style={{
                width: 22,
                height: 22,
                border: "1.5px solid var(--border-strong)",
                borderTop: "1.5px solid var(--ink)",
                borderRadius: "50%",
              }}
            />
          ) : (
            <Icons.Upload size={22} stroke="var(--ink)" />
          )}
        </div>
        <div className="t-h3" style={{ marginBottom: 4 }}>
          {state.kind === "uploading"
            ? `Processing ${state.filename}…`
            : state.kind === "success"
              ? `${state.filename} · ${state.result.employee_count} employees scored`
              : "Drop an Excel workbook"}
        </div>
        <div className="t-small" style={{ color: "var(--muted-2)" }}>
          {state.kind === "success"
            ? `Shape ${state.result.shape} · ${state.result.date_range.from} → ${state.result.date_range.to}${
                state.result.unjoined_names.length > 0
                  ? ` · ${state.result.unjoined_names.length} missing salary`
                  : ""
              }`
            : "Accepts .xlsx, .xls · Up to 10 MB per file · Parses and joins sheets automatically."}
        </div>
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 8,
            justifyContent: "center",
          }}
        >
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <Icons.Upload size={14} stroke="#fff" />
            Choose file
          </button>
          <a
            href="/samples/skillnex-demo.xlsx"
            className="btn btn-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <Icons.Download size={13} />
            Download sample
          </a>
        </div>
      </div>

      {state.kind === "success" && (
        <div
          className="fade-in"
          style={{
            padding: "16px 20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <div className="t-micro">Employees joined</div>
              <div className="t-num-md" style={{ marginTop: 2 }}>
                {state.result.employee_count}
              </div>
            </div>
            <div style={{ width: 1, background: "var(--border)" }} />
            <div>
              <div className="t-micro">Missing salary</div>
              <div
                className="t-num-md"
                style={{
                  marginTop: 2,
                  color:
                    state.result.unjoined_names.length > 0
                      ? "var(--accent)"
                      : "var(--ink)",
                }}
              >
                {state.result.unjoined_names.length}
              </div>
            </div>
            <div style={{ width: 1, background: "var(--border)" }} />
            <div>
              <div className="t-micro">Shape</div>
              <div className="t-num-md" style={{ marginTop: 2 }}>
                {state.result.shape}
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <a
            href="/dashboard"
            className="btn btn-primary"
            onClick={() => router.push("/dashboard")}
          >
            Continue to overview <Icons.ArrowRight size={14} stroke="#fff" />
          </a>
        </div>
      )}

      {state.kind === "error" && (
        <div
          className="card fade-in"
          style={{
            padding: "12px 16px",
            borderColor: "rgba(153,27,27,0.3)",
            background: "var(--destructive-tint)",
            color: "var(--destructive)",
            fontSize: 13,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Icons.Alert size={14} stroke="var(--destructive)" />
          <div style={{ flex: 1 }}>{state.message}</div>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => setState({ kind: "idle" })}
            style={{ color: "var(--destructive)" }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {[
          {
            n: "01",
            h: "Shape detection",
            t: "We look at the sheet names in your workbook and auto-detect whether it's the combined Sales + Engineering + Payroll format or the HR-only format.",
          },
          {
            n: "02",
            h: "Name-based joining",
            t: "Activity rows are joined to Payroll / Compensation by name. Unjoined employees are reported, not dropped.",
          },
          {
            n: "03",
            h: "Department-aware scoring",
            t: "Each department has its own value model. HR uses an Activity Impact Score. Sales and Engineering return a dollar ROI.",
          },
        ].map((b) => (
          <div key={b.n} style={{ padding: 20, background: "var(--surface)" }}>
            <div
              className="font-mono"
              style={{
                fontSize: 11,
                color: "var(--muted-2)",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              {b.n}
            </div>
            <div className="t-h3" style={{ marginBottom: 6 }}>
              {b.h}
            </div>
            <div className="t-small">{b.t}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "14px 16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 4,
        }}
      >
        <Icons.Alert size={16} stroke="var(--warning)" />
        <div
          className="t-small"
          style={{ color: "var(--muted-1)", flex: 1 }}
        >
          Salary and activity data are sensitive. Demo runs locally — nothing
          leaves this browser until you approve it.
        </div>
        <Chip kind="warning" icon={<Icons.Check size={10} />}>Local only</Chip>
      </div>
    </div>
  );
}
