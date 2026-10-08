# Retro 0.0 — approved changes to apply (curator, APPLY mode)

Approved by the human on 2026-10-08. Apply exactly these; edits only under `.omp/**`.
The retro proposals are in `~/.omp/agent/sessions/-Projects-yamt/2026-10-08T17-54-41-516Z_01a11ca7-30ec-7543-b586-500022fabf37/Retro00.json`
(read it; ids below refer to it). Rejected: P7. P1 approved in a changed form (see A1).

A1 (P1, changed): new hook `.omp/hooks/pre/plain-language.ts`. On a `tool_call` for tool `ask`
from the main agent (`ctx.agent.kind === "main"`), collect every string in `event.input`
(question texts, option labels, option descriptions, headers). Load `.omp/hooks/lib/plain-language.json`
(human-owned; do not change its word lists). Match case-insensitively: each entry of `ai_overused`
and `project_jargon` as a whole word/phrase, each `id_patterns` entry as a regex. If anything
matches, block with reason: `[plain-language] rephrase for the human — flagged: <word>: "<10-word excerpt>", …`
(max 8 items). Export a pure `flaggedTerms(strings: string[], lists): Flag[]` from `lib/policy.ts`
or a new `lib/plain-language.ts` so the test in A2 covers it. The orchestrator rule OR-h in
`skill://orchestrate` gets `Detector: hook plain-language.ts (word list: .omp/hooks/lib/plain-language.json, human-owned)`.

A2 (P2): `.omp/hooks/test/hooks.test.ts` with `node:test`, as proposed: fake `pi` capturing the
`tool_call`/`tool_result` handlers; table cases for ownership (main blocked on crates/, sub allowed
in owned, sub blocked outside, `agent://` target ignored, /tmp ignored, no-slice blocked),
generated (bindings.ts, Cargo.lock, *.snap), bash-guard (every justfile recipe name except
golden-update passes for subagents; `just bindings-check` passes; `git push` blocked for all;
`git commit` blocked for sub, allowed with `git -C /tmp/x`), plain-language (one flagged, one clean),
slice-registry (A4). Runner: `cd .omp/hooks && npx --yes tsx --test test/*.test.ts` must work
from the repo root via `frontend/node_modules/.bin/tsx` (prefer: `pnpm -C frontend exec tsx --test ../.omp/hooks/test/hooks.test.ts`).
Report the exact command for the orchestrator to add as `just hooks-test` (orchestrator edits the justfile).

A3 (P3): `policy.ts` exports `ORCHESTRATOR_EDITABLE = ["frontend/package.json", "frontend/.oxlintrc.json", "frontend/.oxfmtrc.json", "frontend/eslint.config.js", "frontend/vite.config.ts", "frontend/tsconfig*.json", "src-tauri/Cargo.toml", "crates/*/Cargo.toml"]`
and `SHARED_PATHS = ["Cargo.toml", "Cargo.lock", "justfile", "frontend/package.json", "frontend/pnpm-lock.yaml"]`;
`ownership.ts` main branch allows `ORCHESTRATOR_EDITABLE`. `skill://orchestrate` lines 9-10 and
`curator.md` cite the constants by name instead of listing paths.

A4 (P4): hook `.omp/hooks/pre/slice-registry.ts` as proposed: on main's `write` to
`.omp/run/slices.json` parse `input.content`; block if any two `owned` lists overlap (glob vs
glob: test each literal-prefix of one against the other's regex, and vice versa), if any `owned`
entry matches `SHARED_PATHS` or `GENERATED_PATHS`, or if the JSON is invalid; block `edit` on
that file (always written whole). `skill://orchestrate` OR1 gets `Detector: hook slice-registry.ts`.

A5 (P5): `policy.ts` `MAX_PARALLEL_AGENTS = 2`; hook `.omp/hooks/pre/task-fanout.ts` blocks a
main `task` call whose `tasks` array is longer than that. `bash-guard.ts` adds
`DENIED_FOR_REVIEWERS` (agent names boundary-reviewer, correctness-reviewer): `just check`,
`just web-*`, `pnpm -C frontend lint|typecheck|test`, `cargo clippy --workspace`, `cargo nextest run --workspace`,
`vue-tsc`, `oxlint --type-aware`; single-file test runs stay allowed. `skill://orchestrate` §5
becomes "one patch at a time" and adds `[OR10] at most MAX_PARALLEL_AGENTS agents at once; never
reviewers while an implementer or the verifier runs`. `review-protocol` RV6 cites the guard.

A6 (P6): `skill://slice-protocol` SP3 → "Run your layer's recipes (`cargo …` for Rust, `pnpm -C frontend …`
for web); the integrated `just check` runs once, by the verifier, on the merged tree." (The justfile
edits are the orchestrator's.)

A7 (P8): `skill://project-map` PM2/PM3/PM5 detector text → "oxlint overrides + `frontend/scripts/fences.test.ts`"
and `GUARDRAILS.md` rows PM2/PM3/PM5 level `L1+L2 (test pending next web slice)`.

A8 (P9): `vue-conventions` VU2 shrinks to id + one line + detector; `web-impl.md` autoloadSkills drops
`cm6-rules`; `skill://orchestrate` §2 adds "editor slices list `skill://cm6-rules` under Skills".

A9 (P10): `GUARDRAILS.md` new row IPC8 L2 `frontend/src/ipc/log.test.ts`; `ipc-contract` IPC8 forward
type → `(entry: LogEntry) => Promise<unknown> | void` + `Detector: log.test.ts`.

A10 (P11): `verification` adds `[VF6] verifier recipes are read-only commands; a detector's failing
path is proven by a committed test, never by tamper-and-restore`; `orchestrate` §7 cites VF6;
`slice-protocol` SP4 adds "a detector you add ships with a committed test of its failing path".

A11 (P12): `orchestrate` §6 "nit → log; included only in a rework already triggered";
`correctness-reviewer.md`: a test that would pass with the feature deleted is `should`, `block`
if it is the only evidence for an Acceptance line.

A12 (P13): apply every `drift[]` item from Retro00.json that concerns `skill://project-map`
(verified commit `588abc9`, package names, src-tauri/specta line, scripts/ and config rows,
tsconfig split, Vitest projects, ipc public surface, briefs/ and AGENTS.md rows, PM1/PM4 detectors);
`verification` lines 51-55 (`test:browser`, no jsdom); keep project-map ≤ 120 lines.

A13: `GUARDRAILS.md`: update rows per above, add rows OR1 (L3), OR10 (L3), OR-h (L3 via
plain-language.ts), IPC8 (L2); append a changelog entry dated 2026-10-08 listing every proposal
id with its outcome (P1 changed, P2–P6, P8–P13 approved, P7 rejected).

Acceptance: `pnpm -C frontend exec tsx --test ../.omp/hooks/test/hooks.test.ts` passes (paste);
every SKILL.md ≤ 120 lines (`wc -l`); `git diff --stat` pasted.
