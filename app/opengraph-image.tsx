import { ImageResponse } from "next/og";

/**
 * Open Graph + Twitter share card. Renders to PNG at build time. What
 * shows up when someone pastes app.skillnex.tech into Slack, LinkedIn,
 * iMessage, X, or any link unfurler that follows the og:image meta.
 *
 * Standard 1200x630 ratio. Composition: gradient X mark on the left,
 * tagline + sublabel stacked on the right, paper background, ink type.
 * Mirrors the marketing landing's hero so the unfurl matches what the
 * person sees when they click through.
 */
export const alt = "Skillnex — performance reviews drafted from your data";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#FAFAF7",
        display: "flex",
        alignItems: "center",
        padding: "80px 96px",
        gap: 64,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      <svg
        width="240"
        height="240"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="t" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E91E63" />
            <stop offset="40%" stopColor="#FF5722" />
            <stop offset="100%" stopColor="#FF9800" />
          </linearGradient>
          <linearGradient id="b" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4DD0E1" />
            <stop offset="50%" stopColor="#29B6F6" />
            <stop offset="100%" stopColor="#42A5F5" />
          </linearGradient>
        </defs>
        <path d="M 35 45 L 100 120" stroke="url(#t)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 165 45 L 100 120" stroke="url(#t)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 35 155 L 100 80" stroke="url(#b)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 165 155 L 100 80" stroke="url(#b)" strokeWidth="14" strokeLinecap="round" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#C2410C",
            marginBottom: 18,
          }}
        >
          skillnex
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.05,
            color: "#0B0F19",
            letterSpacing: "-0.02em",
            marginBottom: 24,
          }}
        >
          Performance reviews, drafted from the data.
        </div>
        <div
          style={{
            fontSize: 24,
            lineHeight: 1.4,
            color: "#52525B",
          }}
        >
          Quarterly or annual. Sourced from your team's actual work. Every claim cites a number.
        </div>
      </div>
    </div>,
    { ...size },
  );
}
