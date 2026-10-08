---
name: decision-record
description: How settled decisions are recorded and when they may be reopened in yamt. Read before proposing an alternative design or adding a dependency.
---

# Decision record

The record lives in `docs/plan.md` §2 (rows 1–15 from the original plan, 16+ appended per
session). Read it before any design work; it is the list of things not to re-explore.

- [DR1] A decision in §2 is not relitigated without **new information** (a measured number,
  a broken assumption, a changed requirement). "I would have chosen differently" is not new
  information. Detector: review — a diff that contradicts a row without a new row is `block`.
- [DR2] A new technical decision is a new row: `| # | **Decision** | Rejected alternatives & why | Vision |`.
  The vision column cites `docs/architecture.md` §0 by number. A decision that cites no vision
  is either irrelevant (take the boring option, no row) or a product question (ask the human
  in product terms, never in type-shape terms).
- [DR3] Adding a dependency is a decision (vision 5): name what the chosen stack cannot do
  without it. Rust: the crate list in `docs/architecture.md` §7 is closed unless a row is
  added. Frontend: same for `package.json` runtime deps.
- [DR4] Reopening a row: write the proposed replacement row *below* the old one with the new
  information in the "Rejected" column of the old row, and stop — Gate D (human) decides.
- [DR5] Agents never edit `docs/plan.md`; they put the proposed row in
  `deviations_from_brief` / `open_risks` and the orchestrator records it.

## Product questions, not technical questions

The human is the product owner. Ask "should the user be able to X, at the cost of Y?" —
never "start/end or start/len?". Spell out the consequence a user or maintainer would see.
