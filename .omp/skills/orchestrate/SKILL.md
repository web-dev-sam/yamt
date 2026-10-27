---
name: orchestrate
description: The yamt orchestrator's playbook — session re-hydration, intent capture in product terms, slice mapping with disjoint ownership, spawning isolated implementers, the review/fix/verify loop, human gates, retro and guardrail evolution. The main session reads this first, every session.
---

# Orchestrate

You are the main session. You plan, brief, spawn, judge, and record. You never write product code: `PRODUCT_CODE_ROOTS`
minus `ORCHESTRATOR_EDITABLE` (`.omp/hooks/lib/policy.ts`) is hook-blocked for you; `docs/**`, `.omp/**`, `SHARED_PATHS` are yours.

## 0. Re-hydrate (every session, before anything)

`AGENTS.md` → this skill → `docs/slices/SLICES.md` → `.omp/GUARDRAILS.md` (changelog tail) → `docs/architecture.md` §0
(visions), §9 (slice map) → `docs/plan.md` §2 if a design question is in play. Then say in one paragraph what is next.

## 1. Intent capture (with the human)

Restate: goal, acceptance, non-goals. Ask at most three **product questions** ("should the user be able to X, at the
cost of Y?"), never a type-shape question (`skill://decision-record`). Write the result into `SLICES.md` under the milestone.

- [OR13] Before asking anything, start every slice that does not depend on the answer; the question waits while
  agents work. A request that states the feature and the workflow gets no approval question: ask only real product
  choices (a WebStorm deviation, a tradeoff the owner must make). Gate B is asked at most once per feature; its answer
  stands. The first word of an answer is the answer ("No …" is no); being asked again is no consent (#738/#739).

## Talking to the human (every message, every gate)

The human has read **nothing** of your process: no briefs, no findings, no agent outputs, no skills. Write as if to a
product owner joining the conversation now. Detector: hook `plain-language.ts` (word list `.omp/hooks/lib/plain-language.json`, human-owned).

- [OR-h1] No internal ids or invented vocabulary: no `P3`, `OR1`, `L2`, `RK7`, "fence", "slice", "wave",
  "curator", "gate" unless the human used the word first. Say "the rule that stops two agents editing the same file", not "OR1".
- [OR-h2] No tool or library names the human did not introduce (`tsgolint`, `specta`, `oxlint`): say "the type checker", "the linter".
- [OR-h3] Every option in a question is one plain sentence stating what changes for the human (what they gain, what
  it costs), readable without any other message.
- [OR-h4] Lead with the decision needed, then at most three lines of why. Details on request.
- [OR-h5] Reread each question as the human: not answerable without opening a file → rewrite.
- [OR-h6] A release: `CHANGELOG.md` gets its full section as before; the reply also gives notes to paste into the release, in the owner's compact form (example: finding #989): Added/Changed/Fixed, one short line per feature, its parts as sub-bullets, no explanations, written in no file.

✗ "Approve P2 hook regression tests in `just check`? Both hook bugs were untested."
✓ "Should the safety checks that stop agents editing the wrong files get automated tests?
Two of them had bugs this round that tests would have caught. Cost: minutes of agent time."

## 2. Slice map (per wave)

For each slice: id, owner agent, `Owned`/`Read-only` globs, fixed `Contract`, `Acceptance`, smoke recipe; editor
slices list `skill://cm6-rules` under `## Skills`. Hand failing-path steps only for `editor/` (not mutated) and
type-level proofs; elsewhere `just mutants` (VF7) does it. One slice = one concern, well inside an implementer's 200-request
budget (guide: ≤ ~25 files, ≤ ~1,500 changed lines; larger → split; SettingsWeb: 281 requests, no real-app check). The
brief passes the design's sourced facts as given (`skill://slice-protocol`). Slices form a dependency graph: independent
ones run in parallel; a dependent one starts once its prerequisite's round 1 is committed, not after its review. A fix
round never touches a dependent slice's owned files; a contract change it uses goes to it (`write agent://<id>`) or into its own fix round. Checks:

- [OR1] `Owned` globs are pairwise disjoint across the wave; `SHARED_PATHS` and `GENERATED_PATHS` are never owned.
  Implementers report needed shared edits in `deviations_from_brief`; you apply them between rounds. Detector: hook `slice-registry.ts`.
- [OR2] Every `Contract` either exists in the tree or is fully written in the brief.
- [OR3] Every technical decision the brief makes cites a vision (§0); undecidable → product question; irrelevant → boring option.

── **Gate A**: the slice graph goes into the next report to the human; a question only for a real product choice (OR13). ──

## 3. Spawn

`write` `.omp/run/slices.json` with only the live task names; hooks in isolated worktrees read the main checkout's
copy, so a grant applies at once. Detector: hooks `slice-registry.ts`, `task-fanout.ts`. One `task` call per isolated
slice (OR10), `isolated: true`, `name` = slice id in CamelCase (`M0S1MergeCore`), `agent` = `rust-impl` | `web-impl`
(language-neutral: `rust-impl`; the default `task` agent is disabled), brief as `task`, background as `context`, `solutionSpace` = openness.

## 4. Collect and commit

Read each output field separately (`agent://<id>/<field>`), never the truncated whole document, and write
`.omp/run/notes/<Name>.md` from them; board evidence cells ≤ ~300 characters, pointing to the note.
`deviations_from_brief` → accept (update `SLICES.md`/brief) or reject (fix round). Apply needed shared-file edits now,
then `just bindings` (and `just third-party-licenses` when a dependency changed); patches never carry generated files.
Commit each applied patch (every round) before its review, caveman-commit style; only you commit; never push unasked.

## 5. Review and fix rounds

Once a slice's patch is committed: start `just mutants <commit before it>` as a background job (VF7) and spawn
`boundary-reviewer` at once; spawn `correctness-reviewer` when the run ends, with its survivor list. Each gets the
brief and the patch path. Append every finding to `.omp/run/findings.jsonl`:
`{"ts","slice","source":"boundary|correctness|verifier|human","severity","rule_id","file","line","problem","fix","triage"}`.

- [OR12] Triage before any fix round: every `should`/`nit` and every verifier survivor gets one question — _if this
  stays, does the app get harder to grow (a component with a second job, data with two writers or two sources, a
  copied rule, a bent boundary, an untested rule other code relies on)?_ Yes → `block`, fixed in this slice's fix round
  (`"triage": "promoted: <reason>"`); no → dropped (`"triage": "dropped: <one-line reason>"`). No backlog, no cleanup round.

Only blocks (promoted ones included) start a fix round: respawn under a fresh name (`<Name>R<n>`) with the blocks
verbatim; max **two** rounds per slice. Each round is re-checked by **one** reviewer, the lens that raised the blocks
it fixes (both only when both did; scope RV8); its `should`/`nit` are dropped without a round. Beyond two rounds →
── **Gate B** (escalate to the human with the findings; OR13). ──

## 6. Verify (final check)

Update `docs/architecture.md` and `skill://project-map` once per feature, now. Then spawn `verifier` alone (OR10) with
read-only recipes (VF6): `just check` (incl. `map-check`) and the smoke recipes — never `just mutants` over the feature: each
patch's own run is the evidence (VF7, owner #1630). `gate: fail` → fix round for the owning slice (§5), never a new slice. Evidence → board.

## 7. Milestone end and retro

Run the demo recipe (`docs/plan.md` §5) with the human; write `docs/walkthroughs/M<n>.md`: what was built, and the few non-obvious
Rust constructs with why each (Rust-beginner reader). ── **Gate C**: milestone acceptance by the owner. A check the product will
show later waits for it: a board row in that milestone naming the question it settles; no side tooling (#106–#107). ── Then, before
the next milestone's first spawn (owner, #108), spawn `curator` with `findings.jsonl` since the last retro + human corrections. ──
**Gate D**: each change in plain language; the human approves; the curator applies, appends the changelog, bumps the verified commit. ──

## Rules about yourself

- [OR4] Log every human correction ("don't do X", "I prefer Y", a rephrased question) to `findings.jsonl` with `source: "human"` the
  moment it happens: the main learning input.
- [OR5] You may recommend a guardrail at any time; you apply none without Gate D. Exceptions: additions to
  `.omp/run/*` and `SLICES.md`; a hook that blocks a brief-required action may be fixed at once, logged, ratified at the next Gate D.
- [OR6] You never run `just check` as proof; the verifier does. Single commands to understand a failure are fine.
- [OR7] A `scout` is allowed for mapping unknown code; its output is context, not a plan.
- [OR8] If the board and the tree disagree, the tree wins; fix the board, note it as a finding.
- [OR9] Handoff = board + findings log + GUARDRAILS changelog, never chat memory; update the board before yielding. A handoff note is
  a checkpoint, not a stop: keep executing the board until the owner says stop or the context is nearly full (owner, #352/#356).
- [OR10] At most `MAX_PARALLEL_AGENTS` agents live, at most two implementers. Reviewers may run beside an implementer
  (they read committed patches); a `just mutants` run may run beside both; the verifier runs alone (no agent, no
  mutation run beside it: it builds and drives the app). No broadcast. Detector: hook `task-fanout.ts` (per call); across calls, you.
