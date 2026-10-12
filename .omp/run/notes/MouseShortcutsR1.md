# MouseShortcutsR1 (row 2, rework 1)

## Summary
All six findings are fixed. #636: an action transaction now carries the spans that `chainedChanges`' throwaway state ends with, in one exported effect `placeSpans` (the old `restoreSpans`, renamed). The field takes those spans as given, as it does on undo. `newlyApplied` is gone, and `mapSpans`/`updateSpans` are back to the rule from before this slice. No test needs the newer rule (all 461 pass).
#632: one predicate `decidesOtherSide(chunk, status, side)` in status.ts, used by both the hint (`otherWaits`) and `sideDecisions`. #633: `#pressed` skips the press when `!readOnly && modClickAction(...) !== null`.
#634/#637: rows store `otherWaits`. The reuse check is now `keepsArrowRow(row, arrow, layout)` in gap.ts, a pure function with its own test, and titles are built only when a row is built.
#635: the comment clauses are placed as the brief says. #638: renamed to `LETTER_OR_MARK`.

## Files changed
- frontend/src/editor/internal/chunkField.ts
- frontend/src/editor/internal/apply.ts
- frontend/src/editor/internal/apply.test.ts
- frontend/src/editor/internal/status.ts
- frontend/src/editor/internal/gap.ts
- frontend/src/editor/internal/gap.test.ts
- frontend/src/editor/internal/strips.ts
- frontend/src/editor/internal/sideFocus.ts
- frontend/src/editor/internal/modClick.ts
- frontend/src/editor/internal/historyKey.ts

## Tests added
- **apply.test.ts › a Ctrl/Cmd ignore dragged over a conflict and a touching zero-line conflict equals clicking each** — #636, Ctrl/Cmd+ignore variant. The drag's text, spans and statuses equal clicking each change: text 'a\nR1\nR2\nc\n', spans [[2,5],[5,8]]. With the fix reverted it gives [[2,8],[8,8]].
- **apply.test.ts › an apply drag over a change and a touching zero-line conflict equals clicking each** — #636, plain apply-drag variant over [LocalOnly, touching zero-line conflict]. Text and statuses equal clicking each, spans are [[2,4],[4,6]]. With the fix reverted it gives [[2,6],[6,6]].
- **apply.test.ts › a Ctrl/Cmd drag over an ignored change touching a conflict it fills equals clicking each (kept, unchanged)** — The 'touching' case, now pinned by placeSpans. With the fix reverted: [[2,6],[6,6]] ≠ [[2,4],[4,6]].
- **gap.test.ts › an icon row built while the other side waited is rebuilt once that side is ignored** — #634/#637. With the same mode and layout, `keepsArrowRow` keeps a row while `otherWaits` is unchanged, and refuses it once the other side is ignored (mode stays 'replace'). Fails when the otherWaits comparison is dropped.

## Smoke evidence
- `pnpm -C frontend lint && pnpm -C frontend typecheck && pnpm -C frontend test && just sfc-order && just web-unused && pnpm -C frontend fmt:check && echo ALL_EXIT_0`

  ```
  $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"
  $ vue-tsc -b
  $ vitest run --project node
   Test Files  41 passed (41)
        Tests  461 passed (461)
  $ tsx scripts/check-sfc-order.ts
  $ knip --include exports,types
  $ oxfmt --check
  All matched files use the correct format.
  ALL_EXIT_0
  ```
- `wc -l frontend/src/editor/index.ts`

  ```
  299 frontend/src/editor/index.ts (file unchanged)
  ```
- `Revert #636 once: chainedChanges returns `effects: [...effects]` (no placeSpans; mapping rule is the pre-slice one); vitest run src/editor/internal/apply.test.ts`

  ```
  × a Ctrl/Cmd drag over an ignored change touching a conflict it fills equals clicking each
  AssertionError: expected [ [ 2, 6 ], [ 6, 6 ] ] to deeply equal [ [ 2, 4 ], [ 4, 6 ] ]
  × a Ctrl/Cmd ignore dragged over a conflict and a touching zero-line conflict equals clicking each
  AssertionError: expected [ [ 2, 8 ], [ 8, 8 ] ] to deeply equal [ [ 2, 5 ], [ 5, 8 ] ]
  × an apply drag over a change and a touching zero-line conflict equals clicking each
  AssertionError: expected [ [ 2, 6 ], [ 6, 6 ] ] to deeply equal [ [ 2, 4 ], [ 4, 6 ] ]
  Tests  3 failed | 32 passed (35)   (fix restored afterwards)
  ```
- `Revert #634 once: remove `row.otherWaits === otherWaits &&` from keepsArrowRow; vitest run src/editor/internal/gap.test.ts`

  ```
  × an icon row built while the other side waited is rebuilt once that side is ignored
  AssertionError: expected true to be false // Object.is equality
  Tests  1 failed | 11 passed (12)   (restored afterwards)
  ```
- `WebKit steps 2 and 4: pnpm -C frontend dev --port 5397 --strictPort + just webdriver 4497 (MiniBrowser, windows on the Samsung screen). Fresh session, file vueuse-use-magic-keys.ts, left pane scrolled to line 129 via scrollTop. Real WebDriver pointer actions at icon rects; Control held through a key-down action; Ctrl+Z as key actions`

  ```
  Before: left129/right141/center129 = 'cm-line chunk-conflict chunk-band'. Left and right icon titles: "Apply\nCtrl+click: also ignore the other side", "Ignore\nCtrl+click: also take the other side".
  Step 2, Ctrl+click left apply: middleHasLocal129to136 true; left129 'cm-line', right141 'cm-line', center129 'cm-line cm-activeLine' (purple gone); leftIcons [] and rightIcons [].
  One Ctrl+Z: middleIsOriginal true; all three lines are 'chunk-conflict chunk-band' again; both sides show the two-line titles again.
  Step 4, plain click left ignore: left129 'cm-line'; right titles ["Apply","Ignore"] (no hint line; the row was rebuilt through keepsArrowRow).
  Ctrl+click right ignore: right141 'cm-line', rightIcons [], middleIsOriginal true.
  Two Ctrl+Z: everything is back, including the two-line titles on both sides. document.activeElement stays the middle's 'cm-content' throughout.
  ```
- `WebKit step 7: fresh session, word-marks.ts. Control held through a real pointer drag from the left apply icon of conflict 49 (local 163) to that of conflict 50 (local 166)`

  ```
  Before: l163, l166, r172, r175, c168, c171 all 'cm-line chunk-conflict chunk-band'; middle 168–171 starts 'const data = fetchUser(id);' and ends "import { ref, computed, watch } from 'vue';".
  After the Ctrl drag: all six are 'cm-line' (c171 'cm-line cm-activeLine'); middle = 'const data = await fetchUser(id);' … "import { ref, watch } from 'vue';" (local's lines).
  One Ctrl+Z: every class is chunk-conflict chunk-band again and middleIsOriginal is true.
  ```
- `Ctrl drag over a conflict and a touching zero-line change: jq over frontend/fixtures/{golden,showcase}/*.json for any chunk whose middle.start+len equals the next chunk's middle.start`

  ```
  No output. No fixture has touching chunks, so this WebKit step could not run. It is covered by the two new node tests and the 'touching' test.
  ```
- `pgrep -af "MiniBrowser|WebKitWebDriver|vite --port 5397" || echo none (after stopping the dev and webdriver services and removing the /tmp scratch harness)`

  ```
  none
  ```

## Deviations from brief
- Renamed, added and removed exports (for the project map and architecture). chunkField.ts: private `restoreSpans` → exported `placeSpans` (one effect for undo's restore and for the action's spans); `newlyApplied` removed; `mapSpans` takes `StatusChanges` again (the pre-slice rule). status.ts: new export `decidesOtherSide(chunk, status, side)`. gap.ts: new exports `keepsArrowRow(row, arrow, layout)`, `type ButtonLayout` (moved here from strips.ts) and `type ArrowShape` (mode, otherWaits, layout). strips.ts: private `sameShape` removed; `PlacedArrow`/`ArrowRow` no longer carry titles; `ArrowRow` = `ArrowShape` + node + buttons; `arrowRow` takes `platform` and builds the titles. historyKey.ts: `LETTER_OR_VOWEL_SIGN` → `LETTER_OR_MARK`. No files added or removed.
- newlyApplied revert (#636): with placeSpans in place, no test needs the newer rule. Lint, typecheck and all 461 node tests pass with `updateSpans`/`mapSpans` exactly as at a09d2ee, apart from the effect rename (checked with git diff a09d2ee).
- Rule wording to update. CM1: 'A span applied in this transaction maps `to` with +1 …' is now only the rule for single-change transactions (one setStatus with its own text change, i.e. each throwaway step). An action's transaction carries `placeSpans` with the spans its chained throwaway state ends with, and the field takes them as given, as on undo. CM2: undo restores status through the field's `invertedEffects` snapshot (`placeSpans` of the start state), not through `setStatus` being inverted. `setStatus` stays in the action transaction for the side panes' status push and for the inversion trigger. CM7: 'composed into one ChangeSet in its action step' should add 'and the chain's final spans as `placeSpans` in the same step', which is why spans equal clicking one by one. Project map state table, 'chunk current positions' row: 'restored on undo by an invertedEffects effect' → 'set by `placeSpans` on an action and on undo/redo'.
- Decision left open by the brief (#634): the reuse decision lives in gap.ts (pure module, node-tested), not in strips.ts. strips.ts imports Lucide `?raw` icons and theme.css and has no node test. Its signature is positional `(row, arrow, layout)`, as TS7 allows in gap.ts/strips.ts per-frame paths.
- #633: `#pressed` now reads `rows()` once and asks `modClickAction(rows, { side, y, click: event, platform })`. `changeAt` is still used for the plain-press mark. `isModHeld` stays imported for the Ctrl/Cmd+wheel path.
- WebKit: no fixture has a conflict touching a zero-line change (jq check above), so the extra Ctrl-drag step could not run in WebKit. Steps 2 and 4 ran in one fresh session and step 7 in another. No right-click steps were needed this round.

## Open risks
- `frontend/src/editor/internal/chunkField.ts:114-119`: When a transaction carries `placeSpans`, its value replaces the field outright, so any other change in that same transaction is not mapped into the spans. Today only actions (one transaction from `chainedChanges`) and undo/redo carry it. A future caller that adds extra changes to an action transaction (for example a transactionExtender) would leave the spans stale. None exists now: grep finds no transactionExtender/changeFilter in editor/.
- `frontend/src/editor/internal/apply.ts:106`: The action's spans come from the throwaway chain on `target.state`. This holds only while the state the steps are dispatched on equals `target.state` mapped through the cursor step (the cursor step has no changes). That is how `dispatchSteps` is used today.
