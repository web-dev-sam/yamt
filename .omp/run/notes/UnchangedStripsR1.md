# UnchangedStripsR1 — 3.U-strips rework 1 (board "Unchanged lines" row 3)

Brief `docs/slices/briefs/3.U-strips-rework-1.md`; base `0e14e92`. Verbatim implementer report below.

---

Both findings are fixed in the files I own. All six frontend recipes exit 0 with 739 tests passing. In the WebKit smoke, the strips' markup is byte-identical to the base tree's at every step of the same scripted session.

**summary**
- **Pane pairs:** `geometry.ts` now has `STRIP_PANES` (which two panes each strip sits between), next to `SIDE_PANE`. `bandPaints`, `wavePaints` and `Strips.paint` all read it, so the `side === "local" ? … : …` ternaries are gone (#841).
- **Icon rows:** the icon-row code has moved to its own file, `stripIcons.ts` (`APPLY_ICON`, `parsedIcon`, `iconElement`, `isCovered`, `actionButton`, `arrowRow`).
- **Keyed nodes:** `dropMissing` now works for any key type. The wave layer is back in `GapStrip` as `#paintWaves`, next to `#paintBands`, so bands, waves and icon rows keep their nodes the same way. `stripWaves.ts` is deleted (#842).
- **File sizes:** `strips.ts` is 234 lines (was 299), `stripIcons.ts` 119, `gap.ts` 116, `geometry.ts` 82.

**files_changed**
- `frontend/src/editor/internal/geometry.ts`
- `frontend/src/editor/internal/gap.ts`
- `frontend/src/editor/internal/strips.ts`
- `frontend/src/editor/internal/stripIcons.ts` (new)
- `frontend/src/editor/internal/stripWaves.ts` (deleted)
- `frontend/src/editor/internal/geometry.test.ts`

**tests_added**
- `geometry.test.ts` › "each strip sits between its side's pane and the middle, the local pane on its left": pins `STRIP_PANES` to `{ local: { left: "left", right: "center" }, remote: { left: "center", right: "right" } }`.
- Failing-path proof: I swapped the remote pair to `{ left: "right", right: "center" }`, ran the tests, then restored it. 5 tests failed:
  - the new test: `expected { local: { left: 'left', …(1) }, …(1) } to deeply equal …`
  - `gap.test.ts` › "each strip joins its own pane pair…": `expected 'M0 800 C20 800 20 460 40 460 L40 660 …' to be 'M0 560 C20 560 20 700 40 700 L40 980 …'`
  - `gap.test.ts` › "a chunk whose local side is applied / ignored leaves the local strip…" (2 tests)
  - `gap.test.ts` › "a join runs between the waves' centres…"
  - Result line: `Tests  5 failed | 21 passed (26)`

**smoke_evidence**
- **Layer recipes:** `for r in lint typecheck test unused fmt:check sfc-order; do pnpm -C frontend --silent $r …; echo "$r exit=$?"`
  - `lint exit=0`, `typecheck exit=0`, `test exit=0`, `unused exit=0`, `fmt:check exit=0`, `sfc-order exit=0`
  - `All matched files use the correct format.`
  - `Test Files  65 passed (65)`, `Tests  739 passed (739)`
- **Line counts:** `wc -l` gives gap 116, strips 234, stripIcons 119, geometry 82. Every file is under 300.
- **WebKit smoke setup:**
  - `just app-session start-fixture --name sr1 --size 1600x950` (MiniBrowser through `just webdriver`), file `language-tools-script-setup.ts`.
  - Base tree: `git archive HEAD frontend` into `/tmp/yamt-sr1/base`, served by Vite on port 5393 in the same browser session.
  - One script (`/tmp/yamt-sr1/scenario.mjs`) ran the same steps on both trees. After each step it took a sha256 of both strips' `outerHTML`.
  - Base run 2 and this tree (2 runs) gave identical hashes at all 11 steps:
    - `start 33320d43…`, `wheel70 da9d9c35…`, `wheel360 da9d9c35…`, `top 63f9b659…`, `hover 0135c2dd…`, `strip-click dd9476de…`, `applied 4a3cade3…`, `undone dd9476de…`, `mid-drag 84a87386…`, `dragged cb50d0d5…`
  - Base run 1 differed only at `wheel70`, where the middle pane had scrolled 70 px instead of 270 px. Base run 2 then gave exactly this tree's numbers, so that was wheel timing, not the strips.
- **Joins level at the wave centres, both strips:**
  - At the start: `strip0 run0: start 14 vs 14, end 14 vs 14, level`; `strip1 run1: start 254 vs 254, end 254 vs 254, level` (the same `M0 254` as round 1's right strip run 1); `strip1 run3: start 614 vs 614, end 614 vs 614, level`.
  - When the panes are clamped (scroll tops `[151,271,271]`, as in round 1): `strip0 run1: start 63 vs 63, end -17 vs -17, S`; `strip0 run3: start 383 vs 383, end 343 vs 343, S`; `strip1 run3: start 343 vs 343, end 343 vs 343, level`.
- **Hover:**
  - Pointer on the right strip's run-3 join: `strip0 run3 … w=2px` and `strip1 run3 … w=2px`; the other joins stay `w=1px`.
  - The `hovered` list held the panes' `fold-wave` elements for run 3.
  - Moving off gave `unhover: 0`.
- **Strip-join click:** wave rows went from `3@613 | 3@693 | 3@693` to `3@693 | 3@773 | 3@773`, so the next step shows in all three panes. The joins followed: `strip1 run3: start 694 vs 694, end 694 vs 694, level`.
- **Icon click:** Apply on the first Local icon went `3 changes · 1 conflict` → `2 changes · 1 conflict`. Ctrl+Z restored `3 changes · 1 conflict`, with the same markup hash as before the apply (`dd9476de…`).
- **Drag over icons:** from the first to the last Local Apply icon (682,202.5 → 682,882.5, 4 icons). Mid-drag all four were covered (`[true,true,true,true]`). On release the summary went `3 changes · 1 conflict` → `1 conflict`.
- Screenshots: `/tmp/yamt-sr1/{base,new,new2,base2}-<step>.png`. The driver, base Vite and dev server were stopped afterwards.

**deviations_from_brief**
- **New file** `frontend/src/editor/internal/stripIcons.ts`, with these exports:
  - `IconPress`, `OnPress`, `ArrowRow`, `ACTION_WIDTH_PX`, `isCovered`, `arrowRow`.
  - `ACTION_WIDTH_PX` is exported because `GapStrip.measure` still places the buttons with it.
  - `OnPress` and `ArrowRow` were private types in `strips.ts` before.
- **`IconPress` now lives in `stripIcons.ts`.** `strips.ts` re-exports it (`export type { IconPress } from "./stripIcons"`) because `drag.ts` and `editor/index.ts` import it from `./strips` and I may not edit them. Keeping it in `strips.ts` and importing it into `stripIcons.ts` would be the cycle `strips ↔ stripIcons`, which `fences.test.ts` rejects (type imports count). Once `drag.ts:6` and `index.ts:29` import it from `./internal/stripIcons`, the re-export can be dropped.
- **New export** `STRIP_PANES` in `geometry.ts`.
- **New private helpers in `strips.ts`:**
  - `stripViews(views, side)`: the strip's two `EditorView`s, read from `STRIP_PANES`.
  - `waveNode`: moved from `stripWaves.ts`.
  - `WAVE_PATH_CLASSES`: renamed from `PATH_CLASSES`.
- **Deleted** `stripWaves.ts` and its export `StripWaves`. `GapStrip`'s constructor now takes the hover getter instead of a `StripWaves`. `Strips`' constructor and `paint` signatures are unchanged.
- **Wave nodes are still appended, not re-sorted with `placeInOrder`.** This keeps round 1's DOM order exactly; the identical markup hashes depend on it.
- **Docs I don't own:**
  - The project map's editor internals line and `docs/architecture.md` still name `stripWaves.ts`. They need `stripIcons.ts` (the icon rows: the icon press, the Apply/Ignore buttons, the covered mark) instead.
  - `skill://ts-conventions` TS15 cites "`strips.ts` `parsedIcons`"; that cache is now in `stripIcons.ts`.
- **`SVG_NS` is defined in both `strips.ts` and `stripIcons.ts`**, as it was in `strips.ts` and `stripWaves.ts` before.
- **Scratch files** are in `/tmp/yamt-sr1/` (including the `base/` copy, whose `node_modules` is a symlink to this worktree's). None are in the repo.

**open_risks**
- `frontend/src/editor/internal/strips.ts:24`: the `IconPress` re-export stays until `drag.ts:6` and `editor/index.ts:29` import from `./stripIcons`. Those files were outside my ownership.
- `frontend/src/editor/internal/geometry.test.ts:26`: the new test compares against a literal table. The behaviour (each strip reads its own pane pair) is covered by the 4 `gap.test.ts` tests that also failed when the pair was swapped.
- Not run here: `pnpm -C frontend test:browser` and `just check`. `editor/` is not mutated by `just mutants`.