# Work board

Durable state of the build: open work only. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9. A closed feature's section
moves to `docs/slices/archive/board.md` (`just archive-board "<heading start>"`); search it, never read it whole.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Merge-request conflicts: size, readiness, resolve in yamt with abort (session 39, owner request #1995: "plan 2, 7, 8 (with abort)")

Request `request-mr-conflicts.md` (rules 1–10). Answers: merge in the user's own checkout (#1995), ask before pushing
(#1996), Continue from the row (#1997), conflicts first (#1998). Design option A (`briefs/mr-conflicts-design.md`,
plan §2 #138–#143): new crate `yamt-local-merge`. Owner's go: session 40 ("Implement request-mr-conflicts.md"). Before
`local`: root `Cargo.toml` gains the `crates/local-merge` member and workspace dep (orchestrator). After `app`:
`just bindings`. `page` wires the feature: its commit starts the smoke pass. Risk rows RK43–RK47 (design §4.8) go
into the register with the builds that prove them.

| row | slice                                                                                                                    | owner                 | status  | evidence                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | design (`briefs/mr-conflicts-design-brief.md`) (`MrConflictsDesign`)                                                     | designer              | done    | option A, 6 builds, ~7,400 lines `[INFERENCE]`; notes `MrConflictsDesign.md`                                                                                                                                                                          |
| 2   | `git`: gitio branch/fetch/push runs (`briefs/mr-conflicts-git.md`) (`MrConflictsGit`)                                    | rust-impl             | running | `45b9d94`: 15 tests, mutants 26 caught 0 kept. Reviews: boundary pass, correctness fail; blocks #1999–#2002 → `MrConflictsGitR1` (`briefs/mr-conflicts-git-rework-1.md`) running. Notes `MrConflictsGit.md`                                           |
| 3   | `gitlab`: size, readiness, fork, `prepare_resolve` (`briefs/mr-conflicts-gitlab.md`) (`MrConflictsGitlab`), beside row 2 | rust-impl             | review  | `c4577bd`: 12 tests. Reviews: boundary pass (#2003, #2004 dropped), correctness fail; blocks #2005, #2006 → `MrConflictsGitlabR1` (`briefs/mr-conflicts-gitlab-rework-1.md`) when a slot frees. Bindings wait for row 4. Notes `MrConflictsGitlab.md` |
| 4   | `local`: crate `yamt-local-merge` (`briefs/mr-conflicts-local.md`) (`MrConflictsLocal`), after row 2                     | rust-impl             | running |                                                                                                                                                                                                                                                       |
| 5   | `app`: commands, window claim, second window (`briefs/mr-conflicts-app.md`) (`MrConflictsApp`), after rows 3, 4          | rust-impl             | planned |                                                                                                                                                                                                                                                       |
| 6   | `window`: merge window Abort restore, push question (`briefs/mr-conflicts-window.md`) (`MrConflictsWindow`), after row 5 | web-impl              | planned |                                                                                                                                                                                                                                                       |
| 7   | `page`: size, readiness icon, Resolve/Continue (`briefs/mr-conflicts-page.md`) (`MrConflictsPage`), after row 6          | web-impl              | planned |                                                                                                                                                                                                                                                       |
| 8   | docs keeper, final run                                                                                                   | docs-keeper, verifier | todo    |                                                                                                                                                                                                                                                       |

## Release 0.6.2 (session 38, owner request #1975: "merge this branch into main and release 0.6.2 … but fix CI before, windows and mac failed")

`feat/merge-requests` has no commit outside `main` (merged in `2a4b7af`): nothing to merge. `v0.6.1` (`0927634`) is
tagged; its ci run failed on macOS and Windows in the merge-request tests (#1976). 0.6.2 = that fix plus the CI
changes after 0.6.1's release commit (cache, macOS 15). The owner pushes `main`, waits for green ci, then tags.

| row | slice                                                                                        | owner        | status      | evidence                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | merge-request tests on macOS and Windows (`briefs/mr-portable-tests.md`) (`MrPortableTests`) | rust-impl    | accepted    | `c171d5c`: tests only (product question: no — every path key comes from git). macOS form reproduced on Linux via symlinked TMPDIR: fail before, pass after; cross `cargo check --tests` clean. Reviews pass; #1977–#1980 dropped. Notes `MrPortableTests.md` |
| 2   | release commit 0.6.2: `Cargo.toml`/`Cargo.lock`, `CHANGELOG.md`, README                      | orchestrator | done        | `34c5369`                                                                                                                                                                                                                                                    |
| 3   | final run 0.6.2 before tagging (`briefs/release-0.6.2-verify.md`)                            | verifier     | done        | `Release062Verify` at `655dcee`: gate pass; readmer, licences; merge-request tests through a symlinked TMPDIR pass; `yamt_0.6.2_amd64.deb` Version `0.6.2`, `yamt 0.6.2`; release binary: 5 rows, job → opened.log. Notes `Release062Verify.md`              |
| 4   | push `main`, ci green on all four jobs, tag `v0.6.2`, publish (`handoff-release-0.6.2.md`)   | human        | handed over |                                                                                                                                                                                                                                                              |

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
