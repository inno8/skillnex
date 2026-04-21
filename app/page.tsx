import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Upload employee data</h1>
        <p className="text-muted-foreground max-w-2xl">
          Skillnex reads your multi-sheet Excel workbook (Sales Team, Engineering, Payroll)
          and produces department-aware ROI scores plus LLM-written review paragraphs.
          Nothing is fabricated. Missing data is shown as missing.
        </p>
      </section>

      <section className="rounded-lg border-2 border-dashed p-10 text-center space-y-3 bg-muted/30">
        <div className="text-sm text-muted-foreground">Drag-drop zone (Day 5 wiring)</div>
        <div className="text-lg font-medium">skillnex-demo.xlsx</div>
        <div className="text-xs text-muted-foreground">
          Accepts .xlsx with sheets: Sales Team, Engineering, Payroll data (HR team optional)
        </div>
      </section>

      <section className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          View sample dashboard
        </Link>
        <a
          href="/samples/skillnex-demo.xlsx"
          className="text-sm text-muted-foreground hover:underline"
        >
          Download sample file
        </a>
      </section>
    </div>
  );
}
