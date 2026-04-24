# Design System — Skillnex

## Product Context

- **What this is:** A data-heavy internal web app that turns multi-sheet employee data into department-aware ROI / impact scores and LLM-generated review narratives.
- **Who it's for:** HR leads (director to VP People), responsible for performance reviews and compensation calibration. Serious users doing serious work with sensitive data about individuals.
- **Space/industry:** HR tech / people analytics. Peers: Lattice, Leapsome, 15Five, Culture Amp, ChartHop, Visier.
- **Project type:** Internal dashboard + occasional long-form reading (the LLM narrative is narrative, not a metric).

## Aesthetic Direction

- **Direction:** Editorial hybrid — part Bloomberg Terminal restraint, part long-form reading polish. Think "The Economist meets Linear": strong typographic hierarchy, confident whitespace, data lives in disciplined grids, the narrative feels like something worth reading, not a form field.
- **Decoration level:** Intentional. Thin rules, subtle warm paper tone, numeric typography as a quiet accent. No gradients, no illustration, no icon-in-colored-circles.
- **Mood:** Trustworthy, considered, slightly literary. The product is making claims about humans — the visual language should feel like it was edited, not generated.
- **Reference touchpoints:** Linear (discipline), Stripe Docs (readable density), Pitchfork post-redesign (editorial restraint), The New York Times (data journalism typography).

## Typography

Variable fonts. Modular scale, 1.25 ratio. Mixed serif + sans is the signature — deliberate, not random.

- **Display / Hero:** **Fraunces** (variable serif) — distinctive optical-size axis, warm, signals craft. Avoids the default-Inter trap that makes every dashboard look alike.
- **Body / UI:** **Geist Sans** (variable) — Vercel's font. Quietly modern, well-balanced at small sizes, not overused.
- **Data / Tables:** **Geist Mono** — tabular-nums enabled. Used sparingly: only in numeric columns and metric cards where alignment matters. Dashboards that use mono everywhere feel hostile; dashboards that use mono for numbers feel precise.
- **Code / Debug:** **Geist Mono** — same family keeps vertical rhythm clean.
- **Loading strategy:** Google Fonts CDN for Fraunces (variable axis), Vercel CDN for Geist family. Both cached aggressively, both free. Preload Fraunces and Geist Sans in `layout.tsx`.

### Type scale (rem)


| Role      | Size   | Line height | Weight | Font                                          |
| --------- | ------ | ----------- | ------ | --------------------------------------------- |
| display   | 2.25   | 1.15        | 500    | Fraunces                                      |
| h1        | 1.75   | 1.2         | 500    | Fraunces                                      |
| h2        | 1.25   | 1.3         | 600    | Geist Sans                                    |
| h3        | 1      | 1.35        | 600    | Geist Sans                                    |
| body      | 0.9375 | 1.55        | 400    | Geist Sans                                    |
| small     | 0.8125 | 1.45        | 400    | Geist Sans                                    |
| micro     | 0.6875 | 1.35        | 500    | Geist Sans (uppercase, letter-spacing 0.04em) |
| number-lg | 2      | 1.1         | 500    | Geist Mono (tabular-nums)                     |
| number-md | 1.125  | 1.2         | 500    | Geist Mono (tabular-nums)                     |


## Color

- **Approach:** Restrained. One accent, semantic colors only where they carry meaning. No decorative color.
- **Ink (primary text):** `#0B0F19` — near-black, slightly blue. Softer than pure black, still high-contrast.
- **Paper (page background):** `#FAFAF7` — warm off-white. Distinguishes Skillnex from every pure-white dashboard. Looks correct on screen, prints cleanly.
- **Surface (cards):** `#FFFFFF` on paper — cards are the true white, paper is around them, inversion is intentional.
- **Muted text:** `#52525B` (primary muted), `#71717A` (secondary muted), `#A1A1AA` (tertiary muted).
- **Border / rule:** `#E7E5E0` — warm gray, pairs with paper.
- **Accent (CTA, anomaly flags):** `#C2410C` — burnt orange. Uncommon in dashboards (everyone uses blue). Makes CTAs and anomalies genuinely pop. Used sparingly.
- **Accent muted (accent tint for backgrounds):** `#FED7AA` — pale apricot for anomaly chips, never for large surfaces.
- **Semantic success:** `#166534` (deep green, not mint). Used for "Comparison agrees" badges.
- **Semantic warning:** `#92400E` (deep amber). Used for "no salary data" notes.
- **Semantic destructive:** `#991B1B` (deep red). Used only for parse errors and destructive confirmations.
- **Dark mode:** Deferred to phase 2. MVP ships light-only. DESIGN.md will get dark-mode tokens when that work starts.

## Spacing

- **Base unit:** 4px.
- **Density:** Comfortable. Generous on cards and headings, compact on table rows to keep 20+ employees on screen without scrolling horizontally.
- **Scale:** `2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`.

## Layout

- **Approach:** Grid-disciplined with editorial detailing. Strict columns for data, breathable measures for narrative.
- **Grid:** 12-col on desktop (≥1024px), 6-col on tablet, single-col on mobile. Demo target is desktop — mobile is minimum-viable only.
- **Max content width:** 1200px. Narrative paragraphs capped at 70ch for readability. Table regions use full width.
- **Border radius:** `sm 2px / md 4px / lg 8px / full 9999px`. No bubbly rounding. Editorial products earn trust through discipline.
- **Shadows:** None on cards by default. Shadows are noise. Use a thin border (`1px solid border`) instead. Reserve one soft shadow (`0 1px 2px rgba(0,0,0,0.04)`) for the upload dropzone to signal drop target, and for dropdown menus.

## Motion

- **Approach:** Minimal-functional. Skillnex is a tool, not an experience.
- **Easing:** `ease-out` for enter, `ease-in` for exit, `ease-in-out` for movement.
- **Duration:** `micro 80ms / short 180ms / medium 280ms / long 420ms`. Default for state transitions: `180ms ease-out`.
- **Allowed animations:** hover color shifts, focus ring fade-in, dropdown expand, narrative text fade-in when generated (one 280ms fade), upload dropzone active-state scale 1.01.
- **Banned animations:** page entrance animations, scroll-driven reveals, loading spinners longer than 500ms (use skeleton states instead), bouncy springs, any animation on tabular data.

## Aesthetic Risk Register

**SAFE CHOICES** (baseline — users expect these):

1. Grid-disciplined layout — data tools need predictability.
2. Restrained color approach — high-stakes HR data demands visual restraint.
3. Tabular numerics for all metrics — alignment is the unit of trust in data UI.

**RISKS** (deliberate departures — this is where the product gets a face):

1. **Fraunces (variable serif) for display type.** Risk: some dashboard users expect sans-everywhere. Payoff: instant differentiation from Lattice/Leapsome/15Five (all sans-default). Signals editorial care. If it feels too literary in testing, we swap display to Geist Sans 500 and keep Fraunces only on the /dashboard hero. Cost: one CDN request.
2. **Burnt orange `#C2410C` accent instead of blue.** Risk: HR software convention is blue (trust). Payoff: anomaly flags and CTAs genuinely pop instead of blending in. Also positions Skillnex as "not another SaaS dashboard." If stakeholder reads it as "warning color" confusion, we shift to `#0369A1` (deep blue) and move the burnt orange to anomaly-only.
3. **Warm paper `#FAFAF7` instead of pure white.** Risk: looks wrong if someone compares side-by-side with competitors. Payoff: less eye-fatigue in long review sessions, editorial signal. Low reversal cost.

## Phase-2 Surfaces (not yet designed)

Post-demo integration UI — queued once the MVP validates the wedge. Design comes before code for each of these:

1. **Integration picker** — first-run flow replacing the current Ingest drop zone. OAuth connect for BambooHR, then Workday, Rippling, Salesforce, GitHub. Each integration writes the same `EmployeeRecord` shape the xlsx parser produces, so the dashboard, People list, and Calibration scatter work unchanged.
2. **Sync status page** — a per-integration timeline: last sync, rows pulled, unjoined employees, error states. Visual language stays editorial — tabular rows, no status-light "dashboards."
3. **Continuous outlier alerts** — once a real-time connector is live, outliers become events (webhook or email), not a demo screen. The `rating-vs-data` flag becomes an inbox-class notification: "Jane Doe's manager rated her 4/5 this week but her Salesforce pipeline dropped 40%. Review before next 1:1."

Rationale in `docs/product-validation.md` §Q15: data plumbing is the retention problem, not the demo problem. Demo sells the workflow; the integration sells the renewal.

## Decisions Log


| Date       | Decision                      | Rationale                                                                                                                                                                    |
| ---------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-21 | Initial design system created | `/design-consultation` one-shot. Product context: HR-facing internal dashboard with narrative component. Risks chosen to differentiate from Lattice/Leapsome commodity look. |
| 2026-04-21 | Light mode only for MVP       | Demo target is one HR lead on a demo laptop. Dark mode is phase 2.                                                                                                           |


## Tokens (source-of-truth for Tailwind + CSS variables)

Applied in `app/globals.css` as CSS custom properties and in `tailwind.config.ts` as theme extensions. If tokens here and config drift, tokens here win — fix the config.

```
--ink: #0B0F19
--paper: #FAFAF7
--surface: #FFFFFF
--muted-1: #52525B
--muted-2: #71717A
--muted-3: #A1A1AA
--border: #E7E5E0
--accent: #C2410C
--accent-tint: #FED7AA
--success: #166534
--warning: #92400E
--destructive: #991B1B

--radius-sm: 2px
--radius-md: 4px
--radius-lg: 8px

--font-display: "Fraunces", ui-serif, Georgia, serif
--font-sans: "Geist", ui-sans-serif, system-ui
--font-mono: "Geist Mono", ui-monospace, SFMono-Regular
```

