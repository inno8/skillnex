import type { ReactNode } from "react";

import { BrandLockup } from "./brand/lockup";

/**
 * Sidebar wordmark — wraps BrandLockup with the conventional sidebar
 * sizing. Kept as a separate name for the call sites that already
 * reference Wordmark, but the actual asset (Skillnex wordmark + gradient
 * X) lives in /public/brand and renders via BrandLockup.
 *
 * `size` is now interpreted as approximate pixel height; width follows
 * the lockup's ~4:1 aspect ratio. Default 20 → ~120px wide.
 */
export function Wordmark({ size = 20 }: { size?: number }) {
  // Convert "intended height" to BrandLockup's width param (which scales
  // by aspect ratio to set height). Aspect ~4 means width ≈ height * 4.
  const width = Math.round(size * 6);
  return <BrandLockup width={width} />;
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
    <span className={`sparkbar ${accent ? "accent" : ""}`} style={{ width }}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

export function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
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
        <span className="t-num-lg" style={{ color: accent ? "var(--accent)" : "var(--ink)" }}>
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
