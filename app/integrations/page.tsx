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
    name: "Asana",
    blurb: "Project tickets, response time",
    dept: "Cross-department",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-xl">
      <div className="max-w-prose space-y-md">
        <p className="micro">Integrations</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          Where the real data lives.
        </h1>
        <p className="text-muted-1 leading-relaxed">
          Phase 2 data sources. Not connected in the demo — these tiles illustrate the
          integrations Skillnex will pull from when signals from source systems replace
          uploaded spreadsheets.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
        {INTEGRATIONS.map((i) => (
          <div
            key={i.name}
            className="rounded-lg border border-border bg-surface p-xl space-y-md"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-display text-xl font-medium text-ink">
                {i.name}
              </span>
              <span className="chip-muted">Demo — not connected</span>
            </div>
            <p className="text-sm text-muted-1">{i.blurb}</p>
            <p className="micro">{i.dept}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
