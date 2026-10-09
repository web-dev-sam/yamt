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

| slice                                                                                                      | owner    | status | evidence                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | -------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.W window: three panes + JetBrains-dark chrome, inert buttons (`briefs/1.W-window.md`)                    | web-impl | done   | verifier: `just check` exit 0, build exit 0; WebKit smoke (rework 1): editable `[false,true,false]`, each pane scrolls alone (own scrollTop 644/553/444, others 0), keyword `#CF8E6D`, only yamt colours (`--color-red-500` empty), undo restores BASE, six buttons inert; sample changes ≥ 7 lines apart; screenshot `/tmp/yamt-1W-window.png` |
| 1.F import-rule test, owed since retro 0.0 (`briefs/1.F-fences-test.md`)                                   | web-impl | done   | verifier: `just check` exit 0; 17 import-rule tests pass on the real tree incl. window files; rework 1: four failing-path proofs (query stripping, `.ts`/`.vue` resolution, PM5 only inside `src/`)                                                                                                                                             |
| Gate C (early): owner looks at the window in WebKit                                                        | human    | done   | owner 2026-10-09: "the look is accepted"                                                                                                                                                                                                                                                                                                        |
| retro after early M1 (findings #33–#50)                                                                    | curator  | done   | Gate D 2026-10-09: 9 proposals — 7 approved, 1 approved changed (component names: written rule, no check on plans), 1 deferred (self-breaking test check: decide when window work resumes); applied; `just hooks-test` 10/10                                                                                                                    |
| 1.U remove unused `log` export so the new unused-export check passes (`briefs/1.U-unused-log-export.md`)   | web-impl | done   | `pnpm unused` exit 1 naming `log  src/ipc/log.ts:68:14` before, exit 0 after; both reviews pass, no findings; verifier: `just check` exit 0 incl. `web-unused`                                                                                                                                                                                  |
| palette test: colours only from `style.css` `@theme` (approved at retro, owner: with the next window work) | web-impl | todo   |                                                                                                                                                                                                                                                                                                                                                 |

## M0 — Rust, headless

Intent (owner go-ahead 2026-10-09): the engine before more window work — highlighting, bands
and apply arrows need the chunk data, which comes from Rust types via generated bindings
(vision 2). Acceptance (plan §5): chunk boundaries match what PhpStorm shows on the same
conflict, judged by the owner on 10 real conflicts. Non-goals: any window change, Tauri, IPC.
Wave 1 = 0.1 + 0.1' in parallel (`briefs/0.1-merge-core.md`, `briefs/0.1'-gitio.md`); deps
pre-added by orchestrator: merge-core `imara-diff`, `serde`, `specta`, dev `proptest`; gitio
`thiserror`, `tracing`, dev `tempfile` (workspace).

| slice                                                                                      | owner     | status  | evidence                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 merge-core                                                                             | rust-impl | done    | rework 1 (names, shared-edit generator, proptest 4 emptiness; mid-file BothSame cases 3 → 23 of 512); reviews pass (2 nits logged); verifier: `just check` exit 0, 31 Rust tests; sample smoke: 7 chunks, kinds match the sample's design                                                                                                                                                          |
| 0.1' gitio                                                                                 | rust-impl | done    | rework 1 (pipe deadline + test, non-blob read, absolute git path, comments, macOS-safe test); reviews pass (2 nits logged); verifier: `just check` exit 0; 18 tests incl. RK1/RK2/RK5/RK15/RK17 gitio-level; smoke `unmerged()` == `git ls-files -u`                                                                                                                                               |
| 0.2 session + shared test-repo crate (`briefs/0.2-session.md`)                             | rust-impl | done    | 2 rework rounds (decode order across sides, reset coverage incl. add/add + never-finished, new reasons `Symlink`/`Submodule` so one odd file no longer blocks the merge, submodule reset); reviews pass; verifier: `just check` exit 0, 52 Rust tests; RK1/2/3/5/6/15/16/17 each mapped to a passing test; smoke: CRLF file finish → `\r\n` intact, reset → `ls-files -u` identical + markers back |
| 0.3 cli: classify/scan/golden/fixture + `git merge-file` cross-check (`briefs/0.3-cli.md`) | rust-impl | running | owner go-ahead 2026-10-09; `M0S3Cli` (isolated)                                                                                                                                                                                                                                                                                                                                                    |
| 0.3' 10 real goldens from public TS/TSX/Vue projects (`briefs/0.3'-goldens.md`)            | task      | running | owner 2026-10-09: public projects (plan §2 #26); `M0S3Goldens` (isolated)                                                                                                                                                                                                                                                                                                                          |
| Gate C: PhpStorm comparison on 10 goldens                                                  | human     | todo    |                                                                                                                                                                                                                                                                                                                                                                                                    |

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
