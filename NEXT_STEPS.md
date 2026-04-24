# Next Steps — non-engineering action items

Track non-code work that unlocks or validates the MVP. If code blocks on one of these, note it in the row.

## This week

### 1. Recruit 5 HR practitioners for feedback — before Day 5

**Source:** `docs/product-validation.md` §Q14.

**Action:** Post in `r/humanresources` and `r/PeopleOps` with the following (or adapt):

> **Looking for 5 HR practitioners — free trial + 30 min feedback**
>
> I built a tool that auto-generates performance review drafts from your existing work data (Salesforce, Jira, spreadsheets). It reads a workbook, joins the sheets, and flags employees where the data disagrees with the manager's rating. Not a Lattice replacement — it replaces the three days of manual data prep before every cycle.
>
> If you run HR for a 50–300 person company and this sounds like your pain, I'll give you free access plus a 30-minute walkthrough in exchange for honest feedback. DM or comment below.

**Why it matters:** This is the market-validation signal that opens the YC partner conversation and fills Demo Day with testimonials. The brief estimates responses within 48 hours.

**Blocker:** none. Can run in parallel with code.

### 2. Register a domain + landing page — before posting

Before dropping a Reddit post, have a one-page landing site to send curious prospects to. Doesn't need to be fancy. Skillnex homepage copy works — just hosted somewhere besides localhost. Fly.io / Vercel / Render free tier. One afternoon of work.

**Blocker:** engineering — we need to decide on hosting before landing this. Default recommendation: Vercel (Next.js native, free for this size).

### 3. Capture the founder-pain origin story

**Source:** `docs/product-validation.md` §Q3 / §Q15.

The brief's strongest finding: *"You built SkillneX because you were answering boring, repetitive review questions with no data to back you up. That is the most legitimate founder origin story there is."*

Write 200-300 words on this — when, what you tried first, why the spreadsheet wasn't enough. It's the opening slide of Demo Day. Keep it honest and specific, not polished.

## Before Demo Day

- **Integration scoping spike (1 day, eng):** BambooHR API developer signup, read the authentication docs, confirm the schema matches `EmployeeRecord`. Does not need to ship working code — just "we know how to build this, here's the plan."
- **CFO-facing pitch deck:** different language from the HR UI. This is the only place "Employee ROI" appears as a term (`docs/product-validation.md` §Q12).
- **Demo script walkthrough:** open on `/people` sorted by flag → click the first mismatch → show the detail narrative → show calibration as supporting evidence. Practice to a non-HR listener first.

## After Demo Day (retention risk — §Q15)

This is the list that prevents cycle-one churn. None are optional if we land a paying customer.

1. BambooHR API connector (first) — matches the 50–300 person target buyer.
2. Rippling partner program (second) — cross-department in one API.
3. Salesforce REST (third) — easiest of the real integrations.
4. GitHub API (fourth) — engineering signals.

See `PLAN.md` §10.5 for the ranked rationale.
