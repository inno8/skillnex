"use client";

import { Icons } from "@/components/icons";

/**
 * Action buttons in the employee detail header. Lives in a client
 * component because Export PDF needs window.print() — and we want to
 * keep the rest of the detail page server-rendered.
 *
 * "Export PDF" triggers the browser's print dialog with the print
 * stylesheet from globals.css applied — prints the review only, no
 * sidebar / nav / hover affordances. Save-as-PDF is then one click in
 * the dialog. Server-side PDF rendering (puppeteer/playwright) is a
 * follow-up if customers want one-click downloads, but every browser
 * already has print-to-PDF built in for free.
 *
 * "Approve & lock" used to live here as a placeholder. Removed because
 * the workflow isn't designed: it would need a status column on
 * employees (draft|approved|locked), a /api/people/<key>/approve API,
 * an audit row, immutability rules ("locked" should reject narrative
 * regeneration), and a way to unlock. All real work — picking it up
 * means a Phase 2.5 mini-design rather than shipping a button that
 * doesn't actually do anything.
 */
export function EmployeeActions() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
        <Icons.Download size={13} /> Export PDF
      </button>
    </div>
  );
}
