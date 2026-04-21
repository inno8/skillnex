const INTEGRATIONS = [
  { name: "Salesforce", blurb: "Revenue, deals, pipeline velocity", dept: "Sales" },
  { name: "Jira", blurb: "Tickets, story points, bug fix time", dept: "Engineering" },
  { name: "GitHub", blurb: "PRs, review turnaround, commit approvals", dept: "Engineering" },
  { name: "Asana", blurb: "Project tickets, response time", dept: "Cross-dept" },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Phase 2 data sources. Currently mocked — no live connection.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {INTEGRATIONS.map((i) => (
          <div key={i.name} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">{i.name}</div>
              <span className="text-xs rounded bg-warning/20 text-warning px-2 py-0.5">
                Demo — not connected
              </span>
            </div>
            <div className="text-sm text-muted-foreground">{i.blurb}</div>
            <div className="text-xs text-muted-foreground">Department: {i.dept}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
