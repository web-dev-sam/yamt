I found one blocking issue and five smaller ones (four `should`, one `nit`), so the verdict is fail. The block: `markBoxes` works out two minimap facts again instead of taking them from `minimapLayout.ts`. These are the canvas height and how document pixels map to minimap rows. The window build will need both facts too, which would make a third copy.

```json
{
  "verdict": "fail",
  "findings": [
    {
      "file": "frontend/src/editor/internal/minimapMarks.ts",
      "line": 61,
      "problem": "markBoxes works out two minimap facts again: the canvas height in device px (`Math.floor(pixelRatio * height)`, :61, the same expression as `fitting` at minimapLayout.ts:71) and the row rule 'row n covers document px (n−1)×LINE_HEIGHT_PX to n×LINE_HEIGHT_PX' (:65-66, :70-71, also in minimapLayout.ts viewportStart and centredScrollTop). The window build must size the canvas and turn block tops into rows too, so a third copy would come, and a floor/round difference between copies would put the edge marks a device px away from the code rows.",
      "fix": "Add `canvasHeight` (device px) to `MinimapLayout`, computed once in `minimapLayout`, and export a `rowOfTop(top)` / `topOfRow(row)` pair from minimapLayout.ts. Use them in markBoxes, viewportStart and centredScrollTop, and name them to the window build.",
      "severity": "block",
      "rule_id": "vision-2"
    },
    {
      "file": "frontend/src/editor/internal/minimapLayout.ts",
      "line": 1,
      "problem": "windowAt, steadied and alignedSliderTop, and paintRow's tab rule in minimapPixels.ts, follow VS Code's `MinimapLayout.create` and `_renderLine` line by line with no source named. A reader cannot find out where names like `considering` or the strict `start < extraTop` padding branch come from. The plan row draft says these parts are copied, while THIRD_PARTY_NOTICES.md and copied_entries() in third-party-licenses.sh name only minimapGlyphs.ts. As more VS Code behaviour is ported, nobody can tell which files the MIT notice has to cover.",
      "fix": "Add a header to minimapLayout.ts like the one in minimapGlyphs.ts: the vscode commit, minimap.ts `MinimapLayout.create`/`getDesiredScrollTopFromDelta`, editorOptions.ts `_computeMinimapLayout`, and the MIT line. Add a one-line `_renderLine` reference at paintRow. The orchestrator then decides whether the notice also covers minimapLayout.ts and minimapPixels.ts.",
      "severity": "should",
      "rule_id": "CP1"
    },
    {
      "file": "frontend/src/editor/internal/minimapGlyphs.ts",
      "line": 33,
      "problem": "`glyphs()` (a full copy of the table on every call) is now imported only by minimapPixels.test.ts; `paintRow` and the window build read through `glyphIntensity`. The module therefore has two ways to read the table, and one of them exists only for a test. Nothing gets harder beyond that, but it is a test-only export that knip cannot flag.",
      "fix": "Have the `T` tests read the table through `glyphIntensity(scale, charIndex(T), pixel)` and remove `glyphs()`, recording the contract change for the window build.",
      "severity": "should",
      "rule_id": "TS16"
    },
    {
      "file": "frontend/src/editor/internal/pane.test.ts",
      "line": 461,
      "problem": "The test name 'the pane's highlight styles every tag as before the syntax table' describes this change rather than a rule. Once merged, 'before' means nothing to a reader, against Acceptance 1 ('names stating the rule'). Nothing else gets harder.",
      "fix": "Rename it to the rule it pins, e.g. \"the pane's highlight: each tag's colour token, bold headings and strong, italic emphasis, struck-through strikethrough\".",
      "severity": "should",
      "rule_id": "R-open-1"
    },
    {
      "file": "frontend/src/editor/internal/minimapLayout.ts",
      "line": 41,
      "problem": "`type Window` shadows the DOM's global `Window` in a file the minimap element will sit next to, and `Sizes` (:35) says nothing about its three fields. A reader of `steadied(…): Window` has to check that it is not the browser window, and this gets worse once the window build imports this file next to DOM code.",
      "fix": "Rename `Window` to `RowWindow` (startRow + topPaddingRows) and `Sizes` to `WindowInputs`, or pass the three numbers as parameters of `windowAt`.",
      "severity": "should",
      "rule_id": null
    },
    {
      "file": "frontend/src/editor/internal/minimapLayout.ts",
      "line": 45,
      "problem": "`const HALVES = 2` (also minimapPixels.ts:33 and minimapMarks.ts:25) is a second way to name halving, next to the `HALF = 0.5` used in connectors/index.ts, foldView.ts and stripIcons.ts. Nothing gets harder beyond a second spelling.",
      "fix": "Use `const HALF = 0.5` and `* HALF` in the three files, as the existing modules do.",
      "severity": "nit",
      "rule_id": null
    }
  ],
  "checked": [
    "Ownership: the commit touches only the nine new owned minimap* files, pane.ts and pane.test.ts, plus .omp/run/notes/MinimapData.md, which is the orchestrator's report commit. markLanes, marks and markJump are not on the branch and nothing imports them.",
    "One source for syntax colours: pane.ts:124-157 has SYNTAX_COLOURS feeding both paletteHighlight (`color: var(${colour})`) and syntaxColourClasses (tagHighlighter, class = token). removalTooltip.ts still uses paletteHighlight unchanged. pane.test.ts:495-508 checks that both give each tag the same token, including inherited tags (controlKeyword, docComment, definition(propertyName)).",
    "Every SyntaxToken name is in style.css for dark (:43-52) and light (:103-112) as #rrggbb, which rgbOf reads.",
    "paneTone reused: changeMarks calls tone.ts paneTone(chunk, status, \"center\"); there is no second tint rule.",
    "MAX_COLUMNS: defined once (minimapLayout.ts:43) and used by minimapColumns and paintRow's cut. The window brief's `block.from + 120` is the window build's to change to MAX_COLUMNS.",
    "Edge widths: EDGE_CSS_PX 6 (layout) and the mark's 4 px width with 1 px inset (marks) are separate facts in the brief contract. The mark stays inside the edge at dpr 1 (1+4≤6), 1.25 (1+5≤8), 2 (2+8≤12) and 3 (3+12≤18).",
    "Import edges: minimapPixels → minimapLayout → minimapGlyphs/pane; minimapMarks → minimapLayout/geometry/pane/tone/connectors index; no cycle, no vue, tauri or ~icons import, no sibling internal/ (PM2, PM3, PM5).",
    "Growth: each new file holds one concept (layout geometry, glyph data, pixel writing, staleness rule, edge marks); pane.ts already owned paletteHighlight, so the table is the same job. The modules hold no state (TS15).",
    "SEVERITY_EDGE is a Readonly<Record<Diagnostic[\"severity\"], …>> over every severity (TS17, total).",
    "minimapGlyphs.ts header: names Microsoft Corporation, the MIT licence, commit 789f2c4 and both source files; it matches the notice text in third-party-licenses.sh copied_entries().",
    "Comments: the SOFTEN comment (minimapCharRenderer.ts), the centredScrollTop comment (viewLines.ts _computeScrollTopToRevealRange) and the glyph layout comment (renderChar) are external facts with a reference (CP1); production code has no narration.",
    "Deviation 1 (source commit and files): accepted, it matches the notice.",
    "Deviation 2 (Center: the row's top in the middle, row 100 → 1,534): accepted, it copies VS Code's 'mouse' reveal, and 3.M-minimap-window.md:11-12 already adopts it.",
    "Deviation 3 (contract types unexported, TILE_ROWS absent): accepted, as given; the window brief :10-11 adds them.",
    "Deviation 4 (glyphIntensity, Scale/HIDPI_SCALE/GLYPH_ROWS_PER_SCALE, MAX_COLUMNS exported): accepted, each has a production importer; glyphs() is reported above.",
    "Deviation 5 (charIndex `>=`): accepted. VS Code's CHAR_COUNT is 96, so `> CHAR_COUNT` returns 96 (out of range) for code 128.",
    "Deviation 6 (no bottom padding rows; ratio 0 instead of NaN): accepted, since floor(4/20)=0 and the slider is null in that case.",
    "Deviation 7 (decimal softening constants): accepted; the comment names 12/15 and 50/60.",
    "Deviation 8 (clip before the minimum height): accepted, per the brief's 'clamped inside the canvas'.",
    "Deviation 9 (map-check and architecture not updated): the orchestrator's job, as given.",
    "Open risks (negative slider top under the find bar, strict padding branch): accepted, both are VS Code's own formulas, copied as the brief directs.",
    "Open risk (missing palette entry paints nothing): accepted; the design's fallback to --color-code belongs to the window build that fills the palette.",
    "Open risk (shrunk tree → none): accepted, per the brief.",
    "No gate run (RV6)."
  ]
}
``````json
{
  "verdict": "fail",
  "findings": [
    {
      "file": "frontend/src/editor/internal/minimapMarks.ts",
      "line": 66,
      "severity": "block",
      "rule_id": "R-boundary",
      "problem": "The window filter `bottom >= first && top <= last` keeps a change that ends exactly where the window starts, and one that starts exactly where it ends, so both get drawn next to rows that have no change. Probe with tsx, layout at 72,770 with rows 3,435–3,884: a mark on row 3,434 (`top 3433×20, bottom 3434×20`) gives `{y:0,height:4}`, and a mark on row 3,885 gives `{y:896,height:4}`. 'only marks in the window' tests only row 3,900, so it would still pass with the boundary off by one either way.",
      "fix": "Keep a span only if it overlaps the window strictly, and keep a zero-height insertion point if it lies inside or on the boundary: `top === bottom ? first <= top && top <= last : first < bottom && top < last`. Add three cases to 'only marks in the window': rows 3,434 and 3,885 are dropped, and an insertion point at `3434×20` is kept."
    },
    {
      "file": "frontend/src/editor/internal/minimapMarks.test.ts",
      "line": 146,
      "severity": "should",
      "rule_id": "R-test-gap",
      "problem": "`markBoxes` is tested only at pixel ratios 1 and 2, where `MARK_INSET_CSS_PX * pixelRatio` and `MARK_WIDTH_CSS_PX * pixelRatio` are already whole numbers. Dropping either `Math.round` (line 60/61) would give a 1.25 px x at ratio 1.25 and still pass, and a fractional x blurs the mark. As the app grows, nothing pins the device-pixel rounding that the canvas build depends on.",
      "fix": "Add one ratio-1.25 case, for example on `minimapColumns(1.25).right`: x = 128 + 1 = 129, width 5, a one-row mark 5 tall (my probe gives `{x:129,y:21,width:5,height:5}` for row startRow+11)."
    }
  ],
  "checked": [
    "Layout matches VS Code exactly. I transcribed `MinimapLayout.create` at 789f2c4 (minimap.ts:280-411) and compared it with `minimapLayout` in tsx, with `./pane` stubbed to give LINE_HEIGHT_PX 20 (no file written). That was 120,000 random cases: ratios 1, 1.25, 1.5, 2 and 3; padding top 4 or 33 (the find space); rows 1–20,000; scrollTop at 0, inside the padding, mid-file and at the end; six chained steps each so the previous layout counts. startRow, endRow, topPaddingRows, whether there is a slider, slider top and height, and the ratio: 0 mismatches.",
    "The file that fits (minimap.ts:364-367: slider only if maxSliderTop > 0), the taller file's own window, and the flicker guard (:386-399) are copied right. The only branch left out is extraLinesAtTheBottom; it is 0 for yamt's 4 px bottom padding, and I found no scrollPastEnd in `editor/`. Deviation 6 accepted.",
    "Press row is right. VS Code's `canvasInnerHeight/canvasOuterHeight` equals pixelRatio, because editorOptions.ts:2807 sets outer = inner/pixelRatio, so `offsetY * pixelRatio` is the same factor. The clamp to [1, rows] matches `min(lineCount)` plus Range validation (minimap.ts:1259-1268).",
    "Center (deviation 2) accepted. `revealLineNumber` passes source 'mouse' with minimalReveal false (minimap.ts:1134-1139). viewLines.ts:720-736 then pads the box with one line above and none below, so (boxStart+boxEnd)/2 is the row's top, and row 100 → 1,984 − 450 = 1,534 is right.",
    "Drag is copied right: `round(scrollTop + delta / ratio)` from the layout at the press (minimap.ts:252-253, 1345). A ratio of 0 returns the start (deviation 6).",
    "Scale and columns match editorOptions.ts:2796 and 2810-2811: scale 2 at ratio ≥ 2, row 2×scale device px, char `scale` device px, 120 columns. At ratio 1.25 the code column is 96 CSS px and each edge is round(7.5) = 8 device px.",
    "Glyph data is identical to VS Code's: the sha256 of the hex strings in minimapGlyphs.ts and minimapPreBaked.ts at 789f2c4 is the same (b0633dd1…). The strings are 192 bytes (96×2) and 768 bytes (96×8). The stride `glyph*scale*scale*2 + dy*scale + dx` matches `renderChar`'s `charIndex*charWidth*charHeight`.",
    "Glyph blend: softening ×12/15 on dark and ×50/60 when `backgroundIsLight` (minimap.ts:1979), truncated like `toUint8`. RGB of the token with alpha = intensity composites to VS Code's `bg + delta*c` over an opaque background (foregroundAlpha 255).",
    "`_renderLine` copied: tab advances `tabSize - column % tabSize`, a space advances, and nothing is drawn past column 120. Deviation 5 accepted: VS Code's `> CHAR_COUNT` lets code 128 index glyph 96, past the table.",
    "Edges as specified: insertion point centred (deleted at 3,499×20 → y 128, height 4); last row clamped (y 896); a mark starting above the window is clipped (y 0, height 12, deviation 8 accepted); the 33 px find space shifts row 1 by one row at ratio 2 (y 2, height 8); minimum height round(4×ratio).",
    "A problem in collapsed lines lands on its wave row through `blockAt(from).top` and `blockAt(to).bottom` (minimapMarks.test.ts 'a problem in collapsed lines on its wave row'). Info and hint are dropped; warnings come before errors.",
    "The end of the document: the 'the end' test pins rows 6,828–7,277, the slider at 810.4 and rowTop(7277) = 898. The cross-check covered scrollTop = max scroll at every ratio.",
    "Open risks 1 and 2 accepted. The slightly negative slider top while scrollTop < paddingTop, and no padding row in a tall file, are VS Code's own formulas (minimap.ts:378-383, 405-409). With extraTop ≤ 1, `start < extraTop` cannot happen in windowed mode, so steadied's topPaddingRows branch is inert for yamt. Open risk 3 (a palette index with no colour paints nothing) is harmless. Open risk 4 (a shrinking tree gives none) follows the brief.",
    "pane.ts: the 'as before' test pins all 25 tag styles. 'same token' compares `syntaxColourClasses` with `paletteHighlight` over every SYNTAX_COLOURS tag plus derived tags (controlKeyword, docComment, definition(propertyName)) and tags with no colour (variableName, heading). Every --color-syntax-* token in style.css is #rrggbb, so `rgbOf` reads all of them in both palettes.",
    "Design 'Tests' tables: every listed test exists, including `languageChanged` → all. Each hand mutation in the report targets the line its test pins; I read each test and agree it would fail.",
    "Deviation 3 accepted (unexported contract types and TILE_ROWS are knip-driven; row 3 exports them). Deviations 4 and 7 accepted (0.8 and 0.8333333333333334 are the same doubles as 12/15 and 50/60). Deviation 9 (project map and architecture entries missing) is outside the owned files and left to the orchestrator.",
    "No risk register row owns these files. No transactions are dispatched, so CM1–CM9 do not apply. `problemMarks` only reads `forEachDiagnostic`.",
    "I ran no vitest file. The probes were `tsx -e` runs on the layout and marks modules with `./pane` and `./tone` stubbed."
  ]
}
```