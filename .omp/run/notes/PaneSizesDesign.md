# 3.H design: dots on the resize handles, three resizable panes, one remembered split

I built three options against `6c5f91a` and recommend **Option A**. All of them run in the window: no Rust, no IPC, no `App.vue` change. Two things fall outside `frontend/src/**`:
- **Docs:** the project map, architecture §5.1/§5.4 and the changelog need updating.
- **`app-session` lacks a drag:** it has no drag or double-click command, so the real-app steps need `drag` and `click --double` added in `frontend/scripts/app-session/`.

Nothing here was built or run. The WebKit and app steps below are what the verifier should run.

## What the sources say

- **WebStorm, `ThreeDiffSplitter.java`:**
  - `Divider` puts `W_RESIZE_CURSOR` on the whole gap between two editors.
  - `Divider.processMouseMotionEvent` → `setProportion`: dragging one divider changes only that proportion. The other one is kept unless it would no longer fit (`min(other, 1 − p)`). It is clamped to `[0, 1]`, so there is no minimum.
  - The fields are `myProportion1` (first pane) and `myProportion2` (third pane); the middle is whatever is left.
  - `calcComponentsWidths`: the first and third widths are cut to whole pixels and the middle takes the rest, so the widths always add up.
  - `Divider.processMouseEvent`: a double-click calls `resetProportions` (thirds), or `expandMiddlePanel` when the panes are already equal. Expanding is not copied (it is a non-goal).
- **WebStorm, `DiffSplitter.java`:**
  - `createDivider` makes the whole divider a resize handle, but its buttons keep the default cursor (`createActionComponent` → `setCursor(Cursor.getDefaultCursor())`). The rest of the divider resizes.
  - `paintTitleSeparator` draws the divider over the title row as well.
- **VS Code, `sash.ts`:**
  - `globalSize = 4`.
  - `globalHoverDelay = 300`: `Sash.onMouseEnter` adds `hover` after the delay, `onMouseLeave` removes it at once.
  - `onPointerStart` stops the event and injects `* { cursor: … !important }` so the cursor holds over the whole window (#21675).
  - `onPointerDoublePress` fires `_onDidReset`.
- **VS Code, `grid.ts`:** `Grid.onDidSashReset` resizes the view to its preferred width, else calls `distributeViewSizes` (equal sizes).
- **VS Code, `splitview.ts`:** `resize` pushes a drag on into further views once a neighbour reaches its minimum. Rule 2 forbids that, so it is not copied.
- **VS Code, `layout.ts`:** it stores the side bar width (`LayoutStateKeys.SIDEBAR_SIZE`), so the width comes back after a restart.
- **VS Code merge editor, `codeEditorView.ts`:** `minimumWidth: DEFAULT_EDITOR_MIN_DIMENSIONS.width`, which `editor.ts` defines as **220 px**.

---

## Option A — the whole strip column is the divider (WebStorm); one split held by the store (recommended)

**Visions:** 2, 1, 4, 5

### Data structures
- **`PaneSplit = { readonly local: number; readonly remote: number }`**
  - The shares of Local and Remote in the three panes' total width, strips excluded. Result is `1 − local − remote`, the same shape as WebStorm's `myProportion1`/`myProportion2`.
  - Because Result is derived, the shares cannot fail to add up to one.
  - It is stored in `localStorage` under `yamt.panes.split` as `{"local":0.3,"remote":0.25}`.
  - **Valid** means: both are finite numbers, each ≥ `MIN_SHARE` (0.01), and their sum ≤ 0.99. Anything else reads as `EQUAL_SPLIT` (thirds).
- **`PaneWidths = { local; center; remote }`** — pixel widths, measured once when a drag starts.
- **`DotsState = "rest" | "hover" | "drag"`** — a sum type, not two booleans.
- **`ColumnDrag = { moveBy(dx: number): void }`** — the press returns a closure, so no generic type is needed.
- **Constants:**
  - `MIN_PANE_PX = 220` (VS Code).
  - `MIN_SHARE = 0.01`.
  - The gutter widths: `strip` = `2.5rem`, `gap` = `1px`.

### 1. Who owns the split
- `ui/paneSplit.ts` provides `createPaneSplit(storage?)` over `storedValue`, following the `collapsing.ts` precedent. It returns `{ paneSplit, setPaneSplit, resetPaneSplit }`.
- The store spreads it in like `...createCollapsing()`. That is **3 lines in `store.ts`** (290 → 293): the import, `& PaneSplitState` on `AppStore`, and the spread.
- **Why the store:** module state outside the store is forbidden (TS15), and one window-wide owner has to reach every `MergeView` and `ChoiceView`. The alternative, App passing props down with events back up, puts feature logic into `App.vue` (VU16) and goes against props-down/events-up (VU7).
- **How each view reads it:** each view computes `paneColumns(paneSplit.value, gutter)` and binds it as `:style="{ gridTemplateColumns }"` on its `<section>`. That is a derivation from the one ref, not a per-file copy.
- **`paneColumns` output:** five tracks, `minmax(min(220px, calc((100% - 2 * G) / 3)), <share × 100>fr) G … G …`.
  - Fr factors are shares × 100. When a pane is held at its minimum, the CSS grid algorithm ("Find the Size of an fr", css-grid-1 §12.7.1) treats it as fixed. If the remaining flex factors add up to less than 1, CSS counts the sum as 1 and part of the row stays empty. With shares ≥ 1 % and factors ×100, every factor is ≥ 1, so that cannot happen.
  - The ChoiceView moves from `grid-cols-3 gap-x-px` to the same five tracks with 1 px gutters. Its column starts become 1/3/5 and the background colour still shows through the gutters.

### 2. Divider elements and press area
- **Each pane divider is two elements with one listener object** (`v-on="dividers.local.listeners"`):
  1. The header-row cell above the strip. Today it is the empty `col-start-2/4 row-start-1` div. It gets `role="separator"`, `aria-orientation="vertical"`, the label "Local and Result widths" or "Result and Remote widths", and the dots.
  2. The existing strip wrapper (`col-start-2/4 row-start-2`, `will-change-transform`, unchanged). It gets `cursor-col-resize`.
- **What counts as a divider press:** the press's `target` is the handle element itself or the strip's `<svg>` root (`target === currentTarget || target instanceof SVGSVGElement`).
  - Icon hit rectangles (`.chunk-action rect`) and wave joins (`.strip-wave-hit`, `pointer-events: stroke`) are children of the svg, so their presses, drags (#45) and clicks (#63) go to the editor as they do today. This is WebStorm's model: the buttons keep their presses, the rest of the divider resizes.
  - Ctrl/Cmd+click (#46) is handled in the side panes (`modClick.ts` `domEventHandlers`), not on the strips, so it is unaffected.
- **The one editor change:** `path.chunk-band { pointer-events: none; }` in `editor/theme.css`. Without it, a press on a band would target the path instead of the svg.
- **Stacking:** no new layers. The header cell is in normal flow. The ChoiceView handle is the 1 px gutter track spanning both rows, with an absolute `-inset-x-[2px]` hit box at `z-10`, so it is 5 px wide like the file list's gap.
- **Where the dots go:**
  - In MergeView, centred in the header-row cell. That is the only part of the divider column with no band, wave or icon, so rule 1 holds by construction. WebStorm also draws its divider over the title row.
  - On the file list's 5 px gap and on the ChoiceView gaps, centred vertically.
  - `ResizeDots.vue` draws three 3 px dots, 3 px apart, with `pointer-events-none`.
  - Colours are `bg-handle` at rest and `bg-handle-active` on hover (`transition-colors`, `delay-300` going in, `delay-0` going out, after VS Code's `globalHoverDelay`) and at once while dragging.
  - New tokens in both theme blocks of `style.css`: `--color-handle` (dark #565362, light #aeb3c2) and `--color-handle-active` (dark #aba9b6, light #767a8a).
- **When the dots brighten:** `pointerover` sets `hover` only when the target counts as a divider press. Over an icon or a wave the dots stay at rest, so bright dots always match the `col-resize` cursor.

### 3. Drag math — `dragged(widths, boundary, dx)`, pure
- `boundary: Side` names the divider next to that side's pane.
- `T = widths.local + widths.center + widths.remote`.
- `min = Math.min(MIN_PANE_PX, T / 3)`.
- For the `local` boundary:
  - `pair = local + center`
  - `floor = Math.min(min, pair / 2)`, which keeps the function total when `pair < 2·min`
  - `local' = clamp(local + dx, floor, pair − floor)`
  - `remote' = widths.remote`, never recomputed: no push into the third pane, unlike VS Code
  - the result is `{ local: local'/T, remote: remote'/T }`
- The `remote` boundary is the mirror image.
- `dx` is measured from the press, so the boundary keeps the exact point where it was grabbed. WebStorm's `x / totalWidth` lets it drift.
- **The third pane to the pixel:** its new share is `w/T`, so CSS renders `T · w/T = w`, the same layout unit. Result is never rounded on its own because it is derived.
- **When the minimum held at the press:** what was measured becomes the split, because the press measures what is shown.
- **Window too narrow for the stored shares:** the shares are never rewritten on a resize; only a drag writes. CSS `minmax` keeps the minimum and shares the rest by ratio. Below 3 × 220 px of panes, all three are equal.

### 4. During a drag — `ui/useColumnDrag.ts`, shared by FileList and the dividers
- **On `pointerdown`**, if the press is accepted and is the main button:
  - `preventDefault`
  - `setPointerCapture` on `currentTarget`
  - add the class `col-resizing` to `document.documentElement`. `style.css` then sets `:root.col-resizing * { cursor: col-resize !important; user-select: none !important }` (the VS Code fix for #21675).
- **Keyboard stays put:** every handle's `mousedown` is cancelled when accepted. The svg's `keepEditorFocus` already does this inside the strip. Whether cancelling `pointerdown` alone stops the focus change in WebKit is unverified, so both are cancelled.
- **The press** measures three rectangles once. Each move only calls `setPaneSplit` and reads no layout.
- **The drag ends** on `pointerup`, `pointercancel` or `lostpointercapture`, and on scope dispose, so the cursor cannot get stuck.
- **What re-lays out per move:**
  - The style of every opened section (hidden ones skip layout under `content-visibility: hidden`).
  - The three editors: CodeMirror's resize observer measures, `geometryChanged` fires, and `Frame` recomputes its rows. Lines are not wrapped, so the rows come out the same.
  - The strips: their width is constant and their contents use strip coordinates, so they just move.
  - `WavePhases`: its `ResizeObserver` on the pane hosts rewrites `--fold-wave-x`/`--fold-wave-period` per frame. Dragging the left divider never changes the right pane's size, so its observer stays quiet.
- **No frame throttle:** the move handler writes without reading layout, and the browser lays out once per frame.
- **Storage:** each move writes it (`flush: sync`, two numbers). That is the cost of keeping one ref; the WebKit step watches for it.
- **Scroll timing:** run `.omp/run/scroll-timing.py` on builds of `6c5f91a` and of the change. The second run comes after one drag, so the stored split is not equal thirds. "All opened" should be no worse.

### 5. Reset and rule 6
- **Double-click on a divider:** `resetPaneSplit()` gives equal thirds (VS Code's `distributeViewSizes`; WebStorm's `resetProportions`).
- **Double-click on the file list handle:** `width = null`, which falls back to `w-60` = 240 px (VS Code's preferred width).
- **Rule 6a, not remembered (today):** no new module. The list starts at 240 px every time, matching #61 (shown/hidden is not remembered either). The user re-drags it after each start.
- **Rule 6b, remembered:**
  - A new `ui/fileListWidth.ts` (about 35 lines) and its test (about 60), created inside FileList like `createFileListMode`. No store change.
  - Key `yamt.files.width`, in px like VS Code's `SIDEBAR_SIZE`. Valid means finite and ≥ 160 (`min-w-40`), else null.
  - The 50 vw cap stays in CSS, so on a smaller screen the list shows capped while the stored width stays.
  - Today's drag does not clamp, so a width dragged past the cap is kept past it and there is a dead zone on the way back. With 6b that persists across restarts. The fix is a clamp `[160, innerWidth / 2]` in the drag (+3 lines).

### 6. Why nothing else changes (rule 7)
A divider drag changes pane widths exactly as a window resize does today, and every width-dependent piece already follows a window resize:
- **Locked scroll:** it is vertical-only, and line heights do not change because lines are not wrapped.
- **Bands, joins and icons:** they are in strip coordinates, and `documentTop − stripTop` is vertical.
- **Waves (#64):** `WavePhases` already re-measures through its `ResizeObserver` and the measured strip edges.
- **Minimap (#81):** it sits in the right pane's `view.dom` at `right: 0`, its width comes from `minimapColumns(pixelRatio)`, and its height does not change.
- **Find bar:** it is a CodeMirror panel at the pane's width.
- **Text selection:** none, because of `preventDefault` and `user-select`.
- **Keyboard:** stays where it was, because `mousedown` is cancelled.

### Files touched
- **Build H1 — model and composables**, node-tested (about 250 lines of code plus about 340 of tests):
  - **New:** `ui/paneSplit.ts`, `ui/paneSplit.test.ts`, `ui/useColumnDrag.ts`, `ui/useColumnDrag.test.ts`, `ui/usePaneDividers.ts`.
  - **Changed:** `ui/store.ts` (+3), `ui/store.test.ts` (+25).
- **Build H2 — chrome** (about 300–400 lines):
  - **New:** `ui/ResizeDots.vue`, `editor/strips.browser.test.ts`.
  - **Changed:**
    - `ui/MergeView.vue` (+22, about 293 lines)
    - `ui/ChoiceView.vue` (+25)
    - `ui/FileList.vue`: dots, double-click, `useColumnDrag` replacing `startResize`/`resize`
    - `style.css`: 4 tokens and the root rule
    - `editor/theme.css`: 1 line
    - `frontend/scripts/app-session/{args.ts,drive.ts,args.test.ts}`: `drag --name <n> <name|css> --dx <px> [--dy <px>]` and `click --double`, using W3C pointer actions like `click`
    - For 6b: `ui/fileListWidth.ts` and its test
    - Docs: `.omp/skills/project-map/SKILL.md` (tree and state row; map-check needs it), `docs/architecture.md` §5.1/§5.4, `CHANGELOG.md`
- **Contract H1 → H2:**
  - `PaneSplit`, `PaneWidths`, `Gutter = "strip" | "gap"`, `EQUAL_SPLIT`
  - `paneColumns(split, gutter): string`
  - `dragged(widths, boundary: Side, dx): PaneSplit`
  - `PaneSplitState = { paneSplit: Readonly<Ref<PaneSplit>>; setPaneSplit(s); resetPaneSplit() }` on `AppStore`
  - `useColumnDrag({ accepts(e), press(e): ColumnDrag | null, reset() }, root?) → { listeners, dots }`, where `listeners` covers pointerdown, pointermove, pointerup, pointercancel, lostpointercapture, pointerover, pointerleave, mousedown and dblclick
  - `usePaneDividers(measure: () => PaneWidths | null, { setPaneSplit, resetPaneSplit }) → Readonly<Record<Side, { listeners; dots }>>`
- **Order:** no file is in both builds. Run H1 first; H2 compiles against its exports.

### Risks
- The "only icons and joins take presses" rule lives in CSS and is proven only by a browser test, and `pnpm test:browser` is not part of `just check`.
- A slightly missed icon click (1–2 px of jitter on the strip background) nudges the split by that much. Neither source uses a dead zone.
- Each move writes `localStorage` synchronously. That should be cheap in WebKit but is unmeasured.
- `Frame` recomputes its rows every drag frame. Drags on huge files may drop frames; scrolling is unaffected.
- `MergeView.vue` ends near 293 of 300 lines. I'm assuming oxlint counts only the script block, which would leave more room.
- `min()` with a percentage inside a grid track minimum in WebKitGTK 2.54 is unverified; the WebKit test covers it.
- The docs (map, architecture, changelog) will conflict with the parallel server-pins feature.

### Unit tests (node) and the bug each one catches
- **`paneSplit.test.ts`:**
  - A missing key gives thirds and writes nothing. *(Writing defaults would lock in today's thirds.)*
  - Invalid values give thirds: `""`, `x`, `[]`, `{}`, string numbers, a missing `remote`, `local + remote = 1` (a zero Result), a negative share, 0.005. *(A zero or negative pane would render.)*
  - A value written then read back by a second instance is the same. *(Write and read do not match.)*
  - `{300,400,300}`, dx +100 → `{0.4, 0.3}` with `remote·T === 300`. *(Recomputing all three from the pointer moves the third pane.)*
  - dx +250 gives Result exactly 220; dx −200 gives Local exactly 220. *(No minimum, or the minimum applied to the wrong pane, or the drag pushing into the third pane.)*
  - T = 600: the minimum is 200 and dx +50 changes nothing. *(The fixed 220 on a narrow window gives negative widths.)*
  - `{300,100,600}`: the result stays total, both shares are positive, and Result ≥ 1 %. *(Lower bound above upper bound.)*
  - The `remote` boundary mirrors the `local` one. *(The two sides mixed up.)*
  - dx 0 gives back the measured shares. *(A click moves the split.)*
  - Exact `paneColumns` strings for `strip` and `gap`, every fr factor ≥ 1. *(Swapped tracks; the gutter left out of the minimum; factors summing to one leaving part of the row empty.)*
  - A storage that throws gives thirds, still sets the split in memory, and warns. *(A crash with storage disabled.)*
- **`useColumnDrag.test.ts`** (fake events and a fake `classList`):
  - An accepted main-button press cancels the event, captures, adds the class and sets `drag`. *(No capture: the 5 px handle loses the pointer.)*
  - `moveBy` gets dx from the press. *(Absolute x.)*
  - Up, cancel and lost capture each end the drag and remove the class. *(Stuck cursor.)*
  - Moves from a second pointer, or after the drag ended, are ignored. *(A pen or second finger interfering.)*
  - A rejected target or right button does nothing and cancels nothing. *(Icon presses or the context menu swallowed.)*
  - Double-click on an accepted target resets; on an icon it does nothing. *(Double-clicking an apply icon resets the split.)*
  - Hover: accepted target → `hover`, icon → `rest`, leave → `rest`.
  - A press that returns null does not capture.
- **`store.test.ts`:** `setPaneSplit` writes `yamt.panes.split`, and a second store reads the same split. *(The wiring is missing.)*

### Editor test (`editor/` is not mutated, VF7)
- **`strips.browser.test.ts`:**
  1. `elementFromPoint` on a multi-line band, below its icon row, returns the strip svg. **Hand mutation:** delete `pointer-events: none` from `path.chunk-band` → the test gets the path and fails.
  2. On an icon, `closest(".chunk-action")` is found. **Mutation:** add `pointer-events: none` to `.chunk-action rect` → fails.
  3. On a wave join, `closest("[data-fold-run]")` is found. **Mutation:** change `.strip-wave-hit` to `pointer-events: none` → fails.

### WebKit steps
Run `pnpm -C frontend dev --port 4448` and `just webdriver 4448`, using W3C pointer actions:
- **W1 — dots, dark and light:** the computed background matches the tokens; resting on a handle switches to `--color-handle-active` after 300 ms, not over an icon. Take screenshots of all three handles in both themes.
- **W2 — drag a divider:** drag the left header cell by +120 and read the hosts' rectangles: Local +120, Result −120, Remote equal to the pixel. The left strip moves +120 and stays 40 px wide. A band's `d` is unchanged. A fixed scroll of the left pane gives the same follower `scrollTop`s as before the drag. The pane hosts' `--fold-wave-*` values are updated. Take a zoomed join screenshot.
- **W3 — the strip as a handle:** dragging from the strip between icon rows works. A press on an apply icon still applies, and a vertical drag over icons covers several. A wave click in the strip opens lines. Ctrl+click in a side pane still applies.
- **W4 — the minimum:** dx −2000 → Local 220; dx +2000 → Result 220.
- **W5 — double-click:** on a divider the panes come out equal within 1 px; on the file list handle it is 240 px.
- **W6 — keyboard and cursor:** focus a change in the left pane, drag: `activeElement` and the outline are unchanged, and `getSelection().toString() === ""`. While the button is held, `cursor` reads `col-resize` on `body` and on a `.cm-line`.
- **W7 — narrow windows:** at 1000 px the stored value is unchanged and the minimum holds. At 700 px the panes are equal and fill the row. Back at 1600 px the shares are restored.
- **W8 — reload:** the split is the same, and another file shows it too.
- **W9 — garbage in storage:** `{"local":0.9,"remote":0.5}` → equal thirds.
- **W10 — minimap and find bar:** hold Alt after a drag: the minimap's right edge equals the right scroller's right edge. Ctrl+F in Result: the find bar has the pane's width.

### Real-app steps
On the `conflict-repo.sh` repository:
- `start-app --name h-split`: drag the "Local and Result widths" separator by 150. Open the binary file (choice view) and the file deleted on one side: their column ratios match. `stop`, start again: same widths.
- `h-light` with `--settings` for the light theme: dot screenshots.
- `click --double` on each handle.
- `--size 1000x800`: the narrow case.
- `drag ".chunk-action-apply" --dx 0`: the change is applied.
- `.omp/run/scroll-timing.py` before and after.
- `just check`.

---

## Option B — handle only in the header row; no editor change

**Visions:** 5, 2, 1

- **Same as A:** the data structures, `paneSplit.ts`, `useColumnDrag.ts`, `usePaneDividers.ts`, the store, the ChoiceView gutters and the dots.
- **The difference:** a press starts a drag only in the header-row cell above each strip (40 × about 33 px) and on the ChoiceView gaps. The strip wrapper gets no listeners, so `editor/theme.css` and `strips.browser.test.ts` drop out, and `accepts` is always true.
- **Files touched:** as A without `editor/theme.css`, `editor/strips.browser.test.ts` and the strip-wrapper bindings in MergeView.
- **Data structures:** as A.
- **Risks:**
  - It departs from WebStorm (DR6): WebStorm's whole divider is the handle. That makes it a product question, not an orchestrator default.
  - A small press target, far from the code the user is looking at.
  - The cursor only changes in the header row.
- **Tests:** as A without the editor test and W3's strip-background drag. W3 instead checks that a press on a strip band does nothing.
- **Cost:** about 25 fewer lines, and the editor is untouched.

## Option C — the editor routes strip presses

**Visions:** 3, 2

- **What it is:** `strips.ts` decides which presses are free. `MergeOptions` gains `dividers: { press(side, event) }` and `MergeController` forwards those presses. The ui does the math as in A.
- **Files touched:**
  - **New:** `editor/internal/stripPress.ts` and its test.
  - **Changed:** `editor/index.ts` (280 lines, close to its cap), `editor/internal/strips.ts`, `ui/useMergeController.ts`, plus everything in A's ui list.
- **Data structures:** as A, plus a `DividerPress` callback type across the editor seam.
- **Risks:**
  - More editor surface, which is not mutation-tested (VF7) and needs hand mutations for its tests.
  - ChoiceView has no editor, so it still needs A's ui handle: two press paths for one gesture (against vision 2).
- **Tests:** stripPress unit tests with fake targets, plus A's.

---

## Recommendation: Option A

- It follows WebStorm's divider model, the one the rules ask to copy (`ThreeDiffSplitter.Divider`, and `DiffSplitter`'s buttons keeping their own cursor).
- The editor change is one CSS line with a three-assertion WebKit test.
- One owner (`createPaneSplit` in the store), one minimum constant, and one token pair.
- Shares are stored as Local/Remote with Result derived, so they cannot fail to add up (vision 4), and fr factors ≥ 1 prevent an empty band under the minimum.
- **What it costs:**
  - The band hit rule is enforced only by a browser test outside `just check`.
  - A missed icon click can nudge the split by a pixel or two.
  - Storage is written on every pointer move.
  - Two builds of about 600 + 400 lines including tests.
  - `MergeView.vue` ends near its line cap.
  - The real-app steps need two small `app-session` commands outside `frontend/src`.
- **If the owner wants no editor change at all,** B is the fallback, but it needs his answer on the WebStorm deviation.

### Draft plan §2 row 84
| 84 | **Three dots on every resize handle; the three panes resized by their dividers, one split for the window, remembered** (owner 2026-10-19, GitHub issue 4; rules 1–7 in `docs/slices/request-pane-sizes.md`; design `briefs/3.H-pane-sizes-design.md` option A by `PaneSizesDesign`). **Split:** Local's and Remote's shares of the three panes' width, strips excluded, Result the rest (WebStorm `ThreeDiffSplitter` `myProportion1`/`myProportion2`); one value for the window in localStorage `yamt.panes.split` (`ui/paneSplit.ts`, held by the store like #68); each ≥ 1 % and together ≤ 99 %, otherwise thirds. Every MergeView (the deleted-side view too) and ChoiceView builds its grid from it: `minmax(min(220px, a third), share×100 fr)` per pane. A narrower window keeps the shares, the 220 px minimum wins (VS Code merge editor `codeEditorView.ts` `DEFAULT_EDITOR_MIN_DIMENSIONS.width`), and with less than three minimums the panes are equal. **Divider:** the whole strip column, as WebStorm's `Divider` with its buttons keeping their own (`DiffSplitter.createActionComponent`): its header-row cell plus every point of the strip that no icon or wave join takes (bands no longer take pointer events); the choice view's 1 px gap plus 2 px on each side. A drag moves that boundary only: the two panes share their sum, each ≥ the minimum, and the third keeps its measured width (no push into the next pane as in VS Code's `SplitView.resize`); the press keeps its grab point. **Dots:** three 3 px dots in `--color-handle`, `--color-handle-active` 300 ms after the pointer rests where a press would drag (VS Code `Sash` hover delay) and at once while dragging; in the header-row cell above each strip (the column's only part without bands, waves or icons; WebStorm draws its divider over the title row, `paintTitleSeparator`), centred on the file list's and the choice view's gaps. **Drag:** pointer capture, `mousedown` cancelled (the keyboard and the selection stay), `col-resize` over the whole window while dragging (VS Code `Sash.onPointerStart`, #21675); each move writes the split; no frame throttle (no layout reads per move). **Reset:** a double-click on a divider gives equal panes, on the file list's handle its starting 240 px (VS Code `Grid.onDidSashReset`); WebStorm's `expandMiddlePanel` is not copied. **File list width:** ⟨owner's answer to rule 6⟩ | A handle in the header row only (DR6: WebStorm's whole divider takes the press); a thin sash over a strip edge (covers the icons' hit areas); the editor routing strip presses through `MergeController` (more editor surface and a second press path for the choice view); custom properties on App's container (restyles every editor line of every opened file per move [INFERENCE]); fr factors summing to 1 (a pane at its minimum leaves the rest summing below 1, and CSS leaves part of the row empty, css-grid §12.7.1); widths stored in px (a different window width breaks the shares); storage written only on release (two values for one fact); VS Code's push into the next pane (rule 2); WebStorm's missing minimum (a pane dragged to nothing, a non-goal); a split per file (non-goal) | 2, 1, 4, 5 |

## Open questions for the owner
1. **Rule 6:** should the file list come back after a restart at the width it was last dragged to, as VS Code's side bar does? If yes, a list dragged wide on a big monitor also starts wide on a laptop, capped at half the window. If no, it starts at 240 px every time as today, and a user who likes it wider re-drags it after each start.
2. **Only if Option B is chosen:** is it acceptable that only the header-row piece above each connector strip resizes the panes, and pressing the strip itself does nothing? In WebStorm the whole gap between two editors is the handle.