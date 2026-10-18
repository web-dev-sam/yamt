```json
{
  "verdict": "pass",
  "findings": [
    {
      "file": "frontend/src/editor/internal/minimap.ts",
      "line": 202,
      "problem": "`#renderer` decides what one minimap row shows: the block looked up at the row's middle (`ROW_MIDDLE`, a CodeMirror boundary quirk), the 120-column slice, and wave or code. That rule sits in the DOM-owning class, while the rest of the row content (`rowColours`, `waveRowsOf`) is in `minimapRows.ts`. So `minimap.ts` (259 of 300 lines) does a second job, and the row-alignment rule is checked only by the WebKit step, which is not in CI. That rule keeps drawn rows in line with `rowOfTop` for marks and with `rowAt` for presses. As the app grows, the next row-content rule (VS Code's full-width columns, which this patch did not copy) would land in an untested class that is already near the size cap.",
      "fix": "Move the row painter into `minimapRows.ts` as a function that takes `{ state, blockAtHeight, waveRows, look, width, rowPx }` and returns `TileRenderer['paintRow']`, and leave `#renderer` as a one-line call. Add a node test with a fake `blockAtHeight` that follows CodeMirror's viewport rule (first block with `top <= h && bottom >= h`) and asserts that row n paints line n's text.",
      "severity": "should",
      "rule_id": "TS11"
    },
    {
      "file": "frontend/src/editor/internal/frame.ts",
      "line": 47,
      "problem": "The `follow` closure handed to `Minimap` repeats the body of `realign()` (`this.#scroll.follow(\"center\")`), so 're-align on the Result' is written twice in one class. Nothing gets harder beyond keeping the two in step.",
      "fix": "Pass `follow: () => { this.realign(); }`.",
      "severity": "nit",
      "rule_id": null
    }
  ],
  "checked": [
    "Brief and patch read. I read the touched files as they are now: minimap.ts, minimapRows.ts, minimapTiles.ts, minimapPointer.ts, minimapLayout.ts, minimapMarks.ts, the minimapPixels.ts header, frame.ts, index.ts constructor/MergeOptions, theme.css .minimap rules, style.css slider tokens, MergeView.vue script plus its hunk, useMergeController.ts, the minimap tests in useMergeController.test.ts, App.vue wiring and editor/AGENTS.md.",
    "#1227 fixed: `canvasHeight` is computed once in `minimapLayout` (minimapLayout.ts:85) and read by `markBoxes` (minimapMarks.ts:57). `rowOfTop`/`topOfRow` are exported (minimapLayout.ts:73-79) and used by viewportStart, centredScrollTop, markBoxes, `#input` rows, waveRowsOf and the tile block lookup. A grep for `/ LINE_HEIGHT_PX`, `* LINE_HEIGHT_PX` and `pixelRatio *` finds no other copy of the row rule or the canvas height; the rest are VS Code's own slider/extraTop formulas.",
    "#1228 fixed: minimapMarks.ts:65-66 has exactly the fix from the finding (`top === bottom ? first <= top && top <= last : first < bottom && top < last`), with the boundary cases in minimapMarks.test.ts as reported.",
    "#1229 fixed: VS Code source headers (commit 789f2c4…, files, functions, MIT line) are at minimapLayout.ts:1-5 and minimapPixels.ts:1-4; the `centredScrollTop` comment names viewLines.ts `_computeScrollTopToRevealRange` (CP1).",
    "#1230 fixed: minimapMarks.test.ts:191-206 tests ratio 1.25 (`{x:129,y:21,width:5,height:5}`) and also 1.1, so a dropped `Math.round` on the width is caught too.",
    "Ownership: every source file touched is in Owned (`minimap*.ts`, frame.ts, index.ts, AGENTS.md, theme.css, style.css, the two browser tests, useMergeController(+test), MergeView.vue, App.vue). The pure-module edits (minimapLayout, minimapMarks, minimapPixels) are the reported #1227–#1229 fixes. The `.omp/run/notes/MinimapWindow.md` report commit follows earlier slices (MinimapData, MinimapCutover patches). pane.ts, tone.ts, geometry.ts, scrollSync.ts and altHold.ts are unchanged.",
    "Contract: `MergeOptions.minimap: boolean`, `MergeController.showMinimap`, `FrameParts.minimap: boolean`, `Minimap.show/changed(update, rowsMoved): boolean/paint({rows,waves})/destroy`, `ControllerOptions.minimap: MaybeRefOrGetter<boolean>` (watched → showMinimap, no rebuild), MergeView props `{data, shown, minimap}` and App `:minimap=\"altHeld\"` all match the brief. The style.css slider tokens match the design's values for both themes.",
    "Accepted deviation, MergeView `showsMinimap`: the immediate watch in useMergeController reads `toValue(minimap)` synchronously during setup (Vue 3.5 runs an `immediate` job at once whatever `flush` is), so `centerLine.value` would be in its TDZ when a file mounts while Alt is held. VU2 (check-sfc-order: composables classify as state, before computed) forbids moving the computed above `useMergeController`. The rule is not copied: `resultLine` is the one rule, used by `centerLine` and `showsMinimap`.",
    "Accepted deviations: the two extra files (minimapPointer.ts, minimapRows.ts) to stay under the 300-line cap and test in node, the only finding being the split above; edge colours as validated token strings (VU17); `changed()`'s boolean as Frame's request reason (that is the contract); the row lookup at the middle — checked against @codemirror/view `ViewState.lineBlockAtHeight`, where viewport lines match `l.top <= h && l.bottom >= h` first and so give the line above at a boundary, so the CP1 comment is accurate; integer `scrollTop` in WebKit; real-app press/drag on conflict-repo.sh.",
    "Open risks accepted as known: the `endRow` half row follows VS Code's formula; WebDriver's synthetic pointer/wheel without `altKey` is a harness limit; per-frame redraw cost on scroll is the final run's scroll timing, as the assignment says.",
    "Frame vs Minimap vs MinimapTiles: Frame keeps the one per-frame paint and the geometry cache; Minimap reads `frame.rows`/`frame.waves` (no second derivation of change rows or wave rows) and only compares `folds.center` identity for tile staleness; MinimapTiles is the tile cache plus `renderTile` behind a `TileRenderer` seam, and `staleTiles` is pure. Every cache in Minimap (`#layout`, `#drawn`, `#placed`, `#look`, `#edges`) has one writer inside the class, and `show()` resets them all.",
    "One source per fact: syntax colours come only from `SYNTAX_COLOURS`/`syntaxColourClasses` (pane.ts) through `PALETTE_TOKENS`; light/dark only from the center's `EditorView.darkTheme` facet; the tint only from `paneTone(…, \"center\")`; the edge-kind → token mapping exists only in `readLook` as an exhaustive `Record<EdgeKind, string>` (TS17); `LINE_HEIGHT_PX` is imported from pane.ts, never redefined.",
    "Hidden costs nothing: `changed` returns false for a hidden or non-center update on its first line; `paint` returns on its first line; `show(false)` releases a drag capture, sets `hidden` (display:none) and drops tiles, look, edges and layout; `destroy` aborts every pointer listener through one AbortController and removes the box.",
    "Pointer isolation: the box is appended to `views.right.dom`, outside `scrollDOM`/`contentDOM`. SideFocus's capture mousedown and its non-passive wheel are on `scrollDOM` (sideFocus.ts:55-56), so they never see minimap events; `mousedown` is prevented and stopped like strips.ts `keepEditorFocus`; the slider's pointerdown stops propagation so the box press does not also fire.",
    "Boundaries: editor/ has no vue/@vueuse/@tauri imports (PM3); ui/ reaches editor only through useMergeController (MergeView imports nothing from ../editor) (PM2); the new edges minimap → problems/folds/geometry/minimap* and frame → minimap have no cycle (minimap does not import frame); minimapRows → minimapMarks is type-only.",
    "useMergeController: `followWithoutRebuild` holds the preferences, collapsed and minimap watches as the brief asks; the tests check 'built true, show false, show true' with one build, and nothing before the file loads.",
    "State-ownership table: docs/architecture.md:559 ('whether the minimap shows (Alt held)': useAltHold → MergeView `showsMinimap` → `minimap` option → MergeOptions.minimap/showMinimap) and :560 ('the Result's minimap': `Minimap` owned by `Frame`, tiles/slider/edges/look, no history) are the two rows this needs; each has one writer as implemented. The project-map skill's old #80 rows (change marks, MarkLanes) are still to be replaced by the orchestrator, known as excluded.",
    "Plan §2 #81 is not contradicted: place (z 400, `--color-panel`, 1 px `--color-control-border`, `visibility: visible`), 128-row tiles, redraw triggers (document, fold, theme, language, parse growth, scale), the slider shown only while `travel > 0`, edges 4 CSS px wide / ≥ 4 tall, a press centres (VS Code's 'mouse' reveal), drag/wheel then `follow(\"center\")`, Alt released mid-drag ends the drag.",
    "Comments: the only new comments are CP1 external facts with sources (minimap.ts:217-218, minimapLayout.ts centredScrollTop) and the CP1 VS Code/MIT headers; no narration.",
    "editor/index.ts is 286 lines (≤ 300); `MergeController` gains only `showMinimap` and one option."
  ]
}
``````json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "R-boundary",
      "file": "frontend/src/editor/internal/minimapLayout.ts",
      "line": 102,
      "problem": "When the Result is scrolled to its end and the viewport's first row is more than about half cut off, the minimap leaves the file's last one or two rows out. Their code is not drawn, a change or problem on those rows gets no edge mark, and the slider sits ~3 px past the box bottom, where `overflow: hidden` crops it. This breaks Acceptance 4e. The 4e evidence does not show otherwise: it compared canvas rows (434 = 434), not document rows.",
      "fix": "When `scrollTop` is at the end of the scroll range, raise `startRow` to `rows − fitting + 1 + topPaddingRows` before working out `endRow` and the aligned slider top, and keep the slider bottom at or above `height`. Add `minimapLayout.test.ts` end cases where the viewport's first row is ≥ 0.5 cut off (618 rows, height and viewport 867, ratio 2 → endRow 618, slider top + height ≤ 867). Alongside them, assert slider top + height ≤ height in the existing 7,277-row end test, which today passes at 900.4 > 900."
    },
    {
      "severity": "should",
      "rule_id": "R-test-gap",
      "file": "frontend/src/ui/MergeView.vue",
      "line": 128,
      "problem": "Nothing checks the rule that a Result showing its \"not text\" or \"deleted\" line gets no minimap (`resultLine(deletedViewNow()) === null`). No node test covers it and no smoke step was run on such a file, so removing the check passes everything. For growth: nothing else builds on this rule, but the next edit to `centerLine`/`resultLine` can drop it silently.",
      "fix": "Add one WebKit fixture step: open a deleted-side file, take Delete so the Result shows `DELETED_LINE`, hold Alt, and assert `.minimap` is not displayed."
    }
  ],
  "checked": [
    "Block arithmetic: worked through `minimapLayout` by hand at 618 rows, height 867, ratio 2, end scrollTop 11,501. Viewport row 575 (0.85 cut off), sliderTop 781, startRow floor(575 − 390.5) = 184, endRow 184 + 433 − 1 = 616, aligned slider 783.7 + 86 = 869.7 > 867. This matches the implementer's own open-risk numbers.",
    "The same formula reproduces the implementer's measured values for the 616-row file at scrollTop 3000 (start row 47, slider top 207.6). At its end (11,461) it gives startRow 182 and endRow 614 of 616, so the reported 4e end proof also missed the last rows.",
    "With height and viewport 868 (no half row) the formula still gives endRow 617 of 618. The cause is how far the viewport's first row is cut off, not only a half-row canvas.",
    "I tried a `tsx` probe of `minimapLayout`; it failed to load because pane.ts pulls in CSS and `~icons` imports. No test was run; the block rests on the arithmetic above.",
    "#1227 fixed: `canvasHeight` is on `MinimapLayout` and `markBoxes` uses it. `rowOfTop`/`topOfRow` are the only row rule, used in viewportStart, centredScrollTop, markBoxes, waveRowsOf, `Minimap#input` and `#renderer`. A grep of minimap*.ts finds no other `(row − 1) × 20` or `pixelRatio × height`.",
    "#1228 fixed: the filter treats boundaries as the fix asked. The test's rows 3,434 and 3,885 are dropped and the insertion point at 3434×20 is kept; the old `bottom >= first && top <= last` would keep both rows, so the test catches it.",
    "#1229 fixed: source headers with commit and MIT line in minimapLayout.ts and minimapPixels.ts.",
    "#1230 fixed: the ratio 1.25 case catches a missing inset round; the 1.1 case catches a missing width round (4.4).",
    "Hidden costs nothing: `Minimap.changed`/`paint` return on their first line while hidden. `show(false)` releases the drag, sets the canvas to 0×0, clears the tiles and resets layout, look and edges. The box is `display: none`, so its listeners never fire.",
    "Marks gone the frame after an apply: the chunk field change sets `rowsChanged` → `Frame` drops its layout cache, `Minimap` drops `#edges` and `#drawn`, and `changed` returns true. `request` → `layout()` recomputes the rows before `minimap.paint`. Ignore without a doc change goes the same way through the spans field.",
    "Tiles go stale on: document, folds (`folds.center` field), theme (`darkTheme` facet), language facet → all; tree growth → tiles whose `to` > old length (boundary tested: a tile ending exactly there stays); a scale change → `#fit` clears tiles and look; window ±1 kept (`keep`, tested); all cleared on show/hide.",
    "Press never reaches the right pane: the box sits in `view.dom`, outside scrollDOM/contentDOM. `mousedown` is prevented and stopped (tested). The slider's pointerdown is stopped before the box's press (tested via `cancelBubble` and boxPress not called). CM's HoverPlugin attaches to `view.dom` but `startHover` returns when `docView.tile.nearest(target)` finds no tile (view dist index.js:10821), so hovering the minimap opens no right-pane tooltip.",
    "Alt released mid-drag: `show(false)` → `pointer.release()` releases the capture and clears `active` before the box hides (release tested in minimapPointer.test.ts).",
    "Accepted (open risk): the row lookup at the row's middle. `viewState.lineBlockAtHeight` matches `l.top <= height && l.bottom >= height` (view dist index.js:6676), so an exact boundary gives the line above. The `minimap.ts` comment states this correctly.",
    "Built or shown while Alt is held: the build reads `toValue(minimap)` without tracking it, and `followWithoutRebuild` calls `showMinimap` without a rebuild. Both added useMergeController tests would fail if the option or the watch were removed. A file that is not shown gets false through `props.shown`.",
    "Accepted (deviation): the MergeView TDZ. The immediate `watch(toRef(minimap))` reads the getter during setup, so `centerLine.value` there would throw. `showsMinimap` shares `resultLine`/`deletedViewNow` with `centerLine`, so the rule is not copied.",
    "Destroy: `Frame.destroy` cancels the rAF, then `Minimap.destroy` aborts the listeners, releases any drag, clears the tiles and removes the box.",
    "Light/dark: `readLook` is read only in `#draw` after a reset (show, `darkTheme` facet change, scale change). The `data-theme` watcher and the `setPreferences` watcher both run before the rAF that reads `getComputedStyle`. Accepted (deviation): edge colours are passed as token strings with `rgbOf` validation (VU17); readLook test covers the fallback.",
    "Stacking: z 400 sits over `.cm-panels` (300) and under tooltips (500); the pane hosts have no stacking context (only the strips have `will-change`). `visibility: visible` keeps the minimap over a right pane made invisible because the remote side was deleted.",
    "rowColours test pins the per-row offset (`start − from`) and the code colour where no grammar applies; waveRowsOf uses floor rows; the wheel test covers the line and page modes and the follow call.",
    "Mutation survivors in useMergeController.ts :79-83, :89, :104, :133-136, :190, :196 dropped as older (#582/#658, per the orchestrator); none on the changed lines 47, 143-161, 165, 185, 193.",
    "Accepted (open risk): WebDriver pointer and wheel events report no `altKey`; real xdotool input was used in the app. Also accepted: per-scroll-frame redraw in a long file, within plan #81's \"at most five tile copies\"; timing is the final run's job.",
    "Accepted: two extra modules, minimapPointer.ts and minimapRows.ts, inside the owned `minimap*.ts`; their map and architecture entries are the orchestrator's.",
    "Accepted: \"none for info\" not observable in the app; minimapMarks.test.ts:104 covers info and hint giving no mark."
  ]
}
```