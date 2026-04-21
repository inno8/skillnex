import Link from "next/link";

import { Icons } from "@/components/icons";
import { Avatar, Chip, SparkBar } from "@/components/primitives";
import { TopBar } from "@/components/topbar";
import { FLAG_LABELS, deriveFlags, type FlagKey } from "@/lib/anomalies";
import { listEmployees } from "@/lib/db";
import { initialsFromName, formatCurrency } from "@/lib/utils";
import type { EmployeeRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

type PeopleSearch = {
  department?: string;
  flag?: string;
  q?: string;
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<PeopleSearch>;
}) {
  const params = await searchParams;
  const deptFilter = params.department ?? "all";
  const flagFilter = params.flag ?? "all";
  const q = params.q?.toLowerCase() ?? "";

  let all: EmployeeRecord[] = [];
  try {
    all = listEmployees();
  } catch {
    all = [];
  }

  if (all.length === 0) {
    return (
      <>
        <TopBar crumbs={[{ label: "People" }]} />
        <div
          className="fade-in"
          style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px" }}
        >
          <div className="t-micro">People</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            No employees yet.
          </h1>
          <p
            className="t-body"
            style={{ color: "var(--muted-1)", marginBottom: 16 }}
          >
            Upload a workbook to populate the directory.
          </p>
          <Link href="/" className="btn btn-primary">
            <Icons.Upload size={14} stroke="#fff" /> Go to Ingest
          </Link>
        </div>
      </>
    );
  }

  const flaggedAll = deriveFlags(all);
  const flagsByKey = new Map(
    flaggedAll.map((f) => [f.employee.employee_key, f.flags]),
  );

  let filtered = all;
  if (deptFilter !== "all")
    filtered = filtered.filter((e) => e.department === deptFilter);
  if (flagFilter !== "all")
    filtered = filtered.filter((e) =>
      (flagsByKey.get(e.employee_key) ?? []).includes(flagFilter as FlagKey),
    );
  if (q)
    filtered = filtered.filter((e) =>
      (e.name + (e.job_title ?? "") + (e.sub_department ?? "") + e.source_ids.activity_id)
        .toLowerCase()
        .includes(q),
    );

  filtered = [...filtered].sort(
    (a, b) => (b.computed?.value_score ?? 0) - (a.computed?.value_score ?? 0),
  );

  const deptList = Array.from(new Set(all.map((e) => e.department))).sort();

  const headerLabel =
    flagFilter !== "all"
      ? FLAG_LABELS[flagFilter as FlagKey] ?? "Flagged employees"
      : deptFilter !== "all"
        ? deptFilter
        : "All employees";

  const crumbs = [
    { label: "People", href: "/people" },
    ...(deptFilter !== "all" ? [{ label: deptFilter }] : []),
    ...(flagFilter !== "all"
      ? [{ label: FLAG_LABELS[flagFilter as FlagKey] ?? flagFilter }]
      : []),
  ];

  return (
    <>
      <TopBar crumbs={crumbs} />
      <div
        className="fade-in"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "28px 24px 64px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div className="t-micro">
              People ·{" "}
              <span className="tabular">
                {filtered.length} of {all.length}
              </span>
            </div>
            <h1 className="t-h1" style={{ margin: "4px 0 0" }}>
              {headerLabel}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/calibration"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: "none" }}
            >
              Open calibration <Icons.ArrowRight size={13} stroke="#fff" />
            </Link>
          </div>
        </div>

        <form
          method="GET"
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, ID, title…"
              className="input"
              style={{ width: "100%", paddingLeft: 32 }}
            />
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            >
              <Icons.Search size={14} stroke="var(--muted-2)" />
            </span>
          </div>
          <select
            name="department"
            defaultValue={deptFilter}
            className="input"
          >
            <option value="all">All departments</option>
            {deptList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select name="flag" defaultValue={flagFilter} className="input">
            <option value="all">All flags</option>
            {Object.entries(FLAG_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" type="submit">
            Apply
          </button>
          {(deptFilter !== "all" || flagFilter !== "all" || q) && (
            <Link href="/people" className="btn btn-ghost btn-sm">
              Clear <Icons.X size={12} />
            </Link>
          )}
        </form>

        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>Employee</th>
                  <th style={{ width: "16%" }}>Dept · Role</th>
                  <th style={{ width: "10%", textAlign: "right" }}>Rank</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Value</th>
                  <th style={{ width: "10%", textAlign: "right" }}>ROI</th>
                  <th style={{ width: "12%", textAlign: "right" }}>Salary</th>
                  <th style={{ width: "10%" }}>Flags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const c = e.computed;
                  const flags = flagsByKey.get(e.employee_key) ?? [];
                  const displayFlags = flags.filter((f) => f !== "top-performer");
                  return (
                    <tr key={e.employee_key}>
                      <td>
                        <Link
                          href={`/people/${encodeURIComponent(e.employee_key)}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textDecoration: "none",
                            color: "inherit",
                          }}
                        >
                          <Avatar initials={initialsFromName(e.name)} />
                          <div>
                            <div style={{ fontWeight: 500 }}>{e.name}</div>
                            <div
                              className="t-small"
                              style={{ color: "var(--muted-2)" }}
                            >
                              {e.job_title ?? e.source_ids.activity_id}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <div>{e.department}</div>
                        <div
                          className="t-small"
                          style={{ color: "var(--muted-2)" }}
                        >
                          {e.sub_department ??
                            e.region ??
                            e.location ??
                            e.level ??
                            "—"}
                        </div>
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {c ? `${c.dept_rank} / ${c.dept_size}` : "—"}
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            justifyContent: "flex-end",
                          }}
                        >
                          <SparkBar value={c?.value_score ?? 0} width={56} />
                          <span
                            style={{ minWidth: 40, textAlign: "right" }}
                          >
                            {c ? c.value_score.toFixed(1) : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {c?.roi != null ? `${c.roi.toFixed(2)}x` : "—"}
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {formatCurrency(e.salary)}
                      </td>
                      <td>
                        {displayFlags.length === 0 ? (
                          <span
                            className="t-small"
                            style={{ color: "var(--muted-3)" }}
                          >
                            —
                          </span>
                        ) : (
                          <div
                            style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                          >
                            <Chip kind="anomaly">
                              {FLAG_LABELS[displayFlags[0]]}
                            </Chip>
                            {displayFlags.length > 1 && (
                              <Chip kind="neutral">
                                +{displayFlags.length - 1}
                              </Chip>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: 48,
                        color: "var(--muted-2)",
                      }}
                    >
                      No matches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
