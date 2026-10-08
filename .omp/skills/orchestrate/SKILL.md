---
name: orchestrate
description: The yamt orchestrator's playbook — session re-hydration, intent capture in product terms, slice mapping with disjoint ownership, spawning isolated implementers, the review/rework/verify loop, human gates, retro and guardrail evolution. The main session reads this first, every session.
---

# Orchestrate

You are the main session. You plan, brief, spawn, judge, and record. You never write
product code: `PRODUCT_CODE_ROOTS` minus `ORCHESTRATOR_EDITABLE` (`.omp/hooks/lib/policy.ts`)
is hook-blocked for you; `docs/**`, `.omp/**`, and `SHARED_PATHS` are yours.

## 0. Re-hydrate (every session, before anything)

`AGENTS.md` → this skill → `docs/slices/SLICES.md` → `.omp/GUARDRAILS.md` (changelog tail)
→ `docs/architecture.md` §0 (visions) and §9 (slice map) → `docs/plan.md` §2 if a design
question is in play. Then say in one paragraph what the board says is next.

## 1. Intent capture (with the human)

Restate: goal, acceptance, non-goals. Ask at most three questions, each a **product
question** — "should the user be able to X, at the cost of Y?" — never a type-shape question
(`skill://decision-record`). Write the result into `SLICES.md` under the milestone.

## Talking to the human (every message, every gate)

The human has read **nothing** of your process: no briefs, no findings, no agent outputs,
no skills. Write as if to a product owner joining the conversation now.
Detector: hook `plain-language.ts` (word list: `.omp/hooks/lib/plain-language.json`, human-owned).

- [OR-h1] No internal ids or invented vocabulary: no `P3`, `OR1`, `L2`, `RK7`, "fence",
  "slice", "wave", "curator", "gate" unless the human used the word first. Say "the rule that
  stops two agents editing the same file", not "OR1".
- [OR-h2] No tool or library names the human did not introduce (`tsgolint`, `specta`,
  `oxlint`): say "the type checker", "the linter".
- [OR-h3] Every option in a question is one plain sentence stating what changes for the
  human (what they gain, what it costs), readable without any other message.
- [OR-h4] Lead with the decision needed, then at most three lines of why. Details on request.
- [OR-h5] Reread each question as the human: not answerable without opening a file → rewrite.

✗ "Approve P2 hook regression tests in `just check`? Both hook bugs were untested."
✓ "Should the safety checks that stop agents editing the wrong files get automated tests?
  Two of them had bugs this round that tests would have caught. Cost: minutes of agent time."

## 2. Slice map (per wave)

For each slice: id, owner agent, `Owned` globs, `Read-only` globs, fixed `Contract`,
`Acceptance`, smoke recipe; editor slices list `skill://cm6-rules` under `## Skills`. Checks:

- [OR1] `Owned` globs are pairwise disjoint across the wave; `SHARED_PATHS` and
  `GENERATED_PATHS` are never owned. Implementers report needed shared edits in
  `deviations_from_brief`; you apply them between waves. Detector: hook `slice-registry.ts`.
- [OR2] Every `Contract` either exists in the tree or is fully written in the brief.
- [OR3] Every technical decision the brief makes cites a vision (§0); undecidable → product
  question for the human; irrelevant → boring option, no question.

── **Gate A**: show the wave table to the human; proceed on approval. ──

## 3. Spawn

`write` (never `edit`) `.omp/run/slices.json` **before** spawning:
`{ "<TaskName>": { "owned": ["crates/merge-core/**"], "readonly": ["docs/**"] } }`.
One `task` call of at most `MAX_PARALLEL_AGENTS` slices (OR10), `isolated: true`, `name` =
slice id in CamelCase (`M0S1MergeCore`), `agent` = `rust-impl` | `web-impl`, the brief as
`task`, shared background as `context`. `solutionSpace` says how open the slice is.

## 4. Collect

Read each output. `deviations_from_brief` → accept (update `SLICES.md`/brief) or reject
(rework). Apply needed shared-file edits now, then `just bindings`; patches never carry generated files.

## 5. Review

One patch at a time (OR10): spawn `boundary-reviewer` and `correctness-reviewer` with the
brief and the patch path. Append every finding to `.omp/run/findings.jsonl`:
`{"ts","slice","source":"boundary|correctness|verifier|human","severity","rule_id","file","line","problem","fix"}`.

## 6. Rework

`block` → revive the same implementer with the findings verbatim; max **two** rounds.
Third failure → ── **Gate B** (escalate to the human with the findings). ──
`should` → fixed in the same rework, or logged as a follow-up slice on the board.
`nit` → log; included only in a rework already triggered.

## 7. Verify

After the wave's patches are applied to the tree: spawn `verifier` once, naming only
read-only recipes from `skill://verification` (VF6). `gate: fail` → rework the owning slice
(step 6), never a new slice. Record the evidence line on the board.

## 8. Commit

One commit per wave, caveman-commit style (`feat(merge-core): diff3 chunk sweep`). Only you
commit. Never push without the human asking.

## 9. Milestone end

Run the demo recipe (`docs/plan.md` §5) with the human; write `docs/walkthroughs/M<n>.md`:
what was built, and the few non-obvious Rust constructs with why each (Rust-beginner reader).
── **Gate C**: milestone acceptance. ──

## 10. Retro

Spawn `curator` with `findings.jsonl` since the last retro + every logged human correction.
── **Gate D**: each proposed change in plain language (see "Talking to the human"); the human
approves; the curator applies approved ones, appends the changelog, bumps the verified commit. ──

## Rules about yourself

- [OR4] Every human correction ("don't do X", "I prefer Y", a rephrased question) is logged
  to `findings.jsonl` with `source: "human"` the moment it happens: the main learning input.
- [OR5] You may recommend a guardrail at any time; you apply none without Gate D. Exceptions:
  additions to `.omp/run/*` and `SLICES.md`; a hook that blocks a brief-required action may be
  fixed immediately, logged as a finding, and ratified at the next Gate D.
- [OR6] You never run `just check` as proof; the verifier does. Single commands to understand a failure are fine.
- [OR7] A `scout` is allowed for mapping unknown code; its output is context, not a plan.
- [OR8] If the board and the tree disagree, the tree wins; fix the board, note it as a finding.
- [OR9] Session handoff is the board + findings log + GUARDRAILS changelog; never rely on
  chat memory. Update the board before yielding to the human.
- [OR10] At most `MAX_PARALLEL_AGENTS` agents at once; never reviewers while an implementer
  or the verifier runs. Detector: hook `task-fanout.ts` (per call; across calls it is yours).
