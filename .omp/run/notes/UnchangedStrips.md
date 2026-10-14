# UnchangedStrips — 3.U-strips round 1 (board "Unchanged lines" row 3)

Brief `docs/slices/briefs/3.U-strips.md`; base `d69b61b`. Verbatim implementer report below.

---

**summary**
- The wave now crosses both connector strips. Each strip draws one join per run where both of its panes show a wave, using WebStorm's `drawConnectorLine` shape. The join is level when the panes line up and an S-curve when they don't (`connectors.waveJoinPath`).
- Where each pane's wave sits is worked out once per layout, not on every scroll frame. `geometry.waveRows` reads each pane's wave top from the cached layout, and `gap.wavePaints` places the joins on each frame from those tops, the pane shifts and `waveCenterY`.
- Each run gets one kept `<g data-fold-run>` in a new layer between the bands and the icons (`stripWaves.ts`). It holds a transparent hit path one line height wide and a visible 1 px path that goes to 2 px under `.fold-wave-hover`. The existing `Folding` listeners handle hover and click; nothing new listens. Read-only views draw the joins too.
- `connectors` now exports `WAVE_STROKE_PX = 1` and `WAVE_HOVER_STROKE_PX = 2`; the strip paths use them, so no stroke number is copied into `strips.ts` or `theme.css`.

**files_changed**
- `frontend/src/connectors/index.ts`, `frontend/src/connectors/index.test.ts`
- `frontend/src/editor/internal/{gap,geometry,frame,strips}.ts`, `frontend/src/editor/internal/{gap,geometry}.test.ts`
- `frontend/src/editor/internal/stripWaves.ts` (new; the grant came from Main)
- `frontend/src/editor/theme.css`
- `frontend/src/editor/index.ts`: only the `new Frame({ … })` call, net +1 line (297 → 298)

**tests_added**
- `connectors/index.test.ts`:
  - "a level join wider than five steps…": exact strings at 38 px and at 26 px.
  - "a level join of five steps or fewer is one sagging curve": 20 px, and exactly 25 px.
  - "a join falling to the right…" (`left > right`) and "a join rising to the right…" (`left < right`): exact strings.
  - "a slope of exactly one in five is no longer level": the `< 0.2` boundary.
- `gap.test.ts`:
  - "a strip joins a run only where both of its panes show a wave"
  - "an empty side gets no joins on its strip while the other strip keeps them"
  - "a join runs between the waves' centres, each pane moved by its own shift" (y = top + shift + 10)
  - "a join is kept while either wave line touches the strip and dropped once both have left it" (the edges ±1 px)
- `geometry.test.ts`:
  - "each pane's wave top is the block top at the start its own pane shows…", with an injected block-top function.
  - "a pane with fewer runs than the middle shows no wave for the missing runs"
- Failing-path proofs for the `editor/` rules: each rule broken by hand, run, then restored.
  - `&&` → `||` in the "both panes" check: `expected [ +0, 1, 2, 3 ] to deeply equal [ +0, 2 ]` and `expected [ +0, 1 ] to deeply equal []`.
  - Remote strip paired with the wrong panes: 3 tests fail (`expected [ +0, 1, 2, 3 ] to deeply equal [ 1, 2 ]`).
  - No `waveCenterY` offset: `- "d": "M0 115 C10 127 …"` / `+ "d": "M0 105 C10 117 …"`.
  - No line-height pad on the strip filter: `expected [ 2 ] to deeply equal [ +0, 2 ]`.
  - `waveRows` reading the middle's starts for every pane: both geometry tests fail.

**smoke_evidence**
Fixture page `pnpm -C frontend dev --port 5291` with `just webdriver 4491` (MiniBrowser, window 1600×950, file `language-tools-script-setup.ts`). Pointer moves, clicks and drags are WebDriver actions. Screenshots are in `/tmp/yamt-strips/`.
1. **One join per run, end points at the wave centres.**
   - Left strip: runs 0, 1, 3; right strip: runs 0, 1, 3. Every start and end matches the pane wave's centre exactly, e.g. `run 0: level start 102.5 vs left wave 102.5, end 102.5 vs right wave 102.5`.
   - Where the panes line up the join is the level form: right strip run 1 `M0 254 Q2.5 257 5 257 Q7.5 257 10 254 Q12.5 251 19 251 Q25.5 251 28 254 Q30.5 257 33 257 Q35.5 257 38 254`.
   - After scrolling, `run 4: level start 891.5 vs left wave 891.5, end 891.5 vs right wave 891.5`.
   - Computed style: stroke `rgb(85, 85, 85)`, 1px; hit path 20px wide, cursor `pointer`.
2. **S-curves when the panes clamp.** After wheel scrolling (70, then 360) the scroll tops are `[151,271,271]`, with the left pane at its maximum. The left strip shows `run 1: S-curve start 151.5 vs left wave 151.5, end 71.5 vs right wave 71.5` and `run 3: S-curve start 471.5 … end 431.5`. Screenshot `s1-more.png`.
3. **Hover.**
   - Pointer on the right strip's run-3 join at (1152, 431.5): `"underPointer":"strip-wave-hit","cursor":"pointer","hovered":["pane:3","strip:3","pane:3","strip:3","pane:3"]`, and both strips report `width 2px hover true` (`s3-hover-right-3.png`).
   - Pointer moved off: `"hovered":[]`.
4. **Click with the left pane focused.**
   - Wave rows `117 ~3 359 | 121 ~3 363 | 121 ~3 363` became `121 ~3 355 | 125 ~3 359 | 125 ~3 359`: the next step shows in all three panes.
   - Focus did not move: `active cm-content` before and after, and `{ focusedLeft: 254, activeInFocused: true, hovered: 0 }`.
5. **Icons still work.**
   - An Apply press goes `3 changes · 1 conflict` → `2 changes · 1 conflict`, and undo restores it.
   - A drag from the first to the last Local Apply icon crosses the strip's wave joins and marks all three `covered:true` mid-drag; on release `3 changes · 1 conflict` → `1 change · 1 conflict`.
   - The same drag script on the base tree (`git archive HEAD`, port 5292) gives exactly the same before, mid-drag and after states and the same icon positions.
6. **Scroll timing.** 200 frames on the middle, interleaved, 3 rounds; "late" means more than 1.5× the median.

   | round | before (d69b61b): median / mean / p95 / max / late | after (this slice): median / mean / p95 / max / late |
   |---|---|---|---|---|
   | 1 | 50 / 51.5 / 65 / 80 / 2 | 50 / 50.7 / 54 / 72 / 0 |
   | 2 | 50 / 50.8 / 59 / 75 / 0 | 50 / 51.1 / 63 / 77 / 1 |
   | 3 | 50 / 50.9 / 59 / 80 / 1 | 50 / 50.6 / 54 / 79 / 1 |

   Late frames total 3 before and 2 after, so no worse. WebKit paced frames at 20 Hz in both trees, as in the panes report.
7. **Layer recipes.** `lint`, `typecheck`, `unused`, `fmt:check` and `sfc-order` all exit 0 (`All matched files use the correct format.`). `test` exits 0 with `Tests 734 passed (734)`.
- **Mutants.** `just mutants HEAD` on `connectors/index.ts`: 173 killed, 1 survived, score 99.43. The survivor is `index.ts:112` `y1 > y2` → `y1 >= y2`. It is equivalent: for any width > 0, equal y values always take the level branch, so the two differ only on a strip of width 0 or less, which shows nothing.

**deviations_from_brief**
- **New file** `frontend/src/editor/internal/stripWaves.ts` (class `StripWaves`: `layer`, `paint(paints, hovered)`). Main granted it as option A, because `strips.ts` would have reached 333 of 300 lines. The project map's editor internals line and `docs/architecture.md` need this file.
- **New exports:**
  - `connectors`: `waveJoinPath`, `WAVE_STROKE_PX`, `WAVE_HOVER_STROKE_PX` (the last two at Main's request).
  - `geometry`: `waveRows`, `WaveRow`.
  - `gap`: `wavePaints`, `WavePaint`.
  - `stripWaves`: `StripWaves`.
- **`waveRows` takes each pane's displayed start, not the folds.** Its signature is `waveRows(starts: Record<Pane, (DocPos | null)[]>, blockTop)`, and `frame.ts` maps each pane's own fold field through `displayed`. Importing `foldRuns` into `geometry.ts` created the cycle `foldRuns ↔ geometry`, which `fences.test.ts` (PM5) rejects.
- **`FrameParts` changed.** `layoutFields` became `folds` (the controller's `#folds`), and the field list `[spans, folds.center, folds.sides]` is built inside `Frame.changed`. `FrameParts` also gained `hovered: () => number | null`, because `Strips` is built at `index.ts:86`, which I don't own, so the hover getter comes through the frame.
- **`Strips.paint` signature** is now `paint(views, { rows, waves }, { covered, hovered })`.
- **Stroke widths reach CSS as custom properties.** `StripWaves` sets `--strip-wave-hit` (`LINE_HEIGHT_PX`), `--strip-wave-stroke` and `--strip-wave-hover-stroke` on its layer, and `theme.css` reads them. This is how the 1/2 px values keep one source in TypeScript.
- **Line height for the joins is `pane.ts`'s `LINE_HEIGHT_PX`**, the same constant `foldView.ts` uses for the pane wave, rather than `defaultLineHeight`. A join is drawn while the band from its two wave lines' tops to one line below the lower one touches the strip.
- **New nodes are appended, not re-sorted.** `StripWaves` doesn't use `placeInOrder`: joins never overlap, so their DOM order doesn't matter.
- **Scratch files** are in `/tmp/yamt-strips/`, including a `base/` copy that the bash guard would not let me delete. None are in the repo.

**open_risks**
- `frontend/src/editor/internal/gap.ts:107`: the strip filter pads by one line height. A slanted join's control points can bow up to about 12 px past its end y, so a join just outside the strip may be cut a few pixels early.
- The join for a run whose wave is outside CodeMirror's rendered range (right pane run 4) ends at the `lineBlockAt` top, which is estimated, not measured. It was only seen while that end was off-strip (`end 1291.5 vs right wave null`).
- After a click, a run's waves moved up 40 px; the joins followed and stayed level. That movement comes from scroll handling in the panes half, not from this slice.
- Read-only views get waves by construction (`measure` builds them before the `onPress === null` early return, `strips.ts`), but no read-only fixture was driven in the smoke.