# Work board

Durable state of the build: open work only. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9. A closed feature's section
moves to `docs/slices/archive/board.md` (`just archive-board "<heading start>"`); search it, never read it whole.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Releases 0.6.0 and 0.6.1 (session 38, owner request #1973: "release branch maintainability to be 0.6.0 and merge this branch into main and make it 0.6.1")

No branch `maintainability` exists; read as `main` (0.6.0-beta.2's product, no product change since) released as
0.6.0, then `feat/merge-requests` (the merge-request overview, owner-accepted #1972) merged into `main` and released as
0.6.1. Release commits change version, changelog and README file names only (0.6.1 also adds the overview's README
sentence). The owner tags and pushes (`docs/slices/handoff-release-0.6.0-0.6.1.md`). Nothing pushed. Closed sections
of `main`'s board moved to `archive/board.md` with the merge (the branch had archived them).

| row | slice                                                                                                    | owner        | status  | evidence                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | release commit 0.6.0 on `main`: `Cargo.toml`/`Cargo.lock`, `CHANGELOG.md` `[0.6.0] - 2026-10-30`, README | orchestrator | done    | `8ece003`                                                                                                                                                                                                                                                                |
| 2   | final run 0.6.0 before tagging (`briefs/release-0.6.0-verify.md`)                                        | verifier     | done    | `Release060Verify` at `ec5c914`: gate pass; `readmer check`, licences no diff; `yamt_0.6.0_amd64.deb` Version `0.6.0` (read with `bsdtar`: no `dpkg-deb` here), `yamt 0.6.0`; merge, range (one POST), compare with the release binary pass. Notes `Release060Verify.md` |
| 3   | merge `feat/merge-requests` into `main`; release commit 0.6.1                                            | orchestrator | done    | merge `2a4b7af` (product files equal to the branch head; conflicts only in changelog and board); release `43461ef`                                                                                                                                                       |
| 4   | final run 0.6.1 before tagging (`briefs/release-0.6.1-verify.md`)                                        | verifier     | running | `Release061Verify`                                                                                                                                                                                                                                                       |
| 5   | push, tags `v0.6.0` (on `8ece003`'s board commit `ec5c914`) and `v0.6.1`, publish both (handoff)         | human        | todo    |                                                                                                                                                                                                                                                                          |

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
