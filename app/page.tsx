import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-3xl">
      <section className="space-y-md max-w-prose">
        <p className="micro">Step 1 — Upload</p>
        <h1 className="font-display display text-4xl font-medium tracking-tight">
          Turn your workbook into review-ready insight.
        </h1>
        <p className="text-lg text-muted-1 leading-relaxed">
          Skillnex reads your multi-sheet Excel workbook — Sales Team, Engineering,
          Payroll, HR Activity — and produces department-aware ROI and impact scores,
          with honest, numbers-only narratives HR can paste into reviews. Nothing is
          fabricated. Missing data shows as missing.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-card p-4xl text-center space-y-md">
        <p className="micro text-muted-2">Drag-drop zone — Day 5 wiring</p>
        <p className="font-display text-2xl font-medium text-ink">
          skillnex-demo.xlsx
        </p>
        <p className="text-sm text-muted-1">
          Accepts <span className="font-mono text-xs">.xlsx</span> with sheets: Sales
          Team, Engineering, Payroll data, HR team — or HR Activity Log + Employee
          Compensation.
        </p>
      </section>

      <section className="flex items-center gap-lg">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md bg-ink text-paper px-xl py-md text-sm font-medium hover:bg-accent transition-colors duration-short"
        >
          View sample dashboard
        </Link>
        <a
          href="/samples/skillnex-demo.xlsx"
          className="text-sm text-muted-1 hover:text-accent transition-colors duration-short underline-offset-4 hover:underline"
        >
          Download combined sample
        </a>
        <a
          href="/samples/skillnex_HR_Sample_Data.xlsx"
          className="text-sm text-muted-1 hover:text-accent transition-colors duration-short underline-offset-4 hover:underline"
        >
          Download HR-only sample
        </a>
      </section>
    </div>
  );
}
