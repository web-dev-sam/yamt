# GitOpsStopsR1 — notes (web-impl, 3.J row 6 fix round 1)

Output fields verbatim.

Row 6's fix round is in, and every Acceptance check passes. Nothing from an old stop survives into the next one: a question about the stop closes with it, and late replies (writes, format answers, reloads, Abort) change nothing. That "late reply changes nothing" rule is now written once, in `saving.ts` `landed(stop, call)`.

```
summary
- A stop is a `Stop` token (`{ dropped }`) held in `Writing.stop`. `dropStop` marks it dropped, makes a new one, marks every claim overtaken and clears them.
- `landed(stop, call)` in `saving.ts` returns null once the stop is dropped. It is the only place the late-reply rule is written. Save, finish, take, reset, the format step, Abort and every reload use it.
- `nextStop` dismisses a waiting stop question (`question.ts` `endsWithStop`: unprocessed and abort; exit, clash and servers questions stay open). It also clears `formatOutcomes`, which is now a store ref written only by `createSaving`. It reports `stopped` through `report`.
- A failure answered `StopMovedOn` lists again through `problem.ts` `reportFailure`, so "the list is being read again" is now true. "A merge counts no steps done" is written once in `operationText.ts`. `nextStop: state.nextStop`.
- `ui/AGENTS.md` now has accurate Questions, "Listing and stops" and Abort paragraphs.

files_changed
- frontend/src/ui/{saving,stops,store,listing,aborting,diskChanges,problem,question,operationText,views}.ts
- frontend/src/ui/{saving,stops,aborting,listing,operationText}.test.ts
- frontend/src/ui/AGENTS.md

tests_added
- stops.test.ts, block 1:
  - "a Mark resolved question waiting when the stop ends ends with it: a Yes afterwards sends no finishFile"
  - "an Abort question waiting when the stop ends ends with it: a Yes afterwards aborts nothing"
  - "a question that is not about the stop stays open across it" (exit question; protects `endsWithStop`)
- stops.test.ts, #1379 (item 8):
  - "moved on outside to a stop that lists no file shows no message"
  - "moved on outside from a stop that recorded no operation: the notice says Git moved on"
  - "continued to a stop that lists no file …" now expects the new stop's CherryPick while the old stop was a Rebase
- stops.test.ts, existing tests extended: the first test also expects formatOutcomes cleared; the claim test now also expects the old Stop dropped and a fresh one.
- saving.test.ts:
  - "a %s answered %s after dropStop changes nothing": 16 cases (save/finish/take/reset × written/changed on disk/refused/moved on). files, taken, choices, problem, opened, notices and formatOutcomes must stay the same objects; no marks, loads or lists (#1370, #1378).
  - "a format answer after dropStop records no format note and writes nothing" (#1369)
  - "a reload still waiting when the stop is dropped leaves opened and problem as the new stop has them": fetched view and failure cases (#1377)
  - "a %s git answers StopMovedOn is reported and lists again …": 4 cases (#1373, item 6)
- aborting.test.ts:
  - "an abort git answers StopMovedOn lists again, so the window goes on to the new stop"
  - "an abort answered after its stop was dropped reports nothing and lists nothing"
- operationText.test.ts, #1380 (item 9):
  - "a patch whose progress git did not record has a line without a count"
  - "a patch's tooltip holds the line and the patch message trimmed; an empty message adds nothing"

smoke_evidence
- Seen failing: I temporarily put round 1's behaviour back, one line per fix:
  - `landed` returned the reply even when the stop was dropped
  - the dismiss in `clearStop` never ran
  - `reportFailure` did not list again
  - round 1's stops.ts survivors: `true && listed…`, `operation.value!.kind`, `operation: before`
  - operationText survivors: `progress!.total`, `message` without trim
  `vitest run stops/saving/aborting/operationText` → "Tests  33 failed | 56 passed (89)". Every new test above failed, including both stops.test block 1 tests, both reload cases, all 16 late-reply cases, the format case, all 4 relist cases, the 3 #1379 cases and the 2 am cases. All reverts were restored; stops.ts and operationText.ts are back to their pre-revert snapshot tags, and the next full run passed.
- pnpm -C frontend typecheck → `$ vue-tsc -b`, exit 0
- pnpm -C frontend test → "Test Files  121 passed (121)", "Tests  1687 passed (1687)"
- pnpm -C frontend lint → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings
- pnpm -C frontend unused → `$ knip --include exports,types`, no findings
- pnpm -C frontend fmt:check → "All matched files use the correct format."
- store ≤ 300: `wc -l` → 277 frontend/src/ui/store.ts (saving.ts 283)
- Real app. Built with `cargo tauri build --debug --no-bundle` and started with `just app-session start-app --name stops --repo /tmp/yamt-test-stops-r1`. The repo is a rebase of 2 feature commits, and both steps conflict in src/board.ts (same path):
  - top line "Rebasing feature onto main · 1 of 2"; click "Mark resolved" → open dialog "Unprocessed Changes … 1 unresolved conflict still remains … Save Current Result / Back to Resolving"
  - terminal: `git checkout --ours -- src/board.ts && git add -A && GIT_EDITOR=: git rebase --continue` → "Rebasing (2/2) … CONFLICT (content): Merge conflict in src/board.ts"
  - `git ls-files -s src/board.ts` after the continue: stages 1 b68e31f…, 2 dfcdd81…, 3 7aac71e…
  - focus-away / focus-back → `{"top":"Rebasing feature onto main · 2 of 2","dialogs":[],"files":["src/board.ts"]}`
  - press Enter, then `git ls-files -s src/board.ts` → same three stages (b68e31f / dfcdd81 / 7aac71e); screenshot /tmp/yamt-stops-r1-step2.png
  - I did not run round 1's code in the real app for contrast.

deviations_from_brief
- `frontend/src/ui/views.ts` (granted by Main): `reload` and the `report` import were removed from it. The guarded `reload(target, path, stop)` now lives, private, in saving.ts, because views.ts cannot import saving.ts without an import cycle.
- To avoid the cycle saving → diskChanges → saving, diskChanges.ts `applyDiskChanges` became `noteDiskChanges` (notices and taken only, sync, returns the shown paths). `changedOnDisk` was folded into `afterWrite`. saving.ts `applyDiskChanges(target, changes, when, stop)` reloads; listing and `afterWrite` call it.
- Claims lost their `dropped` flag; the shared `Stop` token replaces it (one notion of "the stop is current", as Main asked). `dropClaims` was renamed `dropStop`.
- `afterWrite` takes the stop as a 4th argument.
- Each action takes `target.stop` before it calls (finish and Abort before asking their question).
- refreshFiles returns null when its stop was dropped during its reloads. Otherwise a nested `nextStop` would be followed by the outer list opening the old stop's first file.
- Not asked for:
  - A failed `open` (store `load`) that is still current also goes through `reportFailure`. So does a failed reload. The StopMovedOn words are then true there too.
  - Take Side moved to saving.ts as `take`, and its reload now runs inside the claim.
  - The store's finish and takeSide share `thenMoveOn`.
  - State creation moved into `createState` to keep `createAppStore` ≤ 40 lines.
- `Saving` no longer exposes `formatOutcomes`. It is a store ref (`FormatOutcomes` type in saving.ts); ServerStatus.vue reads `store.formatOutcomes` unchanged.
- State's `loadFiles`, `refreshFiles` and `nextStop` are now readonly function properties, because `nextStop: state.nextStop` tripped `unbound-method` otherwise.
- I used `vi.waitFor` plus resolver arrays rather than `Promise.withResolvers`: the tsconfig lib is older than ES2024.
- The real-app run used a two-step repo I scripted in /tmp (script since deleted). In `scripts/operations-repo.sh`'s rebase, the two steps conflict in different files, so there is no same-path file at the new stop.
- The project map and architecture still need the doc lines (orchestrator's #1372 part): formatOutcomes is a store-owned ref; `landed`, `dropStop`, `reportFailure`, `endsWithStop`; diskChanges' `noteDiskChanges`; views.ts without `reload`.

open_risks
- frontend/src/ui/stops.ts:35: only unprocessed and abort questions close with the stop. An exit question stays and still names files whose edits were just dropped.
- frontend/src/ui/aborting.ts:46: when an Abort reply arrives after its stop was dropped, the only thing that runs is `running = false`. If git did abort, Rust ends the window, so nothing is lost.
- frontend/src/ui/listing.ts:39: the stop is taken after the list reply. A `Files` reply that was in flight while another list ran `nextStop` is still applied ([INFERENCE] Rust answers in order, so it is the current list).
- frontend/src/ui/problem.ts:106: `StopMovedOn` → `refreshFiles` → `MovedOn` → `nextStop` relies on Rust answering the new stop after `MovedOn`; there is no loop guard.
```

Main should run `just check`, `just map-check` (after the doc lines above) and `just mutants` on `ui/{saving,stops,listing,aborting,problem,question,operationText,diskChanges,store}.ts`.