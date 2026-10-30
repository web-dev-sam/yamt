---
name: slice-protocol
description: The contract between the orchestrator and an implementer in yamt — what a slice brief guarantees, what "done" means, what to report, and what never to do silently. Autoloaded into every implementer.
---

# Slice protocol

You were spawned for exactly one slice: one concern, sized to fit well inside your 200-request budget
(`skill://orchestrate` §2). The brief in your task has five parts; if one is missing, say so in
`deviations_from_brief` and do what the architecture doc implies. Facts the brief gives with a source (a
value, a source line) are given: use them; re-check only what it marks `[INFERENCE]`.

```
# Slice <id> — <title>
## Target      Owned: <globs>   Read-only: <globs>   Non-goals: <list>
## Contract    signatures / types that are FIXED (you may add, never change)
## Change      ordered steps
## Acceptance  observable results (a test name, a command and its output, a screenshot)
## Skills      extra skill:// paths beyond your autoloaded ones
```

## Rules

- [SP1] Edit only `Owned` globs. A hook blocks everything else; do not work around it with
  `bash` redirection. If you need a change elsewhere (a `Cargo.toml` dep, a shared type),
  write the exact diff you need in `deviations_from_brief` and continue with a local stub
  only if the slice is otherwise blocked. Detector: hook `ownership.ts`.
- [SP2] `Contract` signatures are fixed. Adding is fine; changing a listed signature is a
  deviation to report, not to do. Detector: review `block`.
- [SP3] Run your layer's recipes (`cargo …` for Rust, `pnpm -C frontend …` for web); the
  integrated `just check` runs once, by the verifier, on the merged tree.
- [SP4] Done means: every `Acceptance` line observed by you, with the evidence pasted into
  `smoke_evidence` (command + relevant output lines). No stubs, no `TODO`, no "follow-up".
  If an acceptance line is unreachable, say which and why in `acceptance_not_run` — do not narrow it
  silently; such a slice is not done, and its check runs before its review ends. A
  detector you add ships with a committed test of its failing path. Behaviour the brief excludes
  by owner decision (Non-goals, plan §2 row) is scope, not a stub.
- [SP5] Tests: the ones `Acceptance` names, plus any pinning a `skill://risk-register` invariant you
  touch; they kill the mutants on your changed lines (SP11). Never wiring, defaults, "does not throw".
- [SP6] No new dependency without a `deviations_from_brief` entry naming why the chosen stack
  cannot do it (`skill://decision-record` DR3).
- [SP7] Every comment you write is judged by `skill://comment-policy`. Default: none.
- [SP8] Report with the output schema. `deviations_from_brief` is a legal channel, not a
  confession: use it for everything you did outside `Change`/`Target`, and for everything you
  decided that the brief left open.
- [SP9] You may not spawn agents, commit, push, or run `git` write commands; the orchestrator
  commits each applied patch. Detector: hook `bash-guard.ts`.
- [SP10] Working copy may be an isolated workspace; path references in your report are
  repo-relative.
- [SP11] Finish in this order, so review finds nothing you could have seen (`skill://verification` VF7):
  1. Your layer's recipes once (SP3) and the acceptance runs (SP4); WebKit and the app on a private display.
  2. `just mutants HEAD` in your workspace (uncommitted and new files count). Kill every survivor on a
     changed line with a test, or keep it with its reason (equivalent, gate-covered, wiring) in `mutation`.
     Start the run early enough: a slice reported without one goes back.
  3. Self-check against the reviewers' growth question: does a touched module now have a second job; does
     a state get a second writer or source; did you write a rule, helper or constant that already exists
     (`grep` for it before keeping yours); did you add an import edge against `skill://project-map`? Fix
     what you find; what you cannot fix inside `Owned` goes to `deviations_from_brief`.

## Output schema (filled fully, every field)

```
summary                 ≤ 5 lines, what exists now that did not before
files_changed           repo-relative paths
tests_added             test names and what each proves
smoke_evidence          command → observed lines, for every Acceptance item
mutation                the `just mutants HEAD` run; survivors kept on changed lines, each with its reason
acceptance_not_run      Acceptance lines not observed, each with why; empty = all observed
deviations_from_brief   list; empty list means "brief followed exactly"
open_risks              what you are unsure about, with the file:line
```

Every field has a length cap (the agent schema); the orchestrator reads this output, the evidence stays
in your transcript (`agent://<id>`).
