"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icons } from "./icons";
import { Wordmark, Avatar } from "./primitives";
import { initialsFromName } from "@/lib/utils";

type NavItem = {
  href:
    | "/ingest"
    | "/dashboard"
    | "/people"
    | "/calibration"
    | "/integrations"
    | "/my-review"
    | "/settings/profile";
  label: string;
  icon: React.ReactNode;
  count?: number | null;
  roles?: Array<"owner" | "admin" | "manager" | "employee">; // undefined = all
  matches: (pathname: string) => boolean;
  /** Show only when the user has a linked employee_key. Undefined = always show. */
  requiresEmployeeKey?: true;
};

export type SidebarUser = {
  name: string;
  email: string;
  role: "owner" | "admin" | "manager" | "employee";
  tenantName: string;
  /** Set when this user is also a reviewed employee — surfaces /my-review. */
  hasEmployeeKey: boolean;
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

  // Order matters: Overview first because login lands users there and
  // it's the dashboard everyone uses every visit. Ingest second — it's
  // the once-per-cycle action, gated to owner/admin/manager. /my-review
  // is the only nav an employee sees besides Settings.
  const items: NavItem[] = [
    {
      href: "/my-review",
      label: "My review",
      icon: <Icons.File size={16} />,
      requiresEmployeeKey: true,
      matches: (p) => p === "/my-review",
    },
    {
      href: "/dashboard",
      label: "Overview",
      icon: <Icons.Dashboard size={16} />,
      roles: ["owner", "admin", "manager"],
      matches: (p) => p === "/dashboard",
    },
    {
      href: "/ingest",
      label: "Ingest",
      icon: <Icons.Upload size={16} />,
      roles: ["owner", "admin", "manager"],
      matches: (p) => p === "/ingest",
    },
    {
      href: "/people",
      label: "People",
      icon: <Icons.People size={16} />,
      count: employeeCount ?? undefined,
      roles: ["owner", "admin", "manager"],
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
    {
      href: "/settings/profile",
      label: "Settings",
      icon: <Icons.Settings size={16} />,
      matches: (p) => p.startsWith("/settings"),
    },
  ];

  const visibleItems = items.filter((it) => {
    if (it.roles && !it.roles.includes(user.role)) return false;
    if (it.requiresEmployeeKey && !user.hasEmployeeKey) return false;
    return true;
  });

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
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 6px",
          }}
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
              title={user.email}
            >
              {user.name}
            </div>
            <div className="t-small" style={{ color: "var(--muted-2)" }}>
              {ROLE_LABEL[user.role]}
            </div>
          </div>
        </div>
        <Link
          href="/logout"
          prefetch={false}
          className="btn btn-ghost btn-sm"
          style={{
            justifyContent: "center",
            width: "100%",
            textDecoration: "none",
            border: "1px solid var(--border)",
          }}
        >
          <Icons.Logout size={14} stroke="currentColor" />
          Sign out
        </Link>
      </div>
    </aside>
  );
}
