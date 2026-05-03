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
};

const INK = "#0B0F19";
const MUTED_1 = "#52525B";
const MUTED_2 = "#71717A";
const ACCENT = "#C2410C";
const RULE = "#E7E5E0";

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
