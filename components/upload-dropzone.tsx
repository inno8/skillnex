"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { Icons } from "./icons";
import { Chip } from "./primitives";

type UploadResult = {
  ok: true;
  upload_id: number;
  shape: "A" | "B" | "C";
  employee_count: number;
  cycle_label: string;
  unjoined_names: string[];
  row_counts: Record<string, number>;
  date_range: { from: string; to: string };
};

type PickSheetError = {
  error: string;
  code: "pick_sheet";
  sheets: string[];
};

type GenericError = { error: string; details?: unknown };

/**
 * UploadDropzone — drag-and-drop or browse for an HR data file.
 *
 * Two-step path for files that don't match Shape A/B:
 *   1. POST → server returns 422 + code='pick_sheet' + sheets[]
 *   2. UI shows a picker → user clicks a sheet → re-POST with `sheet`
 *      → Shape C runs against that sheet
 *
 * Single-sheet xlsx and CSV skip the picker — they go straight through.
 *
 * Cycle is a free-text label submitted alongside the file. Companies
 * run reviews quarterly (Q1 / Q2 / …) or annually — the field accepts
 * either. Empty value falls back to the server default.
 */
export function UploadDropzone({
  suggestedCycle,
  previousCycle,
}: {
  /** What we'll prefill the cycle field with. Caller computes this
   *  from the latest upload — usually the next quarter. */
  suggestedCycle: string;
  /** Last cycle this tenant uploaded under, if any. Surfaced in the
   *  hint text so the user knows what they uploaded last time. */
  previousCycle: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cycleLabel, setCycleLabel] = useState(suggestedCycle);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "uploading"; filename: string }
    | { kind: "pick_sheet"; filename: string; file: File; sheets: string[] }
    | { kind: "success"; result: UploadResult; filename: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  /**
   * Submit a file. `sheetHint` is supplied on the second attempt after
   * the user has picked a sheet from the modal.
   */
  async function submit(file: File, sheetHint?: string) {
    setState({ kind: "uploading", filename: file.name });
    const body = new FormData();
    body.set("file", file);
    if (sheetHint) body.set("sheet", sheetHint);
    if (cycleLabel.trim()) body.set("cycle_label", cycleLabel.trim());
    const res = await fetch("/api/upload", { method: "POST", body });
    const data = (await res.json()) as UploadResult | PickSheetError | GenericError;

    if (!res.ok) {
      if ("code" in data && data.code === "pick_sheet") {
        setState({
          kind: "pick_sheet",
          filename: file.name,
          file,
          sheets: data.sheets,
        });
        return;
      }
      setState({
        kind: "error",
        message: "error" in data ? data.error : "Upload failed",
      });
      return;
    }
    if (!("ok" in data)) {
      setState({ kind: "error", message: "error" in data ? data.error : "Upload failed" });
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
      {/* Cycle field — sits ABOVE the dropzone so the user picks the
          cycle BEFORE clicking upload. Free text; defaults to the
          suggested next cycle but trivially overridable. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 4,
        }}
      >
        <label
          htmlFor="cycle-label-input"
          className="t-small"
          style={{
            color: "var(--ink)",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Review cycle
        </label>
        <input
          id="cycle-label-input"
          type="text"
          value={cycleLabel}
          onChange={(e) => setCycleLabel(e.target.value)}
          placeholder="Q2 2026"
          maxLength={64}
          disabled={busy}
          className="input"
          style={{ height: 34, fontSize: 14, flex: "0 1 200px" }}
        />
        <div className="t-small" style={{ color: "var(--muted-2)", flex: 1 }}>
          {previousCycle
            ? `Last upload was ${previousCycle}. New uploads under a different label create a new cycle.`
            : "Free text — Q1 2026, Annual 2025, Mid-year, etc. Same label = same cycle (re-uploading preserves narratives)."}
        </div>
      </div>

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
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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
              : "Drop an Excel or CSV file"}
        </div>
        <div className="t-small" style={{ color: "var(--muted-2)" }}>
          {state.kind === "success"
            ? `${state.result.cycle_label} · Shape ${state.result.shape} · ${state.result.date_range.from} → ${state.result.date_range.to}${
                state.result.unjoined_names.length > 0
                  ? ` · ${state.result.unjoined_names.length} missing salary`
                  : ""
              }`
            : "Accepts .xlsx, .xls, .csv · Up to 10 MB · Multi-tab workbooks ask which sheet to use."}
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

      {state.kind === "pick_sheet" && (
        <SheetPickerModal
          filename={state.filename}
          sheets={state.sheets}
          onCancel={() => setState({ kind: "idle" })}
          onPick={(sheet) => void submit(state.file, sheet)}
        />
      )}

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
                  color: state.result.unjoined_names.length > 0 ? "var(--accent)" : "var(--ink)",
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
            h: "Auto-detect",
            t: "Skillnex auto-detects whether your workbook is the Sales+Engineering+Payroll format, the HR-only format, or arbitrary HR data — and falls back gracefully if it's the third.",
          },
          {
            n: "02",
            h: "Multi-tab? Pick one",
            t: "Workbooks with multiple sheets get a picker: choose the tab with the people. CSV uploads skip this — they're already a single sheet.",
          },
          {
            n: "03",
            h: "Department-aware scoring",
            t: "Each department has its own value model. HR uses an Activity Impact Score; Sales/Engineering use a contribution ratio. Anything else falls back to a generic per-team normalization.",
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
        <div className="t-small" style={{ color: "var(--muted-1)", flex: 1 }}>
          Salary and activity data are sensitive. Demo runs locally — nothing leaves this browser
          until you approve it.
        </div>
        <Chip kind="warning" icon={<Icons.Check size={10} />}>
          Local only
        </Chip>
      </div>
    </div>
  );
}

/**
 * Modal shown when a workbook has multiple tabs and none match Shape A/B.
 * The user picks one — we re-submit with `sheet=<name>` and run Shape C.
 */
function SheetPickerModal({
  filename,
  sheets,
  onCancel,
  onPick,
}: {
  filename: string;
  sheets: string[];
  onCancel: () => void;
  onPick: (sheet: string) => void;
}) {
  return (
    <>
      <div
        onClick={onCancel}
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
        aria-labelledby="pick-sheet-title"
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
          Multi-sheet workbook
        </div>
        <h2
          id="pick-sheet-title"
          className="t-h2"
          style={{
            margin: "0 0 6px",
            fontFamily: "var(--font-display)",
            fontSize: "1.4rem",
            fontWeight: 500,
          }}
        >
          Which sheet has the people?
        </h2>
        <p className="t-small" style={{ color: "var(--muted-1)", marginTop: 0, marginBottom: 18 }}>
          <span className="font-mono" style={{ fontSize: 12 }}>
            {filename}
          </span>{" "}
          has {sheets.length} sheets and doesn't match a known Skillnex layout. Pick the sheet with
          one row per person — or one row per activity, we'll aggregate.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {sheets.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onPick(name)}
              className="btn btn-secondary"
              style={{
                justifyContent: "flex-start",
                padding: "12px 16px",
                fontSize: 14,
                textAlign: "left",
              }}
            >
              {name}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
