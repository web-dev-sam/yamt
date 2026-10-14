# WavePhaseR1 — 3.V-phase round 2 (board "Unchanged lines, part 2" row 2)

Brief `docs/slices/briefs/3.V-phase-rework-1.md`. Verbatim report below. Orchestrator: deviations accepted (`WavePhases` takes structural views; `MASK_PERIODS` exported; `layoutOf(views, strips, ratio)`; device-px rounding added as the brief's fallback; #64 text gets the proposed clause).

---

The wave now meets the strip joins within 1 device px in WebKit on every level-join edge, at ratios 1 and 2, widths 1600 and 1237, with the file list shown and hidden. Fixing the drawn period was not enough on its own: two layouts still missed by up to 0.29 px. So I also round the measured edges to device pixels, as the brief allowed. All six recipes exit 0, and the node tests fail on the old code.

**summary**
- `connectors/index.ts` decides the drawn period once. `MASK_PERIODS` (64) now lives there, and `wavePhase` "through" returns `round(64·P)/64` (at least 1/64), so 64 waves are whole CSS px. The offset is pinned at the midpoint between where the middle pane enters and leaves its strips, so each edge gets at most half the leftover drift.
- `foldView.ts`: the mask is `calc(var(--fold-wave-period) * 64)` with no rounding of its own. Its comment now names WebKitGTK's whole ratios (plan §3) and plan §2 #64, not the slice.
- `wavePhase.ts`: new pure `layoutOf(views, strips, ratio)` reads each pane's `scrollDOM` and the strips (local is `strips[0]`), rounding every edge to device px. `WavePhases` reads `devicePixelRatio`, measures again when `matchMedia("(resolution: <n>dppx)")` fires `change` and then watches the new ratio, and `destroy()` removes that listener.
- `PANES` is exported from `geometry.ts` next to `Pane`; `wavePhase.ts` and `foldRuns.ts` import it.

**files_changed**
- `frontend/src/connectors/index.ts`
- `frontend/src/connectors/index.test.ts`
- `frontend/src/editor/internal/wavePhase.ts`
- `frontend/src/editor/internal/wavePhase.test.ts`
- `frontend/src/editor/internal/foldView.ts` (mask constants, `maskSize` and its comment only; the toggle's changes are kept)
- `frontend/src/editor/internal/geometry.ts` (the `PANES` export only)
- `frontend/src/editor/internal/foldRuns.ts` (its local `PANES` replaced by the import)

**tests_added**
`connectors/index.test.ts`:
- "420 px between two strips hold 21.5 waves of 1250/64 px, pinned at the middle": expects exactly `{ offset: 7.265625, period: 19.53125 }`.
- "a wave between two strips holds the nearest whole number of waves plus a half, in a period the mask draws" (replaces round 1's sweep): uses the returned period. Over 3 wave lefts × spans 0–2000 in steps of 0.37, both edges are met within `(k+½)/256` px. It also checks that `period·64` is a whole number, that k is the nearest one, a stretch of at most `1/(2k+1)` plus the rounding, and `0 ≤ offset < period`.
- "a wave between strips a hair apart is drawn one mask pixel per 64 waves": the period is 1/64 and the offset is finite (this is what the `max(1, …)` is for).

`editor/internal/wavePhase.test.ts`:
- "the layout is read from each pane's scroller and the strips in order, local first": the fakes give the host and the scroller different rects, so swapping the strips or reading the host fails.
- "every edge is snapped to the device pixels of the ratio": at ratios 1, 1.25 and 2, 428.65625 becomes 429, 428.8 and 428.5.
- "a change of resolution measures again at the new ratio and watches for the next change": uses fake `ResizeObserver`, `matchMedia`, `devicePixelRatio`, `HTMLElement` and `Element`. It checks the phases at ratio 1 and then at 2, the listener moving from the `1dppx` query to the `2dppx` one, and that `destroy` removes it.
- "destroying the phases stops observing and removes both properties from every pane": the observer saw the three hosts and was disconnected, and both custom properties are removed from each pane.

**smoke_evidence**

1. **Node tests fail on the old code.**
   - `connectors/` is mutated: `just mutants HEAD` → `index.ts | 99.54 | … 215 killed | 1 survived`. The survivor is `src/connectors/index.ts:150:7 y1 > y2 → y1 >= y2`, the same pre-existing, equivalent `slopedJoin` line as in round 1; none of my lines survive.
   - Round 1's "through" (unrounded period, pinned where the middle pane enters) against the new tests: `× 420 px … pinned at the middle` (`expected { offset: 7.209302325581405, …`), `× … in a period the mask draws` (`expected [ …(16184) ] to deeply equal []`), `× … a hair apart …` → `Tests 3 failed | 17 passed`.
   - Rounded period but still pinned where the middle pane enters: `Tests 2 failed | 18 passed` (the example and the sweep).
   - Editor lines, each broken by hand, then restored (file tag back to `#4414`; all hand-break runs below are `vitest run src/editor/internal/wavePhase.test.ts`):
     - strips swapped in `layoutOf`: `× the layout is read …`, `Tests 1 failed | 7 passed`;
     - `views.left.dom` instead of `scrollDOM`: `× the layout is read …`;
     - no `disconnect()` in `destroy`: `× destroying …` (`"disconnected": false`);
     - no property removal in `destroy`: `× destroying …` (`expected [ [], [], [] ]`);
     - no rounding to device px: `× every edge is snapped …` and `× a change of resolution …`, `Tests 2 failed | 8 passed`;
     - no measuring again on `change`: `expected [ '3.953125px', '19.53125px' ] to deeply equal [ '3.859375px', '19.59375px' ]`;
     - not watching the new ratio: `expected [ [ '(resolution: 1dppx)', +0 ] ] to deeply equal [ …(1) ]`;
     - listener left in `destroy`: `expected [ +0, 1 ] to deeply equal [ +0, +0 ]`.

2. **WebKit and Chromium measurements.**
   - Setup: MiniBrowser, fixture page, `vue-core-compiler-von.ts`, round 1's method (`/tmp/wp/analyze.py`, copied to `/tmp/wp2`).
     - Ratio 2: `app-session start-fixture`; `[devicePixelRatio, innerWidth] = [2,1600]`.
     - Ratio 1: a private Xvfb with `WebKitWebDriver` and MiniBrowser; `[1,1600]`.
   - "meet" is in device px. Runs 0, 2 and 3 were measured; the table shows run 0 (level joins), and runs 2/3 match it except on remote|R.

     | ratio | layout | L\|local | local\|C | C\|remote | remote\|R |
     |---|---|---|---|---|---|
     | 1 | 1600, list | 0.35 | 0.04 | 0.36 | 0.22 |
     | 1 | 1600, hidden | 0.35 | 0.04 | 0.33 | 0.22 |
     | 1 | 1237, list | 0.35 | 0.06 | 0.33 | 0.22 |
     | 1 | 1237, hidden | 0.35 | 0.04 | 0.36 | 0.22 |
     | 2 | 1600, list | 0.09 | 0.14 | 0.09 | 0.08 |
     | 2 | 1600, hidden | 0.09 | 0.10 | 0.11 | 0.08 |
     | 2 | 1237, list | 0.09 | 0.27 | 0.56 | 0.08 |
     | 2 | 1237, hidden | 0.09 | 0.90 | 0.60 | 0.08 |

   - Runs 2/3: C|remote reaches at most 0.71 (ratio 2, 1237, hidden). remote|R is an S-curve there and reads 0.63 at ratio 2 and 0.90–1.09 at ratio 1, but its pane side is 0.00 and it arrives from below, which is the rule for S-curves.
   - **Why the device-px rounding is in:** with the period fix only (rounding switched off), ratio 1, 1600, hidden gave C|remote 1.04, and ratio 2, 1237, hidden gave 1.18 / 1.29. Ratio 2, 1600, hidden also missed at 1.11–1.23. With rounding these are 0.33, 0.60 / 0.71 and 0.11 / 0.23.
   - Chromium at forced ratios (`/tmp/wp2/chromium-matrix.sh`), level joins in all four layouts:
     - ratio 1.25: at most 0.57 (L|local 0.45, C|remote 0.29–0.57);
     - ratio 1.5: at most 1.06 (C|remote, 1600, hidden);
     - S-curve remote|R in runs 2/3: 1.56 at 1.5, the same as round 1's 1.57; pane side 0.00.
   - Crops: `/tmp/wp2/{s1,s2}-*-run*-*.png`, Chromium `/tmp/wp2/c125-*.png`, `/tmp/wp2/c15-*.png`.

3. **Recipes:** `pnpm -C frontend lint`, `typecheck`, `test` (`Tests 795 passed (795)`), `unused`, `fmt:check` (`All matched files use the correct format.`) and `sfc-order` all exit 0.

**deviations_from_brief**
- **Contract widened:** `WavePhases`' `views` parameter is now `() => Readonly<Record<Pane, { scrollDOM: { getBoundingClientRect(): {left,right} } }>>` instead of `() => PaneViews`. It only reads what it uses, so the node test can pass fake views; `Folds` compiles unchanged.
- **New and changed exports:**
  - `MASK_PERIODS` is exported from `connectors`.
  - `layoutOf` is new in `wavePhase.ts`; it takes a third parameter, `ratio`, which the brief did not name.
  - `PANES` is exported from `geometry.ts`.
- **Device-px rounding** (`layoutOf`, plus the `matchMedia` re-measure) was added because the measurement still missed; this is the brief's own fallback.
- **One new comment line** in `wavePhase.ts` cites plan §2 #64 for "WebKit paints each box, and the mask's origin in it, at whole device pixels". Plan #64 does not say this yet. I propose adding, after "…but places it from the unrounded width)": "; the measured edges are rounded to device pixels (WebKit paints boxes and the mask's origin there) and measured again when the resolution changes (`matchMedia`)". `docs/architecture.md`'s `wavePhase.ts` sentence needs the same.
- **Test seam:** the node tests replace `HTMLElement`, `Element`, `ResizeObserver`, `matchMedia` and `devicePixelRatio` with `vi.stubGlobal` fakes, so the fixed `WaveHosts` type stays as it is and the tests need no `as`.
- **No node test for the mask string itself:** the drawn period is decided and tested in `connectors`; the mask is covered by the WebKit measurements.
- **`Folds.destroy` calling `#phases.destroy()`** has no test; the brief asked only for `WavePhases.destroy()`.
- **Not in this tree:** `git diff` also shows `.omp/run/*`, `docs/plan.md` and `docs/slices/SLICES.md` as changed. I did not touch them; they came with the worktree.

**open_risks**
- `wavePhase.ts:53-57`: rounding to device px is right for WebKit. In Chromium at 1.5 it still measures ≤ 1.06 but has not been checked separately, and the analyser's "pane" column reads 0.87–0.89 at local|C (1600 px). That is the reference wave's device alignment at a stretched period, not a meet value.
- `wavePhase.ts:102-112`: the re-measure on a ratio change is proven only in node. MiniBrowser cannot change its ratio live, so it was not seen in WebKit.
- Hover, sideways scroll and the classic-scrollbar check were not repeated in WebKit this round, because the acceptance did not ask for them. The Chromium hover runs gave at most 0.86 at 1.25; at 1.5 the S-curve remote|R reached 1.92 (C|remote 0.19).
- Checks for you to run: `just check` and `just mutants 88f24cf`. `just check` includes `map-check`, which needs round 1's project-map line for `wavePhase.ts` if it has not been applied yet.