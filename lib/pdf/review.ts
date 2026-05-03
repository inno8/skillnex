/**
 * Server-side PDF rendering for the "email finalized review" flow.
 *
 * Built on pdfkit because:
 *   - Pure JS, no headless browser (puppeteer would balloon the
 *     droplet's memory + cold-start cost for one feature)
 *   - Default Helvetica family covers everything we need; no font
 *     bundling
 *   - ~200KB install, no postinstall scripts
 *
 * Output is intentionally simple — same content as the inline email
 * body (summary headline, paragraph, strengths, watch items, signature)
 * laid out as a single-page review document. Manager edits + cover note
 * already shown in the email; the PDF is the printable archival copy.
 */
import PDFDocument from "pdfkit";

/**
 * One row in the metrics block. Mirrors the MetricRow component on the
 * employee detail sidebar — main label/value plus an optional smaller
 * caption underneath the label (used for "dept avg ..." style hints).
 *
 * `tone` colors the value cell red/green for at-a-glance comparisons,
 * matching the sidebar's positive/negative coding.
 */
export type ReviewMetric = {
  label: string;
  value: string;
  /** Trailing unit, e.g. "/ 100" or "/ 5". Rendered smaller/muted. */
  unit?: string;
  /** Subline under the label, e.g. "dept avg 41.8". */
  caption?: string;
  tone?: "positive" | "negative" | null;
};

/** A grouped set of metrics — header above, rows below. */
export type ReviewMetricGroup = {
  title: string;
  /** Optional explanatory paragraph between header and rows. */
  blurb?: string;
  rows: ReviewMetric[];
};

export type ReviewPdfArgs = {
  employeeName: string;
  reviewerName: string;
  tenantName: string;
  cycleLabel?: string;
  summary: string;
  reviewParagraph: string;
  strengths: string[];
  watchItems: string[];
  /** Optional cover note from the manager — appears at the top of the
   *  document so the printed version preserves it. */
  coverNote?: string;
  /** Optional ISO date for the document footer. Defaults to "now". */
  dateIso?: string;
  /** Optional metric groups rendered between the watch items and the
   *  signature. Used to mirror the sidebar's "This cycle" + "Comparison
   *  column" tables on the printable copy. */
  metricGroups?: ReviewMetricGroup[];
};

const INK = "#0B0F19";
const MUTED_1 = "#52525B";
const MUTED_2 = "#71717A";
const ACCENT = "#C2410C";
const RULE = "#E7E5E0";
const SUCCESS = "#0F766E";
const DESTRUCTIVE = "#B91C1C";

/** Render the review to a Buffer (PDF bytes). Resolves once the doc closes. */
export async function renderReviewPdf(args: ReviewPdfArgs): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 64, bottom: 64, left: 64, right: 64 },
    info: {
      Title: `Performance review · ${args.employeeName}`,
      Author: args.reviewerName,
      Subject: `Performance review for ${args.employeeName}`,
      Producer: "Skillnex",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  /* ---- Header band ---- */
  doc
    .fillColor(ACCENT)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("PERFORMANCE REVIEW", { characterSpacing: 1.4 });

  doc.moveDown(0.3).fillColor(INK).font("Helvetica-Bold").fontSize(22).text(args.employeeName);

  const dateLabel = new Date(args.dateIso ?? Date.now()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc
    .moveDown(0.2)
    .fillColor(MUTED_1)
    .font("Helvetica")
    .fontSize(10)
    .text(`${args.tenantName}${args.cycleLabel ? ` · ${args.cycleLabel}` : ""} · ${dateLabel}`);

  doc
    .moveDown(0.8)
    .strokeColor(RULE)
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();

  doc.moveDown(0.8);

  /* ---- Optional cover note ---- */
  if (args.coverNote && args.coverNote.trim().length > 0) {
    doc.fillColor(MUTED_2).font("Helvetica-Oblique").fontSize(10).text(args.coverNote.trim(), {
      align: "left",
      lineGap: 2,
    });
    doc.moveDown(0.8);
  }

  /* ---- Summary headline ---- */
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text(args.summary, { lineGap: 3 });

  doc.moveDown(0.6);

  /* ---- Body paragraph ---- */
  doc
    .fillColor(INK)
    .font("Helvetica")
    .fontSize(11)
    .text(args.reviewParagraph, { align: "left", lineGap: 4 });

  doc.moveDown(1);

  /* ---- Strengths ---- */
  if (args.strengths.length > 0) {
    sectionHeader(doc, "What stood out");
    bulletList(doc, args.strengths);
    doc.moveDown(0.6);
  }

  /* ---- Watch items ---- */
  if (args.watchItems.length > 0) {
    sectionHeader(doc, "Things to watch");
    bulletList(doc, args.watchItems);
    doc.moveDown(0.6);
  }

  /* ---- Metric groups (mirrors the sidebar tables) ---- */
  if (args.metricGroups && args.metricGroups.length > 0) {
    for (const group of args.metricGroups) {
      if (group.rows.length === 0) continue;
      sectionHeader(doc, group.title);
      if (group.blurb) {
        doc.fillColor(MUTED_1).font("Helvetica").fontSize(9.5).text(group.blurb, { lineGap: 1 });
        doc.moveDown(0.3);
      }
      metricTable(doc, group.rows);
      doc.moveDown(0.6);
    }
  }

  /* ---- Footer rule + signature ---- */
  doc.moveDown(0.4);
  doc
    .strokeColor(RULE)
    .lineWidth(0.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.6);

  doc.fillColor(INK).font("Helvetica").fontSize(11).text(`— ${args.reviewerName}`);
  doc.fillColor(MUTED_2).fontSize(9).text(args.tenantName);

  /* ---- Trust footer (small, low contrast) ---- */
  doc
    .moveDown(1.2)
    .fillColor(MUTED_2)
    .font("Helvetica-Oblique")
    .fontSize(8)
    .text(
      "Every figure in this review is sourced from data uploaded by your HR team. " +
        "If a number looks wrong, that's a conversation to have with your manager and HR. " +
        "Generated and emailed via Skillnex.",
      { align: "left", lineGap: 1 },
    );

  doc.end();
  return done;
}

function sectionHeader(doc: PDFKit.PDFDocument, text: string) {
  doc
    .fillColor(MUTED_1)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(text.toUpperCase(), { characterSpacing: 1.2 });
  doc.moveDown(0.3);
}

/**
 * Two-column key/value table for a metric group. Label (with optional
 * caption) on the left, value (with optional unit) right-aligned.
 * Each row gets a hairline rule under it except the last.
 *
 * pdfkit doesn't have grid primitives, so we manage cursor position
 * manually with `text(..., x, y, { lineBreak: false })` for the value
 * cell and let the label cell flow naturally on the left.
 */
function metricTable(doc: PDFKit.PDFDocument, rows: ReviewMetric[]) {
  const xLeft = doc.page.margins.left;
  const xRight = doc.page.width - doc.page.margins.right;
  const colWidth = xRight - xLeft;
  // Reserve right ~38% for the value cell — wide enough for currency
  // strings like "$122,250" without crowding the label.
  const valueColX = xLeft + Math.round(colWidth * 0.62);
  const valueColWidth = xRight - valueColX;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const startY = doc.y;

    // Label
    doc
      .fillColor(MUTED_1)
      .font("Helvetica")
      .fontSize(10)
      .text(row.label, xLeft, startY, {
        width: valueColX - xLeft - 6,
        lineBreak: false,
      });

    // Value (right-aligned in the value column)
    const valueColor =
      row.tone === "negative" ? DESTRUCTIVE : row.tone === "positive" ? SUCCESS : INK;
    doc
      .fillColor(valueColor)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(row.value, valueColX, startY, {
        width: valueColWidth,
        align: "right",
        lineBreak: false,
      });

    if (row.unit) {
      // Inline unit after the value — also right-aligned, smaller,
      // muted. pdfkit's continued text doesn't play well with right-
      // align so we just append it on the same baseline manually.
      const unitText = ` ${row.unit}`;
      doc
        .fillColor(MUTED_2)
        .font("Helvetica")
        .fontSize(9)
        .text(unitText, valueColX, startY + 2, {
          width: valueColWidth,
          align: "right",
          lineBreak: false,
        });
    }

    // Drop down past the value row.
    let nextY = startY + 14;

    // Caption (smaller line under the label).
    if (row.caption) {
      doc
        .fillColor(MUTED_2)
        .font("Helvetica")
        .fontSize(8.5)
        .text(row.caption, xLeft, nextY, {
          width: valueColX - xLeft - 6,
          lineBreak: false,
        });
      nextY += 11;
    }

    // Hairline rule under each row except the last.
    if (i < rows.length - 1) {
      doc
        .strokeColor(RULE)
        .lineWidth(0.4)
        .moveTo(xLeft, nextY + 4)
        .lineTo(xRight, nextY + 4)
        .stroke();
      nextY += 9;
    } else {
      nextY += 4;
    }

    doc.y = nextY;
    doc.x = xLeft;
  }
}

function bulletList(doc: PDFKit.PDFDocument, items: string[]) {
  const indent = 14;
  doc.fillColor(INK).font("Helvetica").fontSize(10.5);
  for (const item of items) {
    const x = doc.page.margins.left;
    const y = doc.y;
    // Bullet glyph at the left margin, text indented by `indent`.
    doc.text("•", x, y, { lineBreak: false });
    doc.text(item, x + indent, y, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - indent,
      lineGap: 2,
    });
    doc.moveDown(0.2);
  }
}
