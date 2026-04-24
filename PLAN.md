# Skillnex MVP — Engineering Plan

**Owner:** Yanick
**Timebox:** 1-2 weeks, demo-grade
**Status:** Validated — executing with market-validated positioning (see `docs/product-validation.md`)

Repo: https://github.com/inno8/skillnex

## 1. Goal

Replace the three days of manual data prep that happens before every performance review cycle. Skillnex ingests a company's existing workbook (Sales, Engineering, HR — from Workday, Salesforce, Jira exports), joins it, and flags where the data disagrees with the manager's rating. Defensibility in, not efficiency out.

**Wedge (market-validated):** the outlier detector. *"Manager rated 4/5 but output data suggests 2.5 — investigate."* This single flag is the conversation every HR leader wants to have with data behind it, and the core product bet. Everything else (narrative generation, scatter calibration, department rollups) is supporting evidence.

**Positioning:** not a Lattice/Leapsome replacement. The real competitor is the shared `Q3 Review Data Master v4 FINAL (2).xlsx` every HR team maintains by hand. We replace that spreadsheet, not their performance-management tool.

**Target buyer:** VP People at a 50–300 person company — one person is buyer + user, discretionary budget under $20K/yr, no committee.

**HR-facing terminology:** Impact Profile and Contribution Summary. Reserve "Employee ROI" for the CFO audience only — HR communities associate that phrase with reducing people to numbers (legal/ethics risk in a sales call).

Success = HR lead walks out saying "this replaces my spreadsheet and gives me evidence for the hard conversations." Five testimonials from r/humanresources posts before Demo Day (see `NEXT_STEPS.md`).

Failure = LLM invents metrics the data doesn't support, or the data-plumbing problem (Q15) means every cycle requires a manual re-export and HR churns after cycle one.

## 2. Scope — What ships

### In scope
- **Flexible xlsx upload** supporting two shapes, detected automatically by the sheet names present:
  - **Shape A (combined workbook):** Sales Team + Engineering + Payroll data + HR team sheets in one file (the `Data skillnex.xlsx` format, regenerated as `skillnex-demo.xlsx`)
  - **Shape B (HR-only workbook):** HR Activity Log + Employee Compensation + Summary Dashboard sheets (the `skillnex_HR_Sample_Data.xlsx` format)
  - Uploading both independently merges their data by department. Re-uploading the same shape replaces that shape's rows.
- Parser + schema validation with clear error messages and row-level feedback
- Name-based join within each workbook (activity rows ↔ cost rows) to pull salary or total-cost-to-company per employee
- Computed derived fields when Excel formula cells are blank (Total_Cost_to_Company = base + bonus + equity + benefits_ER, Total_Target_Comp = base + bonus, etc.)
- SQLite persistence (single file, no server setup)
- Department-aware value models: **Sales + Engineering + HR** for the demo, generic fallback for others
- Employee list view (sortable table, grouped by department)
- Employee detail view (metrics + contribution breakdown + LLM narrative)
- Department summary view (top performers, watch-list, dept avg ROI)
- **Comparison column:** pre-existing Performance_Score (Engineering sheet) and Performance_Rating (Payroll sheet) shown alongside our computed value_score — explicitly NOT fed into the formula. Product framing: "does our number agree with yours?"
- LLM analysis layer that:
  - Narrates each employee's ROI in 2-3 sentences (strict mode: numbers only, no interpretation)
  - Produces a review-ready paragraph HR can paste into performance docs
  - Flags anomalies (e.g. "revenue 3x above department average")
  - Is constrained to only use numbers present in the computed output — cannot invent data
- Four "Integration" tiles (Salesforce, Jira, Slack, Asana) — clearly labeled `Demo — not connected`
- **Corrected demo data file** (`public/samples/skillnex-demo.xlsx`) — regenerated from the provided `Data skillnex.xlsx` with a complete Payroll sheet (all 50 Sales + 50 Engineering employees have salary rows) so ROI computes for everyone.

### NOT in scope (explicit)
- **The five uncomputable metrics** (Quality, Culture, Team Influence, Replaceability, Team Champion). UI shows them as `Requires: [data source]` — e.g., Quality requires code review data, Culture requires Slack/peer signal. Do not fabricate. Reason: fake numbers drive real decisions.
- Real API integrations (Salesforce/Jira/Slack/Asana) — mocked tiles only
- Authentication / user accounts — hardcode one HR session
- Multi-tenant / orgs
- PostgreSQL — SQLite is enough for a demo
- Docker / deployment pipeline — localhost is the demo target
- Historical tracking / trend charts — single snapshot only (source files span 5-15 days of data, but the demo renders aggregated snapshots, not trends over time)
- Editing employee data in UI — re-upload xlsx to change
- **Per-activity-type dollar weights for HR** (e.g. "each recruited hire = $2000 value") — rejected for MVP because it bakes in assumptions we can't defend. HR gets Activity Impact Score only; no fake dollar ROI.

### Deferred, not dropped
- Real integrations → phase 2, requires data-model work per source
- Anonymization mode → phase 2, talk to legal first
- Trend charts → phase 2, requires timestamped uploads
- Auth + org scoping → phase 2, before any non-demo use

## 3. Stack — Boring by default

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 App Router (React + TypeScript)** | Server components for data-heavy views, client components for interactivity. |
| Backend | **Next.js API routes (Node.js + TypeScript)** | Same framework, same language, zero context switch. API routes handle CSV parsing, DB, LLM calls. |
| LLM | **Anthropic Claude Haiku 4.5** via `@anthropic-ai/sdk` | Fast, cheap, excellent at structured output. ~$0.03 per full demo run (20 employees). Sonnet is overkill for templated narratives. |
| LLM safety | **Prompt caching + tool_use structured output** | System prompt (rules + schemas) cached across all per-employee calls. JSON schema enforced via tool definition — can't return freeform text. |
| UI | **Tailwind + shadcn/ui** | Decent-looking out of the box. HR demo cannot look like a 1999 form. |
| DB | **SQLite via better-sqlite3** | Zero setup. One file. Fast enough for 10K rows. |
| xlsx parsing | **SheetJS (`xlsx` npm)** | Multi-sheet, handles formulas, date coercion. Battle-tested, no native deps. |
| CSV parsing (secondary) | **papaparse** | Kept as a fallback if someone uploads a CSV instead of xlsx. |
| Tests | **Vitest + Playwright** | Vitest for unit (metrics, xlsx, LLM response schema). Playwright for one end-to-end upload→dashboard flow. |
| Lint/format | **Biome** | Faster than eslint+prettier, one config. |
| Package manager | **pnpm** | Fast, disk-efficient. |

Innovation tokens spent: 0. Claude API + Haiku is a mature, well-documented surface. Prompt caching reduces LLM cost by ~90% for this workload.

**Environment:** `ANTHROPIC_API_KEY` in `.env.local`, gitignored. Demo works offline with a `--mock-llm` flag that returns canned narratives (so HR demo still runs if internet dies).

## 4. Data model

### Two supported upload shapes

Skillnex detects shape by which sheet names are present, then parses accordingly. Both shapes coexist in the DB; uploading one does not clear the other.

### Shape A — combined workbook (source: `Data skillnex.xlsx` → regenerated as `skillnex-demo.xlsx`)

**Sales Team sheet** (50 rows, 5-day daily activity snapshot):
```
Rep_ID, Rep_Name, Region, Calls_Made, Emails_Sent, Meetings_Booked,
Opportunities_Created, Deals_Closed, Revenue_Generated, Activity_Date
```

**Engineering sheet** (50 rows, 5-day daily activity snapshot):
```
Engineer_ID, Engineer_Name, Projects_Assigned, Tasks_Completed, Bugs_Fixed,
Code_Commits, Pull_Requests, Performance_Score, Activity_Date
```

**Payroll data sheet** (employee cost per pay cycle):
```
Employee_ID, Employee_Name, Department, Salary, Bonus, Overtime_Hours,
Performance_Rating, Payroll_Date
```

**HR team sheet** (lightweight activity log — used as fallback HR activity source if Shape B not uploaded):
```
Employee_ID, Employee_Name, Activity_Type, Activity_Description,
Activity_Date, Duration_Hours, Employees_Impacted, Status
```

### Shape B — HR-only workbook (source: `skillnex_HR_Sample_Data.xlsx`)

**HR Activity Log sheet** (55 activity rows across 11 HR employees, March 2026):
```
Employee_ID, Employee_Name, Department, Job_Title, Activity_Type,
Activity_Description, Activity_Date, Duration_Hours, Employees_Impacted,
Cost_Center, Priority, Status, Notes
```
`Department` here means HR sub-department (Talent Acquisition, HR Business Partner, Compensation & Benefits, Payroll, L&D, HR Ops, Employee Engagement). For Skillnex's top-level dept filter, all of these roll up to `HR`. Sub-department is preserved as a facet.

**Employee Compensation sheet** (11 rows, richer than Shape A Payroll):
```
Employee_ID, Employee_Name, Department, Job_Title, Level, Employment_Type,
Annual_Base_Salary, Annual_Bonus_Target_Pct, Annual_Bonus_Target_Amt,
Annual_Equity_Grant, Total_Target_Comp, Health_Benefits_ER, 401k_Match_ER,
Other_Benefits_ER, Total_Benefits_Cost_ER, Total_Cost_to_Company,
Hire_Date, Pay_Frequency, FLSA_Status, Location
```
**Formula cells are blank on export.** Skillnex computes the derived totals when missing:
- `Annual_Bonus_Target_Amt = Annual_Base_Salary × Annual_Bonus_Target_Pct`
- `Total_Target_Comp = Annual_Base_Salary + Annual_Bonus_Target_Amt + Annual_Equity_Grant`
- `Total_Benefits_Cost_ER = Health_Benefits_ER + 401k_Match_ER + Other_Benefits_ER`
- `Total_Cost_to_Company = Total_Target_Comp + Total_Benefits_Cost_ER`

**Summary Dashboard sheet** (presentation view — ignored by the parser; regenerated in-app from parsed data)

### The join — by name (Shape A) or by Employee_ID (Shape B)

**Shape A:** no shared employee ID across sheets (Sales has `SR###`, Engineering has `EN###`, Payroll has `EMP###`). Only join key is **normalized name**. Fragile but realistic. Skillnex normalizes (lowercase, trim, collapse spaces) and joins.

**Shape B:** HR Activity Log and Employee Compensation both use `HR###` IDs. Join is on `Employee_ID` — clean.

**Activity aggregation (both shapes):** one employee appears in multiple activity rows (the HR Activity Log has 3-6 rows per employee; Sales/Eng daily rows collapse to one per employee over the 5 days). Aggregation is explicit per value model — sum / mean / max — and tested.

**Join rules:**
- Sales/Engineering row matched to exactly one Payroll row by normalized name + department
- HR Activity rows grouped by Employee_ID, joined to Compensation by Employee_ID
- If a Sales rep has no Payroll match → employee still shown with `salary: null`, marked `No salary data — ROI unavailable`
- If a Payroll / Compensation entry has no activity match → ignored (no signals to score)
- Duplicate names in the same department (Shape A) → parser rejects with row numbers
- Duplicate `Employee_ID` in Compensation (Shape B) → parser rejects

### Unified employee record (in SQLite)

After parsing + joining, Skillnex produces a unified record per employee:

```ts
type EmployeeRecord = {
  employee_key: string;     // derived: normalized name + department (Shape A) OR source_ids.activity_id (Shape B)
  source_ids: {             // original IDs preserved for display
    activity_id: string;    // SR001, EN001, or HR001
    payroll_id: string | null;  // EMP001 (Shape A) or HR001 (Shape B)
  };
  name: string;
  department: "Sales" | "Engineering" | "HR" | string;
  sub_department: string | null;  // HR only: Talent Acquisition, HR Business Partner, etc.
  job_title: string | null;       // HR only (Shape B); null for Shape A
  level: string | null;           // HR only (Shape B); e.g. L2, L3, L4
  region: string | null;          // Sales only
  salary: number | null;          // Annual_Base_Salary for Shape B; Salary for Shape A
  bonus: number | null;
  equity: number | null;          // Shape B only
  total_cost_to_company: number | null; // Shape B direct or computed; Shape A = salary + bonus
  overtime_hours: number | null;
  hire_date: string | null;       // Shape B only
  location: string | null;        // Shape B only
  signals: Record<string, number>;     // dept-specific raw signals, already aggregated
  activities: Array<{                  // HR only: raw activity log, preserved for UI
    date: string; type: string; description: string;
    duration_hours: number; employees_impacted: number;
    priority: "High" | "Medium" | "Low"; status: string;
  }> | null;
  existing_ratings: {
    performance_score: number | null;  // from Engineering sheet, 0-100
    performance_rating: number | null; // from Payroll (Shape A), 0-5
  };
  computed: {
    value_score: number;  // our normalized 0-100
    roi: number | null;   // null for HR or when cost missing
    dept_rank: number;
    dept_size: number;
  } | null;
  narrative: NarrativeOutput | null;
  snapshot_date_range: { from: string; to: string };
};
```

### SQLite schema
```sql
CREATE TABLE employees (
  employee_key TEXT PRIMARY KEY,      -- normalized name + "|" + department
  source_ids TEXT NOT NULL,           -- JSON {activity_id, payroll_id}
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  region TEXT,
  salary REAL,                        -- nullable when Payroll join fails
  bonus REAL,
  overtime_hours REAL,
  signals TEXT NOT NULL,              -- JSON: dept-specific signals
  existing_ratings TEXT NOT NULL,     -- JSON: performance_score, performance_rating
  computed TEXT,                      -- JSON: value_score, roi, dept_rank
  narrative TEXT,                     -- JSON: LLM output
  snapshot_date_range TEXT NOT NULL,  -- JSON: {from, to}
  uploaded_at TEXT NOT NULL
);

CREATE TABLE uploads (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  sheet_names TEXT NOT NULL,          -- JSON array
  row_counts TEXT NOT NULL,           -- JSON {sales:50, engineering:50, payroll:43, hr:10}
  unjoined_names TEXT NOT NULL,       -- JSON array: activity-sheet names with no Payroll match
  uploaded_at TEXT NOT NULL
);
```

Each upload **replaces** all prior rows — single-snapshot model for MVP. The `unjoined_names` field makes data-quality gaps visible in the UI ("7 sales reps missing salary data — ROI shown as —").

### Validation rules
- Required sheets: `Sales Team`, `Engineering`, `Payroll data`. `HR team` is optional.
- Required columns per sheet validated by exact name match
- `Salary` > 0, `Revenue_Generated` ≥ 0, all counts ≥ 0
- Dates must parse to valid timestamps
- Empty sheet or headers-only → parser rejects the whole upload
- Max 10,000 rows per sheet (soft limit, configurable)

## 5. Analysis pipeline — Department value models + LLM narrative

Two stages. Deterministic math first, LLM narration second. The LLM never touches the numbers.

### Stage 1: Deterministic value models (per department)

Each department has a hardcoded value formula. Numbers shown in the UI come from here. The LLM cannot change them.

**Sales value model** (inputs from `Sales Team` sheet)
```
raw_value = revenue_generated                      // primary outcome
          + (deals_closed        × 15000)          // closing consistency bonus
          + (opportunities_created × 2000)         // pipeline contribution
          + (meetings_booked     × 300)            // engagement signal
// Calls_Made and Emails_Sent are tracked but NOT weighted — too easy to game.
// Shown in the UI breakdown panel as activity context only.
value_score = normalize(raw_value, dept=Sales) → 0-100
roi = revenue_generated / salary                   // clean ROI uses revenue, not the weighted value
```

**Engineering value model** (inputs from `Engineering` sheet)
```
raw_value = (tasks_completed × 500)
          + (bugs_fixed      × 1500)               // bugs avoided = high downstream value
          + (pull_requests   × 2000)               // merged work is the unit of delivery
          + (code_commits    × 100)                // activity floor
          + (projects_assigned × 3000)             // breadth/responsibility
// Performance_Score from the sheet is NOT used as input — shown in comparison column.
value_score = normalize(raw_value, dept=Engineering) → 0-100
roi = raw_value / salary
```

**HR Activity Impact Score** (inputs from `HR Activity Log`, no dollar ROI)

HR work does not produce revenue. Rather than fabricate a dollar value, Skillnex produces an Activity Impact Score + a cost efficiency ratio.

```
priority_weight = High: 1.5, Medium: 1.0, Low: 0.5
per_activity = duration_hours × max(employees_impacted, 1) × priority_weight

raw_impact    = sum(per_activity) over all activities for this employee
activity_count = count of activities
total_hours    = sum of duration_hours
total_impacted = sum of employees_impacted

value_score = normalize(raw_impact, dept=HR) → 0-100
cost_efficiency = total_cost_to_company / max(total_impacted, 1)   // "$ per employee served"
roi = null  // explicitly null; UI shows Activity Impact Score instead of ROI for HR
```

The HR detail view surfaces Activity Impact Score, total_hours, total_impacted, cost_efficiency, and the raw activity log so HR can see exactly what drove the score. No LLM narrative inventing dollar values.

**Generic fallback (unknown departments)**
```
raw_value = sum of all numeric non-salary non-id columns (min-max normalized per column first)
value_score = normalize(raw_value) → 0-100
roi = raw_value / salary
```

Weights are opinionated starting points, editable in `lib/metrics/config.ts`. Phase 2 spec: weights configurable per-customer via a settings page.

### Comparison column (new)

Alongside our `value_score` (0-100) and `roi`, each employee detail view shows:
- **Performance_Score** (Engineering sheet only, 0-100): the value produced by whatever tooling generated the xlsx.
- **Performance_Rating** (from Payroll sheet, 0-5): existing HR rating.

Explicitly labeled as "existing ratings for comparison — not used in our calculation." If our value_score and the existing rating diverge by ≥30% (normalized), the UI shows an `Anomaly` badge inviting HR to investigate. This is the core product pitch: Skillnex validates existing judgments with fresh signal.

### Stage 2: LLM narrative layer

For each employee, the API sends a JSON payload to Claude Haiku 4.5 and gets structured output back via tool_use.

**Input to LLM** (example from the demo data):
```json
{
  "employee": {"name": "Sophia Martinez", "department": "Sales", "region": "Europe", "salary": 115000},
  "signals": {
    "revenue_generated": 62000, "deals_closed": 4, "opportunities_created": 7,
    "meetings_booked": 12, "calls_made": 60, "emails_sent": 160
  },
  "computed": {"value_score": 92, "roi": 0.54, "dept_rank": 1, "dept_size": 50},
  "existing_ratings": {"performance_rating": 4.7},
  "dept_context": {"avg_roi": 0.38, "median_revenue": 34000, "avg_deals_closed": 2.3}
}
```

**Output from LLM (enforced via tool schema):**
```json
{
  "summary": "2-3 sentence plain-English summary of the numbers",
  "strengths": ["signal-backed strength", "..."],
  "watch_items": ["signal-backed concern, if any"],
  "review_paragraph": "1 paragraph HR can paste into a performance review doc"
}
```

**Safety rules embedded in the cached system prompt (strict narration mode, phase 1):**
1. Only reference numbers present in the input JSON. Do not invent signals.
2. If a signal is missing from `signals`, say "no data" — do not estimate.
3. Do not recommend HR actions (fire / promote / raise / stretch assignment). Describe what the data shows.
4. Do not predict, infer intent, or speculate about causes. No "suggests consistency" or "appears ready for X." Stick to what the numbers show.
5. Flag anomalies when a value is ≥2x or ≤0.5x the department average, and cite the specific multiplier.
6. Use neutral language. No superlatives without a number attached.
7. If `existing_ratings` are present and our `value_score` disagrees by ≥30 points (normalized), state the disagreement neutrally and cite both numbers. Do not take sides.

**Prompt caching:** system prompt (~2K tokens: rules, schema, examples) cached. Per-employee user message ~300 tokens. Output ~250 tokens. Cost per 20-employee run ≈ $0.03.

### UI honesty labels

- Value score tooltip: "Computed from the Sales value model. Weights: revenue (1.0), deal count (25K per deal), quota attainment (500 per %). See [formula]."
- ROI tooltip: "Rough estimate. Does not account for tenure, team multipliers, or non-salary costs."
- Narrative has a `Generated by Claude` badge. The review paragraph has a "Copy" button and a disclaimer: "Narrative based on computed metrics only. Review before using in performance decisions."
- Uncomputable metrics (Culture, Replaceability, etc.) remain `Requires: [data source]` placeholders. The LLM is explicitly told not to address them.

## 6. File structure

```
skillnex/
├── PLAN.md                       # this file
├── README.md                     # how to run
├── .env.local.example            # ANTHROPIC_API_KEY placeholder
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── biome.json
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # upload page (Sales + Dev tabs)
│   ├── dashboard/
│   │   ├── page.tsx              # employee list, grouped by department
│   │   └── [id]/page.tsx         # employee detail + narrative
│   ├── departments/
│   │   └── [slug]/page.tsx       # department summary (top performers, watch-list)
│   ├── integrations/page.tsx     # mocked tiles
│   └── api/
│       ├── upload/route.ts       # POST CSV, parse, persist
│       ├── analyze/route.ts      # POST employee_ids, run value model + LLM, persist narrative
│       └── employees/route.ts    # GET list (filter by dept)
├── lib/
│   ├── db.ts                     # SQLite setup + migrations
│   ├── parsers/
│   │   ├── xlsx.ts               # SheetJS: parse multi-sheet workbook
│   │   ├── join.ts               # name-normalize + join Payroll ↔ activity sheets
│   │   ├── schema.ts             # zod schemas per sheet
│   │   └── csv.ts                # fallback for CSV uploads
│   ├── metrics/
│   │   ├── index.ts              # dispatcher: pick value model by department
│   │   ├── sales.ts              # Sales value model
│   │   ├── engineering.ts        # Engineering value model
│   │   ├── hr.ts                 # HR Activity Impact Score (no dollar ROI)
│   │   ├── fallback.ts           # generic value model
│   │   ├── normalize.ts          # min-max + guards
│   │   └── config.ts             # weights, editable
│   └── llm/
│       ├── client.ts             # Anthropic SDK client
│       ├── analyze-employee.ts   # per-employee analysis call
│       ├── prompts.ts            # cached system prompt + schema
│       ├── mock.ts               # --mock-llm canned responses for offline demo
│       └── types.ts              # NarrativeOutput TS types
├── components/
│   ├── upload-dropzone.tsx
│   ├── employee-table.tsx
│   ├── metric-card.tsx
│   ├── narrative-card.tsx        # shows LLM output with copy button
│   ├── anomaly-badge.tsx
│   └── integration-tile.tsx
├── public/
│   └── samples/
│       ├── skillnex-demo.xlsx               # Shape A, regenerated, Payroll complete
│       └── skillnex_HR_Sample_Data.xlsx     # Shape B, copy of user-provided HR file
├── scripts/
│   ├── regenerate-demo-xlsx.ts              # produces skillnex-demo.xlsx with complete Payroll
│   └── copy-hr-sample.ts                    # copies HR sample into public/samples/
├── tests/
│   ├── parsers/
│   │   ├── xlsx.test.ts
│   │   ├── join.test.ts
│   │   └── schema.test.ts
│   ├── metrics/
│   │   ├── sales.test.ts
│   │   ├── engineering.test.ts
│   │   ├── hr.test.ts
│   │   ├── fallback.test.ts
│   │   └── normalize.test.ts
│   ├── llm/
│   │   ├── prompts.test.ts       # asserts safety rules in system prompt
│   │   └── schema.test.ts        # validates output conforms to tool schema
│   └── e2e/upload-analyze.spec.ts
└── data/
    └── skillnex.db               # gitignored
```

~22 source files + 8 test files. Larger than the original plan, but the expansion is earned: LLM layer, department-specific value models, and dept summary view are core product.

## 7. Test plan — What must be tested

### Unit (Vitest)

**`parsers/xlsx.ts`:**
- Real `Data skillnex.xlsx` parses as Shape A: 50 Sales rows, 50 Engineering rows, Payroll rows, HR rows
- Real `skillnex_HR_Sample_Data.xlsx` parses as Shape B: 55 activity rows across 11 HR employees, 11 compensation rows
- Shape detection: sheet-name fingerprinting, clear error when a sheet is neither Shape A nor Shape B
- Missing required sheet for declared shape → specific error names the missing sheet
- Missing required column in a sheet → error names the sheet AND column
- Date coercion: Excel serial dates and ISO strings both parse to ISO
- Unicode preservation: `Tomás Rivera` round-trips through parse without mojibake
- Blank Excel formula cells in Compensation → parser fills derived totals (Total_Target_Comp, Total_Cost_to_Company, etc.) and marks them `computed: true` in the output
- Empty sheet → specific error
- Trailing empty rows (common in Excel) are skipped, not counted as malformed
- Summary Dashboard sheet present in Shape B → parser ignores it, no error

**`parsers/join.ts`:**
- Name normalization: "John Carter ", "john carter", "JOHN CARTER" all match
- Sales Team row with Payroll match → unified record has salary
- Engineering row with no Payroll match → unified record has salary=null, listed in unjoined_names
- Payroll row with no activity match → quietly ignored (not an error)
- Duplicate names in same department → parser error with row numbers

**`parsers/schema.ts`:**
- Zod schemas reject negative counts, bad dates, missing required fields
- Schema shape matches TypeScript types (type test)

**`metrics/sales.ts`:**
- Full signals → expected raw_value and ROI (snapshot test with known numbers from Sophia Martinez row)
- Missing `deals_closed` → treated as 0 (not an error)
- `calls_made` and `emails_sent` not weighted — test that changing them doesn't change value_score
- Zero revenue and zero deals → value_score = 0, ROI = 0
- Salary = null → ROI = null (not NaN, not 0)

**`metrics/engineering.ts`:**
- Full signals → expected raw_value and ROI
- `Performance_Score` from sheet NOT used as input (verify by varying it, output unchanged)
- Missing `bugs_fixed` → that term contributes 0
- Zero activity → value_score = 0, ROI = 0
- Salary = null (no Payroll match) → ROI = null, value_score still computed

**`metrics/hr.ts`:**
- Employee with 5 activities, mixed priorities → raw_impact is exact weighted sum (snapshot)
- Priority weights: High=1.5, Medium=1.0, Low=0.5 exactly (tested per case)
- Activity with `employees_impacted = 0` → floored to 1 in the product, not zeroed out
- No activities → value_score = 0, cost_efficiency = null (not infinity)
- `Total_Cost_to_Company` blank in sheet → computed from components; hr value model uses the computed value
- `roi` is always null for HR (verify by reading the returned record)
- Activities preserved in output record for UI rendering

**`metrics/fallback.ts`:**
- Unknown department with 3 numeric columns → sums normalized columns
- No numeric columns beyond required → value_score = 0

**`metrics/normalize.ts`:**
- Min-max over [10, 20, 30] → [0, 50, 100]
- Single value → returns 50 (documented choice, avoids NaN)
- All equal values → all return 50
- Empty array → throws

**`llm/prompts.test.ts`:**
- System prompt contains the 5 safety rules verbatim (regex check — rules must not drift)
- Tool schema matches `NarrativeOutput` TypeScript type (type-level test via tsd or manual assertion)

**`llm/schema.test.ts`:**
- Sample LLM response validates against schema
- Response with extra fields → rejected (strict mode)
- Response missing `review_paragraph` → rejected
- Response with numbers outside input range → caught by a post-LLM guard (e.g. if LLM invents an ROI, we detect it)

**`llm/mock.ts`:**
- Mock returns valid `NarrativeOutput` for each test fixture employee
- Used by all tests that would otherwise call the real API (keeps CI offline + free)

### E2E (Playwright) — one happy path
- Upload `samples/skillnex-demo.xlsx` → dashboard shows 100 employees across Sales + Engineering → click Sophia Martinez (Sales top performer) → detail page has narrative card populated, Performance_Rating shown as comparison → click a top-performing engineer → narrative present → department summary page shows top 5 performers per department

Uses `--mock-llm` flag so no API calls during E2E.

### Coverage target
100% of `lib/parsers/**`, `lib/metrics/**`, `lib/llm/prompts.ts`, `lib/llm/analyze-employee.ts`. UI components get smoke tests only.

### What we deliberately do NOT test
- LLM narrative *content* quality — not testable deterministically, not worth the flakiness. Manual review during demo prep instead.
- The real Anthropic API in CI — costs money and adds flakes. One manual smoke test script (`scripts/smoke-llm.ts`) that hits the real API, run before the HR demo.

## 8. Milestones

**Week 1**
- Day 1: Scaffold Next.js, Tailwind, Biome, Vitest, SheetJS. Commit. Run `scripts/regenerate-demo-xlsx.ts` against `Data skillnex.xlsx` to produce `public/samples/skillnex-demo.xlsx` with complete Payroll data (all 50 Sales + 50 Engineering employees have salary rows). Copy `skillnex_HR_Sample_Data.xlsx` into `public/samples/`. Push to https://github.com/inno8/skillnex.
- Day 2: xlsx parser with **Shape A + Shape B** support + name/ID joins + zod schemas + full unit tests. Both sample files parse clean. Derived-total computation for blank Compensation formulas.
- Day 3: SQLite + upload API (handles both shapes, merges by department) + Sales, Engineering, HR value models + normalize + unit tests.
- Day 4: LLM layer (client, prompts, analyze-employee, mock, schema validation) + tests. Prompt caching verified. Strict narration mode. HR narratives use Activity Impact Score framing — no dollar ROI.
- Day 5: Upload UI (single drop zone, detects Shape A/B) + dashboard list view + unjoined-names warning banner + HR activity log panel on detail view.

**Week 2**
- Day 6: Employee detail view (metrics + narrative card + anomaly badges + comparison column for Performance_Score / Performance_Rating) + department summary page.
- Day 7: Integration tiles page + polish (empty states, tooltips explaining formulas, copy button on review paragraph).
- Day 8: Playwright E2E test with `--mock-llm`. Fix whatever it finds.
- Day 9: Manual smoke test against real Anthropic API. Review every narrative for all 100 demo employees (or a stratified sample of 30: top 10, middle 10, bottom 10 per department). Tune prompt if anything drifts.
- Day 10: README with how-to-run + demo script for HR. Buffer for walkthrough rehearsal. Demo.

**Cut list if we slip past day 7** (in order): (1) department summary page collapses into a sidebar on dashboard; (2) anomaly badges become plain text; (3) integration tiles page drops to a single "Integrations coming soon" banner. Never cut: LLM narrative, Sales/Dev value models, the review paragraph copy button — those are the demo.

## 9. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| **LLM hallucinates metrics the data doesn't support** | High | System prompt has 5 safety rules. Post-LLM guard rejects output that references numbers not in the input. Manual review of all 20 demo narratives on day 9. |
| **LLM produces biased or inappropriate language about employees** | Medium | Safety rule 3 bans HR recommendations. Manual review on day 9. If anything off, tune prompt or switch to a more constrained template. |
| **Anthropic API down during demo** | Low | `--mock-llm` mode pre-caches narratives from day 9 smoke test. Demo machine runs in mock mode by default. |
| **Anthropic API cost spirals** | Low | Prompt caching (~90% reduction). Rate limit: max 100 employees per analyze call. Demo cost budget: $0.50. |
| **API key leaks to client bundle** | Medium | All LLM calls go through `/api/analyze` route (server-only). Key is in `.env.local`, never imported by any file under `app/` that isn't an API route. Lint rule to enforce. |
| HR expects the 5 uncomputable metrics to be real | High | UI labels them as requiring future data sources. Show the stakeholder the placeholder UI before demo day, not during. |
| ROI formula triggers a real HR decision | Medium | Tooltip + narrative disclaimer. Demo script says "this is signal, not verdict." |
| CSV parsing breaks on real HR data | Medium | Validation errors are specific ("row 47: salary is negative") not generic. Both sample CSVs get edge cases (trailing spaces, mixed case departments) so we find the bugs now. |
| Scope creep from HR mid-demo ("can you add X?") | High | PLAN.md is the contract. New asks → phase 2 list. |
| Employee data in browser leaks via screenshots | Low (demo only) | No mitigation for demo with fake data. Phase 2: anonymization toggle, role-based viewing. |

## 10. Stakeholder answers (resolved)

1. **Data:** Fake data, provided by user as `Data skillnex.xlsx` (50 Sales reps + 50 Engineers + partial Payroll + 10 HR activity rows). We regenerate a corrected version (`skillnex-demo.xlsx`) on Day 1 with complete Payroll coverage.
2. **Names:** Real employee names in the UI. No anonymization in MVP.
3. **Audience:** One HR lead. One demo laptop. One story.
4. **5-metric gap:** Addressed by the LLM narrative layer (strict mode — phase 1) + the comparison column (existing Performance_Score / Performance_Rating shown alongside our value). Qualitative metrics (Culture, Team Influence, Replaceability, Team Champion) remain `Requires: [data source]` placeholders. Demo pitch frames these as phase-2 unlocks.

All four answered. Day 1 unblocked.

**LLM narrative mode (resolved):** Phase 1 uses **strict narration** — describe the numbers only, no interpretation, no HR recommendations. Phase 2 will add an optional interpretive mode behind a settings toggle.

**Data decisions (resolved):** (A) xlsx upload with SheetJS. (B) Payroll regenerated on Day 1 to cover all 100 activity-sheet employees. (C) **HR is now in scope** for the MVP with an Activity Impact Score (no dollar ROI). (D) Performance_Score and Performance_Rating shown as comparison column, not used in formula. (E) Two workbook shapes supported — combined (Sales/Eng/Payroll/HR) and HR-only (Activity Log + rich Compensation). Both coexist in the DB.

**Scope additions (approved with this update):**
- HR added as third demo department. Value metric = Activity Impact Score; no dollar ROI.
- Second upload shape (`skillnex_HR_Sample_Data.xlsx`) supported independently.
- Blank Excel formula cells computed in-app (Total_Cost_to_Company etc.).
- Unicode names preserved.
- Repo hosted at https://github.com/inno8/skillnex.

## 10.5 Market validation findings (locked decisions)

See `docs/product-validation.md` for the full Q1–Q15 brief from the product reviewer. The findings that change what we build:

- **Q9 — Primary surface is outlier detection.** The People list sorts flagged employees first. The Dashboard anomaly sidebar leads with `score-vs-rating-mismatch`. The Calibration scatter keeps the quadrant labels ("Top performers / Scope review") because they map directly to this conversation.
- **Q11 — The "sellable wedge" is one screen: scored table + outlier flag.** We keep Dashboard and Calibration as supporting views (already built), but the demo script opens on `/people` sorted by flag, clicks into one outlier, shows the defensibility narrative.
- **Q12 — Rename "ROI" in HR-facing UI.** Use **Contribution** for Sales/Engineering and **Activity Impact** for HR. Internal variable names (`roi` in types, API JSON, metric functions) remain unchanged to avoid churn. "ROI" survives only in the CFO-facing pitch deck.
- **Q13 — Positioning copy.** Homepage hero frames Skillnex as replacing the manual spreadsheet prep, not as a Lattice alternative. Explicit partnership-friendly language.
- **Q14 — User research action.** Post in r/humanresources this week to recruit 5 HR practitioners for 30-min feedback sessions. Tracked in `NEXT_STEPS.md`. Non-blocking for eng.
- **Q15 — Phase-2 integration priority (critical for retention).** Upload-CSV works for the demo. The moment a real customer completes cycle one, they'll ask "how do I get my real data in without re-exporting?" Phase-2 roadmap must include at least one real integration before cycle two. Priorities in order:
  1. **BambooHR public API** — mid-market HRIS, documented API, free developer tier, matches target buyer size (50-300 employees).
  2. **Rippling partner program** — cross-department data in one API.
  3. **Salesforce REST** — for sales revenue and deals, probably easiest of the three technically.
  4. **GitHub API** — for engineering signals. OAuth-app model, per-repo scoping.

Data-plumbing work is the retention moat. Do not ship to a paying customer without it.

## 11. Phase 2 (not now, but capture so it's not lost)

- **Real integrations (#1 priority post-demo — this is the retention moat):**
  - **BambooHR public API** (first — HRIS is the entry point for mid-market)
  - **Rippling partner program** (cross-department via one API)
  - **Salesforce REST** (Sales — deals, revenue, opportunities)
  - **GitHub API** (Engineering — PRs, review turnaround, commit approvals)
  - Further down: HubSpot, Azure DevOps, Asana, Microsoft Teams, Jira, Slack
- Configurable value model weights per-customer (settings page)
- Historical snapshots + trend charts (time-series ROI per employee)
- Anonymization mode
- Auth + multi-org / multi-tenant
- Replaceability model (tenure + skill uniqueness + single-point-of-failure detection from project data)
- Quality proxies: code review turnaround, bug-to-feature ratio from Jira, peer-review sentiment
- Team champion score from Slack/Teams graph analysis
- LLM-inferred value models for new departments (point it at a CSV, let it propose weights)
- Expand LLM role: comparative analysis across teams, anomaly detection across time
