# GitOpsCleanupWeb - notes (web-impl, 3.J row 11b)

Output fields verbatim.

All five items are done: a Save or another write that git answers with `StopMovedOn` now ends the stop the window shows, instead of listing again and again.

**summary**
- `reportFailure` (`ui/problem.ts`) now logs a `StopMovedOn` failure and calls `nextStop({ kind: "outside" })` instead of listing again. `Relist` is gone; the targets that only used it now ask for `nextStop` through `EndsStop`. Continue still lists again after a git refusal, so its target keeps its own `refreshFiles`.
- **Problem bar:** a `StopMovedOn` failure no longer shows it. `nextStop` clears the problem anyway, and the moved-on notice says the same thing.
- **The `StopMovedOn` words in `problemText.ts`:** I kept them, but no path shows them at runtime any more. Only the `list` and `settings` problems can still carry that cause, and only by type: Rust's `list_stop` answers `Listing::MovedOn` instead (`src-tauri/src/merge.rs:85`), and the settings commands never reach `Merge::session()`. Removing the words would need those two cause types narrowed.
- `summaryLabel` uses one `Readonly<Record<keyof MergeSummary, { one; many }>>` table, walked in the order changes, conflicts, remembered; output is unchanged. `useMergeController.test.ts` now uses the imported `MergeSummary`, with `remembered` in its literals.
- `FileMark.vue` has one table per status (`Unresolved: null`) and draws the name too, with the muted class for `Resolved`; `FileList.vue` and `FileTree.vue` pass only the status and the label. `ui/AGENTS.md` names `FileMark.vue` and the `StopMovedOn` rule; the fixture sentence in `ipc/AGENTS.md` now matches the code.

**files_changed**
- `frontend/src/ui/problem.ts`, `saving.ts`, `aborting.ts`, `views.ts`, `diskChanges.ts`, `listing.ts`, `continuing.ts`, `summaryLabel.ts`
- `frontend/src/ui/FileMark.vue`, `FileList.vue`, `FileTree.vue`
- `frontend/src/ui/store.test.ts`, `saving.test.ts`, `aborting.test.ts`, `stops.test.ts`, `listing.test.ts`, `useMergeController.test.ts`
- `frontend/src/ui/AGENTS.md`, `frontend/src/ipc/AGENTS.md`

**tests_added**
- `store.test.ts` "a %s git answers StopMovedOn ends the stop: the old views dropped, the moved-on notice shown, the new stop listed once", for both save and take. It runs the real store: the next list answers `Files` for `c.ts`. It checks the call order is exactly `listStop, loadFile a.ts, saveFile|takeSide, listStop, loadFile c.ts`, that only `c.ts` is open and active, that the moved-on notice names `a.ts`, that there is no problem, and that the failure is logged as `store.<write>_failed {path, kind: "StopMovedOn"}`.
- Rewritten:
  - `saving.test.ts` "a %s git answers StopMovedOn goes on to the new stop and shows no problem": finish, save, reset and take each call `nextStop` with `outside`, and no problem is set.
  - `aborting.test.ts` "an abort git answers StopMovedOn goes on to the new stop and shows no problem".

**smoke_evidence**
- **Item 1 test on today's code** (the code at `05f08a0` extracted to `/tmp` with `git archive`, plus the new `store.test.ts`): `pnpm exec vitest run --project node src/ui/store.test.ts -t "answers StopMovedOn ends the stop"` gave
  ```
   FAIL  |node| src/ui/store.test.ts > a take git answers StopMovedOn ends the stop: …
  - Expected  + Received
    [ "listStop", "loadFile a.ts", "takeSide", "listStop",
  -   "loadFile c.ts",
    ]
   Tests  2 failed | 94 skipped (96)
  ```
  The save case also failed; only the take case's diff is pasted.
- **Same test on the new code:** `Test Files  1 passed (1)` / `Tests  2 passed | 94 skipped (96)`.
- **WebKit screenshots:** two sessions with `just app-session start-fixture --size 1400x900` (MiniBrowser through `just webdriver`), one from the old code, one from the new.
  - Steps in each: Mark resolved → "Save Current Result" on `language-tools-script-setup.ts` (resolved); `nuxt-island-test.ts` (unresolved, selected); `remembered.ts` (showcase `remembered`).
  - Shots: list dark → "View as tree" → tree dark → Settings → Light → Back → tree light → "View as list" → list light.
  - Paths: `/tmp/yamt-3j/{before,after}-{list,tree}-{dark,light}.png`.
  - Compared the file-list panel, `magick compare -metric AE` on the crop `495x1728+0+0`: `list-dark AE=0`, `tree-dark AE=0`, `list-light AE=0`, `tree-light AE=0`.
  - The only differences anywhere are inside the editor panes (merge area), outside the panel.
  - The DOM keeps the same classes, and `role="img"`, `title` and `aria-label` on the remembered mark. The only change is the trailing space after the word: `" resolved "` → `" resolved"`.
- **Recipes:**
  - `pnpm -C frontend typecheck`: `$ vue-tsc -b`, exit 0
  - `pnpm -C frontend test`: `Test Files  126 passed (126)`, `Tests  1748 passed (1748)`
  - `pnpm -C frontend lint`: `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0
  - `pnpm -C frontend unused`: `$ knip --include exports,types`, no findings
  - `pnpm -C frontend fmt:check`: `All matched files use the correct format.`
  - `just sfc-order`: clean

**deviations_from_brief**
- `docs/architecture.md` and the project-map skill (`.omp/skills/project-map/SKILL.md`) still say `reportFailure` "lists again on `StopMovedOn`". Both are read-only for me; they should become "goes to `nextStop({ outside })` on `StopMovedOn`".
- `EndsStop` spells out its parameter as `{ readonly kind: "outside" }` instead of importing `StopEnd`. `stops.ts` imports `problem.ts`, so the import would make a cycle that `import/no-cycle` flags.
- `summaryLabel.ts` has a `LABEL_ORDER` array next to the table, because a `Record` can't be walked with typed keys without `as`.
- `FileMark.vue`'s table has an extra `mutesName` flag per mark, which carries the muted name for `Resolved`.
- I ran `pnpm -C frontend install --frozen-lockfile --offline` in the worktree, which created `frontend/node_modules` (gitignored).

**open_risks**
- `frontend/src/ui/problem.ts:110`: `nextStop` now runs inside the write's claim (`saving.ts` `holding`). `dropStop` clears the claim map, and the `finally` deletes only its own claim, so a claim the new stop makes on the same path survives. No test covers the new stop opening that same path.
- `frontend/src/ui/problemText.ts:15`: the `StopMovedOn` words remain only for the type-only `list` and `settings` paths described above.

Checks for Main to run: `just check`, and `just mutants 05f08a0`.

## Mutants on changed TS lines (`b56f16e` vs `2f3d4ce`): 14, all killed.

## Boundary re-check (GitOpsCleanupWebBoundary): fail, block #1438; should #1439

```json
{
  "verdict": "fail",
  "round": "3.J-cleanup-web fix-round re-check (b56f16e), RV8 scope: #1422-#1426, #1435 window half",
  "findings": [
    {
      "severity": "block",
      "rule_id": "review-protocol block (2): decision copied instead of shared",
      "file": "frontend/src/ui/continuing.ts",
      "line": 74,
      "problem": "The rule that `StopMovedOn` goes to `nextStop({ kind: \"outside\" })` is now written in two places: `reportFailure` (problem.ts:110-113) and Continue's own branch here. The copies already disagree: `reportFailure` logs `store.<action>_failed {…, kind: \"StopMovedOn\"}`, but Continue's copy logs nothing. ui/AGENTS.md:13 also documents two places ('through `problem.ts` `reportFailure` …, Continue in `continuing.ts`'), so the next change to the rule has to be made twice.",
      "fix": "Make `refused` run `await reportFailure(target, { action: \"continue\", operation: operation.kind, cause }); if (cause.kind === \"Git\") { await target.refreshFiles(); }`. This drops its own StopMovedOn branch. `ContinueTarget`'s `nextStop(end: StopEnd)` already satisfies `EndsStop`. In continuing.test.ts:294, expect the `store.continue_failed {operation: \"Merge\", kind: \"StopMovedOn\"}` log line. Change ui/AGENTS.md:13 and :21 to say every `StopMovedOn`, Continue's included, goes through `reportFailure`."
    }
  ],
  "checked": [
    "#1435 Relist gone: no `Relist`/`relist`/'lists again' left in frontend/src, docs/architecture.md or the project-map skill. The 'lists again' left at ui/AGENTS.md:21 is Continue's Git refusal, which is correct.",
    "#1435 EndsStop: `{ nextStop(end: { readonly kind: \"outside\" }) }` (problem.ts:47) is a compiler-checked structural subset of `StopEnd`'s outside variant. If that variant gains a field, every store/test `nextStop(end: StopEnd)` assignment fails to type-check, so it is not a silent second source of truth. Importing `StopEnd` would form a cycle, because stops.ts:7 value-imports `report` from problem.ts and oxlint has `import/no-cycle: error` with no `ignoreTypes` (.oxlintrc.json:19). Deviation accepted.",
    "#1435 target types: saving.ts `WriteTarget`, aborting.ts `AbortTarget`, views.ts `reload`, diskChanges.ts `applyDiskChanges` ask only for `EndsStop`. listing.ts `ListTarget` drops `refreshFiles` and keeps `nextStop(StopEnd)` for `Listing::MovedOn`. continuing.ts keeps `refreshFiles` only for the Git refusal (continuing.ts:79-81).",
    "#1435 behaviour: `reportFailure` logs, then calls `nextStop` with no problem set (problem.ts:106-116). nextStop's clearStop sets `problem` to null anyway (stops.ts:46), and the moved-on notice carries the message (stops.ts:56-58). The orchestrator's decision in the finding is followed.",
    "#1435 concurrency: several reloads from `applyDiskChanges`' `Promise.all` that are all answered `StopMovedOn` end the stop once. The first `nextStop` → `dropStop` marks the token dropped (saving.ts:93-94), and `landed` (currentStop.ts:3-6) turns later replies into null before `reportFailure`.",
    "#1435 open risk 'nextStop inside a write's claim' accepted: `holding`'s finally deletes only `target.writing.get(path) === claim` (saving.ts:71-73), and `dropStop` clears the map first, so a claim the new stop makes on the same path survives.",
    "#1435 problemText `StopMovedOn` words kept: no runtime path shows them. `listing.ts:24` `report({ action: \"list\" })` cannot get `StopMovedOn`, because `Merge::list_stop` opens the next stop from `MovedOn` and answers `Listing::MovedOn` for a fresh move (src-tauri/src/merge.rs:85-111). The only session producers are writes.rs:140 and operation.rs:149 (Abort/Continue). Settings commands never reach `Merge::session()`. The exhaustive `OPERATION_STATE_WORDS` Record and the `causedText` switch require the case while `ProblemCause = SourceFailure | Unexpected`. They could only be removed by narrowing the list and settings causes, so keeping them is accepted. Its words ('the list is being read again') describe the old behaviour, but nobody can see them.",
    "#1435 tests: store.test.ts:2561 runs the real store for save and take. It shows one second `listStop`, old views dropped, the moved-on notice and no problem, and the notes show it failing on 05f08a0. saving.test.ts:744 and aborting.test.ts:146 were rewritten to `ends: [\"outside\"]`.",
    "#1422 summaryLabel: `SUMMARY_WORDS: Readonly<Record<keyof MergeSummary, Words>>` is the single words table. A new `MergeSummary` key is a compile error there. `LABEL_ORDER` is the walk order, which the Record cannot give without `Object.keys(...) as`. It repeats the key set without an exhaustiveness check, so a future key would drop out of the label without an error. That is a should-level drift risk, under the RV8 bar. Output is unchanged: changes, conflicts, remembered, ' · ', 'All changes processed'.",
    "#1423 useMergeController.test.ts: `type Summary = MergeSummary` is imported, and every literal at :22, :102 and :358-377 carries `remembered`.",
    "#1424 FileMark.vue: one `Readonly<Record<FileEntry[\"status\"], Mark | null>>` (`FileEntry[\"status\"]` is bindings' `FileStatus`) with `Unresolved: null`. One element is rendered from the table. The remembered mark keeps `role=img`/`title`/`aria-label`, and the resolved mark gets none, as before.",
    "#1425 the muted name now lives only in the table (`mutesName`, one owner). FileList.vue:111 and FileTree.vue:82 pass only `status` and `label`. The tree's folder rows keep their own truncate span, which is not a file status look. WebKit AE=0 on the panel crops for list/tree × dark/light (notes).",
    "#1426 ui/AGENTS.md:15 names FileMark.vue and its table. ipc/AGENTS.md:1 matches the code: `?operation=`, `?rewords`, `?empty` (fixtureOperations.ts:102-110), and `search` is a required parameter (fixture.ts:236-238).",
    "PM2/PM3/PM5: no new import edges. FileMark.vue imports only `vue`, `~icons/lucide/*` and a type from `../ipc`. All ownership is within `frontend/src/ui/**` plus `frontend/src/ipc/AGENTS.md`."
  ]
}
```


## Correctness re-check (GitOpsCleanupWebCorrectness): fail, block #1440 (fix in Rust)

```json
{
  "verdict": "fail",
  "scope": "RV8 re-check of b56f16e, #1435 window half only (reportFailure → nextStop on StopMovedOn, its callers, the claim open risk, the store test). #1422–#1426 (FileMark, summaryLabel) were outside this round's Target and were not reviewed.",
  "findings": [
    {
      "severity": "block",
      "rule_id": null,
      "file": "frontend/src/ui/aborting.ts",
      "line": 52,
      "problem": "If git moved on outside yamt and the user then presses Abort, the moved-on notice for their unsaved edits is lost and the list is fetched twice. The cause: `operation_still_here` answers StopMovedOn (crates/session/src/operation.rs:149, pinned by session/tests/operations.rs:110), and `on_worker` puts the old session back as `Merge::Held` (src-tauri/src/merge.rs:163). The new `reportFailure` then calls nextStop, which sets the notice and lists. That `listStop` sees the moved-on stop and answers `Listing::MovedOn` (merge.rs list_stop → refresh_stop). listing.ts:28 starts a second nextStop inside the first. By then `opened` is already `[]`, so `unsavedFiles()` (stops.ts:52) is empty. The second clearStop then wipes the first one's `movedOn` notice (stops.ts:43). The window lands on the new stop without saying why yamt did not close or that edits were dropped. Before this patch the same press reported the problem and listed once (`refreshFiles` → MovedOn), so exactly one nextStop ran and the notice stayed. Continue's unchanged StopMovedOn path (continuing.ts:75) has the same double nextStop; the patch now extends it to Abort.",
      "fix": "Make 'StopMovedOn means the stop is gone' hold in Rust too. In `on_worker`, when the worker returns `Err(yamt_session::Error::StopMovedOn)`, set `*lock(state) = moved_on(&session)` instead of `Merge::Held(session)`. Then the window's single listStop opens git's stop and answers Files once. Add a merge/tests.rs case: git moves on outside, `abort_operation` (and `continue_operation`) answers StopMovedOn, the state is `MovedOn`, and the next `list_stop` lists step 2."
    }
  ],
  "checked": [
    "#1435 target behaviour: problem.ts:106-116 now logs a StopMovedOn failure and calls `nextStop({kind:'outside'})` with no `report`; any other cause is reported as before.",
    "Every reportFailure caller was walked: saving.ts finish:130, take:156, reset:185, written (save):220; views.ts reload:65 (reached from take/reset and diskChanges); aborting.ts:52; store.ts load:271. Each returns straight after reportFailure. take's `return true` after a failed reload is safe: clearStop bumps `latestOpen`, so thenMoveOn's `untouched` is false and moveOn does nothing.",
    "Panic path (Merge::MovedOn, merge.rs:166-170): the write or abort answers StopMovedOn → nextStop → list_stop opens `open_after` and answers Files, so nextStop runs once.",
    "Write after a Continue `Stopped` (Held new session, writes.rs:140 version check): list_stop answers Files, so the new stop is listed once.",
    "Open risk (claims) accepted. dropStop marks C1 overtaken and clears the map. holding's finally (saving.ts:63-69) deletes only when `writing.get(path) === C1`. C1 is never set again after the clear: holding sets it only on entry, and whileWriting takes `writing.get(path) ?? freeClaim()` from the cleared map. So a claim C2 the new stop makes on the same path survives the old write's finally.",
    "Open risk (late replies) accepted. Any other old-stop write still in flight resolves through `landed(stop)` with `stop.dropped === true` → null → returns; a pending Save format resolves to null, and `claim.overtaken` is true, so `written` is skipped. The write that called reportFailure touches no state after nextStop returns.",
    "Continue unchanged: continuing.ts only swapped `Relist` for its own `refreshFiles` member. StopMovedOn → nextStop outside, Git → report + refreshFiles, still pinned by continuing.test.ts:294.",
    "store.test.ts:2561 runs the real store (`createStoreWithTheme`, store.test.ts:75-77) with a fake ChunkSource. Going back to `report` + `refreshFiles` would fail it: no `loadFile c.ts`, `opened` stays a.ts, and the problem is set. The implementer's notes show it failing on 05f08a0. A second nextStop on these paths would add a third `listStop` and fail the exact `calls` check. It does not cover Abort or Continue against a Held session that git moved on from (the finding above).",
    "saving.test.ts 'a %s git answers StopMovedOn goes on…' (finish/save/reset/take) and aborting.test.ts:146 fail if the nextStop call is removed: `ends` is expected to be ['outside'] and `problem` null.",
    "No new import edge: `EndsStop` spells out `{kind:'outside'}`, so problem.ts → stops.ts is not imported (stops.ts already imports problem.ts); deviation accepted.",
    "No survivor list came with this task, so there was nothing to triage (the notes ask Main to run `just mutants 05f08a0`).",
    "No tests were run; the finding comes from reading merge.rs, operation.rs, listing.ts and stops.ts."
  ]
}
```
