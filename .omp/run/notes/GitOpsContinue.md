# GitOpsContinue — notes (web-impl, 3.J row 8)

Output fields verbatim.

All of row 8 is built and passes every pnpm check. Two acceptance items were checked a different way. "A choice file's header row has Continue and Abort" was confirmed in the real app, because fixture mode has no choice files. StopView, the screen for a stop without conflicts, was never seen on screen. Your #1386 split and the #1387/#1388 tests are done and listed under deviations.

```
summary
- `ui/continuing.ts`: the Continue states (noOperation/filesLeft/writing/ready/running) and the hover words. Clicking asks about unsaved edits first, then the reword question when `editor_steps_ahead` is set, then calls git through `landed`. Replies: Finished → logged, stays running; Stopped → `nextStop({continued, message})`; a Git refusal → problem bar + list read again; StopMovedOn → `nextStop({outside})`; other errors → problem bar.
- One store flag `running` means "git is running a Continue or an Abort". Abort, Continue and `closeGuard` all read it. While it is set, closing is refused with "Git is still running; close yamt when it is done." and no question is asked.
- Toolbar id `continue`: listed only while an operation is recorded, shown at first, its hidden choice stored like the others. Continue is a text button right after "Mark resolved", labelled by `continueLabel`.
- `OperationButtons.vue` (Continue + Abort) sits in the choice view's and the deleted-side view's header rows and in `StopView.vue`, which App shows when an operation is recorded and git lists no files. The all-resolved line now names the next step (`allResolvedText`).
- #1386: `Stop`/`landed` moved to the new leaf `ui/currentStop.ts`, `reload` to views.ts, `applyDiskChanges` to diskChanges.ts.

files_changed
- new: frontend/src/ui/{continuing,currentStop}.ts, frontend/src/ui/{OperationButtons,StopView}.vue, frontend/src/ui/{continuing,closeGuard}.test.ts
- frontend/src/ui/{store,toolbarButtons,question,closeGuard,problem,problemText,operationText,aborting,listing,saving,views,diskChanges}.ts
- frontend/src/ui/{App,MergeToolbar,ChoiceView,MergeView}.vue
- frontend/src/ui/{aborting,listing,operationText,problemText,question,saving,stops,store,toolbarButtons}.test.ts

tests_added
- continuing.test.ts (14):
  - noOperation; filesLeft with counted hover; a held `claimWrite` gives writing; ready (also with no files); running with the terminal hover and a second press ignored
  - unsaved question: No or Escape → nothing runs
  - reword question only with editor_steps_ahead, after the unsaved one; no questions without either
  - Stopped → nextStop with git's message, still running during nextStop, ready after
  - Git refusal → "Could not continue the rebase: hook says no", list read again, ready again; other failure → problem, no relist
  - StopMovedOn → nextStop outside, no problem; Finished → `continue.finished` logged, stays running
  - a late reply after the stop was dropped changes nothing
- closeGuard.test.ts: close refused while running (problem shown, no question, logged); once git is done, the exit question again
- toolbarButtons.test.ts: Continue/Abort listed only with an operation, labels incl. "Commit merge"; Continue hidden by its own decision; Continue shown at first, its toggle stored, the `abortMerge` decision kept; order updated
- operationText.test.ts: `continueLabel` for all six operations; `allResolvedText` for rebase, am, squash merge, none
- question.test.ts: unsaved-continue words for rebase and merge; reword words; `endsWithStop` true for both new questions, false for exit
- problemText.test.ts: continue refusal for 4 operations; the close-refused words
- store.test.ts: "Continue answered Stopped runs the store's own nextStop…" — real store and nextStop; the new stop c.ts is listed, loaded and active, the state is filesLeft (#1381)
- store.test.ts: "a take git refuses stays on the file…" — active stays LOGO, the take problem shown, no describeFile/loadFile of the next file (#1388)
- saving.test.ts: "a reset whose reload is still waiting when the stop is dropped keeps the new stop's open problem" — same problem object, `opened` unchanged, no lists (#1387)

smoke_evidence
- pnpm -C frontend typecheck → `$ vue-tsc -b` (exit 0)
- pnpm -C frontend test → "Test Files  123 passed (123)", "Tests  1723 passed (1723)"
- pnpm -C frontend lint → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings
- pnpm -C frontend unused → `$ knip --include exports,types`, no findings
- pnpm -C frontend fmt:check → "All matched files use the correct format."
- Fixture mode in WebKit (`just app-session start-fixture`, which runs the dev server and `just webdriver`), `?operation=rebase`:
  - before resolving: [["Continue rebase", disabled true, title "11 files are not resolved yet"]]; after one Mark resolved: "10 files are not resolved yet"
  - after all 11: every Continue enabled, title "Continue rebase"; line "All files are resolved. Continue rebase to let git go on."
  - Continue → "Rebasing feature/reminders onto main · 2 of 3", one Continue left (one view open), "11 files are not resolved yet"
  - step 3, then the last Continue → [[true, "Continuing… (if nothing happens, git may be asking for something in the terminal that started yamt)"]]
- `?operation=merge`: "Commit merge" (title "11 files are not resolved yet"); after all resolved, "All files are resolved. Commit merge to commit it."; Commit merge → console `[info] fixture.continue_finished {operation: "merge"}`, `[info] continue.finished {operation: "Merge"}`
- `?operation=rebase&rewords`, all resolved:
  - Continue → dialog "Commit Messages … This step or a later one rewords or squashes a commit. yamt cannot open an editor, so that message stays as git prepares it. … Continue rebase / Cancel"; Cancel → still "1 of 3", Continue enabled
  - typed in the Result, then Continue → "Unsaved Changes … Continue the rebase without saving them? word-marks.ts … Continue Without Saving / Cancel"
  - confirm → the reword question → confirm → "2 of 3"
- `?operation=none`: 0 Continue/Commit/Abort buttons; the header starts with "Mark resolved", "Previous change"
- Screenshots:
  - dark: /tmp/yamt-continue-disabled-dark.png, /tmp/yamt-continue-ready-dark.png, /tmp/yamt-commit-merge-dark.png
  - light: /tmp/yamt-continue-disabled-light.png
  - questions: /tmp/yamt-continue-unsaved-question.png
  - real app: /tmp/yamt-continue-choice-header.png, /tmp/yamt-continue-real-ready.png, /tmp/yamt-commit-merge-real.png, /tmp/yamt-commit-merge-hook.png
  - Native tooltips do not appear in page screenshots; the hover text was read from the `title` attribute.
- Real app (`cargo tauri build --debug --no-bundle`, `scripts/operations-repo.sh`, `just app-session start-app`):
  - (a) rebase, with a scratch wrapper around `--binary` (since deleted) recording yamt's exit status:
    - the deleted-side header row: [["Continue rebase", true, "3 files are not resolved yet"], ["Abort rebase", false]]
    - Keep / Mark resolved / Take left → "All files are resolved. Continue rebase to let git go on."
    - Continue → "Rebasing feature onto main · 2 of 3" with no restart
    - resolve, then Continue → stderr "Successfully rebased and updated refs/heads/feature." "yamt: rebase finished", `exit 0`
    - `git log`: "feature: reminders", "feature: card title", "feature: board columns, logo and notes"; `## feature`, no conflicts left
  - (b) cherry-pick range:
    - "Cherry-picking 74eb6ba … · 1 of 3", choice/deleted header [["Continue cherry-pick", true, "3 files are not resolved yet"], ["Abort cherry-pick", false]]
    - Continue → "Cherry-picking 0d60f8d feature: card title · 2 of 3", log `stop.next … end="continued" operation="CherryPick"`
    - last Continue → "yamt: cherry-pick finished"
    - `git log`: reminders / card title / board columns, each with its own message
    - Exit status not captured in this run; it was captured in (a) and (d).
  - (d) merge (wrapper): Commit merge disabled "4 files are not resolved yet" → after all resolved, Commit merge → "yamt: merge finished", `exit 0`; `git log -1` = "1925554 8ca8433 62efea4 / Merge branch 'feature'" (MERGE_MSG minus git's comment lines)
  - (i) hook:
    - before Mark resolved: [[true, "1 file is not resolved yet"]]
    - Commit merge → problem bar "Could not commit the merge: hook says no", button ready again
    - `git log`: still bf33d60 at the top, `M  src/board.ts`, `.git/MERGE_HEAD` still present (nothing committed)

deviations_from_brief
- Main's reroutes: #1386 (refactor below), #1387 (saving.test reset test), #1388 (store.test take test).
- #1386 refactor:
  - `ui/currentStop.ts` (Stop, landed) imports nothing from ui/
  - `reload` is exported from views.ts; `applyDiskChanges` from diskChanges.ts (`noteDiskChanges` is now private)
  - saving.ts keeps the claims, `dropStop`, `afterWrite` and the four writes
  - listing.ts and aborting.ts type the stop as `{ readonly stop: Stop }` and no longer import saving.ts; stops.ts still imports saving.ts for `dropStop`
  - test imports updated; what the tests assert is unchanged
- aborting.ts's own `running` became the store's shared `running` ref (`AbortTarget.running`). So Abort is disabled while Continue runs and the other way round, and the close refusal covers both.
- `createCloseGuard(asking, opened)` became `createCloseGuard({ asking, opened, problem, running })`.
- New `Problem` variants: `continue` (operation, cause) and `close`. `clearProblemAbout` now checks `"path" in problem` instead of a list of actions.
- New questions `continueUnsaved` (operation, files) and `rewords`. For merge and squash merge the wording is "Commit the merge … without saving them?" / "Commit Without Saving". Titles are "Unsaved Changes" / "Commit Messages"; the cancel button is "Cancel".
- Added to the `createContinuing` result: `continueHover`. Its words live in continuing.ts: putting them in operationText.ts made an import cycle (`import/no-cycle` counts type imports).
- Only a `Git` refusal re-reads the list; other failures go to the problem bar only.
- After Finished the state stays `running`, like Abort after a success.
- The store's `writing` map is `shallowReactive` so `writing` updates live.
- New components (VU15): OperationButtons (Continue/Abort where there is no toolbar; used in 4 places; prop `abort: boolean`, the toolbar passes false) and StopView (the merge area for a stop without conflicts). A ready Continue uses the primary look; when disabled, a wrapping span carries the hover.
- App hides the problem bar for the `stopped` problem while StopView shows git's message.
- question.ts: `unprocessedSentence` became `unprocessedText` so `questionText` stays within 40 lines.
- Test names do not carry "#NNNN": palette.test reads it as a colour literal.
- No `Promise.withResolvers`: the tsconfig lib is older than ES2024.
- "A choice file's header row has Continue and Abort" was checked in the real app, because fixture mode has no choice files.
- Not my files, still to update: project map, architecture.md and ui/AGENTS.md entries for continuing.ts, currentStop.ts, OperationButtons.vue, StopView.vue, the close refusal, `reload` in views.ts and `applyDiskChanges` in diskChanges.ts. Until then `just map-check` will flag the new files.

open_risks
- frontend/src/ui/continuing.ts `continued` (Finished branch): if Rust ever fails to destroy the window after Finished, `running` stays true, so the close is refused for good. aborting.ts after a successful abort has the same risk.
- frontend/src/ui/continuing.ts `continueOperation`: the state is not checked again after the questions; a list change during a modal question is left for git to refuse.
- StopView (frontend/src/ui/StopView.vue, App.vue `stopShown`) was never seen on screen: neither the fixtures nor operations-repo.sh produce a stop without conflicts.
- In the real app the Finished reply never reached the window (it was destroyed first), so `continue.finished` was only seen in fixture mode.
```

Main should run `just check`, `just map-check` (after the doc lines above) and `just mutants` on `ui/{continuing,closeGuard,toolbarButtons,question,problem,problemText,operationText,aborting,views,diskChanges,saving,currentStop}.ts`.