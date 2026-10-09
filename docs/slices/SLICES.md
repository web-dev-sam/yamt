# Work board

Durable state of the build. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Bootstrap (session 1)

| slice                                                                      | owner        | status | evidence                                                                                           |
| -------------------------------------------------------------------------- | ------------ | ------ | -------------------------------------------------------------------------------------------------- |
| B.1 repo + docs + config + AGENTS.md                                       | orchestrator | done   | first commit empty; docs in `docs/`                                                                |
| B.2 `.omp/` skills, agents, hooks, GUARDRAILS                              | orchestrator | done   | commit 42fcb3d                                                                                     |
| B.3 fence smoke (identity, ownership, generated, bash-guard, main-no-code) | orchestrator | done   | four blocks observed; identity confirmed                                                           |
| 0.0 walking skeleton (Rust)                                                | rust-impl    | done   | verifier: `just check` exit 0; arch-check probes; commit 588abc9                                   |
| 0.0' walking skeleton (frontend)                                           | web-impl     | done   | verifier: `just check` exit 0; 8 node tests; WebKit browser project blocked (libs); commit 588abc9 |
| B.5 first retro                                                            | curator      | done   | 13 proposals, 12 approved (1 changed), 1 rejected; applied; `just check` exit 0 incl. hooks-test   |

## M1 (early) — frontend window before the merge engine (session 2, human-directed)

Intent (human, 2026-10-09): build the frontend now, no Rust backend. The window with editor
and buttons that do nothing yet. Dark, JetBrains look (plan §2 row 24). File list shows only
the sample file.
Acceptance: the window opens in WebKit with a file list (one sample file), a toolbar (apply
non-conflicting from left/right, undo, redo, reset file, mark resolved — inert), and three
panes: local (read-only) | result (editable, undo by keyboard) | remote (read-only), with
empty connector gaps; TS highlighting; bundled JetBrains Mono in all panes.
Non-goals: chunks, bands, connectors, scroll sync, gutter arrows, store/ChunkSource, any Rust.
Dependencies added by orchestrator: `@codemirror/{state,view,commands,language,lang-javascript}`,
`@lezer/highlight`, `@fontsource/jetbrains-mono` (all listed in architecture §7 / cm6-rules).

| slice                                                                                   | owner    | status             | evidence                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.W window: three panes + JetBrains-dark chrome, inert buttons (`briefs/1.W-window.md`) | web-impl | running (rework 1) | patch applied; implementer: lint/typecheck/test/fmt/sfc-order/build exit 0; WebKit smoke: editable `[false,true,false]`, keyword `#CF8E6D`, undo restores BASE, buttons inert; reviews: both pass, 2 should + 3 nit → `briefs/1.W-rework-1.md` (palette reset, scroll evidence, fixture spacing) |
| 1.F import-rule test, owed since retro 0.0 (`briefs/1.F-fences-test.md`)                | web-impl | running (rework 1) | patch applied; implementer: lint/typecheck/test/fmt exit 0, 13 tests; reviews: both pass, 4 should + 1 nit → `briefs/1.F-rework-1.md` (tests that survive deleting the feature, PM5 outside `src/`)                                                                                              |

Resume (if this session dies): first-round patches are committed (intermediate commit, so isolated
reworks see them). After both reworks: read their reports, spot-check, one verifier run over
both, then the wave commit.

## M0 — Rust, headless

| slice                                      | owner     | status | evidence |
| ------------------------------------------ | --------- | ------ | -------- |
| 0.1 merge-core                             | rust-impl | todo   |          |
| 0.1' gitio                                 | rust-impl | todo   |          |
| 0.2 session                                | rust-impl | todo   |          |
| 0.3 cli + goldens + merge-file cross-check | rust-impl | todo   |          |
| Gate C: PhpStorm comparison on 10 goldens  | human     | todo   |          |

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
