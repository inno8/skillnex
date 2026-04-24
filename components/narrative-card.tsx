"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { Icons } from "./icons";
import type { NarrativeOutput } from "@/lib/llm/types";

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
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  async function generate() {
    setError(null);
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_keys: [employeeKey] }),
    });
    const data = (await res.json()) as {
      mode: "mock" | "anthropic";
      results: Array<{ employee_key: string; ok: boolean; error?: string }>;
    };
    const r = data.results?.[0];
    if (!r?.ok) {
      setError(r?.error ?? "Narrative generation failed");
      return;
    }
    // Refetch the employee to get the persisted narrative
    const freshRes = await fetch(
      `/api/employees/${encodeURIComponent(employeeKey)}`,
    );
    if (freshRes.ok) {
      const { employee } = (await freshRes.json()) as {
        employee: { narrative: NarrativeOutput | null };
      };
      setNarrative(employee.narrative);
    }
    startTransition(() => router.refresh());
  }

  async function copyParagraph() {
    if (!narrative) return;
    await navigator.clipboard.writeText(narrative.review_paragraph);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1800);
  }

  const busy = isPending;

  if (!narrative) {
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
            className="btn btn-primary btn-sm"
            onClick={generate}
            disabled={busy || disabled}
          >
            {busy ? (
              <>
                <span
                  className="spin"
                  style={{
                    width: 12,
                    height: 12,
                    border: "1.5px solid rgba(255,255,255,0.35)",
                    borderTop: "1.5px solid #fff",
                    borderRadius: "50%",
                  }}
                />
                Generating…
              </>
            ) : (
              <>
                <Icons.Sparkle size={12} stroke="#fff" /> Generate
              </>
            )}
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
            Click Generate to draft a review paragraph from this cycle's data.
            The narrative is strict-narration mode — it only references metrics
            present in the input and never recommends HR actions.
          </p>
          {error && (
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
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

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
          <span className="chip chip-neutral">
            {narrative.mode === "mock" ? "Mock" : narrative.model}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={generate}
            disabled={busy}
          >
            {busy ? "Regenerating…" : (
              <>
                <Icons.Sparkle size={12} /> Regenerate
              </>
            )}
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
          <div
            className="card"
            style={{ padding: 16 }}
          >
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
          Every number above is from the ingested data. The narrative never
          recommends HR actions — the human makes that call.
        </div>
        <button className="btn btn-secondary btn-sm" onClick={copyParagraph}>
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

      {error && (
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
          {error}
        </div>
      )}
    </div>
  );
}
