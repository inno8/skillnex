"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/lib/auth/client";

import { Icons } from "./icons";
import { Wordmark, Avatar } from "./primitives";
import { initialsFromName } from "@/lib/utils";

type NavItem = {
  href: "/ingest" | "/dashboard" | "/people" | "/calibration" | "/integrations";
  label: string;
  icon: React.ReactNode;
  count?: number | null;
  roles?: Array<"owner" | "admin" | "manager" | "employee">; // undefined = all
  matches: (pathname: string) => boolean;
};

export type SidebarUser = {
  name: string;
  email: string;
  role: "owner" | "admin" | "manager" | "employee";
  tenantName: string;
};

const ROLE_LABEL: Record<SidebarUser["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

export function Sidebar({
  employeeCount,
  user,
}: {
  employeeCount: number | null;
  user: SidebarUser;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const items: NavItem[] = [
    {
      href: "/ingest",
      label: "Ingest",
      icon: <Icons.Upload size={16} />,
      roles: ["owner", "admin", "manager"],
      matches: (p) => p === "/ingest",
    },
    {
      href: "/dashboard",
      label: "Overview",
      icon: <Icons.Dashboard size={16} />,
      matches: (p) => p === "/dashboard",
    },
    {
      href: "/people",
      label: "People",
      icon: <Icons.People size={16} />,
      count: employeeCount ?? undefined,
      matches: (p) => p.startsWith("/people") || p.startsWith("/dashboard/"),
    },
    {
      href: "/calibration",
      label: "Calibration",
      icon: <Icons.Scales size={16} />,
      roles: ["owner", "admin", "manager"],
      matches: (p) => p === "/calibration",
    },
    {
      href: "/integrations",
      label: "Integrations",
      icon: <Icons.Plug size={16} />,
      roles: ["owner", "admin"],
      matches: (p) => p === "/integrations",
    },
  ];

  const visibleItems = items.filter((it) => !it.roles || it.roles.includes(user.role));

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error("signOut failed", err);
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--paper)",
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px",
      }}
    >
      <div style={{ padding: "0 4px 20px" }}>
        <Link href="/dashboard" style={{ textDecoration: "none", color: "inherit" }}>
          <Wordmark size={20} />
        </Link>
      </div>
      <div className="t-micro" style={{ padding: "0 6px 8px" }}>
        {user.tenantName} · Q1 2026
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {visibleItems.map((it) => {
          const active = it.matches(pathname);
          return (
            <Link key={it.href} href={it.href} className={`sidenav-item ${active ? "active" : ""}`}>
              {it.icon}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.count != null && (
                <span className="t-num-sm" style={{ color: "var(--muted-2)" }}>
                  {it.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div
        style={{
          marginTop: "auto",
          padding: "12px 6px 4px",
          borderTop: "1px solid var(--border)",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            background: menuOpen ? "var(--ink-tint, rgba(0,0,0,0.04))" : "transparent",
            border: 0,
            padding: "8px 6px",
            borderRadius: 4,
            cursor: "pointer",
            textAlign: "left",
            color: "var(--ink)",
          }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar initials={initialsFromName(user.name)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.name}
            </div>
            <div className="t-small" style={{ color: "var(--muted-2)" }}>
              {ROLE_LABEL[user.role]}
            </div>
          </div>
          <Icons.Settings size={14} stroke="var(--muted-2)" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            style={{
              position: "absolute",
              left: 6,
              right: 6,
              bottom: "calc(100% + 4px)",
              background: "var(--paper)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
              padding: 4,
              display: "flex",
              flexDirection: "column",
              zIndex: 20,
            }}
          >
            <div
              style={{
                padding: "8px 10px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div className="t-small" style={{ color: "var(--muted-1)" }}>
                Signed in as
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.email}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                background: "transparent",
                border: 0,
                padding: "8px 10px",
                fontSize: 13,
                cursor: signingOut ? "default" : "pointer",
                textAlign: "left",
                color: "var(--ink)",
                borderRadius: 2,
              }}
              role="menuitem"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
