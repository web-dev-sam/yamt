#1239 is fixed: the minimap now draws the Result's last visible row at every scroll position near the end, not only at the very end. Each new test fails on `2f767a5`'s behaviour and passes now, all five recipes exit 0, and the WebKit sweep failed no step (0 of 122).

**summary**
- In `minimapLayout`, the end-only `reachingLastRow` is replaced by `drawingLastVisibleRow`, which runs at every position. It computes `last = min(rows, rowOfTop(scrollTop + viewportHeight − paddingTop − 1))` and then `startRow = max(shown.startRow, last − fitting + 1 + topPaddingRows)`.
- Near the end, rows 617–618 no longer vanish one pixel short. The 2-row jump into and out of the end is gone, and the slider stays on the drawn rows, measured against the window that is drawn.
- Mid-file the minimum lets VS Code's start stand, so its formula and the anti-flicker (`steadied`) are untouched. The existing mid-file tests still pass.

**files_changed**
- `frontend/src/editor/internal/minimapLayout.ts`
- `frontend/src/editor/internal/minimapLayout.test.ts`

**tests_added** (`minimapLayout.test.ts`; all use 618 rows, height and viewport 867, ratio 2)
- "one pixel short of the end, after the end: rows 186–618, as at the end": scrollTop 11,500 with the 11,501 layout as previous gives `[186, 618]`.
- "40 px short of the end: row 617, partly shown, is drawn": at 11,460, `endRow ≥ 617`.
- "from the end one pixel up: the window moves by at most one row": `|Δ startRow| ≤ 1` from 11,501 to 11,500.
- "the last 60 px, one pixel up at a time: …": the sweep from 11,500 down to 11,441, each step given the previous step's layout. Every step checks:
  - `endRow ≥ min(rows, rowOfTop(scrollTop + viewportHeight − paddingTop − 1))`
  - `|Δ startRow| ≤ 1`
  - the slider top is ≥ 0 and its bottom ≤ the box height
  - the slider's top and bottom are each within one row (2 CSS px) of where the viewport's top and bottom land in the drawn rows

**smoke_evidence**
1. `pnpm exec vitest run --project node src/editor/internal/minimapLayout.test.ts`
   - On `2f767a5`'s `minimapLayout.ts`, with only the new tests added:
     ```
     AssertionError: expected [ 184, 616 ] to deeply equal [ 186, 618 ]
     AssertionError: expected 615 to be greater than or equal to 617
     AssertionError: expected 2 to be less than or equal to 1
     AssertionError: scrollTop 11500: expected 616 to be greater than or equal to 618
           Tests  4 failed | 15 passed (19)
     ```
   - After the fix: `Tests  19 passed (19)`. The 15 existing tests stay green.
2. Recipes, run in `frontend/`:
   - `pnpm lint` → `oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0
   - `pnpm typecheck` → `vue-tsc -b`, exit 0
   - `pnpm unused` → `knip --include exports,types`, exit 0
   - `pnpm fmt:check` → `All matched files use the correct format.`, exit 0
   - `pnpm test` → `Test Files  108 passed (108)` / `Tests  1439 passed (1439)`, exit 0
3. WebKit run
   - **Setup:** `pnpm -C frontend dev --port 5277 --strictPort`, `just webdriver 4447`, window 1600×1000, device ratio 2. File `language-tools-script-setup.ts` with collapsing off (620 rows, max scrollTop 11,541), Alt held with a WebDriver keyDown. Script: `/tmp/yamt-m/r2/sweep.mjs`.
   - **How it judges a step:** it never calls `minimapLayout`. It reads the canvas pixels and finds the one document row offset whose text matches every canvas row (`offsetsMatching 1`). From that it takes the last canvas text row and compares it with the Result's last visible text row. It also checks the step-to-step move and the slider rect against the box rect.
   - **Sweeps:** 1 px steps from 60 px above the end down to the end, then back up.
   - Down sweep, `down: 61 steps, failing 0`:
     - first: `scrollTop 11481, firstShownRow 186, lastCanvasTextRow 618, lastVisibleTextRow 618, slider 777.7–863.7 of 866.5, sliderInside true`
     - middle: `scrollTop 11511, firstShownRow 187, lastCanvasTextRow 619, lastVisibleTextRow 619, move 0, slider 778.7–864.7, sliderInside true`
     - last: `scrollTop 11541, firstShownRow 188, lastCanvasTextRow 619, lastVisibleTextRow 619 (row 620 is the empty line), move 0, slider 779.7–865.7, sliderInside true`
   - Up sweep, `up: 61 steps, failing 0`, with the same three steps mirrored. Overall: `failed steps: 0`.
   - **Control:** I briefly put back round 1's end-only condition, on the same page and script, then restored the fix and re-ran it. The control gave `failed steps: 89`, for example:
     - `scrollTop 11481 lastCanvasTextRow 617 vs lastVisibleTextRow 618`
     - `scrollTop 11497 slider bottom 867 > box 866.5, sliderInside false`
     - `scrollTop 11540 move -2`
   - Screenshot: `/tmp/yamt-m/r2/window-end.png`. The dev server and webdriver were stopped afterwards; nothing listens on 5277 or 4447.

**deviations_from_brief**
- In the sweep test, the last visible row is capped at `rows` (`min(rows, rowOfTop(…))`), as in the fix's formula. At the exact end, `scrollTop + viewportHeight − paddingTop − 1` falls in the bottom padding, so the bare `rowOfTop` from the Acceptance text gives 619 of 618.
- In the WebKit file the last line, row 620, is empty. "The last canvas text row is the Result's last visible line" is therefore checked as the last canvas text row equalling the last visible line that has text.
- The comment at `minimapLayout.ts:148–149` is the earlier comment with the same source, reworded for "near the end" instead of "at the end".

**open_risks**
- `minimapLayout.ts:150–155`: I reasoned, but did not test, that the raise never changes mid-file windows: there VS Code's window already contains the viewport's last row, so the `max` keeps the found start. Only the existing mid-file tests (72,770; 70,002/70,003) and WebKit near the end were run; no full-range comparison against the old code, and no fractional device ratio.
- The 1-row tolerance for slider alignment is checked at ratio 2 only. Elsewhere the cap at `height − sliderHeight` still keeps the slider inside, but where the cap binds, alignment could drift past one row [INFERENCE].

Checks for you to run: `just check` (no map change) and, if you want it, `just mutants` over `minimapLayout.ts`.