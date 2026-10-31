# Work board

Durable state of the build: open work only. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9. A closed feature's section
moves to `docs/slices/archive/board.md` (`just archive-board "<heading start>"`); search it, never read it whole.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Release 0.6.3 (session 40, owner: "release the next patch version")

0.6.3 = everything after `v0.6.2` (`88086cb`): the merge-request conflicts feature (size, merge status, Resolve,
Continue, Abort, push), the row opening its GitLab page, and this session's row work (true merge status on
gitlab.com, two-line coloured row, cursor). The owner pushes `main`, waits for green ci, then tags.

| row | slice                                                                                                                                                                                       | owner        | status | evidence                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | release commit 0.6.3: `Cargo.toml`/`Cargo.lock`, `CHANGELOG.md`, README (`.readmer/readme.json` + `readmer`, merge-request paragraphs ported from hand edits)                               | orchestrator | done   | `578886f9`                                                                                                                                                                                                                                                                   |
| 2   | final run 0.6.3 before tagging (`briefs/release-0.6.3-verify.md`)                                                                                                                           | verifier     | done   | `Release063Verify`: gate pass; readmer, licences; `yamt_0.6.3_amd64.deb` Version `0.6.3`, `yamt 0.6.3`; release binary: 11 two-line rows, colours, Resolve !21 → merge window + "Continue merging" disabled, Abort → develop clean, record gone. Notes `Release063Verify.md` |
| 3   | push `main`, ci green on all four jobs, tag `v0.6.3`, publish (`handoff-release-0.6.3.md`)                                                                                                  | human        | done   | published 2026-10-31 with ci red on windows-2025 only (owner: "I dont care too much about windows atm"); fix in row 4                                                                                                                                                        |
| 4   | windows-2025 ci: 10 yamt-app tests run `scripts/mr-conflict-repo.sh` directly (`os error 193`, run 41187872315); gate them `cfg(unix)` like every other test of that script (`MrWindowsCi`) | rust-impl    | done   | `a0ed7d52`; Linux 168/168 still run; clippy `--target x86_64-pc-windows-msvc -D warnings` clean; correctness pass (#2045 nit dropped); `just check` exit 0                                                                                                                   |
| 5   | push `main`; windows-2025 green proves row 4                                                                                                                                                | human        | done   | ci run 41189732015 on `29c06125`: success, all four jobs                                                                                                                                                                                                                     |

## Release 0.6.4 (session 40, owner: "release next patch version")

0.6.4 = 0.6.3 plus `--ai` carried from `yamt --diff --ai` and range windows to the changes window a merge request's
Show Diff opens (plan §2 #144), and the Windows test gating (tests only). The owner pushes `main`, waits for green
ci, then tags.

| row | slice                                                                                                        | owner        | status  | evidence |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------ | ------- | -------- |
| 1   | release commit 0.6.4: `Cargo.toml`/`Cargo.lock`, `CHANGELOG.md`, README (`.readmer/readme.json` + `readmer`) | orchestrator | done    |          |
| 2   | final run 0.6.4 before tagging (`briefs/release-0.6.4-verify.md`)                                            | verifier     | running |          |
| 3   | push `main`, ci green on all four jobs, tag `v0.6.4`, publish (`handoff-release-0.6.4.md`)                   | human        | todo    |          |

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
