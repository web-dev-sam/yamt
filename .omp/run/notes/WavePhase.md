# WavePhase — 3.V-phase round 1 (board "Unchanged lines, part 2" row 2)

Brief `docs/slices/briefs/3.V-phase.md`. Verbatim report below. Orchestrator: deviations accepted (64-wave mask tile rounded to whole CSS px, measured WebKit tile rounding; `waveTile(periods)`; `WAVE_UP_STEPS`; extra pure exports). Doc diffs applied at the feature's docs step.

---

I built the wave phase fix in the owned files only. Every layout with whole-pixel edges passes, but two layouts with fractional edges miss the brief's 1 device px limit by 0.11–0.29 px (details under `open_risks`). The brief's mask spec (`viewBox='0 0 20 8'`, a 20 px tile) gave a 2.5 px break at the middle's right edge in WebKit, so I changed it.

Each pane's wave is now phased from the strips' edges: out of a pane heading down at tile x = 5, into a pane heading up at tile x = 15. The middle pane is stretched to hold k + ½ waves.

**summary**
- `connectors/index.ts`: `WAVE_DOWN_X`, `WAVE_UP_X`, `WaveEnds`, `WavePhase` and `wavePhase()` as the contract says, with a modulo that handles negative numbers. `waveTile(periods)` can now draw many waves as one stroke.
- `editor/internal/wavePhase.ts` (new): `WAVE_PHASE_VARS`, `WaveHosts`, `paneEnds` (built from `STRIP_PANES`), `panePhases`, `phaseStyle`, `writePhase`, and `WavePhases`. `WavePhases` uses one `ResizeObserver` on the three pane hosts. It reads the scrollers' left edges and the two strip `<svg>` rects, and writes the two CSS variables only when they change. `destroy()` disconnects it and removes the variables.
- `foldView.ts`: the mask reads `--fold-wave-x` and `--fold-wave-period`. `FoldHosts` became `WaveHosts`, and `Folds` creates and destroys `WavePhases`.
- **Why the mask differs from the brief:** WebKitGTK draws a repeated mask tile at its width rounded to whole device pixels, but places it from the unrounded width. Measured: a 19.58 px tile repeated every 19.5 px at ratio 2, so the middle's right edge drifted by about 2.5 device px. The mask is now one tile of 64 waves (`viewBox='0 0 1280 8'`, `preserveAspectRatio='none'`), and its width is `round(calc(var(--fold-wave-period, 20px) * 64), 1px)`.

**files_changed**
- `frontend/src/connectors/index.ts`
- `frontend/src/connectors/index.test.ts`
- `frontend/src/editor/internal/wavePhase.ts` (new)
- `frontend/src/editor/internal/wavePhase.test.ts` (new)
- `frontend/src/editor/internal/foldView.ts`

**tests_added**
- `connectors/index.test.ts`:
  - "the tile crosses its centre line heading down at WAVE_DOWN_X and heading up at WAVE_UP_X": solves the quadratic segments of `waveTile(3)`.
  - "a tile of several waves repeats the four curves every 20 px in one stroke".
  - "every join leaves the left edge heading down and arrives at the right edge from below": 4 joins × widths 20, 38 and 60, covering all four branches.
  - Leaves/enters sweeps: `waveLeft` ∈ {0, 0.4, 237.33}, distances 0–2000 in steps of 0.37. Each hits phase 5 or 15 within 1e-9, with period 20 and 0 ≤ offset < period. Negative-modulo examples are included.
  - "a wave between two strips…": both edges met within 1e-9, a whole number of waves plus a half, the nearest k, stretch ≤ 1/(2k+1), plus the explicit D = 420 case.
  - "…that do not leave room falls back to entering": D = 0 and D < 0.
- `editor/internal/wavePhase.test.ts`:
  - which strip edge each pane leaves or enters at;
  - phases come from the scrollers' left edges and the strips' edges;
  - a pane stopping 15 px short of its strip gives the same phases (the classic-scrollbar case);
  - a layout moved as a whole (−260.4, 0.37, 333.3) keeps every offset;
  - `phaseStyle` gives `"<n>px"` strings;
  - `writePhase` writes only on change and removes on `null`.

**smoke_evidence**
1. Node tests and mutation testing.
   - `pnpm -C frontend test` → `Tests  756 passed (756)`.
   - `just mutants HEAD` → `index.ts | 99.52 | … 207 killed | 1 survived`. The survivor is `src/connectors/index.ts:146:7 y1 > y2 → y1 >= y2` in `slopedJoin`: an older line, not mine, and equivalent (a sloped join never has `y1 === y2`).
   - Editor lines, proven by breaking each rule and restoring it (`vitest run src/editor/internal/wavePhase.test.ts`):
     - swapping leave/enter edges in `paneEnds` → `× each pane meets the strip edges…`, `× the phases come from…`, `Tests 2 failed | 4 passed`;
     - `scrollers[pane].right` instead of `.left` → `× the phases come from…`, `× a pane whose text stops 15 px short…`;
     - dropping `px` → `× a phase is written as two pixel lengths`, `× a phase is written only when it changed…`;
     - writing without the comparison → `× a phase is written only when it changed…` (`Tests 1 failed | 5 passed`).
   - All four restored; the file tag is back to `#E2D6`.
2. WebKit MiniBrowser, fixture page, `vue-core-compiler-von.ts`, runs 0, 2 and 3.
   - Setup: ratio 1 on my own Xvfb `WebKitWebDriver`; ratio 2 through `just app-session start-fixture` (Samsung screen, `devicePixelRatio` 2).
   - Method (`/tmp/wp/analyze.py`):
     - each 24×24 CSS px crop around an edge is saved 8× as `/tmp/wp/<label>-run<r>-<edge>.png`;
     - for every device column it reads the ink centre;
     - "meet" = the join's first full strip column minus the same pane's wave a whole number of periods away at the same pixel alignment — the step a phase error makes.
   - Run 0 (level joins at all four edges), meet in device px, edges L|local / local|C / C|remote / remote|R:

     | ratio | layout | L\|local | local\|C | C\|remote | remote\|R |
     |---|---|---|---|---|---|
     | 1 | 1600, list | 0.35 | 0.04 | 0.33 | 0.22 |
     | 1 | 1600, Ctrl+B | 0.35 | 0.04 | 1.04 | 0.22 |
     | 1 | 1237, list | 0.35 | 0.06 | 0.33 | 0.22 |
     | 1 | 1237, Ctrl+B | 0.35 | 0.06 | 0.83 | 0.22 |
     | 2 | 1600, list | 0.09 | 0.10 | 0.13 | 0.08 |
     | 2 | 1600, Ctrl+B | 0.09 | 0.14 | 0.18 | 0.08 |
     | 2 | 1237, list | 0.09 | 0.27 | 0.56 | 0.08 |
     | 2 | 1237, Ctrl+B | 0.09 | 0.80 | 1.18 | 0.08 |

   - Run 2 C|remote at ratio 2, 1237 with Ctrl+B: 1.29.
   - Runs 2/3 remote|R: 0.63–0.90. These are S-curves, measured against a level wave, so the number reflects the join's shape. The pane side matches its unbroken wave within ≤ 0.2.
   - Hover (`fold-wave-hover` added to run 2's five nodes), run 2: 0.03 / 0.08 / 0.09 / 1.09 (S-curve) at ratio 1; 0.17 / 0.00 / 0.01 / 0.97 at ratio 2.
   - Sideways scroll (`scrollLeft = 200` in all three panes): all 12 crops at both ratios gave `differing pixels 0`.
   - Before (HEAD, ratio 1, 1600, list), run 0: 3.97 / 3.61 / 3.98 / 3.61. Crops are `/tmp/wp/before-d1-1600-list-*.png`; the side-by-side pair is `/tmp/wp/before-after-d1-1600-run2.png`.
3. Ratio 2 was run in MiniBrowser itself (it runs at scale 2 on the Samsung screen), not in the app. Fractional ratios were run in Chromium 156 with `--force-device-scale-factor` (`/tmp/wp/chromium.mjs`). Run 0, all four layouts:
   - ratio 1.25: L|local 0.31–1.13, others ≤ 0.42;
   - ratio 1.5: every edge ≤ 0.92 (S-curve runs up to 1.57).
   - Before, run 0, 1600 with list: 4.42–5.39 at 1.25 and 5.73–5.94 at 1.5.
4. Classic scrollbar.
   - WebKitGTK 2.54 ignores `.cm-scroller::-webkit-scrollbar`: `offsetWidth − clientWidth` stayed 0, even with `GTK_OVERLAY_SCROLLING=0`.
   - Real scrollbars, Chromium without `--hide-scrollbars`: widths `[15, 15, 0]`. Run 0 meet 0.02 / 0.06 / 0.05 / 0.02 at ratio 1; 1.11 / 0.08 / 0.15 / 0.09 at 1.25; ≤ 0.48 at 1.5. `/tmp/wp/sb.png` shows the join leaving the border on the centre line heading down.
   - WebKit stand-in, `.cm-scroller{border-right:15px solid #333}`: the wave ends 15 px short and the phases are unchanged (no new measurement, as designed); run 0 is the same as without the scrollbar at both ratios.
5. Recipes: `lint`, `typecheck`, `test`, `unused`, `fmt:check` (`All matched files use the correct format.`) and `sfc-order` all exited 0.
   - Extra, not required: `pnpm -C frontend test:browser` could not start Playwright WebKit (`Host system is missing dependencies to run browsers … libicu74 libxml2 libflite1`), so the browser probe did not run.

**deviations_from_brief**
- **Mask:** a 64-wave tile (`viewBox='0 0 1280 8'`) whose width is rounded to whole CSS px, instead of `viewBox='0 0 20 8'` and `var(--fold-wave-period, 20px)`. The reason is the WebKit tile rounding measured above (one comment line in `foldView.ts` cites it). `MASK_PERIODS` and `MASK_WIDTH_PX` are private constants.
- **`waveTile` signature:** `waveTile()` became `waveTile(periods: number)`. Its only callers are `foldView.ts` and the tests.
- **Constants:** `WAVE_UP_X` is written `WAVE_UP_STEPS * WAVE_STEP_PX` (same value, 15) because `no-magic-numbers` rejects the literal `3`.
- **`wavePhase` details:**
  - `max(0, …)` is dropped from k: when D > 0, `round(D/20 − ½)` is never negative, so the mutant would be equivalent.
  - The unreachable `default` branch is left out; the switch is covered by tsgolint's exhaustiveness rule, which TS3 allows.
- **New exports:**
  - connectors: `WAVE_DOWN_X`, `WAVE_UP_X`, `WaveEnds`, `WavePhase`, `wavePhase`;
  - `wavePhase.ts`: `WAVE_PHASE_VARS`, `WaveHosts`, `WavePhases`, `paneEnds`, `phaseStyle`, plus three the brief did not name: `WaveLayout`, `panePhases`, `writePhase` (pure and tested in node).
- **Decided where the brief was open:**
  - `paneEnds` returns `WaveEnds | null` per pane; `null` (a pane next to no strip) removes the variables.
  - `editor/index.ts` needs no change: `MergeHosts` already fits `WaveHosts`.
- **Doc diffs I could not make (outside my files):**
  - `.omp/skills/project-map/SKILL.md` line 58: after `foldView (inline replace + gutter wave, `Folds` wiring),` insert `wavePhase (each pane's wave phase at the strip edges: `paneEnds`/`panePhases` from `STRIP_PANES`, `WavePhases` = one ResizeObserver writing `--fold-wave-x`/`--fold-wave-period`, plan §2 #64),`. Without it, `just map-check` (PM6) fails on `wavePhase.ts`.
  - The same file's connectors line: add `WAVE_DOWN_X/WAVE_UP_X, wavePhase (WaveEnds → WavePhase)` after `waveJoinPath (WebStorm's drawConnectorLine),`.
  - `docs/architecture.md:619`: add `wavePhase.ts` to the file list. After the sentence ending `(CSS mask of `waveTile()`)` on line 630, add: "`wavePhase.ts` pins each pane's mask at the strips' `<svg>` edges (plan §2 #64): a ResizeObserver on the pane hosts writes `--fold-wave-x`/`--fold-wave-period`; the mask is one tile of 64 waves rounded to whole CSS px (WebKitGTK rounds a repeated tile's width to device pixels)."
  - `docs/architecture.md:648`: change to `export function waveTile(periods: number): string; // `periods` × 20 px of the wave as one stroke …`, and after line 650 add `export function wavePhase(waveLeft: number, ends: WaveEnds): WavePhase; // leaves at tile x 5 (WAVE_DOWN_X), enters at 15 (WAVE_UP_X), through: period D/(k+½)`.
  - `CHANGELOG.md` under `### Fixed`: `- The wavy line over collapsed lines now meets the curves between the panes on its centre line, at every window width; before, it met them 3 px off.`

**open_risks**
- **Fractional edges in WebKit miss 1 device px:** ratio 2, 1237 px, file list hidden gives C|remote 1.18–1.29 (and 1.04 at ratio 1, 1600 hidden). Probing with forced offsets shows WebKit snaps the mask's origin to device pixels relative to the snapped box (`foldView.ts:124-125`, `wavePhase.ts:42`). Feeding device-snapped edges by hand cut it to 0.77–0.86. Doing that in code would need `devicePixelRatio` and a re-measure on ratio changes, against the design's "nothing to do on a ratio change", so I left it for you to decide.
- **Chromium at ratio 1.25:** L|local is 1.11–1.13 when the strip's `<svg>` sits at x.8. The raw pixel dump shows the pane's wave about 0.5 device px higher than the join. That is the mask's vertical position (6 px = 7.5 device px, snapped), not the phase, so it falls under the brief's non-goals.
- **Measuring method:** the meet metric compares S-curve joins against a level wave, so 0.6–1.6 on remote|R in runs 2/3 is the join's shape. For those runs only the pane-side columns (≤ 0.2) and the arrival from below are evidence of phase.
- **Inactive tabs:** a file shown again after a window resize relies on the `ResizeObserver` firing when `content-visibility: hidden` is lifted (`wavePhase.ts:67-74`). I believe it does, but did not observe it.
- **Mask size:** each mask is now a 1280 px-wide data-URL SVG (256 quadratic segments), twice (normal and hover). A middle pane wider than 64 periods repeats the tile with up to ½ device px rounding at each seam.

Checks for you to run: `just check` (map-check will fail until the project-map line above is added) and `just mutants a040da6`.