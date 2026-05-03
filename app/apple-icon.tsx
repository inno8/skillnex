import { ImageResponse } from "next/og";

/**
 * iOS / iPadOS home-screen icon. Generated at build time via the same
 * gradient X as the in-app brand mark + a subtle paper-colored backdrop
 * so it doesn't disappear on Apple's translucent dock.
 *
 * iOS doesn't accept SVG icons — must be PNG, exactly 180x180. Next.js
 * picks this file up automatically and emits the right <link rel=
 * "apple-touch-icon"> tag.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#FAFAF7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 36,
      }}
    >
      <svg
        width="120"
        height="120"
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
    </div>,
    { ...size },
  );
}
