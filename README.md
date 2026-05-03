# Skillnex

Department-aware employee impact and ROI scoring with LLM-generated, data-backed review narratives. Replaces the three days of manual data prep that happens before every performance review cycle.

**Target buyer:** VP People at a 50-300 person company.
**Wedge:** the outlier detector — *"manager rated 4/5 but data says 2.5 — investigate."*
**Pitch:** we replace your shared `Q3 Review Data Master v4 FINAL (2).xlsx`, not Lattice.

Status: **Pilot MVP shipped, demo-ready.** Phase 2 fully planned — see [`PLAN.md`](PLAN.md).

## Quick start

```bash
pnpm install
cp .env.local.example .env.local            # paste your ANTHROPIC_API_KEY (optional — see Mock mode)
pnpm regenerate-demo                         # builds public/samples/skillnex-demo.xlsx with 100% join coverage
pnpm dev                                     # http://localhost:3000
```

That's it. Drop `public/samples/skillnex-demo.xlsx` onto the upload page and you'll see 110 employees scored across Sales, Engineering, and HR with click-through narratives.

### Mock mode (no API key needed)

If `.env.local` has `SKILLNEX_MOCK_LLM=true` (or no `ANTHROPIC_API_KEY` at all), narrative generation runs against a deterministic template-based mock instead of calling Anthropic. Same UI, same safety guard, zero cost. Use this for development and CI.

## What ships in the pilot MVP

| Screen | What it does |
|---|---|
| `/` Ingest | Drop xlsx → parse → score → persist (~3 sec end-to-end) |
| `/dashboard` Overview | 5 KPI tiles, department rollups with sparkbars, anomaly sidebar grouped by flag, value distribution histogram |
| `/people` People list | All employees ranked, **flagged-first sort by default** (rating-disagrees-with-data outliers on top), filter by department + flag, full-text search |
| `/people/[key]` Employee detail | Avatar header, signal breakdown OR HR activity log, metric rail with department benchmarks, comparison column showing existing rating vs computed score, nearest peers, **NarrativeCard** with Generate / Regenerate / Copy paragraph |
| `/calibration` Calibration | SVG scatter plot of value_score × ROI with quadrant labels (Top performers / Scope review), click-to-lock selection, dept filter |
| `/integrations` Integrations | Mocked tiles for Salesforce / Jira / GitHub / Asana — labeled "Demo — not connected" |

Two workbook shapes supported automatically:

- **Shape A** (combined): `Sales Team` + `Engineering` + `Payroll data` + optional `HR team` sheets — like the regenerated `skillnex-demo.xlsx`
- **Shape B** (HR-only): `HR Activity Log` + `Employee Compensation` + `Summary Dashboard` sheets — like `skillnex_HR_Sample_Data.xlsx`

Both can coexist in the database. Re-uploading the same shape replaces those department's rows.

## The narrative safety architecture

The LLM never invents numbers. Seven safety rules embedded in a cached system prompt:

1. Only reference numbers that appear in the input JSON (including pre-computed ratios in `dept_context`)
2. If a signal is missing, say "no data" — never estimate
3. No HR action recommendations (fire / promote / raise / PIP / stretch assignment)
4. No predictions, causal inference, or speculation
5. Flag anomalies when a value is ≥2x or ≤0.5x the department average
6. Neutral factual language; no emotion words
7. When existing rating disagrees with computed score by ≥30 points, state neutrally and cite both

Every Anthropic response is post-checked by a guard that scans for invented numbers. Rejections show in the UI with a "Regenerate" button. Real-API verified at **94% safety pass rate** across an 18-employee stratified sample (Day 9 commit).

## Demo

See [`docs/demo-script.md`](docs/demo-script.md) for the minute-by-minute HR-walkthrough script. Practice this before any live demo.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Next.js dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Start the production build (after `pnpm build`) |
| `pnpm test` | Run Vitest unit tests (64 tests, ~1.5 sec) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:e2e` | Playwright E2E tests (uses `SKILLNEX_MOCK_LLM=true`) |
| `pnpm lint` | Biome lint + format check |
| `pnpm format` | Biome format in place |
| `pnpm typecheck` | TypeScript type check |
| `pnpm regenerate-demo` | Rebuild `public/samples/skillnex-demo.xlsx` from `Data skillnex.xlsx` (fixes payroll join coverage) |
| `pnpm review` | Run the stratified real-API narrative review against Anthropic. Requires `ANTHROPIC_API_KEY` in `.env.local`. Costs ~$0.04 for 18 employees. |

## Architecture

| Layer | Choice | Rationale |
|---|---|---|
| Frontend + backend | **Next.js 16 App Router** (TypeScript) | Single framework, server components for data-heavy views, API routes for everything else |
| Database | **SQLite via better-sqlite3** | Pilot scale; managed Postgres migration path documented |
| LLM | **Claude Haiku 4.5** via `@anthropic-ai/sdk` with prompt caching | Sonnet 4 added as upgrade tier in Phase 2 (see Plan 5) |
| xlsx parsing | **SheetJS** (`xlsx` npm) | Multi-sheet, formula-blank handling, date coercion |
| Validation | **zod 4** | Per-sheet schemas, parse-error messages with row numbers |
| UI | **Tailwind 3** + custom token system | Editorial design (Fraunces serif + Geist sans), burnt-orange accent for CTAs and anomalies |
| Tests | **Vitest** unit + **Playwright** E2E | 64 unit tests across parser, metrics, LLM prompts/guard/mock |
| Lint/format | **Biome 2** | Faster than eslint + prettier |
| Email | **Resend** (Phase 2 onward) | Transactional templates for signup, invites, breach notifications |
| Hosting | DigitalOcean Droplet + persistent volume | $12-30/mo for the pilot; managed Postgres at next scale point |

## Project structure

```
skillnex/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/                # /upload, /employees, /employees/[key], /analyze
│   ├── dashboard/          # Overview screen
│   ├── people/             # List + employee detail
│   ├── calibration/        # Scatter
│   └── integrations/       # Mocked tiles
├── components/             # NarrativeCard, Sidebar, TopBar, Chip, SparkBar, Avatar, KPI
├── lib/
│   ├── parsers/            # SheetJS adapter, zod schemas, name/ID joins
│   ├── metrics/            # Per-department value models, normalize, dispatcher
│   ├── llm/                # Anthropic client, prompts, guard, mock, types
│   ├── db.ts               # better-sqlite3 setup + scoped helpers
│   ├── anomalies.ts        # Flag derivation
│   ├── types.ts            # EmployeeRecord shape + competency types
│   └── utils.ts            # Format helpers, name normalization
├── tests/                  # Vitest suites
├── scripts/                # regenerate-demo-xlsx, llm-review, md_to_pdf
├── docs/                   # All planning docs + PDFs
├── public/samples/         # Demo xlsx files
├── PLAN.md                 # Phase index + roadmap
├── DESIGN.md               # Design system source of truth
└── README.md               # This file
```

## Documentation index

All planning docs live in `docs/` with PDF copies for sharing:

| Topic | Doc |
|---|---|
| **Phase 2 — Auth, registration, roles** | [`docs/plan-1-auth.md`](docs/plan-1-auth.md) |
| **Phase 2 — Data retention & deletion** | [`docs/plan-2-retention.md`](docs/plan-2-retention.md) |
| **Phase 2 — Integration data scope (US + EU)** | [`docs/plan-3-integration-scope.md`](docs/plan-3-integration-scope.md) |
| **Phase 2 — Technical integrations + ship sequence** | [`docs/plan-4-integration-tech.md`](docs/plan-4-integration-tech.md) |
| **Phase 2 — LLM cost + business model** | [`docs/plan-5-llm-cost.md`](docs/plan-5-llm-cost.md) |
| Office-hours product brief | [`docs/office-hours-findings.md`](docs/office-hours-findings.md) |
| Market validation findings | [`docs/product-validation.md`](docs/product-validation.md) |
| Alignment review against Before-After PDF | [`docs/skillnex-alignment-review.md`](docs/skillnex-alignment-review.md) |
| Demo walkthrough script | [`docs/demo-script.md`](docs/demo-script.md) |
| Engineering plan + phase sequence | [`PLAN.md`](PLAN.md) |
| Design system source of truth | [`DESIGN.md`](DESIGN.md) |

## Configuration

`.env.local` accepts:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Real Haiku 4.5 narrative generation. Get from [console.anthropic.com](https://console.anthropic.com). |
| `SKILLNEX_MOCK_LLM` | `false` if API key present, `true` otherwise | Forces mock mode regardless of key presence. Useful for E2E tests and CI. |
| `SKILLNEX_DB_PATH` | `data/skillnex.db` | SQLite file location. Tests use `:memory:`. |

## Tests

```bash
pnpm test              # one-shot, 64 tests, ~1.5 sec
pnpm test:watch        # watch mode while developing
pnpm typecheck         # TypeScript
pnpm lint              # Biome
pnpm build             # full production build (catches more than dev mode)
```

Coverage focuses on the load-bearing pure functions: parser (19 tests), metrics + normalize (19 tests), LLM prompts + guard + mock (24 tests). UI components get smoke tests only.

## Phase 2 status

The pilot MVP is feature-complete and demo-ready. Phase 2 (multi-tenant auth, per-competency reviews, integrations, cost dashboard) is fully planned but not yet built. See [`PLAN.md`](PLAN.md) §Phase sequence for the dependency-ordered roadmap.

Engineering work on Phase 2 happens on the `phase-2-auth` branch, not `main`. Pilot stays shippable from `main` until Phase 2 is ready to merge.

## Contributing

This is currently a single-developer project. Contributions welcome once Phase 2 ships and the architecture stabilizes.

## License

Proprietary. All rights reserved.

---

Built with the help of Claude Code (claude.ai/code). Repo lives at [github.com/inno8/skillnex](https://github.com/inno8/skillnex).
