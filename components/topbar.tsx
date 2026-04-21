import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { Icons } from "./icons";

export type Crumb = {
  label: string;
  href?: string;
};

export function TopBar({
  crumbs = [],
  right,
}: {
  crumbs?: Crumb[];
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        height: 56,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        background: "var(--paper)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: 1,
          minWidth: 0,
        }}
      >
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const inner = (
            <span
              style={{
                fontSize: 14,
                color: last ? "var(--ink)" : "var(--muted-1)",
                fontWeight: last ? 500 : 400,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {c.label}
            </span>
          );
          return (
            <Fragment key={`${i}-${c.label}`}>
              {i > 0 && (
                <span style={{ color: "var(--muted-3)", fontSize: 14 }}>/</span>
              )}
              {c.href && !last ? <Link href={c.href}>{inner}</Link> : inner}
            </Fragment>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--muted-2)",
            paddingRight: 8,
            borderRight: "1px solid var(--border)",
            marginRight: 4,
          }}
        >
          <span className="tabular">Q1 2026</span> · draft
        </div>
        <button className="btn btn-ghost btn-sm" type="button">
          <Icons.Search size={13} />
        </button>
        {right}
      </div>
    </div>
  );
}
