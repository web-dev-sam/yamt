---
name: slice-protocol
description: The contract between the orchestrator and an implementer in yamt — what a slice brief guarantees, what "done" means, what to report, and what never to do silently. Autoloaded into every implementer.
---

# Slice protocol

You were spawned for exactly one slice. The brief in your task has five parts; if one is
missing, say so in `deviations_from_brief` and do what the architecture doc implies.

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
  If an acceptance line is unreachable, say which and why — do not narrow it silently. A
  detector you add ships with a committed test of its failing path. Behaviour the brief excludes
  by owner decision (Non-goals, plan §2 row) is scope, not a stub.
- [SP5] Tests: write the ones `Acceptance` names, plus any that pin an invariant from
  `skill://risk-register` your code touches. Never tests for wiring, defaults, or "does not throw".
- [SP6] No new dependency without a `deviations_from_brief` entry naming why the chosen stack
  cannot do it (`skill://decision-record` DR3).
- [SP7] Every comment you write is judged by `skill://comment-policy`. Default: none.
- [SP8] Report with the output schema. `deviations_from_brief` is a legal channel, not a
  confession: use it for everything you did outside `Change`/`Target`, and for everything you
  decided that the brief left open.
- [SP9] You may not spawn agents, commit, push, or run `git` write commands; the orchestrator
  commits per wave. Detector: hook `bash-guard.ts`.
- [SP10] Working copy may be an isolated workspace; path references in your report are
  repo-relative.

## Output schema (filled fully, every field)

```
summary                 ≤ 5 lines, what exists now that did not before
files_changed           repo-relative paths
tests_added             test names and what each proves
smoke_evidence          command → observed lines, for every Acceptance item
deviations_from_brief   list; empty list means "brief followed exactly"
open_risks              what you are unsure about, with the file:line
```
