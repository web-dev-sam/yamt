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

| slice                                                                                   | owner    | status | evidence                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.W window: three panes + JetBrains-dark chrome, inert buttons (`briefs/1.W-window.md`) | web-impl | done   | verifier: `just check` exit 0, build exit 0; WebKit smoke (rework 1): editable `[false,true,false]`, each pane scrolls alone (own scrollTop 644/553/444, others 0), keyword `#CF8E6D`, only yamt colours (`--color-red-500` empty), undo restores BASE, six buttons inert; sample changes ≥ 7 lines apart; screenshot `/tmp/yamt-1W-window.png` |
| 1.F import-rule test, owed since retro 0.0 (`briefs/1.F-fences-test.md`)                | web-impl | done   | verifier: `just check` exit 0; 17 import-rule tests pass on the real tree incl. window files; rework 1: four failing-path proofs (query stripping, `.ts`/`.vue` resolution, PM5 only inside `src/`)                                                                                                                                             |
| Gate C (early): owner looks at the window in WebKit                                     | human    | todo   | `pnpm -C frontend dev`, open http://localhost:5173 in Epiphany                                                                                                                                                                                                                                                                                  |

Next: owner looks at the window; then either M1 chunk work on the frontend (fixture-fed) or M0
(Rust merge engine) — owner's call. Retro due at the end of this early-M1 part (findings since
retro 0.0: naming vs lint rule, rework spawn naming, registry must be committed before isolated spawns).

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
