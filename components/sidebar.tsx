"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icons } from "./icons";
import { Wordmark, Avatar } from "./primitives";

type NavItem = {
  href: "/" | "/dashboard" | "/people" | "/calibration" | "/integrations";
  label: string;
  icon: React.ReactNode;
  count?: number | null;
  matches: (pathname: string) => boolean;
};

export function Sidebar({ employeeCount }: { employeeCount: number | null }) {
  const pathname = usePathname() || "/";
  const items: NavItem[] = [
    {
      href: "/",
      label: "Ingest",
      icon: <Icons.Upload size={16} />,
      matches: (p) => p === "/",
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
      matches: (p) => p === "/calibration",
    },
    {
      href: "/integrations",
      label: "Integrations",
      icon: <Icons.Plug size={16} />,
      matches: (p) => p === "/integrations",
    },
  ];

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
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <Wordmark size={20} />
        </Link>
      </div>
      <div className="t-micro" style={{ padding: "0 6px 8px" }}>
        Q1 2026 Cycle
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => {
          const active = it.matches(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`sidenav-item ${active ? "active" : ""}`}
            >
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
          padding: "12px 6px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar initials="HR" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>HR Lead</div>
            <div className="t-small" style={{ color: "var(--muted-2)" }}>
              Demo user
            </div>
          </div>
          <Icons.Settings size={14} stroke="var(--muted-2)" />
        </div>
      </div>
    </aside>
  );
}
