"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icons } from "./icons";

/**
 * Compact dropdown that switches the active review cycle. Renders into
 * the TopBar — clicking a cycle navigates to the same path with
 * `?cycle=<label>` so server-rendered pages re-fetch under the right
 * cycle scope without losing any other URL state.
 *
 * If the tenant only has ONE cycle (the common pilot case until the
 * second upload happens), the dropdown collapses to a static label.
 * No surface area, no menu to dismiss.
 */
export function CyclePicker({
  current,
  available,
}: {
  current: string;
  /** Most-recent first. */
  available: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside to close the menu. useEffect guards against the
  // very brief moment after a route change when the menu unmounts.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function selectCycle(cycle: string) {
    setOpen(false);
    if (cycle === current) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("cycle", cycle);
    router.push(`${pathname}?${sp.toString()}` as never);
  }

  // Single-cycle case → static text, same visual weight as the
  // dropdown button so the TopBar layout doesn't shift between
  // states.
  if (available.length <= 1) {
    return (
      <div
        style={{
          fontSize: 12,
          color: "var(--muted-2)",
          paddingRight: 8,
          borderRight: "1px solid var(--border)",
          marginRight: 4,
        }}
      >
        <span className="tabular">{current}</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        paddingRight: 8,
        borderRight: "1px solid var(--border)",
        marginRight: 4,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          fontSize: 12,
          color: "var(--ink)",
          background: open ? "var(--surface-2)" : "transparent",
          border: "1px solid var(--border)",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        <span className="tabular">{current}</span>
        <span
          style={{
            fontSize: 9,
            color: "var(--muted-1)",
            lineHeight: 1,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 120ms ease",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 180,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 4,
            boxShadow: "0 12px 32px rgba(11,15,25,0.12)",
            zIndex: 50,
          }}
        >
          <div className="t-micro" style={{ padding: "6px 10px 4px", color: "var(--muted-2)" }}>
            Review cycle
          </div>
          {available.map((c) => {
            const isCurrent = c === current;
            return (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={isCurrent}
                onClick={() => selectCycle(c)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: 13,
                  color: "var(--ink)",
                  background: isCurrent ? "var(--surface-2)" : "transparent",
                  border: 0,
                  borderRadius: 4,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span className="tabular">{c}</span>
                {isCurrent && <Icons.Check size={11} stroke="var(--ink)" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
