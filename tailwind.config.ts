import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 47% 11%)",
        muted: "hsl(210 40% 96%)",
        "muted-foreground": "hsl(215 16% 47%)",
        border: "hsl(214 32% 91%)",
        accent: "hsl(222 47% 11%)",
        "accent-foreground": "hsl(0 0% 100%)",
        destructive: "hsl(0 72% 51%)",
        warning: "hsl(38 92% 50%)",
        success: "hsl(142 76% 36%)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo"],
      },
    },
  },
  plugins: [],
};

export default config;
