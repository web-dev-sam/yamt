**summary**
- When Alt is held, the Result now has a minimap. It is drawn on a canvas inside the right pane's `view.dom`, owned by `Frame` (`editor/internal/minimap.ts`) and painted after `ScrollSync.sync`. The code rows are cached in 128-row tiles (`MinimapTiles`). It also has a slider, problems on the left edge and waiting changes on the right edge.
- New files: `minimapPointer.ts` handles press, slider drag and wheel; `minimapRows.ts` holds row colours, theme tokens and wave rows.
- The hold is connected again: App `useAltHold()` → MergeView `minimap` → `useMergeController` (`followWithoutRebuild` holds the preferences, collapsed and minimap watches) → `MergeOptions.minimap` / `showMinimap`.
- Fixed the review items #1227–#1230 (details under deviations).
- All six layer recipes exit 0. Both WebKit and the real app were run with real Alt input.

**files_changed**
- `frontend/src/editor/AGENTS.md`, `index.ts` (286 lines), `theme.css`, `problems.browser.test.ts`, `removals.browser.test.ts`
- `frontend/src/editor/internal/frame.ts`
- `frontend/src/editor/internal/minimap.ts` (new, 259 lines), `minimapPointer.ts` (new) + test, `minimapRows.ts` (new) + test
- `frontend/src/editor/internal/minimapTiles.ts` + test, `minimapLayout.ts` + test, `minimapMarks.ts` + test, `minimapPixels.ts`
- `frontend/src/style.css`
- `frontend/src/ui/useMergeController.ts` + test, `MergeView.vue`, `App.vue`

**tests_added**
- `useMergeController.test.ts`:
  - "an editor is built showing the minimap as the view says, and follows a change without a rebuild" → `["1 built true","1 show false","1 show true"]`, built once.
  - "a minimap shown before the file loaded reaches no editor, and the editor built later shows it".
- `minimapTiles.test.ts`:
  - each tile paints its 128 rows once, each at its own y, and the last tile stops at the last row;
  - a grown tree drops only the tiles whose `to` is past the old length (a tile ending exactly there stays);
  - `keep` drops tiles outside the window; `"all"` drops every tile.
- `minimapRows.test.ts`:
  - `rowColours` gives the palette index from the row's start, using the TypeScript grammar;
  - text with no grammar is drawn in the code colour;
  - `readLook`: code colour first, a missing token falls back to the code colour, edge values are validated;
  - wave rows come from `rowOfTop`.
- `minimapPointer.test.ts`:
  - wheel pixels, lines and pages; a wheel scrolls and calls `follow`;
  - a primary press gives `centredScrollTop`; a secondary mouse button does nothing; a touch press works;
  - a slider drag (capture, `active`, `draggedScrollTop` from the start, stops propagation) ends on `pointerup`;
  - `release()` mid-drag ends the drag;
  - `mousedown` is prevented and stopped.
- `minimapLayout.test.ts`: "the canvas is the minimap's height in whole device px"; "row n covers document px (n − 1) × 20 up to n × 20".
- `minimapMarks.test.ts`: rows 3,434 and 3,885 are dropped and an insertion point at 3434×20 is kept (#1228); a fractional-ratio case at 1.25 and 1.1 (#1230).
- Hand mutations, each failing then restored:
  - `start - from` → `start`: rows test.
  - DOM_DELTA_LINE → 1: `[1,1,700]` instead of `[1,20,700]`.
  - Tile `first` without +1: 173 painted instead of 172.
  - Old window filter: `expected [ …(4) ] to deeply equal [ …(2) ]`.
  - `?? code` → `?? NO_COLOUR`: look test.
  - Drop the touch case in `primary`: `follow` called 0 times.
  - `>` → `>=` in stale tiles: 256 rows repainted instead of 128.
  - Inset without `Math.round`: fractional-ratio test.
  - Width without `Math.round`: `width: 4.4`.
  - `rowOfTop` with `round`: `[1,2,2,7278]`.
  - `topOfRow` = `row*20` plus unfloored canvas height: 7 tests fail, including `1126.25`.
  - Edge value not validated: `"warning": "not a colour"`.

**smoke_evidence**
1. Node: `vitest run --project node src/editor/internal/minimap src/ui/useMergeController` → `Tests 58 passed (58)`.
2. Recipes, each `exit 0`:
   - `lint`, `typecheck`, `unused` (knip, no findings);
   - `test` → `Test Files 108 passed (108) Tests 1431 passed (1431)`;
   - `fmt:check` → `All matched files use the correct format.`;
   - `just sfc-order` → `exit 0`;
   - `wc -l frontend/src/editor/index.ts` → `286`.
3. Failing paths in WebKit, each then restored:
   - `#box.hidden = false`: `b. Alt up: {"displayed":true…}`, `b. blur: {"displayed":true…}`.
   - `keepFocus` emptied: before the press `"active":"cm-content"`, after `"active":""` → `facts unchanged: false`.
   - Edges kept on `rowsMoved`: after an apply the right edge still had four marks (`[20,31]`, `[68,87]`, `[98,105]`, conflict `[140,195]`); restored, it had three.
4. WebKit fixture page (dev server 5277, `just webdriver 4447`, window 1600×1000, ratio 2, `language-tools-script-setup.ts`, 618 rows uncollapsed, one conflict):
   - a. Before Alt: `"displayed":false,"hit":"cm-scroller","canvas":[0,0]`.
   - b. Hold:
     - Alt held: `boxRect [1458,88.5,1591,955]`, `rightRect [1172,88.5,1591,955]`, `right/top/bottom equal: true`, `panes unchanged: true`.
     - Alt up, Alt then `a`, and blur each hide it.
     - After blur, a repeated keydown leaves it hidden; a fresh keydown shows it.
   - c. Pixels:
     - Keyword row 35 `"export"`: glyph `[224,152,107,174]` against token `[224,152,107]`.
     - Wave row 1: `[86,83,98,255]` against `[86,83,98]`.
     - Background is `--color-panel`; canvas opacity 0.9.
     - Collapsing toggled while held: painted rows `54` → `434` (618-row file) → back to `54`.
   - d. Right edge:
     - Before: three marks of kind `modified` plus one of kind `conflict` (the run reader names a mark by matching its colour to the four tokens, so this reads as "modified tone"); left edge empty (fixture, no server).
     - Applied through the strip icon while held: next frame shows `[modified, modified, conflict]`, still shown.
   - e. Scrolling (the fixture file after one apply, 616 rows):
     - scrollTop 3000: slider `{top:207.6,height:86}` equals `minimapLayout` `{top:207.6,height:86}`; window start row 47, canvas content changed.
     - At the end (11461): `lastTextCanvasRow 434 = lastPaintedCanvasRow 434`.
   - f. Pointer:
     - Press: `scrollTop 2950` against `centredScrollTop 2950.5` (WebKit stores an integer `scrollTop`); sides `[1301,1322]` → `[2950,3030]`; focus, both selections, folds and height unchanged.
     - Drag 50 px: `3684` equals `draggedScrollTop 3684`; `active` during, cleared after.
     - Wheel (3 lines, `altKey` true): `3984` → `4044`, sides follow, still shown.
   - g. Light theme: keyword `[0,51,179,181]` against `[0,51,179]`, wave `[208,208,208,255]`, background `rgb(255,255,255)`.
   - h. `.change-marks` count 0. Console errors and warnings collected from the start of the check runs (after page load): `[]`.
   - Screenshots: `/tmp/yamt-m/window-dark.png`, `window-light.png`, `window-long.png`.
5. Real app (`scripts/lsp-repo.sh --servers /tmp/yamt-m/lsp`, sessions `m-window` / `m-window2` / `m-window3`, display `:2`, ratio 1):
   - `py/api/stats.py`: the status shows "2 errors, 1 warning". Diagnostics: warning (ruff) and hint (basedpyright) on line 1, two errors on line 11.
   - `xdotool keydown alt` → left edge `[{y:[0,3],"warning"},{y:[15,18],"error"}]`, right edge one conflict. Alt up → `{"shown":false}`.
   - `focus-away` → hidden; `focus-back` with Alt still down → stays hidden.
   - Screenshot: `/tmp/yamt-m/window-app-py.png`.
   - Press and drag (`vOn.ts` from `scripts/conflict-repo.sh /tmp/yamt-m/long`, collapsing off, 184 rows):
     - Click on minimap row 101: scrollTops `[0,0,0]` → `[1552,1552,1492]` (centred is 1552.5); `focusedPane 1`, cursor `[[286,286]]`, right selection unchanged.
     - Slider drag of 100 px: `2554` during and after; my hand value of `draggedScrollTop` is 2554; `sliderActive` true during, false after.
     - Wheel: 2554 → 2455, sides follow.
     - `focus-away` → hidden.
   - All three sessions stopped. The `pgrep` check found none of my processes; the matches were VS Code's rust-analyzer and a `yamt --repo /tmp/yamt-conflict-project` that was already running.

**deviations_from_brief**
- **#1227:** `MinimapLayout.canvasHeight` is computed once in `minimapLayout`. `rowOfTop`/`topOfRow` are exported and used in `viewportStart`, `centredScrollTop`, `markBoxes`, the canvas size, the row count, wave rows and the block lookup.
  - Proof: `topOfRow` = `row*20` plus unfloored canvas height fails 7 tests; `rowOfTop` with `round` fails 2.
- **#1228:** the window filter now handles boundaries. The old filter fails the new case: `expected [ …(4) ] to deeply equal [ …(2) ]`.
- **#1229:** VS Code source headers (commit 789f2c4…, MIT) added to `minimapLayout.ts` and `minimapPixels.ts`.
- **#1230:** fractional-ratio cases added. The 1.25 case gives `{x:129,y:21,width:5,height:5}`. I added a 1.1 case because at 1.25 the width (4×1.25) is already whole, so dropping its `Math.round` would not be caught. Dropping the inset's round fails; dropping the width's round fails (`width: 4.4`).
- **Two extra files**, needed to stay under the 300-line cap and to test the pure parts in node: `minimapPointer.ts` (press, drag, wheel; `wheelPixels`) and `minimapRows.ts` (`rowColours`, `readLook`, `waveRowsOf`). Not named in the Change list; they match `minimap*.ts`. Both need entries in the project map and architecture doc (map-check).
- **Row lookup uses the row's middle** (`topOfRow(row + 0.5)`). `lineBlockAtHeight` at an exact line boundary returns the line above (`@codemirror/view` `l.bottom >= height`). Querying at the top, as the design said, drew each row one line late; the keyword-pixel step caught it.
- **Edge colours are the token values themselves**, checked with `rgbOf` and falling back to `--color-code`, rather than `rgb(...)` built from `rgbOf`. A built `rgb(` string fails the palette test (VU17).
- **MergeView**: `minimap: showsMinimap`. This function declaration computes the same rule as `centerLine` (now `resultLine(deletedViewNow())`). The contract's `centerLine.value` would throw a TDZ error when the file mounts while Alt is held: the immediate watch reads it during setup, before the computed exists.
- **Minimap marks reach `Frame`** through `changed()` returning true (`minimapStale`), on top of Frame's own reasons to request a frame.
- **Not copied from VS Code** (as the design already says): the mouse-over slider, the Windows drag reset, touch gestures, full-width characters counting as two columns.
- **Real-app press and drag** ran on `scripts/conflict-repo.sh` (`vOn.ts`, 184 rows). Every file in the language-server repo fits the window, and `--size 1600x320` still gave a 600 px high viewport, so there was no slider there.
- **"None for info" was not observable in the real app.** The repo has no info or hint diagnostic on a line of its own; its hints share a line with a warning or an error. The rule is covered by `minimapMarks.test.ts`.
- **WebKit hold step**: the blur, repeated keydown and fresh keydown were dispatched as synthetic events. WebDriver key actions covered Alt down, Alt up and Alt then `a`.
- **WebKit press value**: the brief's "`scrollTop` equals `centredScrollTop`" holds only within the browser's integer `scrollTop` (2950 against 2950.5; 1552 against 1552.5 in the real app).

**open_risks**
- `minimapLayout.ts:102` (`endRow`): when the canvas holds a half row (1734 device px / 4), the end layout ends at row 616 of 618. The last text row is drawn half visible, and the slider can stick up to ~3 px past the box bottom (top 783.7 + 86 > 867). This follows VS Code's formula.
- WebDriver's wheel source and pointer clicks do not report `altKey`, so the hold hides the minimap; real `xdotool` input keeps it shown. `minimap.ts:217` relies on the CodeMirror boundary behaviour described above.
- In `frame.ts`, `paint` runs every frame while shown. In a long file the window moves on most scroll frames, so the canvas is cleared and the tiles redrawn on each of them. Scroll timing was not measured; it is the final run's job.

Checks for you to run: `just check` (map-check needs `minimap.ts`, `minimapPointer.ts` and `minimapRows.ts` in the project map and architecture doc), `just mutants 6087e93`, and the scroll timing.