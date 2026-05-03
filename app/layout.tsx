import type { Metadata } from "next";

import { Sidebar } from "@/components/sidebar";
import { getOptionalAuth } from "@/lib/auth/middleware";
import { countEmployees } from "@/lib/db";

import "./globals.css";

export const metadata: Metadata = {
  title: "Skillnex — Q1 2026 Review Cycle",
  description: "Department-aware employee ROI analysis with review-ready narrative summaries.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Only render the app chrome (sidebar) when there's a real session.
  // Marketing landing, /login, /signup, /forgot-password, /reset-password
  // all run without it.
  const ctx = await getOptionalAuth();

  let employeeCount: number | null = null;
  if (ctx) {
    try {
      employeeCount = countEmployees(ctx.tenant.id);
    } catch {
      employeeCount = null;
    }
  }

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
          {ctx && (
            <Sidebar
              employeeCount={employeeCount}
              user={{
                name: ctx.user.name ?? ctx.user.email,
                email: ctx.user.email,
                role: ctx.user.role,
                tenantName: ctx.tenant.name,
              }}
            />
          )}
          <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
