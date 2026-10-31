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

## Line-range threads (session 42; owner #2051: "open discussions on a range of lines by dragging, like in gitlab")

Request `docs/slices/request-line-ranges.md` (rules 1–10, acceptance, non-goals); facts
`.omp/run/notes/PlanScoutRangeThreads.md`. Owner's answer #2052: a range may cover both sides (rule 2). Design
`briefs/line-ranges-design.md` option A, plan §2 #145–#148, risks RK48–RK51. Designer's two questions decided by the
orchestrator (OR13, plan #147/#146): an unchanged end posts with no `type`, as GitLab's own form (GitLab shows
"lines 201 to +204"); the first change writes format 2 (rule 9 already accepts an older yamt refusing it).

| row | slice                                                                                          | owner       | status  | evidence                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------- | ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | design: anchor shape, file format step, GitLab `line_code` rule, editor drag/tint              | designer    | done    | `LineRangesDesign`: option A, five briefs                                                                                                                          |
| 2   | rust (`briefs/line-ranges-rust.md`): `ThreadPlace`, format 2, `line_range` body, command       | rust-impl   | running | `69317a2b`; 79 mutants, 0 kept. Boundary pass; correctness fail: added/deleted file line codes #2058/#2059; fix round `LineRangesRustR1` (#2053 #2054 #2058–#2060) |
| 3   | domain (`briefs/line-ranges-domain.md`): ipc types, fixtures, seeded range threads             | web-impl    | review  | ipc tests 546 pass; mutants on `src/ipc` only (ui tests fail until row 5), 3 equivalent kept. Notes `LineRangesDomain.md`                                          |
| 4   | editor (`briefs/line-ranges-editor.md`): order, drag, tint, collapse; beside row 5             | web-impl    | running |                                                                                                                                                                    |
| 5   | window (`briefs/line-ranges-window.md`): drafts, place text, AI value, hover; wires the window | web-impl    | todo    |                                                                                                                                                                    |
| 6   | docs keeper: architecture §3.8, project map rows for the three new editor files                | docs-keeper | todo    |                                                                                                                                                                    |
| 7   | verify (`briefs/line-ranges-verify.md`): smoke after 4+5; final `just check`, WebKit, real app | verifier    | todo    |                                                                                                                                                                    |

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
