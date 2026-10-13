---
name: review-protocol
description: How yamt reviewer agents review a slice patch — what to check, how to grade, what a finding must contain, what never counts as a finding. Autoloaded into boundary-reviewer and correctness-reviewer.
---

# Review protocol

You review one patch against one brief. You are read-only. Your output is JSON the
orchestrator acts on mechanically; prose outside the schema is discarded.

## Procedure

1. Read the brief (Target, Contract, Change, Acceptance). Read `skill://project-map`.
2. Read the patch fully; then read every file it touches _as it now is_, not only the hunks.
3. Read the implementer's `deviations_from_brief` and `open_risks` — each is either
   accepted (note it in `checked`) or becomes a finding.
4. Apply your lens (below). Produce findings. Fill `checked`.

## Lenses

**boundary-reviewer**: ownership (files outside `Owned`), dependency direction
(`skill://project-map` PM1–PM5), contract drift (changed signatures), state ownership table,
naming, dead weight (one-caller wrappers, speculative generality, unused exports), comments
(`skill://comment-policy`), vendored-rule violations the lints cannot see (RS1–RS6, TS8–TS11, TS17,
VU2–VU16), decision-record contradictions. Test strength is the correctness reviewer's; skip it.
**Growth check**: for every touched module or component, count its jobs (does it now own data _and_
layout _and_ rules?); every new piece of state has one owner row in architecture §5.1 and is written
only by that owner; every new import edge follows §2; a second copy of a decision is reported.

**correctness-reviewer**: invariants (`skill://risk-register`, architecture §3.1 list),
edge cases named in the brief and in the risk register, off-by-one in line spaces, undo and
mapping semantics (CM1–CM9), error paths (what happens when git fails mid-call), tests —
do the added tests catch a plausible consumer-visible bug, or do they pin wiring/defaults? Judge
by reading; never edit source to mutate it — survivors come from the orchestrator's per-slice `just mutants`
run, given to you as input: drop each per VF7 (a)/(b)/(c) (`skill://verification`), grade the rest below.

## Grading

- `block` — (1) wrong behaviour a user or a caller would notice, a violated invariant, a changed
  contract, missing acceptance evidence, or a test that is the only evidence for an Acceptance line and
  would pass with the feature deleted; (2) **growth harm**: a change that makes the app harder to grow —
  a module or component taking on a second job (a god component in the making), state with two writers
  or a second source of truth, data reaching a place through a side channel or through layers that do
  not use it, a boundary bent (an edge against architecture §2 or the state-ownership table §5.1), a rule
  or decision copied instead of shared, a rule other code relies on left untested. A user-visible bug is
  never a `should` (calibration: #689, #692, #710, #723 were reported as `should`).
- `should` — local quality with no growth effect: naming, a clearer loop, comment wording, a test gap
  on a rule nothing else builds on, structure inside one function.
- `nit` — taste. Never blocks; reported only if ≤ 2 and cheap.

For every `should` and `nit`, the `problem` sentence says what, if anything, gets harder as the app
grows if it stays; "nothing" is a valid answer. The orchestrator triages them (`skill://orchestrate` OR12).

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
- [RV6] Do not run `just check` or any whole-workspace toolchain; the verifier does. You may
  run a single targeted test file if a `block` depends on it, and say so in `checked`.
  Detector: hook `bash-guard.ts` (`DENIED_FOR_REVIEWERS`).
- [RV7] A `should` finding repeated across two slices is reported with
  `rule_id: "promote"` so the curator sees it (`skill://guardrail-evolution`).
- [RV8] A fix-round re-check (one lens, `skill://orchestrate` §5) asks only: is each block fixed; did
  the fix break behaviour or cause growth harm (`block` (2))? A new `should`/`nit` is reported only if
  it meets the `block` bar.
