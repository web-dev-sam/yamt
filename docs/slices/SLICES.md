# Work board

Durable state of the build: open work only. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9. A closed feature's section
moves to `docs/slices/archive/board.md` (`just archive-board "<heading start>"`); search it, never read it whole.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Merge-request row in two lines (session 40, owner: "make this more structured. All these info is in one line and misaligned" → picked "Two lines, like GitLab")

| row | slice                                                                           | owner    | status  | evidence |
| --- | ------------------------------------------------------------------------------- | -------- | ------- | -------- |
| 1   | title line, muted details line (`briefs/mr-row-two-lines.md`) (`MrRowTwoLines`) | web-impl | running |          |

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
