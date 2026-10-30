# Work board

Durable state of the build: open work only. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9. A closed feature's section
moves to `docs/slices/archive/board.md` (`just archive-board "<heading start>"`); search it, never read it whole.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Merge-request row opens in the browser (session 39, owner request #1981: "in the MR list I want an entry to by clickable and open the MR in the users browser")

Goal: a click on a merge request's row in the merge-request page (compare and range windows) opens its GitLab page in
the system browser. Acceptance: the whole row is clickable except its CI box and open-changes button (unchanged); the
title is the keyboard target; a row is not clickable when GitLab is not on https; a refused/failed open shows in the
page's one problem line. Non-goals: links in threads, AI answers, Markdown; a context menu. Decision `plan.md` §2 #137
(amends #133: one opener rule for job and merge-request pages). Base `88086cb`. `MrPageWeb` wires the window: its
commit starts the smoke pass.

| row | slice                                                                                            | owner                 | status   | evidence                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------ | --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | rename to `WebPage`/`PageOpened`/`open_page`, row page (`briefs/mr-page-rust.md`) (`MrPageRust`) | rust-impl             | accepted | `4389bbb` + fix `7bde4c5` (#1983: GitLab under a sub-path keeps it): crate 48 pass, app `merge_requests::` 3 pass, mutants 0 kept; reviews pass (#1982, #1984 dropped). Notes `MrPageRust.md`, `MrPageRustR1.md`                                                                                          |
| 2   | row click, keyboard, problem line, fixture (`briefs/mr-page-web.md`) (`MrPageWeb`), after row 1  | web-impl              | accepted | `0b71c37`: smoke `MrPageSmoke` 8/8 pass. Fix `fc89cbf` (`MrPageWebR1`: #1985/#1990 empty CI slot opens, #1989 open button stops the click, #1986 step `mergeRequest`, #1987/#1991 one tooltip): 3252 tests, WebKit re-run pass, mutants 0 kept on changed lines; both re-checks pass                      |
| 3   | docs keeper, final run (`briefs/mr-page-verify.md`)                                              | docs-keeper, verifier | done     | `MrPageDocs`: `map-check: ok`. `MrPageVerify` at `e514ac2`: `just check` pass; fixture 1a–1g pass; real app `opened.log` `…/merge_requests/12`, `…/jobs/301`. Empty-CI-slot step missed by WebDriver's element click (#1992/#1993 dropped: recipe artefact, pointer click opens). Notes `MrPageVerify.md` |

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
