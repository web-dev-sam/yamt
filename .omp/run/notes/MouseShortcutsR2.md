# MouseShortcutsR2 (row 2, rework 2)

## Summary
Done: all three findings are fixed, and every acceptance item ran and passed. The step an action dispatches now carries only the chain's final spans (`placeSpans.of(...)`). `setStatus` is used only inside the throwaway per-change `state.update` calls, and the `effects` accumulator is gone. Because no dispatched transaction carries `setStatus` any more, the undo inversion in `chunkField.ts` now fires only on `docChanged || placeSpans`. The arrow field `otherWaits` is renamed `decidesOther` in gap.ts, strips.ts and gap.test.ts, and apply.test.ts now has a single `spanPairs` helper.

## Smoke evidence
- `set -o pipefail; for c in "pnpm -C frontend lint" "pnpm -C frontend typecheck" "pnpm -C frontend fmt:check" "just sfc-order" "just web-unused"; do $c 2>&1 | tail -2; echo "[$c] exit=$?"; done`

  ```
  $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"
  [pnpm -C frontend lint] exit=0
  $ vue-tsc -b
  [pnpm -C frontend typecheck] exit=0
  All matched files use the correct format.
  Finished in 443ms on 125 files using 24 threads.
  [pnpm -C frontend fmt:check] exit=0
  $ tsx scripts/check-sfc-order.ts
  [just sfc-order] exit=0
  $ knip --include exports,types
  [just web-unused] exit=0
  ```
- `set -o pipefail; pnpm -C frontend test 2>&1 | tail -8`

  ```
  Test Files  41 passed (41)
       Tests  461 passed (461)
  exit=0
  ```
- `wc -l frontend/src/editor/index.ts`

  ```
  299 frontend/src/editor/index.ts (unchanged)
  ```
- `pnpm -C frontend exec vitest run --project node src/editor/internal/apply.test.ts --reporter=verbose | grep -Ei 'touching|undo|redo|equals clicking'`

  ```
  ✓ undo after apply restores text and status; redo re-applies
  ✓ undo after ignore brings the change back; redo ignores it again
  ✓ undo and redo after an arrow or × show that change, not the old cursor at line 1
  ✓ redo of an insert-only apply puts the cursor on the first inserted line
  ✓ typing right after an arrow click is an undo step of its own
  ✓ bulk apply moves a cursor outside the visible lines to the first one; undo returns there
  ✓ bulk apply from the left resolves every LocalOnly change; one undo restores all
  ✓ bulk apply over touching spans whose last deletes an unterminated final line equals clicking each
  ✓ a read-only middle pane refuses Enter, Tab and undo; bulk apply still changes it
  ✓ a disk-seeded block takes ours exactly as the hand resolution, and undo brings the disk text back (Lf)/(CrLf)
  ✓ Ctrl/Cmd apply on a waiting conflict takes that side and ignores the other, as one undo step
  ✓ Ctrl/Cmd ignore on a waiting conflict ignores that side and takes the other, as one undo step
  ✓ a drag released with Ctrl/Cmd decides each covered conflict whole and each other change plainly, as one undo step
  ✓ a Ctrl/Cmd drag over an ignored change touching a conflict it fills equals clicking each   [touching 1]
  ✓ a Ctrl/Cmd ignore dragged over a conflict and a touching zero-line conflict equals clicking each   [touching 2]
  ✓ an apply drag over a change and a touching zero-line conflict equals clicking each   [touching 3]
  Tests 35 passed (35). The drag and history undo tests in other files are in the 461-test run above, all passed: sides.test.ts 'a drag over several icons applies or ignores them as clicking each top to bottom, in one undo step', 'touching spans whose last deletes an unterminated final line: a drag leaves what clicking leaves'; chunkField.test.ts 'one undo restores a merged history event; redo re-applies it', 'deleting all of a chunk's lines collapses it; undo restores the range'; words.test.ts 'a resolved block loses its word marks and bars on every side pane and undo brings them back'. None of these tests was edited except the two whose local `spans` helper was swapped for `spanPairs`.
  ```
- `WebKit step 2: pnpm -C frontend dev --port 5398 --strictPort + just webdriver 4498 (MiniBrowser 2.54.1, windows on the Samsung screen). Fresh session, real pointer click on 'vueuse-use-magic-keys.ts' in the file list. The left pane was moved to around line 129 by setting scrollTop in a script. Then a real WebDriver Ctrl key-down plus pointer down/up at the left apply icon of conflict 8 (682,247.6), and Ctrl+Z as key actions.`

  ```
  Before: l129, r141, c129 = 'cm-line chunk-conflict chunk-band'. Left and right icons both have titles "Apply\nCtrl+click: also ignore the other side" / "Ignore\nCtrl+click: also take the other side".
  After Ctrl+click: l129 'cm-line', r141 'cm-line', c129 'cm-line cm-activeLine' (purple gone); leftIcons [] and rightIcons []; middleHasLocal129to136 true (center 129.. now starts "  useEventListener(target, 'keydown', ..."); activeElement is the middle's cm-content.
  After one Ctrl+Z: l129, r141 'cm-line chunk-conflict chunk-band', c129 'cm-line cm-activeLine chunk-conflict chunk-band'; both sides show the two-line titles again; middleIsOriginal true ("  if (target) {" ...).
  ```
- `WebKit step 7: a new session; real click on 'word-marks.ts'; left pane scrollTop moved by script. With Ctrl held through a key action, a real pointer drag from the left apply icon of conflict 49 (local 163, y 320) to that of conflict 50 (local 166, y 375), then one Ctrl+Z.`

  ```
  Before: l163, l166, r172, r175, c168, c171 all 'cm-line chunk-conflict chunk-band'. middle168to171 = ["const data = fetchUser(id);", "", "// X2 conflict: ...", "import { ref, computed, watch } from 'vue';"]. Left apply icons at y [156,265,320,375,429,...].
  After the Ctrl drag: all six lines are 'cm-line' (c171 'cm-line cm-activeLine'); middle = ["const data = await fetchUser(id);", "", "// X2 ...", "import { ref, watch } from 'vue';"]; the icons at 320 and 375 are gone.
  After one Ctrl+Z: all six lines are 'chunk-conflict chunk-band' again; the icons at 320 and 375 are back; middleIsOriginal true.
  ```
- `pgrep -af "MiniBrowser|WebKitWebDriver|vite --port 5398" || echo none   (run after deleting both sessions, stopping r2-dev and r2-webdriver, and removing /tmp/yamt-r2)`

  ```
  none
  ```

## Deviations from brief
- No exports renamed or removed. The renamed field is `Arrow.otherWaits` → `Arrow.decidesOther`; it also appears through `ArrowShape` (Pick<Arrow, "mode" | "decidesOther">) and `ArrowRow`. The private `ChainedAction` type changed from `{ changes, effects: StateEffect<unknown>[] }` to `{ changes, effect: StateEffect<readonly ChunkSpan[]> }`.
- chunkField.ts:122: `setStatus` was removed from the `invertedEffects` trigger, which is now `tr.docChanged || placeSpans`. No dispatched transaction can carry `setStatus` any more. The only places that create it are the throwaway `state.update` calls in `chainedChanges`, whose history state is thrown away, and geometry.test.ts, a state without history. `setStatus` stays exported because `chainedChanges` and geometry.test.ts use it.
- The WebKit harness was a throwaway ES module in /tmp/yamt-r2 (the tmpdir scratch area the ownership hook allows), deleted afterwards. The panes were scrolled by setting scrollTop in a script, as rework 1 did; every click, drag and key press was a real WebDriver action.

## Open risks
- {"location": "frontend/src/editor/internal/chunkField.ts:122", "risk": "If a future change dispatches `setStatus` with no text change and no `placeSpans` (status alone), the field's undo would no longer restore it, because the trigger no longer lists `setStatus`. No such dispatch exists today (grep: setStatus only in apply.ts chainedChanges and geometry.test.ts)."}
- {"location": "frontend/src/editor/internal/apply.ts:103", "risk": "Still open from rework 1: the action's spans come from the throwaway chain built on `target.state`. They are right only while the state the steps are dispatched on is `target.state` plus the cursor-only step, which is how `dispatchSteps` is used today."}
