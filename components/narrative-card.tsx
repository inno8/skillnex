"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Icons } from "./icons";
import type { NarrativeOutput } from "@/lib/llm/types";

type GenState =
  | { kind: "idle" }
  | { kind: "streaming"; text: string }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function NarrativeCard({
  employeeKey,
  employeeName,
  narrative: initial,
  disabled,
}: {
  employeeKey: string;
  employeeName: string;
  narrative: NarrativeOutput | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [narrative, setNarrative] = useState<NarrativeOutput | null>(initial);
  const [gen, setGen] = useState<GenState>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  /**
   * POST to /api/analyze/stream and consume the SSE response. Updates
   * `gen.text` per chunk so the paragraph types in. On the `done` event
   * we hand off to the rich rendered narrative (strengths, watch items,
   * copy button) — same component, different state.
   */
  async function generate() {
    setGen({ kind: "streaming", text: "" });

    let res: Response;
    try {
      res = await fetch("/api/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_key: employeeKey }),
      });
    } catch (err) {
      setGen({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
      return;
    }
    if (!res.ok || !res.body) {
      let msg = `Stream failed (${res.status})`;
      try {
        const data = (await res.json()) as { error?: string };
        if (data.error) msg = data.error;
      } catch {}
      setGen({ kind: "error", message: msg });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by \n\n. Pop completed frames off the
        // buffer; whatever's left after the last \n\n stays for the next
        // chunk to complete.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.trim()) continue;
          const lines = frame.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          if (event === "text" && typeof parsed === "string") {
            accumulated += parsed;
            setGen({ kind: "streaming", text: accumulated });
          } else if (event === "done") {
            const n = parsed as NarrativeOutput;
            setNarrative(n);
            setGen({ kind: "done" });
          } else if (event === "error") {
            const e = parsed as { error?: string };
            setGen({
              kind: "error",
              message: e.error ?? "Generation failed",
            });
          }
        }
      }
    } catch (err) {
      setGen({
        kind: "error",
        message: err instanceof Error ? err.message : "Stream interrupted",
      });
      return;
    }

    // Refresh the route so any server-rendered surface (e.g. dashboard
    // anomalies sidebar) picks up the new narrative.
    startTransition(() => router.refresh());
  }

  async function copyParagraph() {
    if (!narrative) return;
    await navigator.clipboard.writeText(narrative.review_paragraph);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1800);
  }

  const isStreaming = gen.kind === "streaming";
  const isErrored = gen.kind === "error";

  /* -------- empty state — no narrative yet, not streaming -------- */
  if (!narrative && !isStreaming) {
    return (
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div>
            <div className="t-micro">Performance review · draft</div>
            <h2
              className="t-h2"
              style={{
                marginTop: 4,
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                fontWeight: 500,
                fontVariationSettings: '"opsz" 48',
              }}
            >
              Generate narrative for {employeeName.split(" ")[0]}.
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={generate}
            disabled={disabled}
          >
            <Icons.Sparkle size={12} stroke="#fff" /> Generate
          </button>
        </div>
        <div
          className="card"
          style={{
            padding: "20px 24px",
            background: "var(--paper)",
            borderStyle: "dashed",
          }}
        >
          <p className="t-small" style={{ color: "var(--muted-1)" }}>
            Click Generate to draft a review paragraph from this cycle's data. The narrative is
            strict-narration mode — it only references metrics present in the input and never
            recommends HR actions.
          </p>
          {isErrored && <ErrorBanner message={gen.message} />}
        </div>
      </div>
    );
  }

  /* -------- streaming state — typewriter view -------- */
  if (isStreaming) {
    return (
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div>
            <div className="t-micro">Performance review · drafting…</div>
            <h2
              className="t-h2"
              style={{
                marginTop: 4,
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                fontWeight: 500,
                fontVariationSettings: '"opsz" 48',
              }}
            >
              {employeeName.split(" ")[0]}'s draft is coming through.
            </h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" disabled>
            <span
              className="spin"
              style={{
                width: 12,
                height: 12,
                border: "1.5px solid var(--muted-3)",
                borderTop: "1.5px solid var(--ink)",
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
            Streaming…
          </button>
        </div>
        <div className="prose">
          <p>
            {gen.text}
            <span className="caret" />
          </p>
        </div>
      </div>
    );
  }

  /* -------- rendered narrative state -------- */
  if (!narrative) return null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <div className="t-micro">Performance review · draft</div>
          <h2
            className="t-h2"
            style={{
              marginTop: 4,
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              fontWeight: 500,
              fontVariationSettings: '"opsz" 48',
            }}
          >
            {narrative.summary.split(/\.\s+/)[0]}.
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* The model name used to live here. Removed — model is an
              implementation detail; if it matters for support/debugging
              it's still in the persisted NarrativeOutput JSON. We only
              show "Mock" so it's obvious when running offline. */}
          {narrative.mode === "mock" && <span className="chip chip-neutral">Mock</span>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={generate}>
            <Icons.Sparkle size={12} /> Regenerate
          </button>
        </div>
      </div>

      <div className="prose fade-in">
        <p className="drop">{narrative.review_paragraph}</p>
      </div>

      {(narrative.strengths.length > 0 || narrative.watch_items.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            marginTop: 20,
          }}
        >
          <div className="card" style={{ padding: 16 }}>
            <div className="t-micro" style={{ marginBottom: 10 }}>
              Strengths
            </div>
            {narrative.strengths.length === 0 ? (
              <div className="t-small" style={{ color: "var(--muted-2)" }}>
                Nothing flagged this cycle.
              </div>
            ) : (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {narrative.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="t-small"
                    style={{ color: "var(--ink)", display: "flex", gap: 8 }}
                  >
                    <span
                      style={{
                        color: "var(--success)",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <Icons.Check size={12} />
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="t-micro" style={{ marginBottom: 10 }}>
              Watch items
            </div>
            {narrative.watch_items.length === 0 ? (
              <div className="t-small" style={{ color: "var(--muted-2)" }}>
                No concerns surfaced.
              </div>
            ) : (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {narrative.watch_items.map((s, i) => (
                  <li
                    key={i}
                    className="t-small"
                    style={{ color: "var(--ink)", display: "flex", gap: 8 }}
                  >
                    <span
                      style={{
                        color: "var(--accent)",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <Icons.Alert size={12} />
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 20,
          padding: "14px 18px",
          background: "var(--paper)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Icons.Sparkle size={14} stroke="var(--accent)" />
        <div className="t-small" style={{ flex: 1, color: "var(--muted-1)" }}>
          Every number above is from the ingested data. The narrative never recommends HR actions —
          the human makes that call.
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={copyParagraph}>
          {copied ? (
            <>
              <Icons.Check size={12} /> Copied
            </>
          ) : (
            <>
              <Icons.Download size={12} /> Copy paragraph
            </>
          )}
        </button>
      </div>

      {isErrored && <ErrorBanner message={gen.message} />}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: "8px 12px",
        background: "var(--destructive-tint)",
        color: "var(--destructive)",
        fontSize: 13,
        borderRadius: 2,
      }}
    >
      {message}
    </div>
  );
}
