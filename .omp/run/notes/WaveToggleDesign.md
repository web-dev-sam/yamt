# WaveToggleDesign — 3.V design (board "Unchanged lines, part 2" row 1)

Brief `docs/slices/briefs/3.V-wave-toggle-design.md`. Chosen: A1 + B1 (plan §2 #64, #68). Orchestrator rulings: open question 1 (lines typed inside a run hide with it after off→on) — yes, as WebStorm's fold regions move with the text (plan #68); deviations accepted (cursor rule in the sides too; `useMergeController` options object; `foldSelection.ts` split; fractional ratios proven in Chromium); correction: `waveLeft` is the scroller's left edge, not the host's (`briefs/3.V-phase.md`); the two builds run in sequence (phase first, the toggle on top), not in parallel, because both touch `foldView.ts` and the toggle could not type-check without `wavePhase.ts`.

---

# 3.V design: one unbroken wave, and a toolbar toggle for collapsing

**Recommendation: A1 + B1.** Part A pins the wave's phase at every strip edge and stretches the middle pane's period to fit. Part B keeps every run's levels in the middle's field next to a count of hidden steps, and the on/off choice is a store value in the window's storage with its own channel to the editor.

I edited no files. Every fact cites `path:line` at HEAD or the WebStorm source. Anything I could not check is marked [INFERENCE]. Neither part needs Rust or an IPC change.

## 0. Facts the design rests on

**The tile and the joins.**
- `waveTile()` (`connectors/index.ts:35-48`) moves through the levels `[top, mid, bottom, mid, top]`:
  - x = 0 is the crest;
  - x = 5 is the centre line heading down;
  - x = 10 is the trough;
  - x = 15 is the centre line heading up.
- WebStorm's `createImage` is the same path (`DiffLineSeparatorRenderer.java`: `moveTo(0, upper)`, then `quadTo … step*1.0, center` and so on).
- Every branch of `waveJoinPath` starts on the centre line heading down: its first control point lies below its start (`connectors/index.ts:79-82`, `96-99`, `113-118`, `130-133`). Every branch also arrives from below.
- So the phases a pane needs are fixed: phase 5 where the wave leaves a pane into a strip, and phase 15 where it enters a pane from a strip.

**WebStorm's rule.**
- `drawLine` shifts the tile using `gutterWidth % interval` and `getStartPhase`. `getStartPhase` returns `getStepSize`, commented "cross divider at a 45' downwards angle".
- The mirrored editor also uses `contentWidth % interval`. A non-mirrored editor never looks at its own content width, so its right edge is left to chance.
- `+ pane.getHorizontalScrollBar().getValue()` keeps the wave still while scrolling sideways.

**yamt's wave is still under horizontal scroll already.**
- `.fold-wave` sits at `left: 0`, `width: 100cqi` inside the line-number gutter cell (`foldView.ts:123-141`).
- CodeMirror makes the gutter `position: sticky` (`@codemirror/view` `index.js:11477`, with `insetInlineStart: 0` at `:6981`).
- So the wave's left edge is the scroller's left edge whatever `scrollLeft` is. No term like WebStorm's scroll-bar value is needed.

**The pane–strip boundary.**
- Each strip `<svg>` fills a `border-x` div (`MergeView.vue`, strip divs at `:182` and `:191` per the brief).
- So a join starts at the svg's x = 0, which is one border pixel to the right of the pane's box.
- With a classic scrollbar, the wave ends at `100cqi`, the scroller's content edge, before the scrollbar.

**What the strips measure today.**
- `GapStrip.measure` reads `strip.getBoundingClientRect()`, `clientWidth` and `clientHeight` on every frame, not only when the layout changes (`strips.ts:108-111`, called from `Frame.request` at `frame.ts:65-75`).
- The brief says "per layout"; the code reads them per frame. A1 adds no per-frame read.

**How the middle field works now.**
- `foldField` keeps `readonly Fold[]` and *slices* levels off as steps are shown (`folds.ts:66-77`, `131-149`).
- The levels a click showed are therefore gone from the field, and nothing could collapse them back.
- The sides keep only counts (`folds.ts:151-157`).

**CodeMirror facts used by Part B.**
- `EditorView.scrollSnapshot()` records the block at the top edge plus 8 px. It restores that block's top to the same screen position, and the block is looked up by position in the *new* height map (`index.js:8729-8732`, applied at `:3457-3460` inside measure at `:8261-8266`).
- `requestMeasure()` runs before the update listeners whenever a scroll target is present (`index.js:8064-8069`).
- `addToHistory.of(false)` leaves history untouched (`@codemirror/commands` `index.js:240-241`).

**IntelliJ facts used by Part B.**
- `FoldingModelSupport.expandAll` runs one batch per editor, so the side editors too (`FoldingModelSupport.java:590-603`).
- `onFoldProcessingEnd` moves a caret in a collapsed region to `getStartOffset()` and then calls `removeSelection()` if either end lies inside (`FoldingModelImpl.java:784-819`, as you relayed). `restorePosition(true)` keeps the scroll position (`:825-826`).
- `ToggleExpandByDefaultAction` is titled `collapse.unchanged.fragments` with icon `AllIcons.Actions.Collapseall`. It is selected when not expanding by default and `setSelected` → `expandAll(expand)` (`TextDiffViewerUtil.java:443-480`).
- `MergeThreesideViewer.createToolbarActions` adds it right before the apply-non-conflicting group (`:233` before `:235-238`).

**Size limits.**
- `editor/index.ts` is 285 lines, `ui/store.ts` 296 and `folds.ts` about 258, against `max-lines` 300.
- `useMergeController` would gain a second boolean next to `readOnly` (`useMergeController.ts:98-103`). TS7 then requires an options object.

## Part A — one unbroken wave

The phase at a point `x` in window coordinates is `phase(x) = mod(x − waveLeft − offset, P) · 20 / P`. Here `waveLeft` is the wave's left edge, `offset` is the mask's x position and `P` is the tile width.

### A1 — pin every strip edge; stretch the middle to n + ½ waves (recommended)

Visions: 2 (the phases come from the tile's own constants), 3 (connectors code is tested on numbers and mutation-tested), 4 (a closed sum type for the edge cases).

**Data, pure, in `connectors/index.ts`:**
```ts
export const WAVE_DOWN_X = WAVE_STEP_PX;      // tile crosses its centre heading down
export const WAVE_UP_X = 3 * WAVE_STEP_PX;    // … heading up
export type WaveEnds =
  | { readonly kind: "leaves"; readonly at: number }                       // strip on the right
  | { readonly kind: "enters"; readonly at: number }                       // strip on the left
  | { readonly kind: "through"; readonly enters: number; readonly leaves: number };
export type WavePhase = { readonly offset: number; readonly period: number }; // px, from the wave's left edge
export function wavePhase(waveLeft: number, ends: WaveEnds): WavePhase;
```

**The rule:**
- `leaves`: `{ offset: mod(at − waveLeft − 5, 20), period: 20 }`.
- `enters`: `{ offset: mod(at − waveLeft − 15, 20), period: 20 }`.
- `through`:
  - `D = leaves − enters`;
  - `k = max(0, round(D/20 − ½))`;
  - `P = D/(k+½)`;
  - `offset = mod(enters − waveLeft − 15·P/20, P)`.
  - Check: the phase at `leaves` is `kP + 5P/4`, which is `5·P/20` modulo `P`. That is the downward crossing.
  - If `D ≤ 0`, it falls back to `enters`.
- `mod` must handle negative numbers; JavaScript's `%` does not.

**Inputs are measured edges, not pane widths:**
- `waveLeft` is the pane host's `getBoundingClientRect().left`. This assumes the scroller fills the host, which has no padding or border [INFERENCE: the 8× crops prove it].
- The strip edges are the two `<svg>` rects.
- New file `editor/internal/wavePhase.ts` holds `paneEnds(panes, strips)`. It is pure and derives each pane's `WaveEnds` from `STRIP_PANES` (`geometry.ts:23-26`), so the table of which strip sits between which panes stays single: a strip's left pane leaves at `svg.left`, its right pane enters at `svg.right`, and the middle gets both.
- `phaseStyle(phase)` returns the two CSS values.

**Where it is measured: `class WavePhases`.**
- A `ResizeObserver` on the three pane hosts (`box: "border-box"`). Its callback reads 5 rects and writes `--fold-wave-x` and `--fold-wave-period` on each pane host with `style.setProperty`, and only when the string changed.
- The variables are inherited by every `.fold-wave`. The theme reads them, so no decoration and no `WaveMarker` is rebuilt, and nothing is dispatched.
- A `ResizeObserver` delivers once at `observe()` and runs after layout, before paint [INFERENCE: per the spec]. So the first paint is already in phase, and a live resize is corrected in the same frame.
- Nothing is read on scroll frames (#51). `destroy()` disconnects and removes the properties (CM14).

**What triggers a new measurement:**

| change | effect |
|---|---|
| Ctrl+B or a window resize | Host widths change → callback → new offsets. A pure shift of the whole area leaves the phases unchanged, because only differences of edges enter the formula. |
| A classic scrollbar appears | The hosts' border-box does not change → no callback. The phase does not depend on it, because the ends come from the strips. |
| A different device pixel ratio | No CSS-px change → nothing to do. The mask is rasterised at device resolution. |

**Mask change in `foldView.ts`:**
- `maskPosition: var(--fold-wave-x, 0px) 6px` and `maskSize: var(--fold-wave-period, 20px) 8px`. The `Webkit*` twins follow from `tile` (`foldView.ts:136-138`).
- The data-URL SVG gains `viewBox='0 0 20 8' preserveAspectRatio='none'`. Without a viewBox a different mask size would clip the tile instead of stretching it [INFERENCE].
- The 2 px hover image uses the same geometry, so hover keeps the same meeting points.

**Rule 5: how both middle edges are met.** The middle's tile is stretched so its width between the two strips holds k + ½ periods.
- The cost is a period that differs from 20 px by at most 1/(2k+1): about 2.5 % at the usual ~420 px middle and at most 5 % above 190 px.
- The stroke is stretched horizontally by the same amount.
- Code cost: 4 files, about 355 lines.

**Rule 6: a classic scrollbar between the text and the strip.**
- The wave stops at the scrollbar's left edge, and the scrollbar and then the 1 px border cover it.
- The join leaves the border on the centre line heading down, in the phase the wave would have had if it ran on behind them.
- The phase is taken at the strip's edge (`svg.left` / `svg.right`), not at the wave's visible end. That keeps it independent of the scrollbar.
- Without a scrollbar (WebKitGTK's overlay scrollbar), only the 1 px border sits in between, and it is crossed the same way.

**Rule 4:** joins unchanged (`waveJoinPath` as is). The wave is still under horizontal scroll through the sticky gutter.

### A2 — pin pane edges; the right strip's join absorbs the middle's mismatch

Visions: 5 (less CSS change).

- The left pane is pinned at its strip edge. The middle and the right pane get constant offsets for their left edges.
- `waveJoinPath(join, width, startPhase)` gains a lead-in that follows the tile from any phase to phase 5, then runs WebStorm's join over the remaining width.
- `gap.ts` and `strips.ts` pass the middle's measured phase.
- **Cost:**
  - The right strip's join changes shape with the window width.
  - Up to 20 px of the 38 px strip goes to the lead-in, squeezing the S-curve into about 18 px.
  - It breaks rule 4 (WebStorm's shapes), and the mutation-tested port gains branches.
  - The middle's width must still be measured.
- Rejected.

### A3 — one global phase for all panes

Visions: 2.

- Every pane's mask is shifted by `mod(paneLeft − areaLeft, 20)`.
- A level join becomes the plain tile running across the strip. An S-curve needs lead-ins and lead-outs at any phase.
- **Cost:** `waveJoinPath` would be rewritten, the S-curves would no longer be WebStorm's, and it breaks rule 4. Rejected.

(Snapping the middle column to 20k + 10 px widths was also rejected: the panes would jitter by up to 10 px on resize and end up unequal.)

### A proof

**Node tests (`connectors/index.test.ts`, mutation-tested; `editor/internal/wavePhase.test.ts`):**

| test | bug it catches |
|---|---|
| `waveTile` is on the centre line at `WAVE_DOWN_X` heading down and at `WAVE_UP_X` heading up (evaluate the quadratic segments) | constants swapped, or the tile edited without the phases |
| every `waveJoinPath` branch (level ≤ 25 px, level wide, sloped both ways; widths 20, 38, 60) starts heading down and arrives from below | the contract the phases rely on |
| `leaves` / `enters`: sweep `waveLeft` ∈ {0, 0.4, 237.33} × edge distance 0–2000 step 0.37; phase at the edge = 5 / 15 within 1e-9; period = 20; `0 ≤ offset < period` | sign error, negative `%`, up/down swapped |
| `through`: both edges met; `P = D/(k+½)` with the nearest k; stretch ≤ 1/(2k+1); `D ≤ 0` falls back | wrong rounding, an even number of half-waves |
| `paneEnds`: the left pane leaves at the local strip's left edge, the middle enters at its right edge and leaves at the remote strip's left edge, the right pane enters at the remote strip's right edge | strips swapped, or the pane's own right edge used (the scrollbar bug) |
| a pane whose right edge stops 15 px short of the strip gives the same phases as one that touches it | the classic-scrollbar case |
| the whole layout shifted by any amount gives the same offsets | the Ctrl+B case |
| `phaseStyle` gives `"<n>px"` for both variables; an unchanged phase writes nothing | missing unit, needless style writes |

**Real app (verifier), through `just app-session`:**
- Layouts: sizes 1600×1000 and 1237×803, each with the file list shown and hidden (Ctrl+B), each under `GDK_SCALE=1` and `GDK_SCALE=2`. `appEnv` spreads `process.env` (`session.ts:13`), so the variable reaches the app [INFERENCE: GTK3 on X11 honours it].
- `read` the edge positions (`[...document.querySelectorAll('section svg')].map(s => s.getBoundingClientRect())`) and the y of one wave row, then `shot`.
- Crop 24×24 px around each of the four edges at the wave's centre y and scale it 8×.
- **Pass:** across the border column the ink's centre moves by at most 1 device px. Right edges descend left to right; left edges arrive from below.
- **Extra cases, each on one layout:**
  - 2 px hover: `read` adds `fold-wave-hover` to one run's `[data-fold-run]` nodes. The helper cannot move the pointer (3.U open risk).
  - Light theme: `--settings '{"theme":"light"}'`.
  - Classic scrollbar: inject a style `.cm-scroller::-webkit-scrollbar{width:15px;background:#333}`.
  - Horizontal scroll: set `scrollLeft = 200` through `read`; the pane crop must be pixel-identical before and after.
- **DPR 1.25 / 1.5:**
  - On Linux, GTK3 only draws at whole scales (plan §3, "Text rendering"), and macOS draws at 2. Fractional ratios therefore only reach yamt through WebView2.
  - Run the fixture dev page in Chromium with `--force-device-scale-factor=1.25` and `1.5`. That is the WebView2 stand-in used before (`CrispTextProbe.md:36`).
  - Whether MiniBrowser can take a fractional scale is [INFERENCE: unverified].

## Part B — a toolbar button turns collapsing on and off

### B1 — every level kept in the field plus a count of hidden steps; on/off held by the store with its own channel (recommended)

Visions: 2 (one owner per fact), 4, 1.

**Editor data (`folds.ts`):**
```ts
export type FoldState = {
  readonly runs: readonly Fold[];        // every level of every run, middle ranges mapped through every edit; never sliced
  readonly hiding: readonly number[];    // per run: how many innermost levels still hide (0 = all shown)
};
export const setHiding = StateEffect.define<readonly number[]>();   // replaces showSideFolds; used by middle and sides
FoldFields = { runs; center: StateField<FoldState>; sides: StateField<readonly number[]> }
foldFields(runs, collapsed: boolean)     // hiding starts full (lengths) or all 0
```
- The middle and the sides now share one structure: levels plus counts. The sides already hold counts.
- `paneFolds` becomes `innermost(levels, hiding[run])` for every pane. The view code (`foldView.ts:144-156`) is unchanged.

**Transitions:**
- **Every document change** maps *all* levels (today only the levels still hidden are mapped). The cascade where a level shrunk below 2 lines blanks the levels inside it stays (`folds.ts:43-56`).
- **`showFolds{run, keep}`:** `hiding[run] = min(hiding[run], keep)`. Clicks, reveals and the delete filter work as today.
- **Off:** `setHiding(all 0)`. Every displayed range becomes `null`, so there is no wave, no atomic range and no join (`wavePaints` needs both panes' rows, `gap.ts:115-117`).
- **On:** `setHiding(runs.map(f => f.hidden.length))`. That is the state at open, but over the ranges as they are now: mapped, with levels that shrank staying shown. Runs are not recomputed (rule 4).
- **Sides:** `pushFolds` sends `setHiding(hiding)` whenever `hiding` changes identity.

**Why neither enters history:**
- The toggle transaction is `{ effects, selection?, annotations: addToHistory.of(false) }`. It has no text change and no `placeSpans`, so neither the `invertedEffects` snapshot (`chunkField.ts:110-113`) nor history records it (`commands index.js:240-241`).
- Undo and redo after a toggle undo the earlier edit only, and leave the folds as they are (#63).

**Cursor, rule 8 (new file `foldSelection.ts`, pure):**
- `leaveHidden(range, hidden: readonly Hidden[]): SelectionRange | null`. When the head is strictly inside a range, the head moves to that range's `from`, which is the start of the wave line. When either end is strictly inside, the selection is dropped, leaving only that cursor. This is IntelliJ's order: move the caret, then `removeSelection`.
- `holds` and `revealKeep` move here too (`folds.ts:104-119`), which keeps `folds.ts` under 300 lines.
- The middle's toggle spec includes `selection` only when it changed.
- No loop with #63's reveal: the field reveals only for a selection strictly inside (`folds.ts:104-111`, `141-145`). A cursor at `from` is not inside, and an unchanged selection sets no `tr.selection`.
- The sides get the same treatment inside `pushFolds` whenever their count grows. Only "on" makes counts grow. `sideReveals` then sees a selection at `from` and reveals nothing (`folds.ts:243-247`).
- This matches WebStorm, where `expandAll` runs the batch in every editor.

**Scroll, rule 9:**
- `Folds.setCollapsed(on)` runs `center.dispatch(collapseSpec(fields, state, on), { effects: center.scrollSnapshot() })`.
- The snapshot's position is the top line. When that line gets hidden, `lineBlockAt` gives the wave line covering it, which then takes the line's place. When collapsing turns off and the top line was a wave line, the first line it hid takes its place.
- Then `MergeController.setCollapsed` calls `Frame.realign()`, which calls `ScrollSync.follow("center")`:
  - it sets `#source = "center"` and `#syncedTops = null`, then requests a frame;
  - the next sync writes both sides even though the middle did not scroll (the guard at `scrollSync.ts:89` would otherwise skip it);
  - CodeMirror schedules its measure before listeners when a scroll target is present (`index.js:8064-8065`), so the frame registered after the dispatch runs after the middle has applied its snapshot.
- Nothing jumps under the pointer: it is on the toolbar.

**On/off owner (`ui/collapsing.ts`, new):**
- `createCollapsing(storage?)` uses `useStorage<boolean>("yamt.collapse.unchanged", true, …)` with `flush: "sync"` and `writeDefaults: false`.
- The read rule is `raw !== "false"`, so missing, unreadable or garbage storage means on. `onError` logs `collapse.storage_failed`.
- It returns `{ collapsing: Readonly<Ref<boolean>>; toggleCollapsing(): void }`, spread into the store (`...createCollapsing()`, `AppStore = … & Actions & Collapsing`). That is the `...settingsActions(state)` pattern (`store.ts:157`), so `store.ts` grows only to 298.

**Channel to the editor:**
- `useMergeController(data, hosts, { readOnly, preferences, collapsed })` takes an options object (TS7: two booleans).
- The value is read with `toValue` when a controller is built (`MergeOptions.collapsed`).
- `watch(toRef(collapsed), on => controller.setCollapsed(on))` reaches every opened `MergeView`: hidden ones, read-only ones and deleted-side ones (rule 10).
- New files, and rebuilds after reset or a disk change, open in the current state (rule 5).

**Why not through `Preferences`:**
- `preferences` is `preferencesOf(settings)` (`store.ts:112`, `settings.ts:56-58`) and every change reaches `setPreferences` (`useMergeController.ts:128-130`).
- Those reconfigure compartments and can safely run again. "On" resets shown runs, so it cannot.
- Mixing the two would need a diff in the controller, and forgetting it would reset folds on a theme change.

**Toolbar:**
- `TOOLBAR_BUTTONS = ["previous", "next", "collapse", "applyLeft", "applyRight", "undo", "redo"]`. It stays out of `HIDDEN_AT_FIRST`. Stored hidden lists name hidden ids, so a list stored before this change shows the new button (#58).
- In `MergeToolbar.vue`, `ICON_BUTTONS.collapse` has the label "Collapse unchanged fragments", the icon `~icons/lucide/chevrons-down-up` (present in `@iconify-json/lucide` `icons.json:1141`), `keepsKeyboard: true`, `run: toggleCollapsing`, and `pressed: collapsing`.
- `IconButton` gains `pressed: Readonly<Ref<boolean>> | null`. `shownButtons` maps it to `aria-pressed`; `undefined` when null, so plain buttons get no attribute.
- Classes: `aria-pressed:bg-row-selected aria-pressed:hover:brightness-110`. The `aria-pressed:` variant follows `ChoiceButtons.vue`; the blue-tinted selected-row token differs from hover's translucent `bg-hover`. WebStorm's exact pressed colour is [INFERENCE: not checked].
- Disabled when `summary === null`, like the others.
- `ToolbarMenu.vue` needs no change: it lists `TOOLBAR_BUTTONS` with the button labels (`ToolbarMenu.vue:28-34`), so it shows seven items with collapse third and checked. Hiding the button never touches `collapsing` (rule 7).
- Why `keepsKeyboard`: a click on the wave already leaves the keyboard where it was (#63), and so do the arrows (#56). It also keeps the cursor that rule 8 moves inside the pane that had it.

**Why a second storage key rather than one toolbar object:**
- The #58 format stays as users already have it; no migration.
- Hiding the button and collapsing are independent facts (rule 7).
- Their parse rules differ: unknown hidden ids are dropped, while anything but "false" means on.

### B2 — the same field, with on/off riding inside `Preferences`

Visions: 5 (no new parameter).

- **Cost:** `Preferences` mixes the settings file with window storage, and `preferencesOf` gains a second source.
- `setPreferences` has to diff old against new before resetting folds. A missed diff resets every shown run on any settings re-read or theme click, and no type would catch it.
- Rejected (B1's channel argument).

### B3 — keep the sliced field; remember changes since open

Visions: 5.

- The middle field also composes a `ChangeDesc` since open. "On" maps `fields.runs` through it.
- **Cost:**
  - There would be two mapping paths for one range: per edit with line snapping (`folds.ts:30-41`) and one-shot through the composed change. They can disagree on which lines hide.
  - The composition grows with every edit.
  - Off still needs a third representation.
- Rejected. (Recreating the fields through a compartment would recompute runs and break rule 4.)

### B node tests

| file | test (bug caught) |
|---|---|
| `folds.test.ts` | off: no displayed range in any pane, sides receive zeros (a wave left in a side) · on after 1–2 clicks: every run's displayed range equals a fresh open's (counts not reset) · lines typed above a run *while it was off*, then on: the shifted range hides (shown levels not mapped) · on after an edit above: mapped, not original positions (`fields.runs` used for the middle) · a level shrunk below 2 lines stays shown after on (null level brought back) · a field built off has zero counts and on hides all · toggle, then undo: the earlier edit is undone and the folds are unchanged, `undoDepth` the same (toggle recorded in history) · clicks still go 4 → 8 → all after on; the delete filter still works at the wave · `setHiding` replaces `showSideFolds` in `sideFoldPush` |
| `foldSelection.test.ts` | head strictly inside → moves to `from`; head at `from`/`to` → unchanged · anchor inside, head outside → cursor at head; head inside → `from`; selection covering the whole range → kept (IntelliJ) · property: for every selection in a small document, `revealKeep` of the result is null (reveal loop) · moved revealKeep tests |
| `folds.test.ts` (sides) | a side cursor inside is moved when counts grow, not when they shrink |
| `geometry.test.ts` | updated to `foldField(runs, collapsed)` and `showNextStep(state, run)`; wave rows unchanged |
| `scrollSync.test.ts` | `follow("center")`: the next `sync` writes both sides even with the middle's `scrollTop` unchanged (guard skip); echoes still ignored |
| `collapsing.test.ts` | missing → on; `"false"` → off; `"true"`, `""`, `"no"`, `"[]"` → on; `getItem` throws → on and logged; toggle writes `"false"` then `"true"`; the default is not written |
| `toolbarButtons.test.ts` | order (collapse after `next`, before `applyLeft`); stored `["undo","redo"]` shows collapse; hiding it stores `["collapse","undo","redo"]` |
| `store.test.ts` | `toggleCollapsing` flips `collapsing` and persists |
| `useMergeController.test.ts` | built off → controller gets `collapsed: false`; flipping the ref calls `setCollapsed` once per live controller; a preferences change never calls it |

### B real-app steps (verifier)

1. Fresh start: `aria-pressed="true"` on the button and waves at their #63 places.
2. In a file, click a wave twice, then open a second file. Toggle off:
   - `.fold-wave` count is 0 and there are no `[data-fold-run]` in the strips, in both files;
   - the gutters number continuously.
3. Toggle on: wave counts and the line numbers around each wave equal those at start (vOn.ts: 25|83 and 22|80, `UnchangedVerify` step 3).
4. While off, put the middle's cursor inside a run, then toggle on: the cursor (`.cm-cursor`) sits at the start of the wave line. A selection with one end inside collapses to the cursor. The wave does not open again.
5. The middle's first visible line number is the same before and after a toggle; the sides' matching lines share its row at once.

[Showing lines 1-300 of 397. Use :301 to continue]