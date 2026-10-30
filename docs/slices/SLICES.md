# Work board

Durable state of the build: open work only. The orchestrator updates this file; a fresh session re-hydrates
from it. Slice definitions (files, contracts, acceptance): `docs/architecture.md` §9. A closed feature's section
moves to `docs/slices/archive/board.md` (`just archive-board "<heading start>"`); search it, never read it whole.

Status: `todo` → `planned` (brief written, Gate A passed) → `running` → `review` → `done <evidence>` / `blocked <why>`.

## Merge requests — the GitLab project's open MRs in the diff windows, quick filters, open an MR's changes (session 37, branch `feat/merge-requests` off main `d97a270`, the 0.7.x line)

Owner request #1765 (2026-10-30): an icon button left of the gear in the compare (`--diff`) and range (`--diff=…`)
windows of a GitLab repository opens an overview of the project's open merge requests, newest first; a row shows the
title, `!iid`, "created x ago", open discussions, approvals (single numbers) and the CI status, whose hover lists only
the failed jobs, each opening its log page in the system browser; a button opens the MR's changes; filters on
assignee, reviewer, label and draft, set with one click each. Intent, rules 1–9, acceptance, non-goals, reopened rows
(#94, #112/#115/#118), sourced facts and risks: `docs/slices/request-merge-requests.md`. Four product questions
answered (#1766–#1769): a new window for an MR's changes, the list as a full page like Settings (not the recommended
drop-down), filters remembered per repository, GitLab servers recognised by name only. Design option A chosen
(plan §2 #128–#135): crate `yamt-merge-requests`, offline detection, one GraphQL query paged by Rust (score ~112 of
250), fetch without refs then a second yamt process, failed-job links through std's process run with only the
addresses the list handed out, one page slice per window behind a seam, pure core `frontend/src/mergeRequests/`.
Designer's two open questions: host names → asked (#1769); ssh passphrases → no prompt, orchestrator default (#135).
Deviation accepted: five builds (window split into state and page). `docs/architecture.md`, the project map and
`CHANGELOG.md` stay the orchestrator's, once per feature before the final run (orchestrate §6), not the builds'.
Scout facts at `d97a270`: `.omp/run/notes/PlanScoutMr{Gitlab,Chrome}.md`; design `.omp/run/notes/MrOverviewDesign.md`
(§5 ownership lists, §6 contracts, §7 tests, §8 acceptance steps).

| row | slice                                                                                                                                                                                                                                                     | owner     | status  | evidence                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------- | -------------------------------------------------------------------------------------------------- |
| 0   | the product questions (request file, "Questions")                                                                                                                                                                                                         | human     | done    | #1766 new window; #1767 full page like Settings; #1768 remembered per repository; #1769 names only |
| 1   | design (`briefs/mr-overview-design.md`) (`MrOverviewDesign`)                                                                                                                                                                                              | designer  | done    | option A chosen, plan §2 #128–#135; notes `MrOverviewDesign.md`                                    |
| 2   | R1 · B1 Rust: offline detection and the list — crate `yamt-merge-requests` (detect, project, query, page, list, `JobPage::built`), glab helpers into `yamt-gitio` (review cutover), arch-check, fake-glab GraphQL, scenarios `merge-requests`, `-timeout` | rust-impl | fix     | `7478f81`; blocks #1932 #1933 → `MrDetectListR1` queued; #1934 sent to `MrOpenCommands`            |
| 3   | R1 · B2 window core: `frontend/src/mergeRequests/` (filters, choices, order, summary, relative time, CI box, stored), `ui/glab.ts` (glab sentences and `RECHECK_PAUSE_MS` moved), `ui/mergeRequestFilters.ts`, module lists in fences, oxlint, Vitest     | web-impl  | fix     | `31aec73`; blocks #1926 #1927 #1929; fix round `MrWindowCoreR1` running                            |
| 4   | R2 · B3 Rust: the four commands, opening (fetch, resolve, pair-lock probe, second process), the job-page opener, `range-repo.sh` fake GitLab (!12, !13), `scripts/fake-open/xdg-open`; bindings by the orchestrator                                       | rust-impl | running | `MrOpenCommands`, brief `briefs/mr-open-commands.md`                                               |
| 5   | R2 · B4 window state: `MergeRequestSource`, domain and brands, Tauri and fixture sources (`?mr=`), the page slice and its seam, `screen.ts`, problems, words, both stores                                                                                 | web-impl  | review  | `635f4e5`; 3193 tests; typecheck waits for bindings; list end moves onto the channel (sent to B3)  |
| 6   | R3 · B5 window page: the button, `MergeRequestsView`, rows, filter checklists, CI box, both roots and views, fence PM10, app-session `--diff --dir`, `--mr`, child-window sweep, map-check                                                                | web-impl  | todo    |                                                                                                    |
| 7   | final run: `just check`, WebKit both windows, real app with the fake glab and the fake opener, dark and light (design §8)                                                                                                                                 | verifier  | todo    |                                                                                                    |

Order: the orchestrator adds the crate to the root `Cargo.toml` (shared file) first; then R1 rows 2 ∥ 3, then R2 rows
4 ∥ 5 (5 codes against 4's contract, design §6; `bindings.ts` regenerated by the orchestrator after 4), then R3 row 6,
then the architecture/project-map/changelog pass, then row 7. Building started on the owner's word (session 38,
"Implement"): root `Cargo.toml` lists the crate; R1 briefs `briefs/mr-detect-list.md` (`MrDetectList`),
`briefs/mr-window-core.md` (`MrWindowCore`).

## Open product questions

See `docs/architecture.md` §10. Answered ones move into `docs/plan.md` §2.
