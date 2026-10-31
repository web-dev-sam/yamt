# Work board

Durable state of the build: open work only. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9. A closed feature's section
moves to `docs/slices/archive/board.md` (`just archive-board "<heading start>"`); search it, never read it whole.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Release 0.6.4 (session 40, owner: "release next patch version")

0.6.4 = 0.6.3 plus `--ai` carried from `yamt --diff --ai` and range windows to the changes window a merge request's
Show Diff opens (plan §2 #144), and the Windows test gating (tests only). The owner pushes `main`, waits for green
ci, then tags.

| row | slice                                                                                                        | owner        | status      | evidence                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | release commit 0.6.4: `Cargo.toml`/`Cargo.lock`, `CHANGELOG.md`, README (`.readmer/readme.json` + `readmer`) | orchestrator | done        | `d3a64cc3`                                                                                                                                                                                                                                                                                |
| 2   | final run 0.6.4 before tagging (`briefs/release-0.6.4-verify.md`)                                            | verifier     | done        | `Release064Verify`: gate pass; readmer, licences; `yamt_0.6.4_amd64.deb` Version `0.6.4`, `yamt 0.6.4`; release binary: Show Diff child `… --repo /tmp/yamt-rel64-rr --ai` with `--ai`, none without; 11 two-line rows; Resolve !21 → merge window, unmerged. Notes `Release064Verify.md` |
| 3   | push `main`, ci green on all four jobs, tag `v0.6.4`, publish (`handoff-release-0.6.4.md`)                   | human        | handed over |                                                                                                                                                                                                                                                                                           |

## Line-range threads (session 41, planning; owner #2051: "open discussions on a range of lines by dragging, like in gitlab")

Request `docs/slices/request-line-ranges.md` (rules 1–10, acceptance, non-goals, slice graph); facts
`.omp/run/notes/PlanScoutRangeThreads.md`. One product question open (a range across both columns; recommended no).
Starts in a new session: `Implement docs/slices/request-line-ranges.md`.

| row | slice                                                                               | owner     | status | evidence |
| --- | ----------------------------------------------------------------------------------- | --------- | ------ | -------- |
| 1   | design: anchor shape, file format step, GitLab `line_code` rule, editor drag/tint   | designer  | todo   |          |
| 2   | Rust: range anchor in `yamt-review`, post body with `line_range`, command, bindings | rust-impl | todo   |          |
| 3   | editor: drag on line numbers, tint, range kept visible under collapse               | web-impl  | todo   |          |
| 4   | window: drafts, place text, AI value, hover, fixtures (wires the window)            | web-impl  | todo   |          |
| 5   | final run: `just check`, WebKit, real app; owner check on his GitLab playground     | verifier  | todo   |          |

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
