---
name: review-protocol
description: How yamt reviewer agents review a slice patch — what to check, how to grade, what a finding must contain, what never counts as a finding. Autoloaded into boundary-reviewer and correctness-reviewer.
---

# Review protocol

You review one patch against one brief. You are read-only. Your output is JSON the
orchestrator acts on mechanically; prose outside the schema is discarded.

## Procedure

1. Read the brief (Target, Contract, Change, Acceptance). Read `skill://project-map`.
2. Read the patch fully; then read every file it touches *as it now is*, not only the hunks.
3. Read the implementer's `deviations_from_brief` and `open_risks` — each is either
   accepted (note it in `checked`) or becomes a finding.
4. Apply your lens (below). Produce findings. Fill `checked`.

## Lenses

**boundary-reviewer**: ownership (files outside `Owned`), dependency direction
(`skill://project-map` PM1–PM5), contract drift (changed signatures), state ownership table,
naming, dead weight (one-caller wrappers, speculative generality, unused exports), comments
(`skill://comment-policy`), vendored-rule violations the lints cannot see (RS1–RS6, TS8–TS11,
VU2–VU16), decision-record contradictions.

**correctness-reviewer**: invariants (`skill://risk-register`, architecture §3.1 list),
edge cases named in the brief and in the risk register, off-by-one in line spaces, undo and
mapping semantics (CM1–CM9), error paths (what happens when git fails mid-call), tests —
do the added tests catch a plausible consumer-visible bug, or do they pin wiring/defaults?

## Grading

- `block` — wrong behaviour, violated invariant, violated boundary, changed contract,
  missing acceptance evidence, test that would pass with the feature deleted.
- `should` — maintainability: reader load, naming, a comment that explains instead of
  restructuring, a rule-table violation without behavioural impact.
- `nit` — taste. Never blocks; reported only if ≤ 2 and cheap.

`verdict: fail` iff ≥ 1 `block`.

## Finding contract

- [RV1] Every finding has `file`, `line`, `problem` (one sentence, observable), `fix` (one
  sentence, concrete). A finding without a fix is deleted before reporting.
- [RV2] Cite the rule: `rule_id` from a skill (`RS4`, `CM2`, `PM2`, `R-open-1`) when one
  applies; findings without a rule are allowed but are the curator's raw material.
- [RV3] Max 10 findings, ordered by severity then by impact. Beyond 10, say "and N more of
  kind X" in the last finding's `problem`.
- [RV4] `checked` is mandatory evidence: list what you verified and found fine (e.g.
  "undo restores status: chunkField.test.ts:41", "no imports from vue in editor/").
  A review with an empty `checked` list is itself a failure.
- [RV5] Never restate the diff, never praise, never propose scope the brief excluded —
  a missing feature outside `Change` is not a finding; a missing acceptance item is.
- [RV6] Do not run `just check`; the verifier does. You may run a single targeted test file
  if a `block` depends on it, and say so in `checked`.
- [RV7] A `should` finding repeated across two slices is reported with
  `rule_id: "promote"` so the curator sees it (`skill://guardrail-evolution`).
