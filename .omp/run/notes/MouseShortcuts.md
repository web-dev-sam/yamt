# MouseShortcuts (row 2, round 1)

## Summary
Slice 3.K is done and all acceptance checks I could run pass. What now works: Ctrl/Cmd+right-click on a waiting change in a side pane ignores that side of it (no menu opens, the selection and focus stay). Ctrl/Cmd+click on a conflict's apply/ignore icon, or a drag released with Ctrl/Cmd held, also gives the other side the opposite decision while it still waits, in one transaction and one undo step. While the other side waits, the icons' hover text has a second line naming the Ctrl/⌘+click, and the line goes away once that side is decided. Ctrl/Cmd+click and Ctrl/Cmd+right-click find their change with the same hit test as a plain press (`changeAt`). The six follow-ups #614, #616, #617, #620, #605 and #613 are fixed.

## Files changed
- frontend/src/editor/index.ts
- frontend/src/editor/internal/apply.ts
- frontend/src/editor/internal/apply.test.ts
- frontend/src/editor/internal/chunkField.ts
- frontend/src/editor/internal/drag.ts
- frontend/src/editor/internal/gap.ts
- frontend/src/editor/internal/gap.test.ts
- frontend/src/editor/internal/historyKey.ts
- frontend/src/editor/internal/historyKey.test.ts
- frontend/src/editor/internal/modClick.ts
- frontend/src/editor/internal/modClick.test.ts
- frontend/src/editor/internal/navigation.ts
- frontend/src/editor/internal/sideFocus.ts
- frontend/src/editor/internal/sides.test.ts
- frontend/src/editor/internal/strips.ts
- frontend/src/editor/internal/wheel.ts
- frontend/src/editor/internal/wheel.test.ts
- frontend/src/editor/internal/words.test.ts
- frontend/src/ui/useMergeController.test.ts

## Tests added
- **apply.test.ts › Ctrl/Cmd apply on a waiting conflict takes that side and ignores the other, as one undo step** — Status is local applied + remote ignored and the middle holds local's lines. The result equals a plain apply followed by a plain ignore, it adds one undo step, and one undo restores text and statuses. With the fix reverted (other side left pending) it fails: 'applied pending' ≠ 'applied ignored'.
- **apply.test.ts › Ctrl/Cmd ignore on a waiting conflict ignores that side and takes the other, as one undo step** — Status is local ignored + remote applied and the middle holds remote's lines. It fails with WebStorm's way (ignore both): 'ignored ignored' ≠ 'ignored applied'; it also fails when the other side is left pending.
- **apply.test.ts › Ctrl/Cmd apply on a conflict whose other side was applied appends, and both sides read applied** — Remote already applied: Ctrl apply appends local after it and both sides read applied. It fails when a side that no longer waits is decided anyway: 'applied ignored' ≠ 'applied applied'.
- **apply.test.ts › Ctrl/Cmd ignore on a conflict whose other side was ignored leaves the middle as it is** — Remote already ignored: Ctrl ignore does not change the middle. It fails when an ignored side gets applied (the middle text changes).
- **apply.test.ts › Ctrl/Cmd on a change that is not a conflict gives the plain click's outcome** — For LocalOnly apply/ignore and RemoteOnly apply, text and statuses equal the plain click's.
- **apply.test.ts › a drag released with Ctrl/Cmd decides each covered conflict whole and each other change plainly, as one undo step** — A drag over [conflict, LocalOnly, conflict] (apply and ignore) gives the expected text and statuses, adds one undo step, and one undo restores text and all statuses. It fails with the fix reverted.
- **apply.test.ts › Ctrl/Cmd ignore on a conflict whose other side has no lines removes the block and resolves it** — Remote has zero lines: Ctrl ignore on local removes the block's lines, the status reads ignored/applied, and the summary shows 0 conflicts.
- **apply.test.ts › a Ctrl/Cmd drag over an ignored change touching a conflict it fills equals clicking each** — Pins the chunkField mapping fix (deviation 3). With the old rule (every status change maps `to` with +1) the spans come out [[2,6],[6,6]] instead of [[2,4],[4,6]]; I observed this by reverting the fix.
- **modClick.test.ts › Ctrl/Cmd+click and Ctrl/Cmd+right-click 3 px from a zero-line change's bar act on it; 5 px away they don't** — Hit test #606. It fails with openBlockAt's rule (len > 0 only): null ≠ 'apply remote 1'.
- **modClick.test.ts › Ctrl/Cmd+click on a block applies its change and Ctrl/Cmd+right-click ignores it; the next line does not** — Main button with the modifier → apply, secondary button → ignore. Pixel band limits are checked on both sides (ported from the openBlockAt tests).
- **modClick.test.ts › without Ctrl/Cmd, with the middle button, on an unchanged side or a decided side nothing happens** — Plain clicks and right-clicks, the middle button, unchanged sides and decided sides give no action.
- **modClick.test.ts › only Cmd counts on macOS and only Ctrl elsewhere, and the hint names that key** — isModHeld behaves as before; modKeyName gives ⌘ on Mac and Ctrl elsewhere.
- **gap.test.ts › a conflict's icons name the Ctrl+click while the other side waits, and lose the line once it is decided** — Pending: two-line titles on both icons. After the other side is ignored, the mode is still 'replace' but the titles are one line each (the stale-title case behind the brief's 'fails with today's sameShape'). An 'Apply after the other side' row has no hint. It fails when the hint ignores whether the other side waits.
- **gap.test.ts › on macOS the hint says ⌘+click** — The Mac platform string gives '⌘+click: also …' on both icons.
- **gap.test.ts › a change that is not a conflict never has the hint, even when both sides changed it** — Non-conflicts, including BothSame, always get one-line titles.
- **historyKey.test.ts › a layout whose physical Z types a vowel sign undoes by the physical key: Hindi InScript** — #614: key 'ॆ' + code KeyZ gives 'undo'. It fails with /^\p{L}$/u (null ≠ 'undo').
- **historyKey.test.ts (Dvorak row changed)** — #616: the row is now key '-' + code KeyY → null, replacing the 'f' row that passed with or without the fix.
- **wheel.test.ts › WebKitGTK's X11 mouse notches of 96 px step once each, also inside one fast burst** — #620: three 96 px events in one burst give three steps. It fails with WHEEL_STEP_PX = 100 (['down', null, 'down']).
- **useMergeController.test.ts › while the file is still loading, toolbar actions and the undo shortcut do nothing and throw nothing** — #617: with no controller, applyAllNonConflicting, undo and redo do not throw and historyKey returns false.

## Smoke evidence
- `pnpm -C frontend lint; pnpm -C frontend typecheck; pnpm -C frontend test`

  ```
  $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue" → lint exit 0
  $ vue-tsc -b → typecheck exit 0
  Test Files  41 passed (41)
       Tests  458 passed (458)
  test exit 0
  ```
- `just sfc-order; just web-unused; pnpm -C frontend fmt:check; wc -l frontend/src/editor/index.ts`

  ```
  $ tsx scripts/check-sfc-order.ts → sfc-order exit 0
  $ knip --include exports,types → web-unused exit 0
  All matched files use the correct format.
  299 frontend/src/editor/index.ts
  ```
- `pnpm -C frontend test:browser`

  ```
  It did not run. Error: browserType.launch: Host system is missing dependencies to run browsers. sudo apt-get install libicu74 libxml2 … (exit 1). The Playwright WebKit probe did not run on this machine.
  ```
- `Fixes reverted one at a time in editor/ (then restored): sideDecisions → [own]; other side always 'ignore'; waiting check dropped for the other half; chunkField newlyApplied → every changed id; modClickAction rows filtered to len > 0; otherWaits without isSideOpen; old letter regex; WHEEL_STEP_PX 100`

  ```
  [own]: 5 failed, e.g. "expected 'applied pending' to be 'applied ignored'".
  Ignore both: "expected 'ignored ignored' to be 'ignored applied'".
  Waiting check dropped: "expected 'applied ignored' to be 'applied applied'", and the 'other side was ignored' test fails on the middle text.
  chunkField: "expected [ [ 2, 6 ], [ 6, 6 ] ] to deeply equal [ [ 2, 4 ], [ 4, 6 ] ]".
  len > 0 filter: "expected null to be 'apply remote 1'".
  Hint: "conflict's icons … lose the line once it is decided" fails.
  Regex: Hindi test "expected null to be 'undo'".
  Wheel: "expected [ 'down', null, 'down' ] to deeply equal [ 'down', 'down', 'down' ]".
  ```
- `WebKit steps 1–4: pnpm -C frontend dev --port 5391 --strictPort + just webdriver 4491 (MiniBrowser, windows on the Samsung screen). Real WebDriver key/pointer actions at element rects, Control held through a key-down action. File vueuse-use-magic-keys.ts, left pane scrolled to line 125 by setting scrollTop.`

  ```
  1. Left apply <title> = "Apply\nCtrl+click: also ignore the other side", left ignore = "Ignore\nCtrl+click: also take the other side".
  2. Ctrl+click left apply: middle starts with local 129–136 = true. left129, right141 and center129 classes lose chunk-conflict ('cm-line' / 'cm-line cm-activeLine'); both sides' conflict-8 icons are gone. One Ctrl+Z: middle equals the original text, all three lines have 'chunk-conflict chunk-band' again, and both two-line titles are back.
  3. Ctrl+click right ignore: middle starts with local's text, both sides decided (no tint, no icons). Ctrl+Z restores everything.
  4. Plain click left ignore, then the right titles are ["Apply","Ignore"] (no hint line). Ctrl+click right ignore: middle equals the original, both sides untinted. Ctrl+Z twice: everything back, titles two-line again.
  ```
- `WebKit step 5 (same session as 1–4; plain right-click also checked in a fresh session)`

  ```
  Before: left selection [3210,3210], active 'left .cm-content'. Ctrl+right-click on local 131 → events "mousedown button=2 prevented=true", "contextmenu button=2 prevented=true", one ignore. Left129 is 'cm-line' (untinted), middle equals the original, right141 still 'chunk-conflict chunk-band' and its apply title is now "Apply". Selection [3210,3210] and active 'left .cm-content' are unchanged.
  Plain right-click there: "mousedown button=2 prevented=false", "contextmenu button=2 prevented=false" (our handler does not act; the native menu was closed with Escape). The caret moved to 3533, which is WebKit's own right-click behaviour; our handler returns false there.
  ```
- `WebKit step 6 (fresh session) and 6b (remembered mark)`

  ```
  Click local 129: left outline lines [129..136], active 'left .cm-content'.
  Ctrl+click the right apply icon: pointerdown/pointerup with ctrl=true. Middle holds remote 141–154 = true, left129 is 'cm-line'. Active stays 'left .cm-content'. The left outline moves to [3] (top-most still waiting) and the view is revealed there (left scrollTop 2135 → 0).
  6b: click remote 141 (right outline 141–154), click local 129, then Ctrl+click left apply. Active stays left, left outline [3]. ArrowRight: active 'right .cm-content', right outline [87], i.e. the remembered conflict 8 moved on to change 3 by itself (sideMark settled).
  ```
- `WebKit step 7: word-marks.ts, Ctrl held through a drag from the apply icon of conflict 49 (local 163) to conflict 50 (local 166)`

  ```
  Before: l163, l166, r172, r175, c168 and c171 all 'chunk-conflict chunk-band'. After the Ctrl drag: all are 'cm-line' and the middle holds local's lines ("const data = await fetchUser(id);" … "import { ref, watch } from 'vue';"). One Ctrl+Z: every class is back to chunk-conflict and the middle text is the original.
  ```
- `WebKit step 8: vueuse-use-magic-keys.ts; click local line 3, click the middle, then press and drag the left scroller's edge by 200 px`

  ```
  Events: "mousedown cm-scroller", "focus cm-scroller", "focus cm-content". scrollTop 0 → 711. Active 'left .cm-content'. Left selection unchanged [109,109]. Outline stays [3]. ArrowDown → outline [22], active still left. The scrollbar is an overlay one (offsetWidth − clientWidth = 0).
  ```
- `WebKit step 9: vue-core-compiler-von.ts, conflict 1 has zero remote lines (bar at the top of remote line 19); one fresh session per click`

  ```
  Ctrl+click at bar+3 px: right line 19 loses 'chunk-marker-conflict chunk-point-above', the right icons at the bar disappear, and the middle's lines 19–21 are replaced by remote's (empty) side.
  Ctrl+right-click at bar−3 px: marker and icons gone, middle unchanged (ignored).
  At ±5 px both gestures change nothing (marker and icons stay).
  ```

## Deviations from brief
- Renamed, removed and added (for the project map). `editor/internal/modClick.ts`: `openBlockAt` and `applyOnModClick` are removed; `modClicks(side, { rows, act })` (Ctrl/Cmd+click → apply, Ctrl/Cmd+right-click → ignore, both on changeAt), `modClickAction` (the pure gesture rule) and `modKeyName` ('⌘'/'Ctrl', same platform test as isModHeld) are new. `editor/internal/apply.ts`: new export `type Reach = "side" | "conflict"`, and `actionSteps(target, action, reach)` takes it as a third parameter. `editor/internal/gap.ts`: `Arrow` gains `otherWaits: boolean`; new exports `arrowTitles(arrow, platform)` and `type ArrowTitles` (APPLY_TITLE moved here from strips.ts). `navigation.ts`: type `AfterDecision` renamed `FocusAfterDecision` (#613). No new or removed files. No public surface change (MergeController, MergeHosts, MergeOptions, MergeHandle unchanged).
- I chose to keep `ChunkAction` unchanged and add a sibling `Reach` instead of a field. The drag highlight (`coveredField`, `sameCovered`) keeps using ChunkAction, which carries no modifier; the reach is read only on release.
- Change outside the listed steps: `chunkField.ts` `updateSpans` now maps `to` with +1 and pushes later spans only for spans that gained an 'applied' side in the transaction (`newlyApplied`), not for every span with a setStatus. Without it, a Ctrl/Cmd drag that ignores a change touching a conflict whose other side gets inserted gave wrong spans (pinned by the 'touching' test). All earlier paths behave the same, because before this slice no transaction mixed text changes with ignore-only statuses.
- Hint wiring: the strip rows keep their titles and `sameShape` compares them, so a row is rebuilt when its hint appears or goes. The title text and its rule are pure (`gap.ts` `arrowTitles`); `sameShape` is DOM code and was checked in WebKit (step 4), not by a node test.
- Decision on the brief's 'DOM focus does not move' (Behaviour 1): a Ctrl/Cmd+right-click goes through `#act` as Behaviour 7 requires. When a pane has focus, it keeps it (observed in step 5). When nothing has focus, the middle gets it, as for every mouse decision (#54/#589; observed in step 9). I read #55 and #54 as agreeing on this.
- #614: I chose `/^[\p{L}\p{M}]$/u` named `LETTER_OR_VOWEL_SIGN` over `\P{ASCII}`, so non-ASCII symbols such as '§' do not fall back to the physical key.
- #605: the handler listens to `focus` on the scroller itself (non-capture, so it fires only when the scroller is the target) and calls `contentDOM.focus({ preventScroll: true })`. The scrollbar drag kept scrolling (step 8).
- Step 6 runs in its own session. After any button-2 gesture, WebKitGTK's WebDriver reports the release as `mouseup button=0`; the page then believes button 2 is still held, so later presses fire no pointerdown/pointerup (chorded) and the icons stop reacting until a new session. I saw this after both plain and Ctrl right-clicks, so it comes from the driver, not from this change. Steps 6, 6b, 7, 8 and each step-9 click therefore ran in fresh sessions.
- WebKit tooltip rendering: the WebDriver screenshot shows no native tooltip, so I could not see whether WebKit draws the two lines on separate lines. Observed: the `<title>` textContent holds '\n' between the lines.

## Open risks
- `frontend/src/editor/internal/modClick.ts:68-77`: On Windows, contextmenu fires on release, so the hit test runs again at the release point. A Ctrl+right-click whose pointer moved off the change before release opens the native menu instead of ignoring. Not observed: only WebKitGTK, where contextmenu fires on press.
- `frontend/src/editor/internal/strips.ts:144-153`: A row is rebuilt while a press is held only when its titles change, which happens after a decision. Not exercised mid-drag.
- `frontend/src/editor/internal/chunkField.ts:79-87`: The newlyApplied rule changes which spans get +1 mapping. I argue it is the same as before for all earlier transaction kinds, and all 458 tests pass; review against CM1 wording ('a span applied in this transaction').
- `WebKit run, step-1 screenshot`: In the WebDriver screenshot the side panes showed line numbers but no text and no band tint, while DOM classes and text were correct. Cause not investigated (probably a screenshot/compositing quirk); not compared with the base commit.
