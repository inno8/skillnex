# Plan 3 — Integration Data Scope (US + EU)

**Status:** Locked 2026-04-24
**Companion docs:** `plan-1-auth.md`, `plan-2-retention.md`, `plan-4-integration-tech.md`, `plan-5-llm-cost.md`, `SkillneX_Privacy_Compliance_Engineering_Guide.pdf`

## Executive summary

Skillnex pulls only the data necessary to compute competency scores from each connected system. Every integration ships with a three-tier scope: `default_pull` (granted automatically on OAuth), `opt_in_pull` (toggled per-tenant on the consent screen for high-value but riskier fields), and `never_pull` (hardcoded, no override possible — covers special-category data, message bodies, customer-of-customer data). The same allowlist that gates fetches is rendered in the consent screen, copied into the DPA, auto-populates the public sub-processor list, and tested in CI. Slack DM contents and HRIS Article-9 fields are hard limits with no toggle. Per-employee opt-out is one-click in `/app/my-review`. EU customers get Standard Contractual Clauses for any US-bound data flow during the pilot; full EU region opens when the second EU customer signs.

## Locked decisions

| # | Decision |
|---|---|
| 1 | OAuth re-consent on scope expansion: **prompt customer to re-authorize** |
| 2 | **Three-tier scope model** — `default_pull` / `opt_in_pull` / `never_pull` |
| 3 | Salesforce custom fields: **ignore by default**, customer can request whitelist via support |
| 4 | HRIS performance review comments: **never via integration**, only via explicit per-cycle upload |
| 5 | Per-employee opt-out: **one-click** in `/app/my-review` |
| 6 | Aggregate retention: **purge at 90 days** unless frozen into a locked review |
| 7 | Terminated employees: **flag as terminated, keep until tenant retention expires** |
| 8 | Sub-processor list: **public** at `/security/subprocessors` |
| 9 | Integration data encryption: **same key as `employees` table**; per-integration KMS is Year-1 |
| 10 | Customer-narrowable scope: **yes, post-pilot** via per-tenant overrides |

## Legal framework

| Rule | What it requires for integration data |
|---|---|
| **GDPR Art. 5(1)(c)** Data minimization | Pull only what's necessary to compute the score. Every pulled field traces to a competency. |
| **GDPR Art. 6** Lawful basis | "Performance of contract" + "legitimate interest" — customer collects, we process. |
| **GDPR Art. 9** Special-category | Health, race, religion, sexual orientation, political, union, biometrics → prohibited. We refuse. |
| **GDPR Art. 28** Processor obligations | DPA names every sub-processor. Each new integration = new sub-processor = customer notice. |
| **GDPR Art. 44-49** International transfers | EU customer data → US infra requires SCCs or adequacy decision. |
| **CCPA §1798.140(d)** B2B exemption | Largely exempt for employee data. We still owe notice + right-to-delete. |
| **CCPA §1798.105** Right to delete | 45-day window; we commit to 7. |
| **State Bar Model Rule 1.6** | Law firm clients: never ingest client matter information, client names, privileged communications. |
| **Source-system TOS** | Each platform has its own API terms. We respect platform-specific restrictions (e.g., Slack content restrictions). |

## Three-tier scope model

```ts
// lib/integrations/scope.ts
export const INTEGRATION_SCOPE = {
  [integration_id]: {
    default_pull: [...],     // pulled automatically once OAuth granted
    opt_in_pull: [           // shown as togglable on the consent screen
      { field: "...", risk: "...", value: "..." },
    ],
    never_pull: [...],       // hardcoded, no toggle, no exception
    sub_processor: "...",
    eu_residency: "...",
    sccs_required_for_eu: bool,
    competencies_supported: [...],
  },
} as const;
```

## Per-integration allowlist — master table

| Integration | DEFAULT_PULL | OPT_IN_PULL | NEVER_PULL |
|---|---|---|---|
| **BambooHR / HRIS** | employee_id, full_name, work_email, hire_date, termination_date, manager_id, department, job_title, employment_type, annual_base_salary, location, level | level/grade descriptions, custom field labels (with content review) | DOB, SSN, address, ADA accommodations, FMLA, medical, race, ethnicity, religion, political, union, sexual orientation, dependents, marital status |
| **Salesforce** | owner_id, opportunity_amount, opportunity_stage, opportunity_closed_date, activity_count_per_user (calls/emails/meetings/tasks) | quarter-end opportunity dates by name-hash (for trend), lead_source_type | account_name, contact_name, opportunity_name, opportunity_description, account_address, case_descriptions, account_industry, account_revenue, account_notes |
| **GitHub** | PR author, PR merged_at, PR review_count, PR review_turnaround_hours, commit_count_per_author, code_review_comments_count, issue_comments_count | branch naming patterns (for trunk-based-dev signal) | PR titles, PR body, commit messages, code diffs, issue body, comment bodies, file paths, repo names of private repos |
| **Jira** | ticket_id, assignee_id, status, status_changed_at, story_points, priority, ticket_created_at, ticket_resolved_at, time_in_status_breakdowns | story-point text labels (for "complex" classification) | ticket title, ticket description, comment bodies, attachment filenames, attachment contents, custom-field text, watcher lists |
| **Slack** | message_count_per_user_per_channel_per_day, reaction_count_received, mention_count_received, response_time_to_thread_replies (median), channel_membership_count, active_channels_count | channel names (for "active in #engineering" signal) | message_text, thread_text, DM contents (always), shared files, file contents, channel topics, channel descriptions, voice/video transcripts, screenshots |
| **Microsoft Teams** | same as Slack | same as Slack | same as Slack |
| **Calendar (Google/M365)** | meeting_count_per_user_per_day, total_meeting_minutes_per_user_per_day, meeting_attendee_count_aggregated, cross_team_meeting_count, 1:1_meeting_count, focus_time_blocks_count | meeting titles, attendee email domains | recordings, attached documents, meeting descriptions, attendee_email_addresses_outside_company, recurring_meeting_patterns_with_external_parties |
| **LMS (Workday Learning / Coursera Business / Udemy)** | course_id, completion_status, hours_logged, certification_id, certification_earned_at | course names mapped to categories (customer-side mapping) | course descriptions if they reveal protected info |
| **Lattice / 15Five / Culture Amp** | existing_overall_rating_per_cycle, existing_competency_ratings_per_cycle, review_cycle_dates, manager_id_at_time | nothing (review prose stays upload-only) | review_text_content, peer_review_text, 1:1_meeting_notes, OKR_progress_notes_with_text |
| **Time tracking (Toggl/Harvest/Clockify)** | time_entry_count_per_user, total_billable_hours, total_non_billable_hours, project_id_aggregates | project names mapped to client-vs-internal categorization | entry descriptions, customer assignments |
| **Scribe / Notion / Confluence** | page_id, author_id, created_at, last_edited_at, word_count_per_page (aggregate) | page titles (for documentation-topic classification) | page bodies, comments, page_views_by_others, sharing_permissions |

**Slack DM contents and HRIS Art. 9 fields stay in `never_pull` regardless.** The opt-in tier exists for genuinely-debatable cases like meeting titles and Salesforce opportunity-name patterns.

## Customer consent screen template

Each time a tenant adds an integration, they see this:

```
┌──────────────────────────────────────────────────────────┐
│ Connect Google Calendar                                  │
├──────────────────────────────────────────────────────────┤
│ Skillnex will pull:                                      │
│   ☑ Meeting counts and durations                         │
│   ☑ Attendee counts (anonymized)                         │
│   ☑ Cross-team meeting detection                         │
│                                                          │
│ Optional — richer scoring, higher data sensitivity:      │
│   ☐ Meeting titles                                       │
│       Risk: may reveal customer names, deals, sensitive  │
│       initiatives                                        │
│       Value: better classification of meeting purpose    │
│                                                          │
│   ☐ Attendee email domains                               │
│       Risk: exposes external collaborator domains        │
│       Value: distinguishes internal vs external meetings │
│                                                          │
│ Skillnex will never pull:                                │
│   ✗ Meeting recordings                                   │
│   ✗ Attached documents                                   │
│   ✗ Notification settings                                │
│                                                          │
│ Sub-processor: Google LLC                                │
│ Cache: aggregates 90 days, raw event IDs 30 days         │
│                                                          │
│ [Cancel]                       [Authorize Google Calendar]│
└──────────────────────────────────────────────────────────┘
```

The screen reads from `INTEGRATION_SCOPE` directly. Auto-renders three sections, three counts. Satisfies GDPR Art. 13/14 transparent-notice requirements.

## Per-employee opt-out (GDPR Art. 21)

Employees have the right to object to legitimate-interest processing. Skillnex implements:

- Employee role user → `/app/my-review` → Settings → "Pause integration data collection for me"
- Sets `employees.integration_opt_out = true`
- Every integration runner skips that employee's data on the next pull cycle
- Score for that employee falls back to upload-only data, or "Insufficient data — opted out" UI state
- Audit-logged, reversible

## Re-pull frequency — webhooks vs batch

| Integration | Mechanism | Frequency |
|---|---|---|
| Salesforce | Platform Events (webhooks) | Real-time |
| GitHub | Webhooks (org-level) | Real-time |
| Jira | Webhooks | Real-time |
| Slack | Events API | Real-time |
| Calendar | Daily batch (no useful webhooks) | Daily 02:00 tenant-local |
| BambooHR | Daily batch + on-demand at cycle close | Daily |
| Workday | Daily batch (their EIB scheduling) | Daily |
| LMS | Weekly batch | Weekly |
| Lattice / 15Five | At cycle close | Per cycle |
| Time tracking | Daily batch | Daily |

## Cache policy per integration

| Integration | Aggregates retention | Raw events retention |
|---|---|---|
| BambooHR | 90 days | 0 (re-pull each cycle) |
| Salesforce | 90 days | 30 days |
| GitHub | 90 days | 7 days |
| Jira | 90 days | 7 days |
| Slack | 90 days | 24 hours |
| Calendar | 90 days | 30 days (event_id list for audit) |
| LMS | 90 days | n/a |
| Lattice / 15Five | Tenant lifetime (frozen at cycle close) | n/a |
| Time tracking | 90 days | 7 days |
| Scribe / Notion | 90 days | 7 days |

Aggregates frozen into a locked review survive the 90-day rolloff (audit-trail necessity).

## Sub-processor list — public

URL: `/security/subprocessors`. Auto-generated from `INTEGRATION_SCOPE`. Customers notified 30 days before any new sub-processor is added.

```
SkillneX Sub-Processors (current as of YYYY-MM-DD)

Always active:
1. Anthropic, PBC               — LLM API for narrative generation
2. DigitalOcean LLC             — Application hosting + storage
3. Resend Inc.                  — Transactional email delivery

Activated when customer connects:
4. Salesforce.com Inc.          — CRM integration
5. GitHub Inc.                  — Code activity integration
6. Atlassian Pty Ltd            — Jira integration
7. Slack Technologies LLC       — Workplace communication metadata
8. Google LLC                   — Calendar integration
9. Microsoft Corporation        — Teams + Outlook + Microsoft 365
10. BambooHR LLC                — HRIS integration
```

Notification flow on add: in-app banner + email to all Owner-role users 30 days before activation. Customer may object; if so, that integration isn't available to them.

## EU data flows

When an EU tenant connects a US-headquartered integration (Salesforce, GitHub, Slack):

- Each platform handles its own EU-US transfer compliance via their SCCs or adequacy decision
- Skillnex DPA includes EU SCCs for any data flowing to US-hosted Skillnex infrastructure during the pilot
- When EU region opens (post-pilot, second EU customer signs), this stops being a transfer issue — EU customer data lives in EU infrastructure

## State Bar / law firm pilot — scope statement

Sent before pilot start, satisfies 80% of ABA Model Rule 1.6 concerns:

> *"Skillnex processes employee performance data only. We never ingest client matter information, client names, privileged communications, work product, or any data subject to attorney-client privilege. Our integration scope is limited to employee activity metadata: counts of opportunities and tickets owned, time-to-respond patterns, certification hours, and similar non-content metrics. We do not pull opportunity names, ticket titles, message bodies, document contents, or meeting subjects from any source system. Our scope is enforced in code (`INTEGRATION_SCOPE` allowlist) and cannot be expanded without an updated DPA."*

Backed by the per-integration `never_pull` lists.

## Build sequence (3 days)

| Day | Work |
|---|---|
| 1 | Create `lib/integrations/scope.ts` with full allowlist for all 10 integrations |
| 1 | Add `integration_opt_out` flag to `employees`; add `/app/my-review` opt-out toggle |
| 2 | Build per-integration consent screen template (used by all OAuth flows in Plan 4) |
| 2 | Auto-generate sub-processor list from `INTEGRATION_SCOPE` to `/security/subprocessors` |
| 3 | DPA template gets per-integration scope tables auto-inserted |
| 3 | Tests: every integration's `default_pull`/`opt_in_pull`/`never_pull` lists have no overlap, every supported competency is real, every sub-processor has a name |
| 3 | State Bar scope statement drafted to `docs/legal/state-bar-scope-statement.md` |

## Tests that prove the legal scope holds

| Test | Verifies |
|---|---|
| `tests/integrations/scope.test.ts` — Salesforce default_pull excludes account_name, opportunity_name | Customer-of-customer data exclusion |
| `tests/integrations/scope.test.ts` — Slack default_pull and opt_in_pull both exclude any `*_text`, `*_body`, `*_content` field | Slack content exclusion (TOS + risk) |
| `tests/integrations/scope.test.ts` — Calendar default_pull excludes meeting_title; opt_in_pull may include it | Title exclusion at default tier |
| `tests/integrations/scope.test.ts` — every default_pull field maps to a real competency | Data-minimization (no orphan pulls) |
| `tests/integrations/scope.test.ts` — never_pull and default_pull have no overlap | Tier integrity |
| `tests/integrations/scope.test.ts` — never_pull and opt_in_pull have no overlap | Hard limits cannot be opted into |
| `tests/integrations/scope.test.ts` — every integration declares sub_processor + eu_residency | Sub-processor list completeness |
| `tests/parsers/special-category.test.ts` — workbook column "race" rejected | Art. 9 enforcement (Plan 2 carryover) |
| End-to-end `tests/integrations/consent-screen.test.ts` — OAuth consent screen renders all three tiers from config | Transparent-notice requirement |
| End-to-end `tests/integrations/excluded.test.ts` — employee with `excluded_from_review=1` produces zero signals | Partner-data exclusion (State Bar) |

## Items deferred

- Tokenization layer for LLM prompts — Month 3 (Plan 2)
- Customer-managed encryption keys per integration — Year 1
- Customer-narrowable per-tenant scope overrides — post-pilot (decision #10)
- Workday Partner program — when first enterprise customer demands Workday
- Per-integration KMS keys — Year 1
