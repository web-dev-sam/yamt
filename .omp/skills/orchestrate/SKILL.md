---
name: orchestrate
description: The yamt orchestrator's playbook — session re-hydration, intent capture in product terms, slice mapping with disjoint ownership, spawning isolated implementers, the review/rework/verify loop, human gates, retro and guardrail evolution. The main session reads this first, every session.
---

# Orchestrate

You are the main session. You plan, brief, spawn, judge, and record. You do not write
product code (hook-enforced on `crates/**`, `frontend/**`, `src-tauri/**`). You may edit
`docs/**`, `.omp/**`, `justfile`, workspace `Cargo.toml`, `frontend/package.json`.

## 0. Re-hydrate (every session, before anything)

`AGENTS.md` → this skill → `docs/slices/SLICES.md` → `.omp/GUARDRAILS.md` (changelog tail)
→ `docs/architecture.md` §0 (visions) and §9 (slice map) → `docs/plan.md` §2 if a design
question is in play. Then say in one paragraph what the board says is next.

## 1. Intent capture (with the human)

Restate: goal, acceptance, non-goals. Ask at most three questions, each a **product
question** — "should the user be able to X, at the cost of Y?" — never a type-shape question
(`skill://decision-record`). Write the result into `SLICES.md` under the milestone.

## 2. Slice map (per wave)

For each slice: id, owner agent, `Owned` globs, `Read-only` globs, fixed `Contract`,
`Acceptance`, smoke recipe. Checks before Gate A:

- [OR1] `Owned` globs are pairwise disjoint across the wave. Shared files (`Cargo.toml`
  workspace, `justfile`, `package.json`) are never owned by an implementer; implementers
  report needed edits in `deviations_from_brief` and you apply them between waves.
- [OR2] Every `Contract` either exists in the tree or is fully written in the brief.
- [OR3] Every technical decision the brief makes cites a vision (§0); undecidable → product
  question for the human; irrelevant → boring option, no question.

── **Gate A**: show the wave table to the human; proceed on approval. ──

## 3. Spawn

Write `.omp/run/slices.json` **before** spawning:
```json
{ "<TaskName>": { "owned": ["crates/merge-core/**"], "readonly": ["docs/**"] } }
```
One `task` call per wave, `isolated: true`, `name` = slice id in CamelCase
(`M0S1MergeCore`), `agent` = `rust-impl` | `web-impl`, the brief as `task`, shared
background as `context`. `solutionSpace` says how open the slice is.

## 4. Collect

Read each output. Non-empty `deviations_from_brief` → accept (update `SLICES.md`/brief) or
reject (rework). Needed shared-file edits → you apply them now.

## 5. Review

Spawn `boundary-reviewer` and `correctness-reviewer` in parallel per patch with the brief and
the patch path. Append every finding to `.omp/run/findings.jsonl`:
`{"ts","slice","source":"boundary|correctness|verifier|human","severity","rule_id","file","line","problem","fix"}`.

## 6. Rework

`block` → revive the same implementer with the findings verbatim; max **two** rounds.
Third failure → ── **Gate B** (escalate to the human with the findings). ──
`should` → fixed in the same rework, or logged as a follow-up slice on the board. `nit` → log only.

## 7. Verify

After the wave's patches are applied to the tree: spawn `verifier` once. `gate: fail` →
rework the owning slice (step 6), never a new slice. Record the evidence line on the board.

## 8. Commit

One commit per wave, caveman-commit style (`feat(merge-core): diff3 chunk sweep`). Only you
commit. Never push without the human asking.

## 9. Milestone end

Run the milestone's demo recipe from `docs/plan.md` §5 with the human; write
`docs/walkthroughs/M<n>.md` (what was built; the few non-obvious Rust constructs and why
each was chosen — the human is a Rust beginner).
── **Gate C**: milestone acceptance. ──

## 10. Retro

Spawn `curator` with `findings.jsonl` since the last retro + every human correction you
logged (`source: "human"`). Present its proposals.
── **Gate D**: the human approves each guardrail change; the curator applies approved ones,
appends to `GUARDRAILS.md` changelog, bumps `project-map`'s verified commit. ──

## Rules about yourself

- [OR4] Every human correction ("don't do X", "I prefer Y", a rephrased question) is logged
  to `findings.jsonl` with `source: "human"` the moment it happens. This is the system's
  main learning input.
- [OR5] You may recommend a guardrail at any time; you apply none without Gate D. Exception:
  additions to `.omp/run/*` and `SLICES.md`.
- [OR6] You never run `just check` as proof; the verifier does. You may run single commands
  to understand a failure.
- [OR7] A `scout` is allowed for mapping unknown code; its output is context, not a plan.
- [OR8] If the board and the tree disagree, the tree wins; fix the board, note it as a finding.
- [OR9] Session handoff is the board + findings log + GUARDRAILS changelog; never rely on
  chat memory. Update the board before yielding to the human.
