# Skillnex

Employee ROI & Impact dashboard. Multi-sheet xlsx upload → department-aware value models → LLM-generated review narratives.

MVP. Demo-grade. See [PLAN.md](PLAN.md) for scope, architecture, and milestones.

## Quick start

```bash
pnpm install
cp .env.local.example .env.local   # paste your ANTHROPIC_API_KEY
pnpm regenerate-demo                # builds public/samples/skillnex-demo.xlsx
pnpm dev                            # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:e2e` | Run Playwright E2E (uses `SKILLNEX_MOCK_LLM=true`) |
| `pnpm lint` | Biome lint + format check |
| `pnpm format` | Biome format in place |
| `pnpm typecheck` | TypeScript type check |
| `pnpm regenerate-demo` | Rebuild `public/samples/skillnex-demo.xlsx` from `Data skillnex.xlsx` |

## Data

The source file `Data skillnex.xlsx` (repo root) has Sales Team, Engineering, HR team, and Payroll data sheets. `pnpm regenerate-demo` rebuilds Payroll so every Sales/Engineering employee has a salary row. The generated `public/samples/skillnex-demo.xlsx` is what the app loads by default.
