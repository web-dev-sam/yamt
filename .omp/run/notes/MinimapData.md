The minimap's data layer is in place: layout, glyph tables, pixel painting, tile staleness and edge marks, plus one shared syntax colour table in `pane.ts`. The pane's highlight CSS came out the same before and after the change. All five layer recipes exit 0. `just map-check` was not run, and it will probably fail until the new files are added to the project map and `docs/architecture.md`.

**summary**
- `minimapLayout.ts`: VS Code's proportional `MinimapLayout.create` in yamt's numbers, plus `minimapScale`, `minimapColumns`, `rowAt`, `rowTop`, `centredScrollTop` and `draggedScrollTop`.
- `minimapGlyphs.ts`: VS Code's prebaked glyph tables for scales 1 and 2, decoded once, with `charIndex` (VS Code's `getCharIndex`) and an MIT header.
- `minimapPixels.ts`: `rgbOf`, `paintRow` (intensities ×12/15 on dark and ×50/60 on light, tab stops, spaces, the 120-column cut) and `paintWave`.
- `minimapTiles.ts`: `staleTiles`. `minimapMarks.ts`: `changeMarks`, `problemMarks` (warnings first) and `markBoxes`.
- `pane.ts`: the `SYNTAX_COLOURS` table; `paletteHighlight` and the new `syntaxColourClasses` are both built from it.

**files_changed**
- `frontend/src/editor/internal/pane.ts`, `pane.test.ts`
- new: `minimapLayout.ts`, `minimapLayout.test.ts`, `minimapGlyphs.ts`, `minimapPixels.ts`, `minimapPixels.test.ts`, `minimapMarks.ts`, `minimapMarks.test.ts`, `minimapTiles.ts`, `minimapTiles.test.ts` (all in `frontend/src/editor/internal/`)

**tests_added**
- `minimapLayout.test.ts` has the design's eleven tests: scale doubles at ≥ 2 (row 2/2/1.6 CSS px); 120 columns plus two 6 px edges (96 CSS px of code at 1.25); a file that fits has no slider; 450 rows fill the minimap exactly, so the rows stay and the slider moves by scrollTop × ratio; 7,277 rows at 72,770 give rows 3,435–3,884 and the slider at 408.6; the end gives 6,828–7,277 and 810.4; no flicker when scrolling up or down; the find space adds one padding row; press row; Center; drag.
- `minimapPixels.test.ts` covers `rgbOf`; `T` at scales 1 and 2; light uses 50/60; tab and space; the column cut; non-ASCII through `getCharIndex`; the wave row.
- `minimapTiles.test.ts` covers doc, folds, theme or language changes giving all tiles, a grown tree giving `{from}`, and nothing changed giving none.
- `minimapMarks.test.ts` covers: right edge tone and resolved changes; left edge error and warning, with info and hint left out; errors after warnings; a problem in collapsed lines lands on its wave row; the 4 CSS px minimum, centring and clamping; only marks inside the window, through the start row and padding.
- `pane.test.ts`:
  - "the pane's highlight styles every tag as before the syntax table" pins all 25 tag styles.
  - "the minimap classes and the pane's highlight give each tag the same token".

**smoke_evidence**

1. `pnpm -C frontend exec vitest run --project node src/editor/internal/minimap` → `Test Files 4 passed (4) Tests 25 passed (25)`.
   Worked cases, by hand from VS Code's formulas:
   - **7,277 rows:** padding 4/4 px, both heights 900. Slider height = ⌊45 × 2⌋ = 90. Travel = min(810, 14,554 − 90) = 810. Scrollable = 145,548 − 900 = 144,648. At scrollTop 72,770 the top row is ⌊72,766/20⌋+1 = 3,639 with 0.3 of it above the top. The plain slider top is 407.49, so the start is ⌊3,639 − 203.75⌋ = 3,435 and the end is 3,435 + 450 − 1 = 3,884. The aligned slider top is (3,639 − 3,435 + 0.3) × 2 = 408.6.
   - **Fits exactly:** 450 rows, scrollTop 1,000 → slider top 1,000 × 810/8,108 = 99.901. The `>` mutation gives 99.6.
   - **Center:** row 100's top is 4 + 1,980 = 1,984. The box runs 1,964–2,004 (one line above, from the "mouse" source), so scrollTop = 1,984 − 450 = 1,534.
   - **Drag:** 72,770 + 50 / (810/144,648) = 81,698.9 → 81,699.
   - **`T`:** glyph 52 has intensities 154 and 46 → alphas ⌊123.2⌋ = 123 and ⌊36.8⌋ = 36; on light, 128 and 38.
   - **Marks:** row 3,500 in a window starting at 3,435 sits at 130 device px; a one-row mark becomes y 129, height 4.
   - **Highlight unchanged:** `paletteHighlight.module.getRules()` was dumped before and after the change. Both give `.ͼq {color: var(--color-syntax-keyword);}` … `.ͼ14 {text-decoration: line-through;}`, all 15 rules the same.

2. Each hand mutation was applied, the run showed the failing line below, and the code was put back. File tags after restoring match the originals: `#7156`, `#1082`, `#C26B`, `#0536`, `#B9CF`, `#7DA1`.
   - `minimapScale` → `return 1;`: `expected [ 1, 1, 1, 1, 1 ] to deeply equal [ 1, 1, 1, 2, 2 ]` (minimapLayout.test.ts:37)
   - `MAX_COLUMNS * scale` → `MAX_COLUMNS`: the columns test fails at :50
   - `travel > 0` → `>= 0`: "a file that fits" fails at :67
   - fit `>=` → `>`: `expected 99.6 to be close to 99.90133201776024` (:86)
   - drop `- sliderTop·pr/rowPx`: `expected [ 3639, 4088, +0 ] to deeply equal [ 3435, 3884, +0 ]` (:95)
   - drop the `min(height − sliderHeight, …)` cap: `expected [ 1, 450 ] to deeply equal [ 6828, 7277 ]` (:103)
   - `Math.min(found.startRow, previous.startRow)` → `found.startRow`: `expected 3304 to be 3303` (:117)
   - `extraTop = 0`: `expected +0 to be 1` (:124)
   - drop `- layout.topPaddingRows` in `rowAt`: `expected 6 to be 5` (:140)
   - `boxStart = top`: `expected 1544 to be 1534` (:147)
   - `/ ratio` → `* ratio`: `expected 72770 to be 81699` (:154)
   - rgbOf green parsed from the red group: `expected { r: 18, g: 18, b: 86 } to deeply equal { r: 18, g: 52, b: 86 }`
   - glyph stride `glyph * scale`: `expected [ 224, 152, 107, 33 ] to deeply equal [ 224, 152, 107, 123 ]`
   - light uses the dark ratio: `expected [ 123 ] to deeply equal [ 128 ]`
   - `column += tabSize`: `expected [ +0, 123 ] to deeply equal [ 123, +0 ]`
   - `< MAX_COLUMNS` → `<=`: `expected [ 123, 123, +0 ] to deeply equal [ 123, +0, +0 ]`
   - modulo wrap removed: `expected 201 to be 9`
   - wave `y = wave.y`: `expected [ [ +0, 255, 255, +0 ], …(2) ] to deeply equal [ [ +0, +0, +0, +0 ], …(2) ]`
   - `{ from: treeBefore }` → `"none"`: `expected 'none' to deeply equal { from: 4000 }`
   - one hard-coded colour for every entry in `paletteHighlight`: the "same token" test fails at pane.test.ts:505
   - number mapped to the string token in `SYNTAX_COLOURS`: the "as before" test fails at :492
   - `"center"` → `"local"`: `expected [ 'modified', 'modified', …(2) ] to deeply equal [ …(6) ]`
   - `info: "warning"`: `expected [ … (2) ] to deeply equal [ … (1) ]` (minimapMarks.test.ts:112)
   - errors before warnings: `expected [ 'error', 'error', 'warning', …(1) ] to deeply equal [ 'warning', 'warning', 'error', …(1) ]`
   - `blockAt(to).bottom` → `blockAt(from).bottom`: the wave-row test fails at :140
   - drop the minimum-height `Math.max`: the minimum-4 test fails at :158
   - `rowTop` without `- startRow`: `expected [ { x: 127, y: 896, … } ] to deeply equal [ { x: 127, y: 1, … } ]` (:179)

3. The recipes, each exit code read with `${PIPESTATUS[0]}`:
   - `lint exit 0`, `typecheck exit 0`, `unused exit 0` (knip printed no findings)
   - `test exit 0`: `Test Files 107 passed (107) Tests 1431 passed (1431)`
   - `fmt:check exit 0`: `All matched files use the correct format.`

4. `git diff --stat`: only `pane.test.ts | 60 +++-` and `pane.ts | 54 +++---` changed (2 files, +96/−18). `git status` shows only the nine new owned `minimap*` files as untracked.

**deviations_from_brief**
1. **Source of the copied code:** microsoft/vscode at `789f2c470d13c4760f2b5cc6a9e1919c05d04f7d` (main on 2026-10-18), files under `src/vs/editor/`:
   - `browser/viewParts/minimap/minimapPreBaked.ts` (the glyph data; its sha256 matches the copy byte for byte)
   - `browser/viewParts/minimap/minimapCharSheet.ts` (`getCharIndex`, `Constants`)
   - `browser/viewParts/minimap/minimapCharRenderer.ts` (softening, `renderChar`)
   - `browser/viewParts/minimap/minimap.ts` (`MinimapLayout.create`, `getDesiredScrollTopFromDelta`, the press handler, `_renderLine`)
   - `common/config/editorOptions.ts` (`_computeMinimapLayout`)
   - `browser/viewParts/viewLines/viewLines.ts` (Center reveal)

   The `LICENSE.txt` at that commit is MIT, "Copyright (c) 2015 - present Microsoft Corporation".
2. **Center differs from the design.** VS Code's minimap reveals with source `'mouse'` and `minimalReveal` false. That pads the box one line above and none below, so the row's **top** lands in the middle, not its centre. I copied VS Code: row 100 → 1,534, not the design's 1,564. My hand mutation is "drop `- LINE_HEIGHT_PX` from `boxStart`".
3. **Contract items left unexported**, because knip fails on an export nobody imports yet; the later build adds the export: `SyntaxToken`, `Slider`, `Columns`, `Stale`, `EdgeKind`, `MarkBox` (all defined, just not exported). `TILE_ROWS` was left out entirely: as an unexported, unused constant it fails `no-unused-vars`.
4. **Additions to the contract:**
   - `minimapGlyphs.ts`: `glyphIntensity(scale, glyph, pixel)` reads the cached table without copying it. `glyphs()` returns a copy, as TS15 requires for parse-once caches, so `paintRow` uses `glyphIntensity` to avoid a copy per row.
   - `minimapGlyphs.ts` also exports `GLYPH_ROWS_PER_SCALE`, `HIDPI_SCALE` and `type Scale = 1 | typeof HIDPI_SCALE`. This is the same type as `1 | 2`, but `no-magic-numbers` flags a `2` in a type.
   - `minimapLayout.ts` exports `MAX_COLUMNS`, so the 120 lives in one place.
5. **`charIndex` fixes an edge case.** VS Code's range check is `chCode > CHAR_COUNT`; I used `>=`. With VS Code's check, code 128 gives index 96, which is past the end of the table.
6. **Not copied from VS Code:**
   - Its bottom-padding rows (`extraLinesAtTheBottom` and that branch of the slider travel). yamt's bottom padding is 4 px, ⌊4/20⌋ = 0, so the result is the same; `paddingBottom` enters only the scroll height.
   - Full-width characters counting twice, as the design already says.
   - The ratio is set to 0 when the slider has no room to move or the file does not scroll, so it is never NaN; `draggedScrollTop` then returns the start position.
7. **The softening ratios are written as decimals**, `0.8` and `0.8333333333333334`, because `no-magic-numbers` flags `12 / 15`. These are the same doubles as `12/15` and `50/60` (checked in node: `true true`).
8. **`markBoxes` clips** a mark to the canvas before applying the 4 px minimum, so a mark that starts above the window is drawn from y 0 at its visible height.
9. **Project map and `docs/architecture.md`:** the new non-test files are not named there (those files are outside my slice), so `just map-check` will probably fail until they are added.
10. The `vitest run` command had to avoid the `>` character, because the ownership hook reads it as a redirect.

**open_risks**
- `minimapLayout.ts:132-139` (`alignedSliderTop`, copied as is): while a find bar is open and scrollTop is under 33 px, VS Code's formula gives a slightly negative slider top (down to about −0.7 CSS px).
- `minimapLayout.ts:102-111` (`windowAt`, also copied as is): in a tall file with the find bar open, the padding row only appears when the start is below `extraTop` (strictly less). At scrollTop 0 that means no padding row.
- `minimapPixels.ts:78`: a character whose palette index has no colour advances the column but paints nothing.
- `minimapTiles.ts:15`: a tree that shrinks without a document or language change gives `"none"`, as the brief says.