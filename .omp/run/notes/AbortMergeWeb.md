# AbortMergeWeb — 3.A-abort-web (board "Abort merge" row 2)

Brief: `docs/slices/briefs/3.A-abort-web.md`. Base `7b479b1` (row 1 at `5ab9b8b`).

## Summary
File list header: "Abort merge" icon (Lucide `git-pull-request-closed`) left of the list/tree toggle, `v-if` not hidden,
disabled while running and after a success; `h2` gained `mr-auto`. `ui/aborting.ts` `createAborting`: `running` ref,
computed `abortButton: "hidden" | "ready" | "running"` from git's `merging`, `abortMerge()` (guard on "ready", ask,
`attempt(source.abortMerge())`, failure → running false + `report({action:"abort"})`). `merging` ref in the store, written
only by `listing.ts` `refreshFiles`. `question.ts` kind "abort" (`ABORT_TEXT` const), `problem.ts` own union member
`{action:"abort"}` (`store.abort_failed`), `problemText` "Could not abort the merge". `fileListKey` moved to
`ui/fileListKey.ts`; `store.ts` 290 lines.

## Tests (ui/store.test.ts)
yes calls once / No and Escape nothing; press while running asks nothing; refusal shows git's message, keeps files and
views, button ready again, later press asks again; button follows `merging` across two lists. 1357 web tests pass.

## Smoke
Fixture page (WebKit): header order `H2:Files, BUTTON:Abort merge, BUTTON:View as tree`; dialog words exact; Escape and
Cancel → no log; Abort Merge → `[info] fixture.abort_merge {}`, disabled. Screenshots `/tmp/a-abort-header.png`,
`/tmp/a-abort-dialog.png`, `/tmp/a-abort-disabled.png`.
Real app: Cancel → status unchanged, app running; Abort Merge → session terminated, status empty, no MERGE_HEAD, no yamt
process, `yamt: merge aborted`. Refusal: MM made while the app ran (git add + `git restore --source=MERGE_HEAD
--worktree`), no focus cycle → problem bar "Could not abort the merge: … not uptodate …", app stays, status unchanged.
Cherry-pick repo: no button. Terminal commit then focus: button gone.

## Deviations (accepted)
- Refusal recipe: stage + change + focus-away/back did NOT refuse — focus-back staged the changed resolved file
  (plan #52), so the click aborted. A refusal needs the MM state to exist without a focus look settling it (made while the
  window has focus, a file outside the session, or yamt's own Save on a resolved file). Verify brief step c adjusted.
- Fixture smoke used `start-fixture` (its own free ports) instead of a dev server on 5301.
- Map line for `ui/aborting.ts` → orchestrator (project map, §6).

## Open risks
- A press while another question is open gets "dismissed" (asking's rule), so nothing happens.
- A later successful list does not clear the abort problem (only open/save/close/dismiss do).
- Leftover throwaway repos `/tmp/a-refuse-probe`, `/tmp/a-cherry`.
