Both findings are fixed. With the Result scrolled to its very end, the minimap now draws the last row and the slider stays inside the box. The row painter is out of `Minimap` and has node tests. All five layer recipes exit 0, and the WebKit check passes.

**summary**
- **#1237:** at the end of the scroll range, `minimapLayout` moves the window down so it ends on the last row (`reachingLastRow`). Everywhere else it keeps VS Code's formula. The slider top is also capped at `height − sliderHeight`, so its bottom never passes the box bottom.
- **#1235:** the row painter is now `rowPainter(source)` in `minimapRows.ts`. It takes state, blockAtHeight, waves, look, width and rowPx, and returns `TileRenderer["paintRow"]`. `Minimap#renderer` just calls it. `minimap.ts` went from 259 to 242 lines.

**files_changed**
- `frontend/src/editor/internal/minimapLayout.ts`
- `frontend/src/editor/internal/minimapLayout.test.ts`
- `frontend/src/editor/internal/minimapRows.ts`
- `frontend/src/editor/internal/minimapRows.test.ts`
- `frontend/src/editor/internal/minimap.ts`

**tests_added**
- `minimapLayout.test.ts`:
  - "the end with the top row 0.85 cut off: 618 rows at ratio 2 end at row 618, the slider inside" (height and viewport 867, scrollTop 11,501). Proves rows 186–618 are drawn, the slider bottom is ≤ 867, and row 618 sits at canvas y 432 × 4.
  - "the end at 868 px: 434 rows fit, the last drawn is row 618, the slider inside" (scrollTop 11,500). Proves rows 185–618 and slider bottom ≤ 868.
  - The 7,277-row end test now asserts slider bottom ≤ 900. Its expected slider top changed from 810.4 to 810, and its title now says so.
- `minimapRows.test.ts`:
  - "row n paints line n: its text and its end, also where a height falls on a line boundary". The fake `blockAtHeight` returns the first line with `top <= h && bottom >= h`. Each row returns line n's `to`, and the painted column counts are `[4,1,3,2]` for the lines `MMMM`, `M`, `MMM`, `MM`.
  - "a collapsed run's row paints the wave across the row's middle, no text". The row returns line 3's `to`, its middle pixel row is the wave colour at 255 opacity, and its top pixel row is empty.

**smoke_evidence**
1. `pnpm exec vitest run --project node src/editor/internal/minimapLayout.test.ts`
   - On round 1's code, before the fix:
     - `AssertionError: expected 900.4 to be less than or equal to 900` (7,277-row end)
     - `AssertionError: expected [ 184, 616 ] to deeply equal [ 186, 618 ]` (618 rows at 867)
     - `AssertionError: expected [ 184, 617 ] to deeply equal [ 185, 618 ]` (868 case)
     - `Tests  3 failed | 12 passed (15)`
   - With the fix: passes. With only the slider cap removed: `expected 900.4 to be less than or equal to 900`, `1 failed | 14 passed`. Restored.
   - In the 618-row case the `startRow`/`endRow` assertion comes first and is the one that fails on round 1. Its slider bottom there (783.7 + 86 = 869.7) is the reviewer's arithmetic; the run stopped at the first assertion, so that slider assertion was not reached.
2. Rows test with the lookup moved back to the row's top (`blockAtHeight(topOfRow(row))`):
   - `AssertionError: expected [ 4, 4, 6, 10 ] to deeply equal [ 4, 6, 10, 13 ]`
   - `AssertionError: expected 6 to be 10 // Object.is equality`
   - `Tests  2 failed | 4 passed (6)`. Restored → `Tests  21 passed (21)` (layout and rows together).
3. Recipes, all in `frontend/`:
   - `pnpm lint` → exit 0
   - `pnpm typecheck` (`vue-tsc -b`) → exit 0
   - `pnpm test` → `Test Files  108 passed (108)`, `Tests  1435 passed (1435)`, exit 0
   - `pnpm unused` (`knip --include exports,types`) → exit 0
   - `pnpm fmt:check` → `All matched files use the correct format.`, exit 0
   - `wc -l src/editor/internal/minimap.ts` → `242`
4. WebKit: `pnpm -C frontend dev --port 5277 --strictPort`, `just webdriver 4447`, window 1600×1000, device ratio 2, `language-tools-script-setup.ts` with collapsing off (620 rows; row 620 is the empty line after the final newline), Alt held by a WebDriver keyDown. Script: `/tmp/yamt-m/r1/end.mjs`.
   - Very end (scrollTop 11541 = max, `firstRowCut 0.85`):
     - layout `startRow 188, endRow 620`; `canvasRows 433`
     - `lastDocTextRow 619 "}"`, `lastPaintedCanvasRow 432 = lastTextCanvasRow 432`
     - slider `top 779.7, height 86`, `sliderBottom 865.7 ≤ boxHeight 867`; `sliderRectBottom 954.2 ≤ boxRectBottom 955`
     - `mismatchCount 0` over all 433 rows. This compares each canvas row's rightmost painted glyph column with the text of the line `lineBlockAtHeight` gives, so it does not depend on the layout under test.
   - The same run with the raise disabled: `endRow 618` of 620, the last text sat at canvas row 434 past the 433 that fit, and `rectInside: false` (955.5 > 955). Restored and run again: the numbers above.
   - Mid-file (scrollTop 3000): rows 48–480, `mismatchCount 0`.
   - Keyword check, row 143 `export`: glyph `[224,152,107,174]` against the token `[224,152,107]`; the row above is empty and has pixels `[0,0,0,0]`.
   - Screenshot: `/tmp/yamt-m/r1/window-end.png`.
   - The dev server and webdriver were stopped; `pgrep` and `ss` found nothing left on 5277 or 4447.

**deviations_from_brief**
- `rowPainter` takes the waves (`waves: readonly WaveRow[]`), not a ready set of wave rows, and builds the set on the first painted row, as round 1 did. That way a draw where every tile is cached does not compute the set.
- The window is raised only when `scrollTop >= scrollable` (the brief's "end of the scroll range"). The slider cap applies in every scrolled position, not only at the end. That is a no-op elsewhere, because the aligned top stays inside the box there.
- `RowSource` is a type private to `minimapRows.ts`.
- The WebKit file now has 620 rows; round 1 reported 618.

**open_risks**
- `minimapLayout.ts:102`: one or two px short of the end (for example scrollTop 11500 of 11501), the viewport already shows the last row but the window is not raised yet, so the last one or two rows are not drawn until the end is reached. The slider cap still keeps the slider inside. The brief scoped the raise to the end.
- The box's `clientHeight` is 867 while its rect is 866.5 (top 88.5, bottom 955). A slider bottom of exactly 867 would stick 0.5 CSS px past the rect. After the fix the end gives 865.7, which is inside.

Checks for you to run: `just check` (no map change: the files are already named), and `just mutants` over the changed lines if you want it.