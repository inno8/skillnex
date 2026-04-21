import type { Metadata } from "next";

import { Sidebar } from "@/components/sidebar";
import { getDb } from "@/lib/db";

import "./globals.css";

export const metadata: Metadata = {
  title: "Skillnex — Q1 2026 Review Cycle",
  description:
    "Department-aware employee ROI analysis with review-ready narrative summaries.",
};

function countEmployees(): number | null {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT COUNT(*) as n FROM employees")
      .get() as { n: number };
    return row.n;
  } catch {
    return null;
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const employeeCount = countEmployees();
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
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar employeeCount={employeeCount} />
          <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
