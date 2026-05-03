"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
