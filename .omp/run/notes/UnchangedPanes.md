# UnchangedPanes — 3.U-panes round 1 (board "Unchanged lines" row 2)

Brief `docs/slices/briefs/3.U-panes.md`; base `7908f02`. Verbatim implementer report below.

---

All three panes now collapse unchanged runs behind a wave line, and a click shows the next step in every pane at once. All 11 acceptance lines were observed. The rendering differs from the brief in one place: the brief's block-widget design let ArrowDown jump straight over the wave, failing acceptance 5, so I built it differently (see deviations).

**summary**
- Each pane computes its runs when the file opens, with steps that keep 4, 8 and 16 lines next to each change (`foldRuns.ts`). The middle owns which steps are still hidden and the sides mirror the counts (`folds.ts`).
- The wave is one overlay per run in the line-number gutter. It spans the visible pane, is drawn with a CSS mask in `--color-diff-wave`, and has no line number (`foldView.ts`).
- One listener set covers all five hosts: hover thickens that run's wave everywhere, and a click shows the next step without moving the keyboard (`folding.ts`). Find or a selection inside hidden lines shows them in all three panes.
- The once-per-frame paint moved to `frame.ts`. `index.ts` is now 297 lines and `MergeController`'s public surface is unchanged.

**files_changed**
- New: `frontend/src/editor/internal/{docPos,foldRuns,folds,foldView,folding,frame,paneDocs}.ts`, `frontend/src/editor/internal/{foldRuns,folds,foldView}.test.ts`
- Changed: `frontend/src/editor/index.ts`, `frontend/src/editor/internal/{chunkField,geometry,geometry.test,indent,indent.test,pane,sideFocus,viewport,viewport.test}.ts`, `frontend/src/connectors/index.ts`, `frontend/src/connectors/index.test.ts`, `frontend/src/style.css`

**tests_added**
- `foldRuns.test.ts` (9 tests):
  - 4/8/16 lines are kept next to each change, and nothing is kept at the file's top or bottom.
  - A file with no changes has one level per pane (an equal level is dropped).
  - A 9-line run hides nothing; a 10-line run hides its 2 middle lines once.
  - An empty document is null in its pane, and a run long only in the middle still makes its levels.
  - A level that differs in one pane only is kept.
  - A hidden range ends at the end of its last line, and `displayed` falls back to the next level.
- `folds.test.ts` (13 tests):
  - An insert above shifts the ranges; typing at a range's first or last character shows that line only.
  - Deleting a level down to one line shows it, and undo does not hide it again.
  - `actionSteps` and bulk apply keep every hidden text and count.
  - Clicks drop the outer level, then the next, then empty the run; a larger `keep` never hides.
  - `undo()` after a click is false.
  - A find match shows levels through the innermost one holding it; a match ending at `to` shows it; a cursor at `from`/`to` does not.
  - Side and middle `revealKeep` agree; the push guard sends nothing when the counts are equal and the sides mirror them.
- `foldView.test.ts` (3 tests): one replace per run over the outermost range with a range; the next level in a pane null at the outer one; nothing for an emptied run.
- `connectors/index.test.ts`: the exact `waveTile()` string, tile size 20×8, `waveCenterY(20) === 10`.
- `viewport.test.ts`: a wave line at the top or bottom of the pane is skipped by `textLineEdges`.
- `geometry.test.ts` (extended): `rowsChanged` reports a fold step.
- Failing paths, each broken by hand, run and restored (the full suite passes again, 723/723):
  - `MIN_HIDDEN_LINES` set to 3 → "a run of 9 lines hides nothing…" fails: `expected [] to deeply equal [ '16-17' ]`.
  - Wave crest flipped → tile test fails: `Received: "M0 1 Q2.5 4 5 4 …"`.
  - `firstIsWave = false` → viewport test fails: `expected { first: 2, last: 49 } to deeply equal { first: 41, … }`.
  - `mapPos(from, -1)` → "typing at a hidden range's first…" fails: `Expected "38-66" Received "37-66"`.
  - `kept >= length` guard removed → "a step that keeps more levels…" fails.
  - `anchor >= from` → "a cursor at a range's first or last position…" fails.
  - Push guard removed → "the sides are told the counts only when they differ…" fails.
  - `displayed` reads only level 0 → the `foldRuns` and `foldView` fallback tests fail.
  - Equal-level drop removed → "a file without changes…" fails: `[ [ '1-31', '1-31', '1-31' ] ]`.
  - `rowsChanged` checks only the first field → the geometry fold-step test fails: `expected false to be true`.

**smoke_evidence**
WebKit fixture page (`pnpm -C frontend dev --port 5287`, `just webdriver 4487`, MiniBrowser capabilities), driven by WebDriver pointer, wheel and key actions; file `language-tools-script-setup.ts`; screenshots in `/tmp/yamt-fold/`.
1. **Waves per pane.**
   - Every wave is 20 px tall. Left and middle have runs 0, 1, 3, 4. Right has 0, 1, 3 in the DOM; its run-4 wave is only out of CodeMirror's rendered range (it was the same pane-wide wave mechanism).
   - Rows: `~0 83 84 … 91 ~1 103 …` (left) and `~0 83 … 93 ~1 105 …` (middle and right). There is no wave for the 3-line run 2.
   - After scrolling the middle (window 1600×600), wheel 70 gives run-1 tops `262.5/262.5/262.5`, and wheel 360 more gives run-3 tops `262.5/262.5/262.5`.
   - In a 950 px window the left pane hits its scroll end (`scrollTop 151`, max) and is 40 px off — the clamped case the strips' S-curve is for (`s1-aligned-run*.png`).
2. **Hover.** On the middle's run-3 wave: `{"total":3,"perPane":["3","3","3"],"cursor":"pointer"}`. Moved off: `{"total":0}` (`s2-hover.png`).
3. **Clicks from the middle, left pane focused on a change.**
   - Before: `left 117 [wave 3] 359 | center 121 [wave 3] 363 | right 121 [wave 3] 363`.
   - Click 1: `121/355 | 125/359 | 125/359`. Click 2: `129/347 | 133/351 | 133/351`. Click 3: `no wave 3` in all panes.
   - After every click: `active "left cm-content"`, `leftFocused true`, outline `solid rgb(56, 113, 225)` on lines `107,108,109`, `centerSelection "0-0"`.
4. **Clicks on the left pane's wave.** The element under the pointer is `fold-wave in gutter` at both the gutter part and the text part. Each click gives `121/355 | 125/359 | 125/359`.
5. **Arrow keys in the middle.** From line 93 col 4, ArrowDown puts the cursor at `pos 3248, caret top 334` (on the wave row). A second ArrowDown goes to line 105. ArrowUp and ArrowUp go back through the wave to line 93. The wave stays: `93 [wave 1] 105`.
6. **Find in the left pane.**
   - Typing `__VLS_setup` (only on left line 135, inside run 3) gives `selected "__VLS_setup"`, `visible true`.
   - The rows stay aligned: tops `left 503, center 503, right 503` (same text on all three lines), and run 3 shows `no wave 3` in all panes.
   - With the bar over the run-1 wave, the element stack is `find-field, find-bar, cm-panels, fold-wave, …` (`s6-bar-over-wave.png`).
   - Find in the middle also reveals: line 139 visible, run 3 gone everywhere.
7. **Horizontal scroll in the middle.** `scrollLeft 0 → 300`; every wave keeps `left 713 width 419` (`s7-hscroll.png`).
8. **Apply, undo, redo (chunk 0, Local's Apply arrow).** Left and middle show 4 waves and right 3 in the DOM at every step (right's run 4 only out of rendered range).
   - Start: center `^[~0]83 93[~1]105 121[~3]363 384[~4]`.
   - After apply: `91[~1]103 119[~3]361 382[~4]` — the document lost 2 lines, the hidden text is the same.
   - Undo: the start numbers exactly. Redo: the after-apply numbers again.
9. **Theme.** Dark: `rgb(85, 85, 85)`. Light (Settings → Light): `rgb(208, 208, 208)`. Dark again: `rgb(85, 85, 85)` (`s9-light.png`).
10. **Scroll timing**, 200 frames on the middle, 3 rounds each:

    | | median | mean | p95 | max |
    |---|---|---|---|---|
    | before (`72e68d1`) | 50 ms | 50.0–50.5 ms | 56–65 ms | 73–77 ms |
    | after (this slice) | 50 ms | 49.9–50.7 ms | 52–65 ms | 65–73 ms |

    WebKit paced requestAnimationFrame at 20 Hz in this session for both trees, so frames over 25 ms are 197–198 in both. Frames over 1.5× the median: one in the before tree (77 ms), none after. No worse.
11. **Layer recipes.** `pnpm lint`, `typecheck`, `unused`, `sfc-order` all exit 0. `test`: `Test Files 65 passed (65) / Tests 723 passed (723)`. `fmt:check`: `All matched files use the correct format.`

**deviations_from_brief**
- **The hidden lines are an inline `Decoration.replace({ widget })`, not `block: true`.** CodeMirror's vertical motion skips block widgets by design (`posAtCoords` with `scanY` in `@codemirror/view`), so ArrowDown jumped from line 93 straight to 105 and acceptance 5 failed. With the inline replace, the hidden lines form one 20 px text line and the cursor stops on it once. Plan #63 wins here. Knock-on changes:
  - The wave marker goes through `lineNumberMarkers`, not `lineNumberWidgetMarker`; the number is suppressed because the gutter sees another marker.
  - The widget has no `estimatedHeight`. `LINE_HEIGHT_PX` still feeds `pane.ts`'s line height and the wave's position.
  - The atomic ranges are the replaced range `[from, to]`, not `[from, next line start)`: with the latter, the landing position `to` sat inside the range and was pushed to the line below. `foldAtoms` was removed; the atomic set is the decoration set.
  - `textLineEdges` recognises a wave as a line block spanning more than one document line, instead of `BlockType.WidgetRange`.
- **The theme rules live in `foldView.ts`'s theme, not `pane.ts`.** That is `.cm-scroller { container-type: inline-size }` and `.cm-gutter.cm-lineNumbers { overflow: visible }`; the wave is their only reason, and `pane.ts` is near the 300-line cap.
- **No `folds: () => readonly Fold[]` getter yet.** Nothing in this slice reads it. The frame drops its cache through `layoutFields`, which include both fold fields. The next slice adds the getter when it reads waves.
- **`Frame` also owns `ScrollSync`** (creation and `destroy`), so `index.ts` stays under 300 lines. `Folding` is built before the views, because a gutter marker needs the hover getter on the first render; the first try crashed the gutter plugin and the line numbers disappeared.
- **Contract names as built:**
  - `connectors`: `waveTile()`, `waveCenterY(lineHeight)`, `WAVE_TILE_WIDTH_PX`, `WAVE_TILE_HEIGHT_PX` are exported. `WAVE_STEP_PX`, `WAVE_HALF_HEIGHT_PX`, `WAVE_GAP_PX` stay private constants in the same file (no importer yet; `waveJoinPath` will live beside them).
  - `foldRuns.ts`: `Hidden`, `FoldLevel`, `Fold`, `foldRuns`, `displayed`, `MIN_HIDDEN_LINES`, `sameHidden`.
  - `folds.ts`: `showFolds`, `foldField`, `revealKeep`, `showNextStep`, `sideFoldField`, `sideFoldPush`, `pushFolds`, `sideReveals`; `mapHidden` is private.
  - `foldView.ts`: `foldView(field, pane, hovered)`, `foldDecorations`.
  - `folding.ts`: `Folding` (with `hovered()` and `destroy()`), `foldRunAt`, `FOLD_RUN_ATTRIBUTE`, `HOVER_CLASS`.
  - `frame.ts`: `Frame` with `changed`, `layout`, `request`, `destroy`.
  - `docPos.ts`: `DocPos`, `toDocPos`, moved from `chunkField.ts`.
  - `paneDocs.ts` (new): `lineSeparator`, `paneDoc`, `paneDocs`, `middleText`.
- **Other signature changes:**
  - `rowsChanged(update, fields[])` instead of a single field.
  - `indentUnitOf(lines: Iterable<string>)`.
  - `paneState` takes `doc: string | Text`.
  - `centerPane` uses `middleText`.
  - `.fold-wave` carries `aria-label="Show unchanged lines"` and `role="button"`.
- **For the map:** `docs/architecture.md` and the project map need the files and names above, the state-table row ("which fold steps still hide": the middle's `foldField`, with the sides mirroring counts through `sideFoldField`, no history), and the `--color-diff-wave` token.
- **Not changed:** `editor/AGENTS.md` does not list internals, so it was left alone.

**open_risks**
- **For the strips slice:**
  - A wave is a text line block: use `lineBlockAt(displayed.from)` for its top; it is not `BlockType.WidgetRange`.
  - `folding.ts` already listens on both strip `<svg>`s, so any node with `data-fold-run` gets hover and click.
  - When a pane is clamped at its scroll end, wave rows are not level. This was observed in a 950 px window: left 40 px off with `scrollTop 151` at its max. The joins must draw the S-curve there.
- **The overlay's `100cqi`** equals the scroller's width, including the scrollbar area: 419 px at `left` 254/713/1172 (`foldView.ts`, `.fold-wave`).
- **The middle's starting cursor** is at position 0, the start of run 0's hidden lines, so the active-line tint shows on the top wave row until the user moves (seen in `s9-light.png`). Typing there shows line 1, as plan #63 says.
- **`sideReveals`** (`folds.ts`) is proven only by the WebKit smoke (acceptance 6): it needs live views, so it has no node test.
- **The scroll timing** ran at WebKit's 20 Hz requestAnimationFrame pacing in this session, so it shows parity rather than per-frame headroom.