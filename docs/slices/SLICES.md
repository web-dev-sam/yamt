# Work board

Durable state of the build: open work only. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9. A closed feature's section
moves to `docs/slices/archive/board.md` (`just archive-board "<heading start>"`); search it, never read it whole.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## GitLab playground and the true merge status (session 40, owner request: "set up ../glab-yamt-playground … vscode tasks")

`scripts/gitlab-playground.sh` fills the owner's gitlab.com project (`samubr/glab-yamt-playground`: four merge
requests, !1 conflicts) and VS Code tasks "gitlab: open the playground in yamt" / "gitlab: reset the playground"
drive it (orchestrator; tooling, not product). Opening it found a real bug: beside `diffStatsSummary` in a list,
GitLab answers `detailedMergeStatus: CONFLICT` for clean merge requests, so every row read "Has conflicts".

| row | slice                                                                 | owner     | status  | evidence |
| --- | --------------------------------------------------------------------- | --------- | ------- | -------- |
| 1   | row size from `diffStats` (`briefs/mr-diff-stats.md`) (`MrDiffStats`) | rust-impl | running |          |

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
