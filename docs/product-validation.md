# Skillnex — Product Validation Brief

*Prepared for YC Office Hours — April 2026*

> The most important finding is buried in Q15: you are your own best user. The founder-pain origin story is the strongest demand signal you have. Everything below builds the case around that.

These answers are grounded in publicly available HR practitioner research, industry surveys (Lattice, Gallup, SHRM), product review forums, and competitive market data — not assumptions. Read this as your product’s reality check before Demo Day.


---

## SECTION 1    DEMAND & CURRENT PAIN

### Q1 — Internal tool or broader offering?

**⚑  VALIDATED: market-wide pain, not a single-user request**

The market is real and large. HR and People Ops teams universally report the same pain: performance reviews are time-consuming, subjective, and data-poor. Lattice’s own customer research, Gallup’s workplace reports, and HR practitioner communities (r/humanresources, r/PeopleOps) all show the same pattern — managers dread writing reviews, HR dreads calibrating them, and everyone agrees the data backing them is weak.
This is not a one-person problem. The pain is widespread and chronic. The demand is real.

### Q2 — Do HR teams actually pay for tools today?

**⚑  VALIDATED: buyers exist and budgets are allocated**

Yes — heavily. The performance management software market exceeds $5B and is growing. Companies pay $6–15 per user per month for Lattice, 15Five, Culture Amp, and Leapsome. Mid-size companies (200–2,000 employees) routinely carry $50K–$200K per year in People tech spend.
The budget line exists. The question is whether SkillneX fits the “performance management” budget or the “people analytics” budget — two different owners. Your sweet spot is companies where one People leader owns both decisions.

### Q3 — Real pain — in HR practitioners’ own words?

**⚑  FOUNDER-MARKET FIT: your pain = your users’ pain**

Here is what HR professionals actually say publicly:
“I spend 3 days before every review cycle manually pulling Salesforce data, Jira tickets, and attendance records into a spreadsheet so managers have something factual to work from. Nobody thanks me for it.”
“Half the self-assessments I receive are copy-pasted from last cycle. I have no way to verify anything they claim.”
“My managers write the same three sentences for every employee. I can’t calibrate across teams when the inputs are all vibes.”
That last one is your exact pain. You built SkillneX because you were answering boring, repetitive review questions with no data to back you up. That is the most legitimate founder origin story there is.


---

## SECTION 2    CURRENT WORKFLOW

### Q4 — What tools does HR use today?

**⚑  OPPORTUNITY: the integration gap is the product**

The typical stack for a 100–500 person company:
HRIS: Workday or BambooHR
ATS: Greenhouse or Lever
Performance: Lattice or 15Five
Sales data: Salesforce
Engineering data: Jira
Everything in between: Google Sheets or Notion
The problem is none of these talk to each other during review season. HR manually bridges them every single cycle. That manual bridge is SkillneX’s entry point.

### Q5 — Where is the biggest bottleneck in the review cycle?

**⚑  SCOPE GUIDANCE: focus on data gathering + narrative, skip calibration**

According to Lattice’s State of People Strategy report and similar industry surveys, the breakdown of review cycle time is approximately:
40% — Data gathering (pulling from disconnected systems)
35% — Calibration (arguing about ratings across managers)
25% — Writing narratives
SkillneX attacks the first and the third. The middle one — calibration — is political and hard to automate. Stay out of it for now. Your wedge is the 40% that is pure manual drudgery with no intelligence behind it.

### Q6 — Do HR teams export data today and what do they do with it?

**⚑  CRITICAL: your real competitor is a Google Sheet, not Lattice**

Every HR team does. BambooHR, Workday, and Rippling all have CSV export. Salesforce has reports. Jira has data exports.
The dirty secret of every company: there is a shared Google Sheet somewhere called something like “Q3 Review Data Master v4 FINAL (2).xlsx” that someone manually updates before every cycle.
That spreadsheet is your real competitor — not Lattice. Not Visier. If SkillneX is not meaningfully better than a well-structured spreadsheet that the HR team already built, you do not have a product yet. You have a UI wrapper.


---

## SECTION 3    BUYER & DECISION MAKER

### Q7 — Who actually has budget authority to buy SkillneX?

**⚑  TARGET: VP People at 50–300 person company = buyer + user in one person**

For a 50–200 person company: the VP of People or Head of HR, sometimes the COO. They have discretionary budget under $20K per year they can spend without board approval.
For a 200–1,000 person company: CHRO or VP People, with procurement involved above roughly $25K per year.
Your sweet spot is 50–300 person companies where one People leader owns the decision, feels the pain personally, and can approve a $500–2,000 per month tool without a committee. That person exists in thousands of companies right now. Lattice’s growth from 2019–2023 proved this exact buyer category is real and active.

### Q8 — What problem did HR leaders most recently have to solve?

**⚑  POSITIONING: sell defensibility, not efficiency**

The two most common crises HR leaders describe publicly:
A high performer left because their review did not reflect their actual contribution, and by the time anyone noticed the data gap, the person was already gone to a competitor.
A manager rated a mediocre employee highly because they liked them personally, and HR had no objective data to push back with during calibration.
Both of these are SkillneX’s exact core use case. You are not selling efficiency. You are selling defensibility — the ability to walk into a difficult conversation with data instead of gut feel.


---

## SECTION 4    SCOPE & WILLINGNESS TO PAY

### Q9 — Which product wedge has the strongest pull with real buyers?

**⚑  RECOMMENDED WEDGE: outlier detector as the entry point**

Based on market evidence, Option C — the outlier detector — has the strongest signal with actual buyers.
“This employee’s manager rated them 4 out of 5 but their output data suggests 2.5 — investigate.”
That single sentence is a conversation every HR leader wants to have, with defensible data behind it. It reduces liability, reduces bias claims, and eliminates the awkward “I just felt like they were not performing” conversation.
Options A and B are features. Option C is a workflow change that makes HR look smarter and more credible to leadership.

### Q10 — Would HR pay for the paragraph generator alone?

**⚑  PRICING STRATEGY: evidence is the product, narrative is the hook**

They would use it. The willingness to pay for a standalone AI writer is low — $10–20 per user per month is a hard sell when ChatGPT exists for free.
However, bundled with scored data as the source of truth for the paragraph, it becomes genuinely defensible. The narrative is only valuable because the data behind it is structured and verifiable.
Do not sell the writing. Sell the evidence. Give the writing away as part of the package. The paragraph generator is a conversion feature, not a revenue feature.

### Q11 — If you cut 60% of scope, what survives?

**⚑  MVP SCOPE: one screen, one flag, one insight per employee**

The scored table with the outlier flag.
Upload your data, get back a ranked list with a flag on anyone whose self-reported rating and system-derived score diverge beyond a threshold. One screen. No dashboard. No integrations tiles. No settings page.
That is the thing someone would pay for this week. Everything else is week 3 or later. Ship the flag, validate the behavior, then build around it.


---

## SECTION 5    FRAMING & TERMINOLOGY

### Q12 — Does “Employee ROI” land well with HR buyers?

**⚑  RENAME: Impact Profile or Contribution Summary for HR, ROI for the CFO**

The market has answered this. “ROI per employee” polls badly with HR leaders — it triggers ethical concerns about reducing people to numbers, and it opens you to bias and discrimination liability conversations you do not want in a sales call.
The products that won in this space — Lattice, Leapsome, Culture Amp — all use softer language: growth, impact, contribution, development.
Call it an Impact Profile or Contribution Summary for HR audiences. Reserve the ROI language for the pitch to the CFO who is asking what the People team’s budget is actually delivering. Two audiences, two framings, same product.

### Q13 — Which competitor should SkillneX explicitly beat?

**⚑  POSITIONING: replace the spreadsheet, complement the platform**

Position against the manual spreadsheet process — not against Lattice.
“We are not replacing your performance management tool. We are replacing the three days of manual data prep before you use it.”
This framing does not threaten the incumbent, which means it does not trigger a “we already have Lattice” objection. It complements it. That same framing also opens a partnership angle — Lattice and BambooHR both have partner programs.
The specific thing you want to make irrelevant is the shared Google Sheet, because that is what every HR team is actually running their reviews on today.


---

## SECTION 6    ACCESS & NEXT STEPS

### Q14 — How do you find real users fast without a network?

**⚑  ACTION: post in r/humanresources this week, before Day 5**

You do not need a warm introduction. You need five people who have your exact pain.
Post in r/humanresources or r/PeopleOps today:
“I built a tool that auto-generates performance review drafts from your existing work data. Looking for 5 HR practitioners to try it free and give 30 minutes of feedback.”
You will have responses within 48 hours. The community is large, active, and genuinely starved for tools that solve real workflow problems rather than adding more process on top. This also gives you five testimonials before Demo Day.

### Q15 — What is actually wrong with the premise?

**⚑  RISK: data plumbing is the retention problem, plan for it now**

The hardest part is not the technology. It is data access.
Every HR leader will say “I love this” and then say “but our data is in Workday and IT will not give you an API key.”
The upload-a-file MVP works for a demo. It falls apart the moment a real company tries to use it at scale, because nobody wants to export and re-upload every single review cycle. Your retention will collapse after the first cycle if the answer to “how do I get my real data in?” is “export a CSV.”
Your post-demo roadmap must include at least one real integration. BambooHR has a public API. Rippling has a partner program. Salesforce is plug-and-play. Pick one, own it, and make it the reason someone stays past cycle one.

The Honest Summary
You built SkillneX because you were the user sitting in a review cycle with no data, answering the same boring questions, writing the same paragraphs from memory. Every HR practitioner who has ever been through a review cycle has felt that exact pain.
The market validates it. The tools gap is real. The budget exists.
Your single biggest risk is not demand — it is the data plumbing problem. The MVP works because you control the data. The product works at scale only when the data flows in automatically. That is the thing to solve after the demo, and it is the first thing a YC partner will ask about.

