# Plan 5 — LLM Cost Math + Business Model

**Status:** Locked 2026-04-24
**Companion docs:** `plan-1-auth.md`, `plan-2-retention.md`, `plan-3-integration-scope.md`, `plan-4-integration-tech.md`, `product-validation.md`

## Executive summary

Skillnex defaults to **Claude Haiku 4.5** for per-competency narrative generation — the Day 9 review proved 94% safety-guard pass rate at 3× lower cost than Sonnet. Sonnet 4 is the upgrade tier, triggered automatically for outliers and senior employees, on-demand via a "Regenerate with deeper analysis" button, and for the cycle-close three-findings summary. Per-employee per-cycle cost is roughly $0.022 (Haiku-only) to $0.027 (hybrid). At a 500-employee mid-market customer paying $7/seat/month, annual revenue is $42,000 against ~$260 in direct costs — gross margin north of 99%. Connector APIs (Salesforce, BambooHR, GitHub, etc.) are free for both customer and Skillnex; Workday Partner program at $20-50K/year is the only meaningful integration cost and only kicks in when a paying enterprise demands Workday.

## Locked decisions

| # | Decision |
|---|---|
| 1 | Default model: **Haiku 4.5** (proven 94% safe in Day 9 real-API review) |
| 2 | Sonnet upgrade trigger: **all three** — on-demand "regenerate" button + automatic for OUTLIER/REVIEW status + automatic for Director+ levels |
| 3 | Three-findings cycle-close summary: **Sonnet** (one big synthesis call per company per cycle) |
| 4 | Pricing model: **per-seat at $7/mo blended for pilot**, volume discount at 1,000+ seats |
| 5 | Pilot pricing: **free 90-day pilot**, then $7/seat/mo month-to-month for 6 months, then annual |
| 6 | Free tier: **none in MVP**; reconsider at month 6 if growth needs it |
| 7 | Per-customer LLM budget cap: **none**; soft alert internally if a single customer crosses $100/cycle |
| 8 | Anthropic ZDR uplift: **eat it** as differentiator, don't pass through |
| 9 | Cost monitoring tooling: **day one** — `usage_log` table, dashboard in `/app/settings/billing` |
| 10 | Multi-tenant prompt cache amortization: **enjoy it as margin gain**, no surfaced pricing logic |

## Model selection

| Model | Strengths | Weaknesses | $/M input | $/M output | Used for |
|---|---|---|---|---|---|
| **Claude Haiku 4.5** | Sub-second responses, structured-output reliable, 94% safety guard pass | Less rich prose, occasionally repetitive | $1 | $5 | Default — every per-competency narrative |
| **Claude Sonnet 4** | Better prose, more nuanced anomaly framing, smarter at edge cases | 3× cost, 3× slower | $3 | $15 | Upgrade tier — outlier reviews, on-demand regeneration, cycle-close summary, Director+ employees |
| Claude Opus 4 | Best prose | 15× Haiku cost | $15 | $75 | Not used — bad price/value for templated narratives |
| GPT-4o | Comparable to Sonnet | Slightly cheaper input | $2.50 | $10 | Not used — already on Anthropic via DPA + ZDR roadmap |

**Hybrid rule** in code:

```ts
// lib/llm/router.ts
function routeToModel(employee: EmployeeRecord, request: AnalyzeRequest): Model {
  if (request.regenerate_with_deeper_analysis) return MODEL_SONNET;
  if (employee.level && ["Director", "VP", "C-Level"].includes(employee.level)) return MODEL_SONNET;
  if (employee.flags.includes("score-vs-rating-mismatch") || employee.flags.includes("low-roi-senior")) {
    return MODEL_SONNET;
  }
  return MODEL_HAIKU;
}
```

## Cost equation

For one customer, one quarterly review cycle, the LLM cost is:

```
Cost = (employees × competencies × cost_per_narrative)
     + (employees × cost_per_generic_comment_check)
     + (1 × cost_per_three_findings_summary)
     + (regeneration_buffer × 1.3)   // managers regen ~30% of drafts
```

For the per-competency model from the Before-After PDF:

- 5 competencies per employee
- ~2,500 system-prompt tokens (cached, ~95% hit rate across the run)
- ~800 user-message tokens per call (employee context for that competency)
- ~350 output tokens per narrative
- Generic-comment classifier: ~400 input + 50 output per detection × 5 competencies
- Three-findings synthesis: ~5,000 input + 1,200 output, one call per cycle

## Per-employee per-cycle math (Haiku default)

| Component | Tokens | Rate | Cost |
|---|---|---|---|
| System prompt cache write (one-time per cycle) | 3,125 | $1/M | $0.003 |
| System prompt cache reads (4 of 5 competencies) | 10,000 | $0.10/M | $0.001 |
| User input (5 calls × 800) | 4,000 | $1/M | $0.004 |
| Narrative output (5 × 350) | 1,750 | $5/M | $0.009 |
| Generic-comment detector | 2,500 in / 250 out | $1/M, $5/M | $0.004 |
| **Per-employee subtotal** | | | **$0.021** |

Plus per-cycle (per company, not per employee): three-findings summary ~$0.025 (Sonnet, recommended for this one synthesis call).

**Effective per-employee per-cycle: ~$0.022 with Haiku.**

**With hybrid (Haiku default + Sonnet for ~15% outlier-review regenerations):**

| Component | Cost |
|---|---|
| Base Haiku | $0.022 |
| 15% upgraded to Sonnet at +3× delta | +$0.005 |
| **Per-employee per-cycle (hybrid)** | **~$0.027** |

## Per-customer annual cost (4 quarterly cycles)

| Company size | Haiku-only | Hybrid (recommended) | All Sonnet |
|---|---|---|---|
| 50 employees | $4.40/yr | $5.40/yr | $14/yr |
| 200 employees | $17.60/yr | $21.60/yr | $56/yr |
| 500 employees | $44/yr | $54/yr | $140/yr |
| 1,000 employees | $88/yr | $108/yr | $280/yr |
| 5,000 employees | $440/yr | $540/yr | $1,400/yr |

Multiply by ~1.2× safety factor (failed calls, retries, edge regenerations). Real cost ceiling:

- **Small (50 employees): ~$7/year**
- **Mid (500 employees): ~$65/year**
- **Large (5,000 employees): ~$650/year**

## Connector costs

**For the customer: free.** They already pay for Salesforce, BambooHR, GitHub, Slack. Skillnex consumes their existing API allowance.

**For Skillnex:**

| Cost | Pilot | Phase 2 | Year 1 |
|---|---|---|---|
| Per-customer per-month integration API access | $0 | $0 | $0 |
| Salesforce AppExchange listing (one-time + annual review) | — | — | ~$5K (optional, only when 3+ Salesforce customers) |
| Workday Partner program (annual) | — | — | $20-50K (only if enterprise customer demands Workday) |
| GitHub Marketplace, Slack App Directory, etc. | $0 | $0 | $0 |
| Sandbox accounts at every connected provider | $0 | $0 | $0 (free dev tiers) |

The pattern: every modern SaaS exposes a free read-only API for ecosystem partners. We pay nothing per call.

The one expensive partnership is **Workday** at $20-50K/year — and it pays for itself in months on a single enterprise customer. Skip until enterprise demand justifies it.

## Reference market pricing

| Product | Per-seat per-month | Annual per-seat |
|---|---|---|
| Lattice | $11 | $132 |
| 15Five | $8 | $96 |
| Culture Amp | $9-15 | $108-180 |
| Leapsome | $8-14 | $96-168 |
| ChartHop (HR analytics) | $4-8 | $48-96 |
| Visier (enterprise people analytics) | $30+ | $360+ |

Per `product-validation.md` §Q2: companies pay $6-15/user/month for performance management. Mid-market budget $50K-$200K annually for People tech.

## Pricing model (locked: per-seat)

| Customer | Tier | Monthly | Annual revenue | Direct cost | Gross margin |
|---|---|---|---|---|---|
| 50 employees | $9/user/mo | $450/mo | $5,400 | ~$7 LLM + ~$50 infra share = $57 | **98.9%** |
| 500 employees | $7/user/mo | $3,500/mo | $42,000 | ~$65 LLM + ~$200 other = $265 | **99.4%** |
| 5,000 employees | $5/user/mo | $25,000/mo | $300,000 | ~$650 LLM + ~$500 other = $1,150 | **99.6%** |

LLM cost is genuinely irrelevant. Real costs are people, sales, support.

## Pilot pricing

- Free 90-day pilot
- Then $7/seat/mo month-to-month for 6 months
- Then annual contract

Risk-free try for the law firm. Real reference customer for us.

## Defensibility pitch (not efficiency)

Per `product-validation.md` §Q8: sell defensibility, not efficiency. But efficiency closes deals.

> *"Your HR team currently spends 3 days per cycle, per HR analyst, manually pulling data for reviews. At a fully-loaded HR analyst cost of $80,000/year, that's roughly $1,200 of HR labor per cycle, $4,800/year, for a 100-person team. Skillnex replaces that prep work for $7-50/year in API costs. We charge $5,400/year. The math works the day you turn it on."*

## Updated business model — full P&L per customer

**500-employee mid-market customer** (the validation-brief sweet spot):

| Line item | Annual |
|---|---|
| Revenue (500 × $7/mo × 12) | $42,000 |
| LLM API (Haiku + Sonnet hybrid) | $65 |
| Anthropic ZDR uplift (post-pilot) | $7 |
| Connector APIs (Salesforce, BambooHR, GitHub, etc.) | $0 |
| DO infrastructure (per-customer share at scale) | $50 |
| Resend transactional email | $5 |
| Vanta SOC 2 (per-customer share) | $100 |
| Cyber liability insurance share | $30 |
| **Total direct cost per customer** | **~$260** |
| **Gross margin per customer** | **99.4%** |

**2,000-employee enterprise customer with Workday** ($15/seat/mo):

| Line item | Annual |
|---|---|
| Revenue (2,000 × $15 × 12) | $360,000 |
| LLM cost | $260 |
| Workday Partner program (amortized: 4 Workday customers) | $7,500 |
| Infra | $200 |
| Other shared (Vanta, insurance, Resend) | $200 |
| **Total direct cost** | **~$8,200** |
| **Gross margin** | **97.7%** |

Workday partner is the biggest single cost line in the entire stack. Pays for itself in months on a single enterprise account.

## Cost-monitoring tooling (day one)

```sql
CREATE TABLE usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  model TEXT NOT NULL,                  -- 'claude-haiku-4-5' | 'claude-sonnet-4-5'
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL,
  endpoint TEXT,                        -- '/api/analyze', etc.
  ts TEXT NOT NULL
);
CREATE INDEX idx_usage_tenant_ts ON usage_log(tenant_id, ts);
```

Captured by middleware on every Anthropic call. Surfaces in `/app/settings/billing`:

- Tokens this cycle, projected monthly cost
- Per-model breakdown
- Cache hit rate (margin signal)
- Internal alert when single customer crosses $100/cycle (something is wrong)

## What scales cheaply, what doesn't

**Stays cheap:**

- Adding a 6th, 7th, 8th competency per employee → linear scale, still cents
- Adding integration-pulled signals to the prompt → +20% input tokens, still cents
- Adding the generic-comment detector → already costed
- Per-employee Sonnet upgrade button → costed at 15% rate
- Cycle-close three-findings in Sonnet → single-digit cents per company

**Gets expensive (would change pricing):**

- Real-time narrative regeneration on every signal pull (vs at cycle close): 10× call volume. Stay scheduled, not real-time.
- Embedding-based "find similar employees": ~$0.50/employee/year additional. Phase 3.
- "Chat with your data" multi-turn: 10-30× per-employee cost. Phase 3+ enterprise tier.
- Auto-running narratives on every cycle for every employee (vs on-demand): 100,000 calls/year for 5,000-employee company. Still ~$1,000/year on Haiku, $3,000 on Sonnet. Affordable but worth opt-in.

## Build sequence (3 days, slots into Phase 2)

| Day | Work |
|---|---|
| 1 | `usage_log` table + token-tracking middleware on `/api/analyze`. Backfill existing narratives. |
| 1 | Cost dashboard in `/app/settings/billing` (admin-visible only) — tokens this cycle, projected monthly, model breakdown, cache hit rate. |
| 2 | Model router (`lib/llm/router.ts`) with Haiku-default + Sonnet-upgrade rules. |
| 2 | "Regenerate with deeper analysis" button on `NarrativeCard` — calls API with `regenerate_with_deeper_analysis: true`, uses Sonnet, marked clearly in UI. |
| 3 | Three-findings cycle-close synthesis endpoint (Sonnet). |
| 3 | Anthropic Prompt Caching: confirm cache writes happening across per-competency calls. Verify `cache_read_input_tokens > 0` in usage logs. |
| 3 | Tests: model router selects correctly given employee + flags + request body. Usage log captures every call. |

## Tests

| Test | Verifies |
|---|---|
| `tests/llm/router.test.ts` — Director-level employee → Sonnet | Auto-upgrade for senior |
| `tests/llm/router.test.ts` — score-vs-rating-mismatch flag → Sonnet | Auto-upgrade for outliers |
| `tests/llm/router.test.ts` — `regenerate_with_deeper_analysis: true` → Sonnet | On-demand upgrade |
| `tests/llm/router.test.ts` — default employee + no flags + no regenerate → Haiku | Default behavior |
| `tests/llm/usage-log.test.ts` — every analyze call writes a usage row | Cost tracking |
| `tests/llm/usage-log.test.ts` — cache_read_input_tokens recorded | Cache verification |
| `tests/llm/three-findings.test.ts` — cycle-close synthesis uses Sonnet, one call per cycle | Sonnet routing |

## Items deferred

- Embedding-based similar-employee search — Phase 3
- Multi-turn "chat with your data" — Phase 3 enterprise
- Per-customer LLM budget cap — never (decision #7)
- Freemium tier — month 6, only if needed for growth
- Cost-passed-through pricing tier — never (we eat ZDR uplift, decision #8)
