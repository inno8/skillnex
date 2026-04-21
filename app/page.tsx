import Link from "next/link";

import { UploadDropzone } from "@/components/upload-dropzone";

export default function HomePage() {
  return (
    <div className="space-y-3xl">
      <section className="space-y-md max-w-prose">
        <p className="micro">Step 1 — Upload</p>
        <h1 className="font-display display text-4xl font-medium tracking-tight">
          Turn your workbook into review-ready insight.
        </h1>
        <p className="text-lg text-muted-1 leading-relaxed">
          Skillnex reads your multi-sheet Excel workbook — Sales, Engineering,
          Payroll, HR Activity — and produces department-aware scores plus
          numbers-only narratives HR can paste into reviews. Nothing is
          fabricated. Missing data shows as missing.
        </p>
      </section>

      <UploadDropzone />

      <section className="flex flex-wrap items-center gap-lg">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md bg-ink text-paper px-xl py-md text-sm font-medium hover:bg-accent transition-colors duration-short"
        >
          View dashboard
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
