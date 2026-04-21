# Skillnex — Product Review Brief

**Prepared for:** Product owner / reviewer assigned to Skillnex MVP
**Prepared by:** Engineering (Yanick), following the YC Office Hours framework
**Date:** 2026-04-21
**Status:** Engineering scaffold Day 1 complete. Review needed before further product scope is locked in.

---

## Why you're reading this

Skillnex is being built as an internal MVP to demonstrate "employee ROI and impact" analysis for an HR lead. Engineering has been given a PDF spec and two sample data files and has started building. Before we invest another 8-9 days of engineering effort, we need a product sign-off on premise, target user, competitive landscape, and scope. The engineer is not the product owner and should not be answering these questions alone.

This document captures:

1. What was scoped from the spec and data we were given
2. The six YC-style forcing questions, applied to Skillnex, with what we know and what's unknown
3. Premise challenges (assumptions that need validation)
4. Alternative framings the product could take
5. What you need to decide or provide so engineering can de-risk week 2

**Time expectation to review:** 15-20 minutes. Written answers to the items marked `ASK` unblock engineering.

---

## 1. What Skillnex is, as currently scoped

**Problem statement from the spec:**
> HR teams struggle to quantify employee performance and impact. Reviews rely heavily on employees reporting their own work. Skillnex will connect work data from systems employees already use and convert that into measurable employee impact metrics.

**MVP target:** a demo that ingests company data (Sales, Engineering, HR activity + Payroll/Compensation), computes ROI or impact per employee in a department-aware way, and generates a short LLM-written narrative HR can paste into a review.

**Demo data on file:**
- `Data skillnex.xlsx` — 50 sales reps, 50 engineers, 43 payroll rows (43/100 joined by name — engineering had 0/50 until regenerated), 10 HR activity rows
- `skillnex_HR_Sample_Data.xlsx` — 55 activity rows across 11 HR employees with a rich compensation sheet (base, bonus, equity, benefits, total cost-to-company)

**What the engineering team has built in Day 1:**
- Next.js 16 + TypeScript scaffold with upload page, dashboard, integrations tiles
- SheetJS parser, SQLite persistence, name-based joins
- Regenerated demo xlsx with complete Payroll (100/100 employees now have salary)
- PLAN.md with deterministic value models per department + LLM narrative layer (Claude Haiku 4.5, strict-narration-only mode)
- Pushed to https://github.com/inno8/skillnex

**Total eng budget remaining:** ~9 days.

---

## 2. Six Forcing Questions

Each question is **restated plainly**, followed by **what engineering currently believes**, **what's unverified**, and a **specific ask** for the reviewer.

### Q1. Demand Reality — does anyone actually want this?

> What's the strongest evidence that someone would be genuinely upset if Skillnex disappeared tomorrow? Not "interested." Not "signed up for a demo." Evidence of behavior — someone paying, someone building their workflow around it, someone losing sleep if we vanished.

**What we believe:** An HR lead at the sponsor org asked for this, which is why it exists. One stakeholder is a start, not a signal.

**What's unverified:**
- No evidence of a second HR team asking for the same thing
- No competitive alternative has been named as currently painful to use
- "Self-reported data in reviews is unreliable" is stated but not measured — how much time/money does HR currently lose to that unreliability?

**ASK (Q1):**
1. Is this a tool one HR leader wants, or an offering the company plans to sell / replicate across customers?
2. If internal: does HR pay for tools today (Lattice, 15Five, Culture Amp)? What line-item does Skillnex replace or supplement?
3. Do we have written evidence — a slack message, a meeting note, an email — from the HR lead describing the current pain in their own words? If yes, can you share it with eng?

---

### Q2. Status Quo — what do people do today?

> What is HR doing right now to get employee impact data, even badly? What does it cost them?

**What we believe:** HR runs reviews on self-reported data + manager sentiment + whatever metrics each department volunteers. They likely export CSVs from Salesforce/Jira/Slack ad hoc and eyeball them.

**What's unverified:**
- How much of a real review cycle is spent on data-gathering vs. writing?
- What tools are already in use (Lattice, Culture Amp, Workday, BambooHR, 15Five, Leapsome, Reflektive)?
- Does HR already have a spreadsheet that does 70% of what Skillnex does? If yes, Skillnex is a UI wrapper around an existing process, not a new capability.

**ASK (Q2):**
1. Name the two or three tools the target HR team uses today for reviews, compensation, or performance analytics. If none, note that.
2. How long does a review cycle take per employee today, and what part is the bottleneck — data gathering, rating calibration, or writing the narrative?
3. Does the HR lead already export data from any source system? If yes, what do they do with it?

---

### Q3. Desperate Specificity — who exactly is the buyer and the user?

> Name the actual human. Title. What gets them promoted. What gets them fired. What keeps them up at night.

**What we believe:** "HR lead" is a role filter, not a person. We were told the demo audience is "one HR lead" but don't know:
- Their seniority (VP People, Director, HRBP, Generalist?)
- Whether they can authorize purchases or if a CFO/COO signs off
- Whether they own performance reviews or just support them

**What's unverified:**
- The buyer persona
- The user persona (could be same person or different)
- What specifically would make this HR lead look good to *their* boss if they adopt Skillnex

**ASK (Q3):**
1. What's the exact title of the demo audience?
2. Who signs the check if this becomes a real product — same person, or someone else?
3. What's the most recent performance problem this HR leader had to solve? What did they wish they had that would have helped?

---

### Q4. Narrowest Wedge — what's the smallest thing someone would pay for?

> Not the platform. The single feature or workflow someone would pay real money for this week.

**What we believe:** The PDF mentions ROI calc, dashboard, integrations, 8 metrics. Engineering has already narrowed to: upload xlsx → compute value score + ROI for Sales/Eng → Activity Impact Score for HR → LLM review paragraph. That's still ambitious for a demo.

**Candidate wedges (ranked by simplicity):**
- (a) **LLM review paragraph generator** — HR pastes rows from a spreadsheet, gets a reviewable draft. 1-day build. No dashboard.
- (b) **Department-aware ROI calculator** — upload xlsx, get a single scored table. Current scope minus narrative.
- (c) **Review-ready comparison** — "Our score says 87, your existing rating says 3.5 stars — investigate this employee." Positions Skillnex as a *validator* of existing reviews, not a replacement.
- (d) **Current full scope** — dashboard + narrative + integrations tiles.

**ASK (Q4):**
1. Would the HR lead pay $X/month for wedge (a) alone?
2. Would the HR lead pay $X/month for wedge (c) alone?
3. If we had to cut 60% of current scope, which wedge survives?

---

### Q5. Observation & Surprise — what do real users actually do?

> Has anyone sat down and watched the HR lead use this without helping them? What surprised us?

**What we believe:** No one has. There's no product yet.

**What's unverified:** Everything about actual usage.

**ASK (Q5):**
1. Has the HR lead been shown a wireframe, mockup, or competitor screenshot to react to? What did they say?
2. Are we allowed to schedule a 30-min session with the HR lead before day 10, or is the demo day itself the first time they see it?
3. If they can react to something sooner, we strongly recommend it.

---

### Q6. Future-Fit — does this get more or less essential in 3 years?

> In 2029, is Skillnex more needed or less? Why?

**What engineering sees as the tension:**
- **More needed:** if AI takes over more individual tasks, measuring human impact gets *harder* (less visible output), so tools that derive impact from secondary signals become more valuable.
- **Less needed:** if integrations like Lattice + GitHub + Salesforce all get native AI summaries, Skillnex is a thin middleware layer getting squeezed from both sides.
- **Redefinition risk:** "performance review" itself may become continuous / real-time in 3 years. Snapshot-based ROI tools may feel dated.

**ASK (Q6):**
1. What's the 3-year bet — is Skillnex a product, a feature inside a larger HRIS, or a consulting deliverable dressed up as software?
2. If we bet that employees become harder to measure (AI eats tasks), what specific signals does Skillnex capture that existing HRIS tools can't?

---

## 3. Premise Challenges

Three assumptions baked into the current scope that may not survive contact with reality:

### Premise A: "HR wants a quantified ROI number per employee."

Unstated assumption: HR treats people as ROI units. Many modern HR orgs explicitly *reject* this framing on ethics grounds (Gallup, Adam Grant, recent HBR writing). A dollar ROI on a human that misses "ambassador," "mentor," "culture carrier" roles is actively dangerous. The current plan handles this partially — the LLM is forbidden from recommending HR actions, and HR gets an Activity Impact Score with no dollar figure. But the pitch still leads with "ROI." Worth testing whether the HR lead actually *wants* ROI or wants something softer like "Impact Summary."

### Premise B: "LLM narratives are a product, not a feature."

Lattice, Leapsome, and most modern HRIS are racing to add AI review summaries as a checkbox feature. Building a product around this is a small window. If Skillnex's moat is "better department-aware formulas," that's defensible. If the moat is "we write the paragraph for you," that's a feature someone else ships free in 6 months.

### Premise C: "Upload-a-file" is the right shape.

Real HR teams live in Workday, BambooHR, Rippling. Nobody *wants* to export a CSV. If the MVP succeeds and the HR lead asks "how do I get my real data in?", the answer has to be "integrations that don't exist yet." That's a second fundraise worth of engineering, or a pivot to being a wrapper on top of an existing HRIS API.

**ASK (premises):** which of these three, if any, would change what we're building? Push back on any you disagree with.

---

## 4. Alternative Framings

What else could this be?

**Framing 1 — Review Copilot (not a dashboard).** Skillnex is a Chrome extension / sidebar for Lattice or BambooHR that reads review drafts in progress and pulls in data-backed evidence from Salesforce/Jira. "Your narrative says 'high performer' — here are three numbers that back that up." No standalone UI. No upload. Lives where HR already works.

**Framing 2 — Calibration tool for comp meetings.** Skillnex doesn't do individual reviews at all. It takes a spreadsheet of 200 employees and produces a visual grid showing outliers — people whose ratings don't match their output, or whose comp doesn't match their impact. Output: a PDF for comp committees, not an employee-level dashboard.

**Framing 3 — Self-serve for employees.** Flip the user. Skillnex lets employees upload their own activity and get a generated "impact summary" they show their manager at review time. Solves the "self-reporting unreliable" problem differently — by making self-reporting *structured* instead of replacing it.

**Framing 4 — What we're currently building.** General-purpose xlsx → department-aware ROI + LLM narrative dashboard.

**ASK (alternatives):** does any of 1-3 feel closer to what the HR lead described than 4? If yes, we should reconsider week 2 scope.

---

## 5. Competitive Landscape — unverified, please validate

Engineering does not have visibility into the competitive set. Provisional categories based on common market knowledge:

| Category | Incumbents | What they do | How Skillnex would differ (unverified) |
|---|---|---|---|
| Performance management suites | Lattice, Leapsome, 15Five, Culture Amp | OKRs, reviews, engagement surveys | Skillnex focuses on *quantification* from existing work tools, not survey-based |
| HRIS with perf modules | Workday, BambooHR, Rippling | All-in-one | Skillnex is narrower and integrates with these, not replaces |
| People analytics | Visier, One Model, ChartHop | Executive dashboards, retention modeling | Skillnex is employee-level not aggregate |
| Productivity telemetry | Time Doctor, ActivTrak, Hubstaff | Screen / keystroke tracking (ethical concerns) | Skillnex pulls from work artifacts, not surveillance |
| Free + AI | ChatGPT + Excel | Managers ask an LLM to summarize a spreadsheet | Skillnex is more structured, with enforced safety |

**ASK (competitive):**
1. Which of these categories is the HR lead already using or evaluating?
2. What specifically would make them switch to or adopt Skillnex vs. turning on AI summaries in their existing Lattice/Leapsome seat?
3. Are any of these incumbents a buyer of Skillnex (acquihire, partnership) rather than a competitor?

---

## 6. Decisions the reviewer should make or signal on

Engineering is unblocked on Day 2 (xlsx parser, value models, LLM layer) regardless of your answers. But week 2 scope (UI, polish, demo narrative) should adapt to what you decide here.

1. **Is this an internal demo or an external product?** (Changes the bar on polish, security, sales framing.)
2. **Is the current scope (full dashboard + narrative + integrations tiles) the right scope, or should we pivot to a narrower wedge before day 5?**
3. **Does the "ROI" framing survive?** Or do we reframe as "Impact Summary" across the board?
4. **Access to the HR lead before demo day** — can we get one 30-minute reaction session before day 9?
5. **Competitive positioning** — is there a specific incumbent we should explicitly position *against* (or *avoid* being compared to)?

---

## 7. What engineering is doing while you review this

Not waiting. Work continues on:
- Day 2: xlsx parser for both workbook shapes + name/ID joins + schema validation + unit tests
- Day 3: value models (Sales, Engineering, HR) + SQLite + upload API
- Day 4: LLM layer with Claude Haiku 4.5, strict narration mode, prompt caching
- Day 5: UI work begins. *This is the natural point to absorb your feedback.* If scope changes materially, the cost is 1-2 days, not 9.

If you can return written answers to the `ASK` items within 3 working days, engineering can adapt day 5 onward without losing the 10-day total budget.

---

## Appendix A — Current engineering artifacts

- **PLAN.md** (in repo): full scope, data model, value formulas, milestones
- **github.com/inno8/skillnex**: day 1 scaffold committed, runnable via `pnpm dev`
- **public/samples/**: `skillnex-demo.xlsx` (all 100 employees joined), `skillnex_HR_Sample_Data.xlsx` (user-provided HR file)
- **Source spec**: `MVP - skillnex.pdf` (in repo)

## Appendix B — Voice / methodology note

This brief applies the YC "Office Hours" forcing-question framework to an engineering-led project. The goal is not to block engineering on philosophical debate — it's to make the product bet visible and owned by someone other than the person writing the code. If no one owns it and the demo fails, the right question is "why did we build this?" and that's a conversation we should have *before* we build it, not after.
