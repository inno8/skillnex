# SkillneX — Alignment Review

**Prepared for:** Product reviewer / stakeholder
**Prepared by:** Engineering
**Date:** 2026-04-24
**Subject:** Review of `SkillneX_Before_After_Review.pdf` against the MVP build
**Companion docs in repo:** `docs/office-hours-findings.md`, `docs/product-validation.md`, `PLAN.md`, `DESIGN.md`

---

## The document in hand

The Before-After Review PDF describes SkillneX as a **per-employee review deep dive** built on a **competency framework**:

- Each employee gets 5 competencies scored (Client Focus, Domain Application, Growth & Development, Operational Excellence, Perseverance & Impact)
- Each competency has **Manager Score vs Data-Derived Score** with a Gap and a status (OUTLIER / ALIGNED / REVIEW)
- Each score is backed by **4 verified signals** per competency, pulled from specific systems (Calendar, Slack, CRM, LMS, SmartSheet, Scribe, Jira, Salesforce, Rework Log, Project Log, Peer Feedback)
- Side-by-side layout: **Part A** shows the original manager one-sentence plus the employee's 5-bullet self-assessment (with flags: "generic", "self-reported, unverified"). **Part B** shows the SkillneX-generated score, the gap, and the narrative citing those 4 signals
- Final summary: three framed findings (Manager Comment Problem, Hidden Impact Problem, Calibration Risk)

The origin story is sharp: *"The employee wrote 5 evidence-backed bullet points per competency. The manager wrote one sentence. Both said Successful. Only one could defend it. SkillneX was built to fix that imbalance."*

---

## What the MVP already gets right

Most of the product primitives the Before-After PDF depends on are already built and tested in the current MVP.

| Before-After PDF feature | MVP status |
|---|---|
| Core thesis: verified data vs self-reported, outlier detection, narrative generation | Built in full |
| Positioning: replace the 3 days of manual data-gathering before the review, not replace Lattice | Already the homepage hero copy |
| Data-Derived Score vs existing rating, with gap flag | Implemented as the `score-vs-rating-mismatch` anomaly, labeled "Rating disagrees with data" in the UI |
| Ready-to-paste manager narrative, data-backed, strict-narration mode | `NarrativeCard` component with Copy button. Real Haiku 4.5 run: 94% pass rate against the safety guard, zero HR-action language leaks |
| Impact Profile framing (not "Employee ROI" in HR-facing UI) | Renamed in the Path B commit per product-validation findings |
| Safety architecture: no invented numbers, no HR recommendations | 7 safety rules in the cached system prompt, post-LLM guard rejects inventions, 64 unit tests green |
| Anomaly chip semantics (OUTLIER / ALIGNED / REVIEW) | Same concept, different labels: `anomaly`, `success`, `neutral` chips |
| Multi-source signal aggregation | Parser already reads multiple sheets and joins them into one employee record |
| Systems-connected tiles | `/integrations` page renders 4 tiles (demo-mocked) |

**Signal:** the product philosophy, safety discipline, positioning, and most of the UI primitives are shared between what we built and what the PDF describes. We are not off-track.

---

## Structural gaps vs the Before-After PDF

The PDF operates at a different zoom level than the MVP. Specifically:

| Gap | What the PDF expects | What the MVP has |
|---|---|---|
| Competency model | 5 named competencies per employee, each independently scored | One value score per employee, per department |
| Side-by-side review | Part A (original review: manager rating + one-sentence comment + employee 5-bullet self-assessment) alongside Part B (data-derived score + verified signals + narrative) | Single detail view with computed metrics only. No ingestion of the original review. |
| Verified signals per competency, labeled by source system | 4 signals per competency (e.g. Calendar, Slack, CRM, Peer Mentions for Client Focus) | One combined signal blob per employee; sources not labeled |
| Manager-comment + employee-self-assessment ingestion | First-class inputs to the review | Not captured |
| Generic-comment detector | Flags one-sentence manager comments as non-specific | Not implemented |
| Per-competency narrative generation | 5 narratives per employee, one per competency, each citing the signals for that competency | One narrative per employee |
| Three-findings summary | Cycle-close summary: Manager Comment Problem, Hidden Impact Problem, Calibration Risk | Not present |
| PDF export of the review | Export the per-employee Before-After layout as a PDF | Not built (the office-hours PDF pipeline can be adapted) |
| Review Time Saved metric | Shown in the hero stat strip | Not measured |

---

## The honest read

The MVP answers the HR calibration question: *"Show me the whole team and flag who to investigate."* 110 employees ranked, outliers on top, a scatter plot for calibration meetings.

The Before-After PDF answers the review-writing question: *"Pre-fill this employee's review with data so the manager does not have to."* One employee, five competencies, side-by-side original-vs-data, verified signals, ready-to-paste prose per competency.

Both are legitimate. The PDF is the stronger product because it is closer to the actual workflow it replaces (a manager sitting down to write a review with a blank page). The team view is a secondary HR-admin workflow that complements it.

**The MVP proves the thesis. The Before-After PDF describes the next zoom-in.**

---

## Reuse, not rewrite

Every primitive the Before-After PDF needs already exists in the code. Adding the new layer is additive, not destructive.

- **Gap detection between computed and existing rating** — reused as the per-competency gap
- **Strict-narration LLM layer with post-guard** — reused for per-competency narratives (5 calls per employee instead of 1)
- **Ready-to-paste with Copy button** — reused per competency
- **Anomaly flags as chips** — reused with OUTLIER / ALIGNED / REVIEW semantics
- **Multi-source signal aggregation in the parser** — extended to tag each signal with its source system
- **Design system** (Fraunces display, burnt orange accent, Part-A-vs-Part-B editorial layout) — already specified in DESIGN.md, fits the PDF layout naturally
- **Positioning, product validation, office-hours brief** — unchanged

---

## Recommended path forward

**Ship the current MVP as the team-overview view.** It is already built, tested, and demo-ready. Do not throw it out. The PDF layout sits *inside* the existing detail page as a richer replacement for the current single-narrative view.

Rough scope for the per-employee review page (post-MVP):

1. **Day 11-12** — Competency model and signal mapping. New `competencies` table keyed by (employee_key, competency_name). Five rows per employee. Migrate one department's ingest to produce 5 per-competency scores. Config file mapping each signal to one or more competencies (for example, `LMS.cert_hours` belongs to Growth & Development; `Jira.on_time_completion_rate` belongs to Operational Excellence).
2. **Day 13** — Original-review ingestion. Accept a new xlsx shape (or a manual form) carrying manager rating + 1-2 sentence comment + 5 employee self-assessment bullets per competency.
3. **Day 14** — Build the `/review` page matching the PDF layout. Part A on the left (original review with "generic" and "unverified" flags), Part B on the right (data score + gap + verified signals + per-competency narrative). Per-competency accordion.
4. **Day 15** — Per-competency narrative generation. Five Haiku calls per employee. Generic-comment detector (simple LLM classifier: "Could this comment apply to any employee in any company? Yes/No."). PDF export using the existing reportlab pipeline.
5. **Day 16** — Three-findings summary generator for the cycle close (Manager Comment Problem, Hidden Impact Problem, Calibration Risk).

Estimated scope: roughly another week of engineering, cleanly additive to what already ships.

---

## What stays unchanged

- Parser, joins, DB schema (extend, do not replace)
- LLM client, guard, mock (reuse verbatim)
- Design system
- Positioning, product validation, office-hours brief
- All 64 unit tests

---

## Decision needed from the product reviewer

1. **Does this Before-After PDF become the new north star?** If yes, Engineering captures it in the repo alongside `product-validation.md` and `office-hours-findings.md`, and scopes the per-employee review page as the next phase in `PLAN.md`.
2. **Does the current MVP still ship as the team-overview demo?** Recommendation: yes. It proves the thesis to the HR stakeholder and has already earned the engineering investment. It becomes the entry point to the per-employee review when that page is built.
3. **Which department's signal-to-competency mapping do we build first?** The PDF uses an Engineering-heavy example (Salesforce, Jira, LMS, Scribe). That matches our Engineering data shape most closely. Recommendation: Engineering first, Sales second, HR third.

---

## One-line summary

The MVP and the Before-After PDF describe the same product at different zoom levels. The MVP proves the thesis at the team level; the PDF specifies the next zoom-in — per-employee, per-competency, original-vs-verified. The structural gap is the competency model; every other primitive already exists. Estimated additional effort: one week.
