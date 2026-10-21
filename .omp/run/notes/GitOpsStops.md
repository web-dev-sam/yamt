# GitOpsStops — notes (web-impl, 3.J row 6)

Output fields verbatim.

**summary**

Row 6 is built and every brief check passes. The one exception is the exit status: in the real app I saw `yamt: rebase aborted` on stderr, but the test harness can't capture the exit code, so "exit 1" was not observed.

- **One list:** start, focus and every action now list through `listStop`. `ui/listing.ts` sets `files`, `operation` (replacing `merging`) and `sideNames` from the same reply, and is their only writer. On `MovedOn` it calls `nextStop({ kind: "outside" })`. `loadSideNames` and its call in `main.ts` are gone.
- **`ui/stops.ts` `nextStop`:** clears every per-stop state, drops and marks overtaken every write claim, bumps `latestOpen`, then lists as at start, which opens the new stop's first file. On `outside` with unsaved edits it adds one moved-on notice naming them; on `continued` to an empty stop it shows git's message. The store exposes it as the `nextStop(end)` action for row 8.
- **`ui/operationText.ts`:** every operation word — `operationLine` (plan #87's words, tooltip with the full commit message) and `abortLabel` from the contract, plus `abortTitle`, `abortMessage` and `operationName`.
- **`ui/OperationBar.vue`:** the top line, first row of the right column, not shown when no operation is recorded.
- **Abort per operation:** `AbortState` is `{none} | {ready|running, operation}` and Abort calls `abortOperation`. The question names the operation and counts `step - 1` steps already done; a merge's question is #74's text word for word. Button and menu labels come from `listedButtons`; the id `abortMerge` and stored decisions are unchanged. A refusal reads "Could not abort the rebase: …".

**files_changed**
- `frontend/src/ui/{store,listing,aborting,question,problemText,noticeText,diskChanges,saving,toolbarButtons,problem}.ts`
- `frontend/src/ui/{App,MergeToolbar,ToolbarMenu,NoticeBar}.vue`
- `frontend/src/main.ts`
- `frontend/src/ipc/fixture.ts`, `frontend/src/ipc/fixture.test.ts`, `frontend/src/ipc/fixtureOperations.test.ts`
- New: `frontend/src/ui/{stops,operationText}.ts`, `frontend/src/ui/OperationBar.vue`
- Tests updated: `store.test.ts`, `saving.test.ts`, `noticeText.test.ts`, `problemText.test.ts`, `question.test.ts`, `toolbarButtons.test.ts`
- New tests: `stops.test.ts`, `listing.test.ts`, `aborting.test.ts`, `operationText.test.ts`

**tests_added**
- **`operationText.test.ts`:**
  - each operation's line in #87's words;
  - no count for a single pick, a missing sequence or a single patch;
  - a missing name drops only its part (incl. "detached HEAD", no upstream, empty subject);
  - tooltip carries the commit message;
  - every `abortLabel` and `abortTitle`;
  - the merge abort text is #74's verbatim;
  - steps already done are counted for rebase, cherry-pick and `am`, and none are named at step 1.
- **`stops.test.ts`:**
  - each per-stop state is cleared before the list;
  - the list runs after `latestOpen` is bumped;
  - a running write's claim is dropped and marked overtaken;
  - the notice appears only with unsaved edits and names the operation and every file;
  - no notice for `continued`;
  - `continued` to an empty stop shows git's message, worded;
  - no message when files are listed or the list failed.
- **`listing.test.ts`:** `Files` sets files, operation and names in one go; `MovedOn` calls `nextStop` and sets nothing; a failed list keeps the old operation and names.
- **`aborting.test.ts`:** no Abort without an operation; the state follows the listed operation; git is called only after a yes; a press while running asks nothing; a refusal names the operation in words and in the log; a later press asks again.
- **`question.test.ts`:** merge text unchanged; the rebase question counts 2 replayed commits.
- **`saving.test.ts`:** after `dropClaims`, late save and finish replies change nothing, and a new claim on the same path outlives the old one's end (catches the old `finally` deleting the new claim).
- **`store.test.ts`:** a focus list answering `MovedOn` drops the old stop, opens the new stop's first file, names the dropped edits, and `dismissNotice("movedOn")` closes the notice.
- **Others:** `noticeText.test.ts` covers the moved-on wording and a file named `movedOn` keeping its own key; `problemText.test.ts` covers abort wording per operation and the `stopped` problem; `toolbarButtons.test.ts` covers labels per `AbortState`.

**smoke_evidence**
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit 0.
- `pnpm -C frontend test` → `Test Files  121 passed (121)`, `Tests  1655 passed (1655)`.
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings.
- `pnpm -C frontend unused` → `$ knip --include exports,types`, no findings.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- **Fixture page in WebKit** (`just app-session start-fixture`, which starts the dev server and `just webdriver`), navigating to each `?operation=` and right-clicking the toolbar:
  - merge: `"Merging feature/reminders into main"`, menu `["Abort merge", …]`
  - squash: `"Squash-merging feature/reminders into main"`, `["Abort squash merge", …]`
  - rebase: `"Rebasing feature/reminders onto main · 1 of 3"`, `["Abort rebase", …]`
  - cherry-pick: `"Cherry-picking 3f1c2a9 Add reminder dates · 1 of 3"`, `["Abort cherry-pick", …]`
  - revert: `"Reverting 3f1c2a9 Add reminder dates · 1 of 3"`, `["Abort revert", …]`
  - am: `"Applying patch 1 of 3: Add reminder dates"`, `["Abort patch application", …]`
  - none: top line `null`, menu `["Previous change","Next change",…]`
  - `?operation=rebase` headers: `"Local (yours): 3f1c2a9 Add reminder dates"` (hover `"Add reminder dates\n\nCards keep a due date."`), `"Remote (theirs)"`.
  - Screenshots: `/tmp/yamt-stops/rebase-dark.png` and `rebase-light.png` (top line above the toolbar in both themes), `/tmp/yamt-stops/abort-question.png` ("Abort Rebase", no replayed-commit sentence at step 1).
- **Real app** (`cargo tauri build --debug --no-bundle`, `scripts/operations-repo.sh rebase /tmp/yamt-test-ops-rebase`, `just app-session start-app --name ops …`):
  - Top line `"Rebasing feature onto main · 1 of 3"`; headers `"Local (yours): 6badc74 feature: board columns, logo and notes"` / `"Remote (theirs): f564603 main: …"`.
  - Typed "typed in yamt " into `src/board.ts`'s Result without saving (only that Result's text contains it).
  - In a terminal: `git -C … checkout --theirs -- . && git -C … add -A && GIT_EDITOR=: git -C … rebase --continue` → `Rebasing (2/3) … CONFLICT (content): Merge conflict in src/card.ts`.
  - After `focus-away` / `focus-back`: `{"top":"Rebasing feature onto main · 2 of 3","files":["src/card.ts"],"notices":["The rebase moved on outside yamt; your unsaved edits in src/board.ts were dropped"],"problem":null}`, screenshot `/tmp/yamt-stops/app-step2.png`.
  - Abort rebase → question: `"Abort Rebase\n\nEvery resolution and every save in this rebase will be lost, and so will unsaved edits. The 1 commit already replayed is undone too. The repository goes back to how it was before the rebase, and yamt closes.\n\nAbort Rebase\nCancel"`. After confirming, the app was gone (`stop` listed no app process); `git status` → `On branch feature / nothing to commit, working tree clean`; `rev-parse HEAD` = the pre-rebase tip `6d22892…`.
  - Second run (`/tmp/yamt-test-ops-rebase2`): the app's stderr in the driver log ended with `yamt: rebase aborted`; HEAD = feature = pre-rebase `b3dd4aa…`.
  - **Not observed: the exit status 1.** The app is launched by tauri-driver, which does not report its exit code. Row 5's `outcome.rs` test covers it.

**deviations_from_brief**
- #1354 (granted): `createFixtureSource(log, search, files = FIXTURE_FILES)`. `search` is required, there is no `typeof location` branch, and `main.ts` reads `window.location.search` once, beside `?servers`. The parameter order changed because a required parameter can't follow an optional one; all callers in `fixture.test.ts` and `fixtureOperations.test.ts:33` are updated (both granted). `fixture.test.ts` now imports its types from `./index`, so knip still sees `FileList` used now that `store.test.ts` no longer needs it.
- `NoticeBar.vue` and `problem.ts` (granted):
  - `Notice` is a sum type, `disk` | `movedOn`; rows come from `noticeRow`, keyed by `noticeKey` (`disk:<path>` / `movedOn`). `dismissNotice` takes that key, and `noticeText`/`noticeCloseLabel` are replaced by `noticeRow`.
  - `Problem` gains `operation: OperationKind` on `abort` (row 8 can add `continue` beside it) and a new `{ action: "stopped"; operation: OperationKind | null; message }`. It is logged at info as `store.stopped` and never cleared by a path.
- `ToolbarMenu` lost its `buttons` prop. Labels now live in `toolbarButtons.ts` (`ListedButton`), so the Abort label is typed only when an operation exists.
- To stay ≤ 300 lines, the store's `reset` moved into `saving.ts` (290 / 205 lines now).
- Take Side now runs under `whileWriting`, like Reset and Mark resolved, so its late reply after a new stop is ignored too.
- Claims gained a `dropped` flag. `holding` deletes a path only while the claim is still its own. `whileWriting` hands its callback the claim.
- Abort words for `Am` follow Rust's `patch application` ("Abort patch application"); titles are title case ("Abort Cherry-Pick").
- The moved-on notice says "Git moved on outside yamt" when the old stop recorded no operation.
- The abort-test cases moved from `store.test.ts` to `aborting.test.ts`; the side-names test was replaced by `listing.test.ts`.
- **Docs I couldn't edit (map-check / PM6 will fail until someone adds them):**
  - `skill://project-map`, `docs/architecture.md`: `ui/stops.ts`, `ui/operationText.ts`, `ui/OperationBar.vue`; the state table's `merging` row becomes `operation` (written by `listing.ts`), and `notices` gains the moved-on notice.
  - `ui/AGENTS.md`'s Abort paragraph (`merging`, `noMerge`) is stale.
- I did not build on fixture `listStop` answering `Files` after `Finished` (#1355).

**open_risks**
- `frontend/src/ui/listing.ts:25`: `MovedOn` → `nextStop` → `loadFiles` → list again. If git kept answering `MovedOn` this would loop; Rust's contract is that the list after `MovedOn` opens the new stop.
- `frontend/src/ui/stops.ts:28`: `formatOutcomes` (the format note per path, kept inside `createSaving`) is not cleared on a new stop, so a note for a path the new stop also lists stays.
- A `reload` from disk changes, already running when `nextStop` clears, can still put an old-stop view back. `load` is protected by `latestOpen`; `reload` in `views.ts` (not owned) is not.
- `StopMovedOn`'s words say "the list is being read again", but nothing re-lists on that error until the next focus or row 8.
- Abort and Continue on a stop with no editable file (choice, deleted-side and empty headers) are row 8. In the app, the first file shown at a rebase stop was the deleted-side `docs/notes.md`, which has no toolbar, so Abort needed another file opened first.

Main should run `just check`, `just map-check` (after the doc lines above), and `just mutants` on `ui/{stops,operationText,listing,aborting,saving,toolbarButtons,noticeText,problemText,question,problem}.ts` and `ipc/fixture.ts`.

## Boundary review (GitOpsStopsBoundary): fail

Blocks #1369/#1370; shoulds #1371–#1373, nits #1374/#1375. Mutants on changed lines: `.omp/run/notes/GitOpsStops-mutants.md`.

## Correctness review (GitOpsStopsCorrectness): fail

Blocks #1376–#1378; shoulds #1379–#1381, nit #1382; orchestrator #1383 → row 9. Dropped survivors: see the review's `checked` (unreachable defaults, logs, path-less notices).
