import { Chip } from "@/components/primitives";
import { TopBar } from "@/components/topbar";

const INTEGRATIONS = [
  {
    name: "Salesforce",
    blurb: "Revenue, deals, pipeline velocity",
    dept: "Sales",
  },
  {
    name: "Jira",
    blurb: "Tickets, story points, bug fix time",
    dept: "Engineering",
  },
  {
    name: "GitHub",
    blurb: "PRs, review turnaround, commit approvals",
    dept: "Engineering",
  },
  {
    name: "Workday",
    blurb: "Compensation, benefits, headcount",
    dept: "HR",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <TopBar crumbs={[{ label: "Integrations" }]} />
      <div
        className="fade-in"
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "28px 24px 64px",
        }}
      >
        <div style={{ maxWidth: "66ch", marginBottom: 28 }}>
          <div className="t-micro">Integrations</div>
          <h1 className="t-h1" style={{ margin: "6px 0 10px" }}>
            Where the real data lives.
          </h1>
          <p className="t-body" style={{ color: "var(--muted-1)" }}>
            Phase-2 data sources. Currently mocked — not connected in the demo.
            These tiles illustrate the integrations Skillnex will pull from once
            signals from source systems replace uploaded spreadsheets.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {INTEGRATIONS.map((i) => (
            <div
              key={i.name}
              className="card"
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.25rem",
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                    fontVariationSettings: '"opsz" 36',
                  }}
                >
                  {i.name}
                </span>
                <Chip kind="warning">Demo — not connected</Chip>
              </div>
              <p className="t-small" style={{ color: "var(--muted-1)" }}>
                {i.blurb}
              </p>
              <div className="t-micro" style={{ marginTop: "auto" }}>
                {i.dept}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
