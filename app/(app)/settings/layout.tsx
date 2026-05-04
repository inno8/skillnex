import Link from "next/link";

import { TopBar } from "@/components/topbar";
import { requireTenantUserPage, type Role } from "@/lib/auth/middleware";

import { SettingsNav } from "./nav";

/**
 * Settings shell — secondary nav on the left, page on the right. The
 * outer (app) layout already gates the auth + paints the global
 * sidebar; this layout adds the section-level nav and the top
 * breadcrumbs.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireTenantUserPage();
  return (
    <>
      <TopBar crumbs={[{ label: "Settings", href: "/settings/profile" }]} />
      <div
        className="fade-in"
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "28px 24px 64px",
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          gap: 40,
          alignItems: "start",
        }}
      >
        <SettingsNav role={ctx.user.role as Role} />
        <div>{children}</div>
      </div>
    </>
  );
}
