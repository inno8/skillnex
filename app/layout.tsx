import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Skillnex — performance reviews drafted from your data",
  description:
    "Quarterly or annual performance reviews, easier and fairer — Skillnex pulls from your source systems, scores per department, and drafts each review in minutes.",
};

/**
 * Root layout — only loads fonts + globals. The sidebar/chrome lives in
 * the `(app)` route group's layout, so marketing (/) and auth pages
 * (/login, /signup, /forgot-password, /reset-password) render without
 * any app shell. Authed surfaces (/dashboard, /people, /ingest, etc.)
 * inherit the sidebar via their own layout.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..700,30..100&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
