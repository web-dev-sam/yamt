# Work board

Durable state of the build: open work only. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9. A closed feature's section
moves to `docs/slices/archive/board.md` (`just archive-board "<heading start>"`); search it, never read it whole.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Release 0.6.5 (session 42, owner: "release the next patch version")

0.6.5 = 0.6.4 plus line-range threads (plan §2 #145–#148; section below; the owner's GitLab playground check, its
row 8, is still open). The owner pushes `main`, waits for green ci, then tags.

| row | slice                                                                                                        | owner        | status      | evidence                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | release commit 0.6.5: `Cargo.toml`/`Cargo.lock`, `CHANGELOG.md`, README (`.readmer/readme.json` + `readmer`) | orchestrator | done        | `86e49122`                                                                                                                                                                                                           |
| 2   | final run 0.6.5 before tagging (`briefs/release-0.6.5-verify.md`)                                            | verifier     | done        | `Release065Verify`: gate pass; readmer, licences; `yamt_0.6.5_amd64.deb` Version `0.6.5`, `yamt 0.6.5`; release binary: both range headers, `threads.json` format 2, back after restart. Notes `Release065Verify.md` |
| 3   | push `main`, ci green on all four jobs, tag `v0.6.5`, publish (`handoff-release-0.6.5.md`)                   | human        | handed over |                                                                                                                                                                                                                      |

## Line-range threads (session 42; owner #2051: "open discussions on a range of lines by dragging, like in gitlab")

Request `docs/slices/request-line-ranges.md` (rules 1–10, acceptance, non-goals); facts
`.omp/run/notes/PlanScoutRangeThreads.md`. Owner's answer #2052: a range may cover both sides (rule 2). Design
`briefs/line-ranges-design.md` option A, plan §2 #145–#148, risks RK48–RK51. Designer's two questions decided by the
orchestrator (OR13, plan #147/#146): an unchanged end posts with no `type`, as GitLab's own form (GitLab shows
"lines 201 to +204"); the first change writes format 2 (rule 9 already accepts an older yamt refusing it).

| row | slice                                                                                                                       | owner       | status      | evidence                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | design: anchor shape, file format step, GitLab `line_code` rule, editor drag/tint                                           | designer    | done        | `LineRangesDesign`: option A, five briefs                                                                                                                                                                               |
| 2   | rust (`briefs/line-ranges-rust.md`): `ThreadPlace`, format 2, `line_range` body, command                                    | rust-impl   | done        | `69317a2b` + R1 `96aef718` (#2053 #2054 #2058–#2060: empty side numbered 0); R1 re-review both pass. Notes `LineRangesRust*.md`                                                                                         |
| 3   | domain (`briefs/line-ranges-domain.md`): ipc types, fixtures, seeded range threads                                          | web-impl    | done        | `0f212e89` + R1 `4b692682` (#2061: isOneLine same-kind ends, 4 fail on a kind-only mutant); reviews pass. Notes `LineRangesDomain*.md`                                                                                  |
| 4   | editor (`briefs/line-ranges-editor.md`): order, drag, tint, collapse; beside row 5                                          | web-impl    | done        | `fea69c87` + R1 `cfa85f42` (#2067–#2071 #2073–#2076: tint 45 % layer, one diff walk, rAF follow, cleanup tests; WebKit 27/27 on private copy, failing-path shown); R1 re-review both pass. Notes `LineRangesEditor*.md` |
| 5   | window (`briefs/line-ranges-window.md`): drafts, place text, AI value, hover; wires the window                              | web-impl    | done        | `3002735e`; 1636 tests, 775 mutants killed, 1 equivalent kept; both reviews pass (#2062–#2064 dropped); smoke C/D pass. Notes `LineRangesWindow*.md`                                                                    |
| 6   | docs keeper: architecture §3.8, project map rows for the three new editor files                                             | docs-keeper | done        | `LineRangesDocs`: architecture §3.8/§5.1/§5.2, tree/state/map, ipc-contract `add_thread(file, place, text)`; map-check ok. Notes `LineRangesDocs.md`                                                                    |
| 7   | verify (`briefs/line-ranges-verify.md`): smoke after 4+5; final `just check`, WebKit, real app                              | verifier    | done        | `LineRangesFinal` B–D pass (WebKit 27/27 on private copy #1445; fixture C1–C9; real app format 2, ranges back after restart, dark+light); A re-pass `LineRangesFinalRepass`: `just check` pass at `3a145993`            |
| 8   | owner check on the GitLab playground (`scripts/gitlab-playground.sh`): send a range in one column and one across both sides | human       | handed over | expected in GitLab: "Comment on lines 201 to +204" and "Comment on lines -200 to +204" (verify brief, after Acceptance)                                                                                                 |

## Local conflict check (session 43; owner #2079–#2080: "check it ourself locally and keep it cheap")

Request `docs/slices/request-local-conflict-check.md` (rules 1–8, acceptance, non-goals); measured facts
`.omp/run/notes/PlanLocalConflictFacts.md`. Owner's answers: the local merge decides conflicts (#2079); every open row,
GitLab's commits, never the user's branches or working tree (#2080). Design `briefs/local-conflicts-design.md` option A,
plan §2 #149–#150, risk RK52. The designer's one question (git 2.38–2.49 leaves unreferenced objects) is answered by
rule 6, which already allows them: decided, plan #150 (OR13). No product question open. Strictly sequential: one
implementer at a time; the docs keeper may run beside row 4.

| row | slice                                                                                                                    | owner        | status  | evidence                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | design: measured facts, readiness shape, late results, per-pair memory                                                   | designer     | done    | `LocalConflictsDesign`: option A, three briefs; notes `LocalConflictsDesign.md`                                                                                                                                                                              |
| 2   | gitio (`briefs/local-conflicts-gitio.md`): `merge_tree`, `remote_refs`, `missing_commits`, `Oid: Hash`                   | rust-impl    | done    | `4b1d9ddf` + R1 `06c13efc` (#2081–#2085: one batch-check runner, one failure wording, `GIT_NO_LAZY_FETCH`, no-prompt test) + R2 `e9c13a15` (#2086: partial-clone tests unix-only, so not built on Windows); re-reviews pass. Notes `LocalConflictsGitio*.md` |
| 3   | check (`briefs/local-conflicts-check.md`): query fields, fold, `check_conflicts`, `MergedPairs`, `checked` message       | rust-impl    | done    | `1f7e73e8` + R1 `5b45a3c1` (#2087 #2088 #2091–#2094: one ref rule, shared `commit_at`, panic-safe merges, fetch-failure and memory tests; #2089 #2090 dropped); 257 tests; re-reviews pass. Notes `LocalConflictsCheck*.md`                                  |
| 3b  | `just bindings` after row 3 lands (`Readiness`, `CheckedRow`, `ListMessage`)                                             | orchestrator | done    | in `1f7e73e8`: `CheckedRow`, `mergesCleanly`, `checked` message only                                                                                                                                                                                         |
| 4   | page (`briefs/local-conflicts-page.md`): words, icon, rows updating, `?mr=local` fixture, real app; wires the window     | web-impl     | done    | `ac5cfcc1` + R1 `f73c85c6` (#2096 #2097: readonly `buffered`, `shown` reset on failure, `rechecked` in the core); 3498 tests; WebKit fixture and real app pass; re-review pass. Notes `LocalConflictsPage*.md`                                               |
| 5   | docs keeper: design §4 "Shared edits" (architecture §3.2/§3.5/§3.9/§4/§5.1, tree.md script row, state.md, README:83)     | docs-keeper  | running | `LocalConflictsDocs`, with #2098. README (`.readmer/readme.json` + `readmer`) and CHANGELOG Unreleased by the orchestrator                                                                                                                                   |
| 6   | verify (`briefs/local-conflicts-verify.md`): smoke after row 4; final `just check`, WebKit, real app, unreachable remote | verifier     | planned | smoke `LocalConflictsSmoke` B–C pass at `ac5cfcc1`: fixture labels change after 1.5 s; real app nine labels, Refresh 0 merges/7 remembered; refs, status, HEAD, no FETCH_HEAD identical. Notes `LocalConflictsSmoke.md`                                      |
| 7   | owner check on the GitLab playground: a merge request GitLab marks conflicting after its target moved                    | human        | todo    | the verify brief's "Owner check"                                                                                                                                                                                                                             |

## Merge-request rows for reviewing (session 44; owner #2095: nine additions to the merge-request page)

Request `docs/slices/request-mr-row-details.md` (rules 1–11, acceptance, non-goals, reopens); facts
`.omp/run/notes/PlanScoutMrRowFacts.md`. Owner's answers: request review only from people on the merge request
(#2096); custom tooltip on the merge-request page only (#2097); due ones first, soonest on top (#2098).
Implementation waits for the local conflict check to close (same files); the design runs now.

| row | slice                                                                                                   | owner                 | status  | evidence |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------- | ------- | -------- |
| 1   | design: pictures' route, review write, query cost, tooltip shape, stored filter words, empty size cause | designer              | running |          |
| 2   | Rust: query fields, empty size, pictures, request-review command, fake glab case                        | rust-impl             | todo    |          |
| 3   | one tooltip component for the merge-request page (may fold into row 5)                                  | web-impl              | todo    |          |
| 4   | page core: three-state filters, stored words, count order, days left, labels "+N"                       | web-impl              | todo    |          |
| 5   | page: author, people box, approvers, labels, due date, hover filters, Shift, fixtures; wires the window | web-impl              | todo    |          |
| 6   | docs keeper; final run: `just check`, WebKit, real app                                                  | docs-keeper, verifier | todo    |          |

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
