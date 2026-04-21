#!/usr/bin/env python
"""Convert docs/office-hours-findings.md to docs/office-hours-findings.pdf.

Lightweight markdown renderer tuned for the brief — handles H1-H4, paragraphs,
bullets, blockquotes, bold, italics, inline code, tables, and horizontal rules.
No external markdown lib dependency to keep install surface small.
"""

import re
import sys
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "office-hours-findings.md"
OUT = ROOT / "docs" / "office-hours-findings.pdf"

INK = HexColor("#0f172a")
MUTED = HexColor("#475569")
ACCENT = HexColor("#1e293b")
RULE = HexColor("#cbd5e1")
CODE_BG = HexColor("#f1f5f9")


def base_styles():
    ss = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "t", parent=ss["Heading1"], fontName="Helvetica-Bold",
            fontSize=22, leading=28, spaceAfter=8, textColor=INK,
        ),
        "h1": ParagraphStyle(
            "h1", parent=ss["Heading1"], fontName="Helvetica-Bold",
            fontSize=16, leading=22, spaceBefore=18, spaceAfter=8, textColor=INK,
        ),
        "h2": ParagraphStyle(
            "h2", parent=ss["Heading2"], fontName="Helvetica-Bold",
            fontSize=13, leading=18, spaceBefore=14, spaceAfter=6, textColor=INK,
        ),
        "h3": ParagraphStyle(
            "h3", parent=ss["Heading3"], fontName="Helvetica-Bold",
            fontSize=11, leading=15, spaceBefore=10, spaceAfter=4, textColor=ACCENT,
        ),
        "body": ParagraphStyle(
            "b", parent=ss["BodyText"], fontName="Helvetica",
            fontSize=10, leading=14.5, spaceAfter=6, textColor=INK, alignment=TA_LEFT,
        ),
        "bullet": ParagraphStyle(
            "bu", parent=ss["BodyText"], fontName="Helvetica",
            fontSize=10, leading=14, spaceAfter=2, leftIndent=16, bulletIndent=4,
            textColor=INK,
        ),
        "quote": ParagraphStyle(
            "q", parent=ss["BodyText"], fontName="Helvetica-Oblique",
            fontSize=10, leading=14, spaceAfter=6, leftIndent=14,
            textColor=MUTED,
        ),
        "meta": ParagraphStyle(
            "m", parent=ss["BodyText"], fontName="Helvetica",
            fontSize=9, leading=12, textColor=MUTED, spaceAfter=2,
        ),
    }


def inline(text: str) -> str:
    # Escape XML-ish chars for reportlab's paragraph parser, then apply markup.
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Bold **x** and __x__
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"__(.+?)__", r"<b>\1</b>", text)
    # Italics *x* and _x_  (after bold so ** isn't consumed)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"(?<!_)_(?!_)(.+?)(?<!_)_(?!_)", r"<i>\1</i>", text)
    # Inline code
    text = re.sub(
        r"`([^`]+)`",
        r'<font name="Courier" backColor="#f1f5f9">\1</font>',
        text,
    )
    # Links [text](url)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<link href="\2"><u>\1</u></link>', text)
    return text


def parse_table(lines, i):
    # Expect: header | ---- | rows...
    header_line = lines[i].strip().strip("|")
    sep_line = lines[i + 1].strip()
    if not re.match(r"^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$", sep_line):
        return None, i
    headers = [h.strip() for h in header_line.split("|")]
    rows = []
    j = i + 2
    while j < len(lines) and lines[j].strip().startswith("|"):
        row = [c.strip() for c in lines[j].strip().strip("|").split("|")]
        rows.append(row)
        j += 1
    return {"headers": headers, "rows": rows}, j


def render_table(tbl, styles):
    cell_style = ParagraphStyle(
        "tc", parent=styles["body"], fontSize=9, leading=12, spaceAfter=0,
    )
    head_style = ParagraphStyle(
        "th", parent=cell_style, fontName="Helvetica-Bold",
    )
    data = [[Paragraph(inline(h), head_style) for h in tbl["headers"]]]
    for row in tbl["rows"]:
        padded = row + [""] * (len(tbl["headers"]) - len(row))
        data.append([Paragraph(inline(c), cell_style) for c in padded[: len(tbl["headers"])]])
    col_count = len(tbl["headers"])
    t = Table(data, colWidths=[6.5 * inch / col_count] * col_count, repeatRows=1)
    t.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f8fafc")),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE),
            ("LINEBELOW", (0, -1), (-1, -1), 0.4, RULE),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [None, HexColor("#fbfcfd")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    return t


def build(md_text: str):
    styles = base_styles()
    story = []
    lines = md_text.splitlines()
    i = 0
    in_list = False
    pending_bullets = []

    def flush_bullets():
        nonlocal pending_bullets, in_list
        for b in pending_bullets:
            story.append(Paragraph(inline(b), styles["bullet"], bulletText="\u2022"))
        pending_bullets = []
        in_list = False

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()

        # Horizontal rule
        if re.match(r"^-{3,}$", line.strip()):
            flush_bullets()
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width="100%", color=RULE, thickness=0.5))
            story.append(Spacer(1, 4))
            i += 1
            continue

        # Headings
        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            flush_bullets()
            level = len(m.group(1))
            text = inline(m.group(2))
            key = {1: "title" if not story else "h1", 2: "h2", 3: "h3", 4: "h3"}[level]
            story.append(Paragraph(text, styles[key]))
            i += 1
            continue

        # Blockquote
        if line.startswith("> "):
            flush_bullets()
            story.append(Paragraph(inline(line[2:]), styles["quote"]))
            i += 1
            continue

        # Bullet list
        bm = re.match(r"^[-*]\s+(.*)$", line) or re.match(r"^\d+\.\s+(.*)$", line)
        if bm:
            in_list = True
            pending_bullets.append(bm.group(1))
            i += 1
            continue

        # Table
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|?\s*:?-", lines[i + 1]):
            flush_bullets()
            tbl, new_i = parse_table(lines, i)
            if tbl is not None:
                story.append(render_table(tbl, styles))
                story.append(Spacer(1, 6))
                i = new_i
                continue

        # Blank line
        if line.strip() == "":
            flush_bullets()
            i += 1
            continue

        # Paragraph
        flush_bullets()
        # Collapse soft-wrapped lines into one paragraph
        para = [line]
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            if (
                nxt.strip() == ""
                or re.match(r"^(#{1,4})\s+", nxt)
                or re.match(r"^[-*]\s+", nxt)
                or re.match(r"^\d+\.\s+", nxt)
                or nxt.startswith("> ")
                or nxt.startswith("|")
                or re.match(r"^-{3,}$", nxt.strip())
            ):
                break
            para.append(nxt)
            j += 1
        story.append(Paragraph(inline(" ".join(p.strip() for p in para)), styles["body"]))
        i = j

    flush_bullets()
    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.75 * inch, 0.5 * inch, "Skillnex \u2014 Product Review Brief")
    canvas.drawRightString(
        LETTER[0] - 0.75 * inch, 0.5 * inch, f"Page {doc.page}"
    )
    canvas.restoreState()


def main():
    if not SRC.exists():
        print(f"Missing source: {SRC}", file=sys.stderr)
        sys.exit(1)
    md_text = SRC.read_text(encoding="utf-8")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title="Skillnex \u2014 Product Review Brief",
        author="Skillnex engineering",
    )
    story = build(md_text)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
