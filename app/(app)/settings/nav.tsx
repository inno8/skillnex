"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/auth/middleware";

type SettingsNavItem = {
  href: string;
  label: string;
  description: string;
  /** Roles that can see this link. Undefined = everyone (any tenant user). */
  roles?: Role[];
};

const ITEMS: SettingsNavItem[] = [
  {
    href: "/settings/profile",
    label: "Profile",
    description: "Your name, email, password",
  },
  {
    href: "/settings/team",
    label: "Team",
    description: "Invite, suspend, change roles",
    roles: ["owner", "admin"],
  },
  {
    href: "/settings/audit-log",
    label: "Audit log",
    description: "Every state change, append-only",
    roles: ["owner", "admin"],
  },
  {
    href: "/settings/data",
    label: "Data",
    description: "Region, retention, export, delete",
    roles: ["owner"],
  },
];

export function SettingsNav({ role }: { role: Role }) {
  const pathname = usePathname() ?? "";
  const visible = ITEMS.filter((it) => !it.roles || it.roles.includes(role));
  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "sticky",
        top: 80,
      }}
    >
      <div className="t-micro" style={{ padding: "0 10px 8px" }}>
        Settings
      </div>
      {visible.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`sidenav-item ${active ? "active" : ""}`}
            style={{
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
              padding: "10px 12px",
            }}
          >
            <span style={{ fontWeight: 500 }}>{it.label}</span>
            <span className="t-small" style={{ color: "var(--muted-2)", fontSize: 12 }}>
              {it.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
