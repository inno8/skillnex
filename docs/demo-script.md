# Skillnex — HR Demo Script

**Audience:** HR Director / VP People at a 50-300 person company
**Length:** 12 minutes (10 min walkthrough + 2 min Q&A)
**Goal:** Get the prospect to say *"this replaces our spreadsheet — when can my team try it?"*
**Hard constraint:** never say "Employee ROI" out loud. Use **Impact Profile**, **Contribution**, or **Outlier flag**.

## Pre-demo (15 min before)

| Step | What |
|---|---|
| 1 | Open a fresh terminal in `C:/Users/yanic/dev/skillnex` |
| 2 | Verify `.env.local` has `ANTHROPIC_API_KEY=sk-ant-...` (real API for the live demo, not mock) |
| 3 | `rm -f data/skillnex.db*` — start with a clean database so the upload is the first interaction |
| 4 | `pnpm dev` — wait for `✓ Ready in ~1s` |
| 5 | Open `http://localhost:3000` in a fresh Chrome window (no DevTools open, browser zoom 100%) |
| 6 | Have `public/samples/skillnex-demo.xlsx` visible in File Explorer (drag-source) |
| 7 | Have a backup tab open with the dashboard already populated, in case the live upload glitches |
| 8 | Close Slack, email, every notification source. Mute phone. |

If anything is red, do not start the demo. Recover or reschedule.

## Minute-by-minute walkthrough

### 0:00 — Open: the founder pain (45 sec)

> *"Before I show you the product, here's why it exists. I was in a performance review last quarter and I had five evidence-backed bullet points for every competency I was reviewed on. My manager wrote one sentence per competency. Both of us said 'Successful.' Both of us were right. Only one of us could defend it. Skillnex was built to fix that imbalance — not by replacing the review, but by replacing the three days of manual data prep that should have happened before it."*

**What you do:** sit at your laptop, browser open to `/` (Ingest screen). Don't click anything yet. Just talk.

**What they should think:** *"That's literally my last review cycle."*

### 0:45 — The current state of the world (45 sec)

> *"Every HR team I've talked to has a shared spreadsheet somewhere called something like Q3 Review Data Master v4 FINAL (2). Someone updates it manually before every cycle. It pulls together Salesforce activity, Jira tickets, training records, and tries to give managers something factual to write from. Three days of work, every quarter, just to prep for a meeting. That spreadsheet is what we replace."*

**What you do:** still on `/`. Point at the screen but don't interact.

> *"This is the upload page. Ingest is Step 1 of 3. We accept Excel — same workbooks your HR team is already maintaining."*

### 1:30 — Live upload (60 sec)

**What you do:** drag `skillnex-demo.xlsx` onto the drop zone.

> *"Watch this. I'm dropping in a fake company with about a hundred employees across Sales, Engineering, and HR. Three sheets, joined on employee name."*

The dropzone goes orange, then shows "Processing skillnex-demo.xlsx..." for ~2 seconds, then "110 employees scored · Shape A · 0 missing salary."

> *"Done. We parsed three sheets, joined them on employee name, ran department-aware scoring formulas, and persisted everything to a local database. No data left this machine."*

Click **"Continue to overview."**

**What they should think:** *"That was easy. And fast."*

### 2:30 — The overview (90 sec)

You're now on `/dashboard`. Five KPI tiles at the top.

> *"Five numbers tell you the cycle's shape. 110 employees. Average value score 50 out of 100. Average contribution 0.43x — that's revenue per dollar of salary, only computed for Sales and Engineering. Total payroll $11.2M. Twelve anomalies that need your attention."*

Point at the **Anomalies** sidebar on the right.

> *"This is where the conversation lives. We grouped flagged employees by reason. The top one — 'Rating disagrees with data' — these are people whose existing performance rating differs from what the actual work data shows by more than 30 points normalized. That's the conversation every HR leader wants to have, with data behind it."*

Hover over one of the names in the anomaly list (don't click yet).

> *"The other flags: missing salary data, low-contribution senior employees, underpaid high-performers. Each one is a calibration meeting moment."*

### 4:00 — Department rollup (45 sec)

Scroll down to the department rows.

> *"Three departments. Each row shows total impact, average contribution as a sparkbar, average score, payroll, anomaly count. I can click into any one to see only that department's people."*

**Don't click.** This is supporting evidence. The story is in the next screen.

### 4:45 — People list (90 sec)

Click **People** in the sidebar.

> *"This is the People view. By default, sorted with flagged outliers first — so the conversation you most need to have is at the top of the screen."*

Point at the leftmost column (Flags).

> *"Flag chips on the left. The orange ones are the outliers. Within each flag group, ranked by value score."*

Point at the search bar.

> *"I can filter by department, by flag type, search by name."*

Click on the first flagged Engineering employee with a "Rating disagrees" chip — pick someone obvious like Elijah Brown if available, or whoever surfaces first.

### 6:15 — The detail page (90 sec, the centerpiece)

You're now on `/people/[employee_key]`.

> *"Here's the per-employee view. Avatar header. The current cycle's metrics in the rail on the right — value score, contribution ratio, ranking, salary, comparison column showing the existing rating side-by-side with what we computed."*

Point at the **Comparison column** card.

> *"This is the moment. Existing HR rating: 4 out of 5. Our computed value score: 89 out of 100. Those don't agree. Rather than picking a winner, we surface the disagreement so a human can investigate."*

Scroll to the **Signal breakdown** card.

> *"Below that, the raw signals that drove the score. Tasks completed, bugs fixed, pull requests, code commits. These are the numbers any narrative will be grounded in."*

### 7:45 — The narrative — the close (90 sec)

Scroll up to the **Narrative card** (currently shows "Generate narrative for [Name]").

> *"And here's where the manager pain goes away. Watch."*

Click **Generate**.

The card spins for ~2 seconds, then the narrative appears.

> *"That paragraph is what a manager would have to write from scratch otherwise. It cites every number from this employee's actual data. No HR action recommendations — we don't tell anyone to fire or promote. Strict narration mode. The data is the data."*

Point at the **Strengths** and **Watch items** cards below the paragraph.

> *"Strengths and watch items in two columns. Each one ties back to a specific signal. Hover any phrase in the paragraph and the supporting metric in the rail highlights — though that's a Phase 2 feature, not yet wired."*

Click **Copy paragraph**.

> *"And it's in your clipboard. Paste into Lattice, paste into Workday, paste into a draft email. The manager edits if they want. They don't write from a blank page."*

### 9:15 — Calibration (45 sec)

Click **Calibration** in the sidebar.

> *"One more screen. Calibration. Each dot is one employee. Horizontal axis is value score. Vertical axis is contribution. Upper-right quadrant — top performers. Lower-left — scope-review candidates. The flagged employees are orange. Click any dot to lock it."*

Click a flagged dot.

> *"Selection panel on the right. Open detail goes back to the page we were just on. This is what you bring into a comp committee."*

### 10:00 — The framing close (60 sec)

Click back to **Dashboard**.

> *"Three days of HR analyst work, replaced. Defensible data backing every rating. Outliers surfaced before calibration, not discovered during it. The product is built on a strict-narration LLM that cannot invent data — every claim traces back to a number in your workbook."*

> *"For the pilot, we work with the workbook you're already maintaining. After the pilot, we connect directly to BambooHR, Salesforce, GitHub, and Calendar so the workbook goes away entirely. That's the roadmap. But you can start using this today, with the spreadsheet you already have."*

> *"The pilot is free for 90 days. Then it's $7 per employee per month. For your team, that's roughly [calculate live: headcount × $7 × 12]. We sign a Data Processing Agreement before any data is uploaded. Everything is encrypted at rest, hosted in the US, GDPR-compliant for any EU employees on your team."*

> *"What questions do you have?"*

## Anticipated questions + answers

### "How is this different from Lattice / 15Five?"

> *"They're a great review-management tool — a place to write reviews, track goals, run engagement surveys. We don't compete with that. We replace what happens before you open Lattice — the three days of pulling Salesforce reports and Jira exports into a spreadsheet to give managers something to write from. We complement Lattice. The narrative we generate is meant to be pasted directly into Lattice's review form."*

### "What does the LLM see? Is my data being used to train models?"

> *"During the pilot, we use Anthropic's Claude API with a 30-day default retention on their side. After the pilot, we request Zero Data Retention from Anthropic — once granted, your prompts and outputs aren't logged at all. We never use customer data for training. None of our prompts include data outside what your workbook contained. The narrative cannot reference numbers that aren't in the input — that's enforced by a post-LLM safety check that runs after every single generation."*

### "Can I see exactly what data the LLM gets?"

> *"Yes. There's an audit log on every generation. We can show you the exact JSON payload sent to Claude for any specific employee. Every numeric claim in the narrative gets cross-checked against that input."*

### "What about my employees in the EU?"

> *"GDPR-compliant from day one. Each employee can request data deletion in 7 days — faster than the 30-day legal floor. Employees can also opt out of integration data collection at any time, one-click. Special-category data — race, religion, disability, etc. — is hard-rejected by our parser if it appears in the workbook. We don't process it, we don't store it, we don't have a way to even ingest it."*

### "What if a manager wants to override the narrative?"

> *"They edit the draft. The Copy paragraph button is the entry point — you take what we generated, paste into your review tool, and edit freely. We're a starting point, not a verdict. The human is always the decision-maker."*

### "How long does setup take?"

> *"For the pilot — fifteen minutes. You upload one workbook. That's the whole onboarding. Once we connect BambooHR after the pilot, it's a single OAuth flow."*

### "What does the data residency look like for the pilot?"

> *"During the pilot, infrastructure is US-East. Disclosed in the DPA. When we have our second EU customer, we open EU region in DigitalOcean Frankfurt. For the pilot's law-firm-style customer, we explicitly never ingest client matter data — only employee performance data. There's a written scope statement in the DPA."*

### "What if Skillnex disappears tomorrow?"

> *"Your data is in your workbook. We export everything to JSON or CSV with one button click — that's a legal requirement under GDPR right-to-data-portability. You can take everything with you in 30 seconds and we can't stop you."*

### "How accurate are the narratives?"

> *"In our last test against the real Claude Haiku 4.5 model, 17 out of 18 narratives passed our safety guard — meaning they cited only numbers that were in the input data, with no invented figures, no HR action recommendations, no speculation. The one that got rejected was a regenerate-able edge case. Manager always reviews and edits before submitting."*

### "Can I have one of my managers try it before we sign?"

> *"That's exactly the pilot. Free for 90 days, your real workbook, your real managers. We get to learn from how they use it. You get to decide whether it's worth $7 a seat at the end of 90 days, with no commitment."*

### "What are you building next?"

> *"Three things, in order: per-competency narrative — five paragraphs per employee instead of one, side-by-side with the original review for context. Then the first integration: BambooHR, so the workbook upload goes away. Then Salesforce, GitHub, and Calendar. Full roadmap is in our planning docs — we can share them after the call."*

## Backup plans

### If the upload fails live

- Have a backup browser tab open with `/dashboard` already populated
- Switch to it without commenting
- *"OK that didn't go cleanly — let me jump to where we'd be after the upload."*
- Continue from minute 2:30

### If the narrative generation fails

- Note the moment, click **Regenerate** once
- If still fails: navigate to a different employee whose narrative was already generated (load `/dashboard` and pick a top performer, then click into them — narratives persist across sessions)
- *"Anthropic's API hiccupped — happens occasionally. Real production uses a queue with automatic retries. Here's a previously-generated example."*

### If the dev server crashes

- Hit Ctrl+C in the terminal, run `pnpm dev` again
- Takes ~5 seconds to restart
- Refresh the browser
- *"One sec — restarting locally. In production this is auto-recovered."*

### If you forget where you are

- Click **Dashboard** in the sidebar — it's the safest fallback
- The five KPI tiles are easy to talk about while you reset

## Post-demo follow-up

Within 24 hours, send:

1. **The plan PDFs** — `docs/plan-1-auth.pdf` through `docs/plan-5-llm-cost.pdf`. Frame them as *"the planning docs we mentioned — these are how we're thinking about the build."*
2. **A one-page security summary** — until the public security page is live (Phase 2.2), draft a one-pager covering: encryption at rest (AES-256), encryption in transit (TLS 1.3), single-tenant DB row isolation, audit log, GDPR right-to-deletion in 7 days, sub-processors (Anthropic, DigitalOcean, Resend), where data is hosted (DO US-East), no special-category data ingestion.
3. **A draft DPA** — the template legal-reviewed version. Even if they don't sign immediately, having it ready answers the procurement question.
4. **Calendar hold** — propose a 30-min follow-up two weeks out. Goal: confirm pilot start date.

## Things to never say in a demo

- "Employee ROI" (always say Impact Profile, Contribution, or Outlier)
- "Our AI thinks..." (the LLM is a templated narrator, not an opinion)
- "We can probably build that" (commit to specific roadmap items only — Phase 2 plans are public)
- "Our pricing is flexible" (the pilot is free, then $7/seat, with volume discounts at 1,000+ — no negotiation in the first call)
- Any disparaging comment about Lattice / 15Five / Workday (they're the customer's existing tools — we complement, never trash)

## Things to always say

- "The human is always the decision-maker."
- "Every claim cites a specific number from your data."
- "The pilot is free for 90 days, no commitment."
- "We replace your spreadsheet, not your performance management system."
- "If you want, we can show you the exact JSON sent to the LLM for any employee."

---

Last updated: 2026-05-03. Update this script after every demo with what worked, what didn't, and what new questions came up.
