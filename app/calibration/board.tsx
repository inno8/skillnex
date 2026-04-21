"use client";

import { useState } from "react";
import Link from "next/link";

export type CalibrationPoint = {
  key: string;
  name: string;
  initials: string;
  department: string;
  value_score: number;
  roi: number | null;
  cost_efficiency: number | null;
  salary: number | null;
  flagged: boolean;
  salaryFormatted: string;
};

const DEPT_COLOR: Record<string, string> = {
  Engineering: "var(--ink)",
  Sales: "var(--accent)",
  HR: "#6B7280",
};

export function CalibrationBoard({
  points,
  hasROI,
  deptFilter,
}: {
  points: CalibrationPoint[];
  hasROI: boolean;
  deptFilter: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Y-axis domain: ROI (0 to max), or cost efficiency inverted
  const useCostEff = deptFilter === "HR";
  const rawYs = useCostEff
    ? points
        .map((p) => p.cost_efficiency)
        .filter((n): n is number => n != null && n > 0)
    : points
        .map((p) => p.roi)
        .filter((n): n is number => n != null);
  const yMax = rawYs.length > 0 ? Math.max(...rawYs) * 1.1 : 1;

  const W = 720,
    H = 480,
    pad = { l: 64, r: 24, t: 24, b: 52 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const xOf = (v: number) =>
    pad.l + Math.max(0, Math.min(1, v / 100)) * iw;
  const yOf = (v: number) => {
    if (useCostEff) {
      // Invert: higher cost_eff = lower position = worse (more $ per impacted)
      return pad.t + Math.max(0, Math.min(1, v / yMax)) * ih;
    }
    return pad.t + ih - Math.max(0, Math.min(1, v / yMax)) * ih;
  };

  const yTicks = useCostEff
    ? [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax]
    : [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  const deptsPresent = Array.from(new Set(points.map((p) => p.department)));

  const selectedPoint = selected ? points.find((p) => p.key === selected) : null;
  const hoveredPoint = hovered ? points.find((p) => p.key === hovered) : null;

  const yLabel = useCostEff ? "COST / IMPACTED" : "ROI (×)";

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}
    >
      <div className="card" style={{ padding: 16 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: "block" }}
        >
          <rect
            x={xOf(50)}
            y={pad.t}
            width={xOf(100) - xOf(50)}
            height={yOf(0) - pad.t}
            fill={
              useCostEff ? "rgba(22,101,52,0.04)" : "rgba(22,101,52,0.04)"
            }
          />
          <rect
            x={pad.l}
            y={useCostEff ? yOf(yMax * 0.5) : yOf(yMax * 0.5)}
            width={xOf(50) - pad.l}
            height={
              useCostEff
                ? H - pad.b - yOf(yMax * 0.5)
                : H - pad.b - yOf(yMax * 0.5)
            }
            fill="rgba(153,27,27,0.03)"
          />
          <line
            x1={xOf(50)}
            y1={pad.t}
            x2={xOf(50)}
            y2={H - pad.b}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <line
            x1={pad.l}
            y1={yOf(yMax * 0.5)}
            x2={W - pad.r}
            y2={yOf(yMax * 0.5)}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <line
            x1={pad.l}
            y1={H - pad.b}
            x2={W - pad.r}
            y2={H - pad.b}
            stroke="var(--ink)"
            strokeWidth={1}
          />
          <line
            x1={pad.l}
            y1={pad.t}
            x2={pad.l}
            y2={H - pad.b}
            stroke="var(--ink)"
            strokeWidth={1}
          />
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={xOf(v)}
                y1={H - pad.b}
                x2={xOf(v)}
                y2={H - pad.b + 4}
                stroke="var(--muted-2)"
              />
              <text
                x={xOf(v)}
                y={H - pad.b + 18}
                textAnchor="middle"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fill: "var(--muted-2)",
                }}
              >
                {v}
              </text>
            </g>
          ))}
          <text
            x={(pad.l + W - pad.r) / 2}
            y={H - 12}
            textAnchor="middle"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10,
              fill: "var(--muted-1)",
              letterSpacing: "0.06em",
            }}
          >
            VALUE SCORE
          </text>
          {yTicks.map((v, i) => (
            <g key={i}>
              <line
                x1={pad.l - 4}
                y1={yOf(v)}
                x2={pad.l}
                y2={yOf(v)}
                stroke="var(--muted-2)"
              />
              <text
                x={pad.l - 8}
                y={yOf(v) + 3}
                textAnchor="end"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fill: "var(--muted-2)",
                }}
              >
                {useCostEff
                  ? v >= 1000
                    ? `$${(v / 1000).toFixed(0)}k`
                    : `$${v.toFixed(0)}`
                  : `${v.toFixed(1)}x`}
              </text>
            </g>
          ))}
          <text
            x={18}
            y={(pad.t + H - pad.b) / 2}
            textAnchor="middle"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10,
              fill: "var(--muted-1)",
              letterSpacing: "0.06em",
            }}
            transform={`rotate(-90 18 ${(pad.t + H - pad.b) / 2})`}
          >
            {yLabel}
          </text>

          <text
            x={xOf(75)}
            y={pad.t + 20}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fill: "var(--success)",
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 24',
            }}
          >
            Top performers
          </text>
          <text
            x={xOf(4)}
            y={H - pad.b - 10}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fill: "var(--destructive)",
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 24',
            }}
          >
            Scope review
          </text>

          {points.map((p) => {
            const y = useCostEff ? p.cost_efficiency : p.roi;
            if (y == null) return null;
            const cx = xOf(p.value_score);
            const cy = yOf(y);
            const isHover = hovered === p.key;
            const isSelected = selected === p.key;
            return (
              <g
                key={p.key}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(p.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(p.key === selected ? null : p.key)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHover || isSelected ? 7 : p.flagged ? 5 : 4}
                  fill={
                    p.flagged
                      ? "var(--accent)"
                      : DEPT_COLOR[p.department] ?? "var(--muted-2)"
                  }
                  fillOpacity={isHover || isSelected ? 1 : 0.75}
                  stroke={isSelected ? "var(--ink)" : "var(--surface)"}
                  strokeWidth={isSelected ? 2 : 1.5}
                  style={{
                    transition:
                      "r 180ms ease-out, fill-opacity 180ms ease-out",
                  }}
                />
              </g>
            );
          })}

          {hoveredPoint &&
            (() => {
              const y = useCostEff ? hoveredPoint.cost_efficiency : hoveredPoint.roi;
              if (y == null) return null;
              const tx = xOf(hoveredPoint.value_score);
              const ty = yOf(y);
              const right = tx > W / 2;
              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={right ? tx - 192 : tx + 12}
                    y={ty - 44}
                    width={180}
                    height={52}
                    fill="var(--ink)"
                    rx={2}
                  />
                  <text
                    x={right ? tx - 180 : tx + 24}
                    y={ty - 24}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 12,
                      fill: "#fff",
                      fontWeight: 500,
                    }}
                  >
                    {hoveredPoint.name}
                  </text>
                  <text
                    x={right ? tx - 180 : tx + 24}
                    y={ty - 8}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fill: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {hoveredPoint.department} · value{" "}
                    {hoveredPoint.value_score.toFixed(1)} ·{" "}
                    {useCostEff
                      ? `$${(hoveredPoint.cost_efficiency ?? 0).toFixed(0)}/head`
                      : `${(hoveredPoint.roi ?? 0).toFixed(2)}x ROI`}
                  </text>
                </g>
              );
            })()}
        </svg>

        <hr className="rule" style={{ margin: "16px 0 12px" }} />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {deptsPresent.map((d) => (
            <div
              key={d}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--muted-1)",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: DEPT_COLOR[d] ?? "var(--muted-2)",
                  borderRadius: 1,
                  display: "inline-block",
                }}
              />
              {d}
            </div>
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--muted-1)",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: "var(--accent)",
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
            Flagged
          </div>
        </div>
      </div>

      <aside>
        <div className="section-header">
          <div>
            <h2 className="t-h2">Selection</h2>
            <div className="t-small" style={{ color: "var(--muted-2)" }}>
              Click a dot to lock it here.
            </div>
          </div>
        </div>
        {selectedPoint ? (
          <div className="card fade-in" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="avatar"
                style={{ width: 36, height: 36, fontSize: 12 }}
              >
                {selectedPoint.initials}
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>
                  {selectedPoint.name}
                </div>
                <div className="t-small" style={{ color: "var(--muted-2)" }}>
                  {selectedPoint.department}
                </div>
              </div>
            </div>
            <hr className="rule" style={{ margin: "14px 0" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Row label="Value score" value={selectedPoint.value_score.toFixed(1)} />
              <Row
                label={useCostEff ? "Cost / impacted" : "ROI"}
                value={
                  useCostEff
                    ? selectedPoint.cost_efficiency != null
                      ? `$${selectedPoint.cost_efficiency.toFixed(0)}`
                      : "—"
                    : selectedPoint.roi != null
                      ? `${selectedPoint.roi.toFixed(2)}x`
                      : "—"
                }
              />
              <Row label="Salary" value={selectedPoint.salaryFormatted} />
              {selectedPoint.flagged && (
                <div style={{ marginTop: 4 }}>
                  <span className="chip chip-anomaly">Flagged</span>
                </div>
              )}
            </div>
            <Link
              href={`/people/${encodeURIComponent(selectedPoint.key)}`}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 14, textDecoration: "none", width: "100%", justifyContent: "center" }}
            >
              Open detail →
            </Link>
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: 20,
              color: "var(--muted-2)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Hover a dot to preview. Click to lock it here — the detail link
            will appear.
          </div>
        )}
      </aside>
    </div>
  );

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span className="t-small" style={{ color: "var(--muted-1)" }}>
          {label}
        </span>
        <span className="t-num-md">{value}</span>
      </div>
    );
  }
}
