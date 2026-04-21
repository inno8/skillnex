import type { ReactNode } from "react";

export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--ink)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19 L12 4 L20 19" />
        <path d="M7.5 12.5 L16.5 12.5" />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: size * 0.95,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          fontVariationSettings: '"opsz" 36',
        }}
      >
        skillnex
      </span>
    </div>
  );
}

export type ChipKind = "anomaly" | "success" | "warning" | "neutral" | "muted";

export function Chip({
  kind = "neutral",
  children,
  icon,
}: {
  kind?: ChipKind;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span className={`chip chip-${kind}`}>
      {icon}
      {children}
    </span>
  );
}

export function SparkBar({
  value,
  max = 100,
  accent = false,
  width = 80,
}: {
  value: number;
  max?: number;
  accent?: boolean;
  width?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span
      className={`sparkbar ${accent ? "accent" : ""}`}
      style={{ width }}
    >
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

export function Avatar({
  initials,
  size = 28,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size < 30 ? "0.6875rem" : size < 40 ? "0.8125rem" : "1rem",
      }}
    >
      {initials}
    </span>
  );
}

export function KPI({
  label,
  value,
  unit,
  footer,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  footer?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 112,
      }}
    >
      <div className="t-micro">{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          className="t-num-lg"
          style={{ color: accent ? "var(--accent)" : "var(--ink)" }}
        >
          {value}
        </span>
        {unit && (
          <span className="t-small" style={{ color: "var(--muted-2)" }}>
            {unit}
          </span>
        )}
      </div>
      {footer && (
        <div style={{ marginTop: "auto" }}>
          <span className="t-small" style={{ color: "var(--muted-2)" }}>
            {footer}
          </span>
        </div>
      )}
    </div>
  );
}

export { initialsFromName } from "@/lib/utils";
