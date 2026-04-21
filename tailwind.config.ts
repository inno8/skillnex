import type { Config } from "tailwindcss";

/**
 * Source of truth: DESIGN.md
 * Tokens here must match :root CSS variables in app/globals.css.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        paper: "var(--paper)",
        surface: "var(--surface)",
        muted: {
          1: "var(--muted-1)",
          2: "var(--muted-2)",
          3: "var(--muted-3)",
          DEFAULT: "var(--muted-1)",
        },
        "muted-foreground": "var(--muted-1)",
        border: "var(--border)",
        accent: {
          DEFAULT: "var(--accent)",
          tint: "var(--accent-tint)",
          foreground: "var(--paper)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        destructive: "var(--destructive)",
        background: "var(--paper)",
        foreground: "var(--ink)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1.35", letterSpacing: "0.06em" }],
        "2xs": ["0.6875rem", { lineHeight: "1.35" }],
        xs: ["0.75rem", { lineHeight: "1.4" }],
        sm: ["0.8125rem", { lineHeight: "1.45" }],
        base: ["0.9375rem", { lineHeight: "1.55" }],
        lg: ["1rem", { lineHeight: "1.65" }],
        xl: ["1.125rem", { lineHeight: "1.45" }],
        "2xl": ["1.25rem", { lineHeight: "1.3" }],
        "3xl": ["1.75rem", { lineHeight: "1.2" }],
        "4xl": ["2.25rem", { lineHeight: "1.15" }],
      },
      spacing: {
        "2xs": "2px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
        "4xl": "64px",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04)",
        dropdown: "0 4px 12px rgba(0,0,0,0.08)",
      },
      transitionDuration: {
        micro: "80ms",
        short: "180ms",
        medium: "280ms",
        long: "420ms",
      },
      transitionTimingFunction: {
        "ease-out-soft": "cubic-bezier(0.2, 0.7, 0.2, 1)",
        "ease-in-soft": "cubic-bezier(0.4, 0, 0.6, 1)",
      },
      maxWidth: {
        content: "1200px",
        prose: "70ch",
      },
    },
  },
  plugins: [],
};

export default config;
