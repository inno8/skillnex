# TODO: Performance review approval workflow (Option C)

**Status:** Deferred. Pilot ships with edit + email (Option B). This
doc captures the design for the full approval workflow so when the
first enterprise prospect asks "how do I prove the employee got the
version we approved?", we don't redesign from scratch.

## What pilot has today (Option B, shipped)

| Action | Where | Audit row |
|---|---|---|
| Generate / regenerate narrative | NarrativeCard | `generate_narrative` |
| Edit narrative inline | NarrativeCard → PUT `/api/employees/[key]/narrative` | `narrative_edited` |
| Email review to employee | Share modal → POST `/api/employees/[key]/share` | `review_emailed` (with recipient + Resend message id) |
| Inline edit name + email on /people | PeopleRow → PATCH `/api/employees/[key]` | `system_event` (action=`employee_fields_updated`) |

The narrative carries `edited_at` + `edited_by_user_id` for provenance,
but **anyone with the role can still re-edit or regenerate after a send**.
There is no "this version is final" lock.

## What Option C adds

A tracked status on each employee's narrative, transitions audited,
immutability after approval, an unlock path with its own audit row.

### Schema

Add to `employees`:

```sql
ALTER TABLE employees ADD COLUMN narrative_status TEXT
  CHECK (narrative_status IN ('draft', 'edited', 'approved', 'sent'));
ALTER TABLE employees ADD COLUMN narrative_approved_by TEXT REFERENCES user(id);
ALTER TABLE employees ADD COLUMN narrative_approved_at TEXT;
ALTER TABLE employees ADD COLUMN narrative_locked_hash TEXT;  -- sha256 of the
                                                              -- approved JSON
```

State machine:

```
       generate
draft  ─────────► draft
       PUT
draft  ─────────► edited
       POST approve
edited ─────────► approved
       POST share
approved ─────► sent
       POST unlock (owner only)
sent / approved ─────► edited
```

### Endpoints

* `POST /api/employees/[key]/approve` — owner|admin|manager scoped.
  Computes sha256 of the current narrative JSON, persists it as
  `narrative_locked_hash`, sets `narrative_status = 'approved'`,
  `narrative_approved_by`, `narrative_approved_at`. Audit:
  `narrative_approved`.
* `POST /api/employees/[key]/share` — only allowed when status is
  `approved` or `sent`. Sets status to `sent`. (Today's endpoint
  works at any status — needs a guard added.)
* `POST /api/employees/[key]/unlock` — owner only. Re-allows
  regenerate + edit by clearing `narrative_locked_hash` and dropping
  status back to `edited`. Audit: `narrative_unlocked`.

### Behavior changes

* **Regenerate** rejects (409) when status is `approved` or `sent`.
  UI grays the button + shows a tooltip "Approved — unlock to regenerate".
* **Edit** rejects with the same shape.
* **Share modal** disables the Send button when status isn't
  `approved` or `sent`. The "Send to employee" CTA becomes
  "Approve & send" when status is `edited` (one click does both).

### Hash check

Before send / display, recompute the sha256 of the narrative JSON and
compare to `narrative_locked_hash`. Mismatch → load the JSON-as-stored
fails the integrity check (would only happen if someone touched the
DB directly). Surface as a hard error to the manager, audit as
`narrative_integrity_failure`.

### UI

* Narrative card gets a status chip (`Draft` / `Edited` / `Approved` /
  `Sent`) — color-coded with the existing chip palette.
* Once `approved`, the body renders with a small lock icon overlay.
* "Approve" button shown when status is `edited`. Disabled when status
  is `approved` or `sent`. Owner-only "Unlock" link in the corner.

### Open questions for when this is built

1. **Resend** — should sending a second copy be allowed after
   `sent`? Probably yes (employee might lose the email), but it
   doesn't change status. Audit each send separately.
2. **Multi-approver** — does the owner need to approve a manager's
   approval? Pilot probably no; enterprise might want it. If yes,
   add a `narrative_approvals` table with one row per approver.
3. **Lock granularity** — lock the whole narrative JSON, or each
   field separately? Whole JSON is simpler and matches what the
   employee actually sees in the email.
4. **Cycle reset** — when the next quarter's xlsx is uploaded and the
   narrative regenerates, what happens to `narrative_status`? Probably
   resets to `draft` automatically. Will need to NOT carry forward the
   approval timestamps in `saveUpload()`.
5. **PDF integrity** — should the Export PDF include the hash + a
   "verified" footer? Useful for printed copies in HR files.

### Estimated scope when picked up

* Schema migration: 0.5 days (including a backfill script for any
  existing rows: status='approved' for sent, 'edited' otherwise).
* API endpoints + status guards on existing endpoints: 1 day.
* UI: 1 day (status chip, button gates, approve flow, unlock).
* Tests: 0.5 days (status transitions, hash integrity, scope guards
  per status).

**Total: ~3 days.** Don't pick up before there's a concrete enterprise
ask — pilot customers haven't needed it.
