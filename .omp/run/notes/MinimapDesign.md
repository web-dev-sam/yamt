# 3.M minimap design: three options, recommendation, cutover, builds, tests, plan row #81

I recommend **option A**: a canvas minimap owned by `Frame`, placed in the right pane's `view.dom`, with its code rows cached in tiles. Its main cost is that it copies VS Code's glyph table, which brings MIT notice work in `THIRD_PARTY_NOTICES.md`, `scripts/third-party-licenses.sh` and the generated `THIRD_PARTY_LICENSES.txt`.

The work fits two web builds after the cutover: build A (cutover) is 24 files; B1 (code drawing, slider, press, drag and wheel) is about 28 files and about 1,500 changed lines; B2 (the two edges) is 8 files. Everything stays inside `frontend/src/**` apart from docs and licence files. No Rust or IPC change is needed.

I read the tree at `09487ec` (the tip of `feat/minimap`), not at `7141a81` as the brief says. I did not check what differs between the two.

## VS Code behaviour this design copies (microsoft/vscode `main`, read 2026-10-18)

Line numbers come from grep on the raw files. Paths below are relative to `src/vs/editor/`. "Lines" below means rows of the minimap, numbered from 1 as VS Code numbers lines.

| behaviour | source |
|---|---|
| Defaults: `size: 'proportional'`, `showSlider: 'mouseover'`, `renderCharacters: true`, `maxColumn: 120`, `scale: 1` | `common/config/editorOptions.ts:3489-3495` |
| Scale is `pixelRatio >= 2 ? round(scale*2) : scale`; row height is `baseCharHeight(2) * minimapScale` device px; character width is `minimapScale / pixelRatio` CSS px | `_computeMinimapLayout`, `:2796`, `:2805`, `:2810-2811` |
| Width is `min(floor(maxColumn * charWidth), …) + MINIMAP_GUTTER_WIDTH` (8) | `:2897-2898`, `:884` |
| Slider height, sliders' travel and the ratio: `sliderHeight = floor(viewportHeight/lineHeight * minimapLineHeight/pixelRatio)`; `maxSliderTop = min(minimapHeight − sliderHeight, max(0, (extraTop + lineCount)*rowH − sliderHeight))`; `ratio = maxSliderTop / (scrollHeight − viewportHeight)`; `sliderTop = scrollTop * ratio` | `browser/viewParts/minimap/minimap.ts` `MinimapLayout.create` `:280`, `:338`, `:341`, `:355-357`, `:361-362` |
| A file that fits in the minimap: drawn from line 1 with `topPaddingLineCount = extraTop`; the slider shows only if `maxSliderTop > 0` | `:364-367` |
| A file taller than the minimap: where its own window starts, with no flicker from the previous layout; `endLineNumber`; `sliderTopAligned` | `:369-411` |
| Drag: `getDesiredScrollTopFromDelta(delta) = round(scrollTop + delta / ratio)` | `:252-253`, `_startSliderDragging` `:1322`, `:1344-1345` |
| Press: `preventDefault`; the row is `lineIndex + startLineNumber − topPaddingLineCount`, at most the line count; then `revealLineNumber` (Center, Smooth). Primary button or a non-mouse pointer. | `:1237-1270`, `:1130-1140` |
| The slider's own press: `preventDefault` and `stopPropagation` | `:1274-1280` |
| Center reveal: `max(0, (boxStart + boxEnd)/2 − viewportHeight/2)` | `browser/viewParts/viewLines/viewLines.ts:768-775` |
| "Smooth" is an instant jump by default: `smoothScrolling` defaults to false, and `setScrollPositionSmooth` falls back to now when the duration is 0 | `editorOptions.ts:6779`; `src/vs/base/common/scrollable.ts:306-309` |
| A wheel over the minimap scrolls the editor, because the scrollbar listens on the whole view node | `browser/viewParts/editorScrollbar/editorScrollbar.ts:44` (`listenOnDomNode`); minimap placed in the overflow guard, `browser/view.ts:288` |
| Characters come from prebaked intensity tables: 1×2 device px per glyph at scale 1, 2×4 at scale 2, 96 glyphs (32–126 plus unknown) | `minimapCharRendererFactory.ts:25-40`, `minimapPreBaked.ts`, `minimapCharSheet.ts` `Constants`, `getCharIndex` |
| Glyph intensities are softened by 12/15 on dark and 50/60 on light (`useLighterFont = backgroundIsLight`); each pixel is `bg + (fg − bg) × intensity × fgAlpha`, and `minimap.foregroundOpacity` defaults to `#000f` | `minimapCharRenderer.ts` constructor and `renderChar`; `minimap.ts:1990`; `src/vs/platform/theme/common/colors/minimapColors.ts:44-46` |
| Per line: tabs advance to `tabSize − (col % tabSize)`, spaces advance, anything past `maxDx` stops, a full-width character counts twice | `_renderLine` `:2132` |
| Redraw on scroll: when the drawn lines are unchanged the old `ImageData` is reused (`linesEquals`); otherwise lines already drawn are copied (`_renderUntouchedLines`) and only new ones drawn; colours and tokens invalidate | `renderLines` `:1942-1951`, `:2039`; `onTokensChanged` `:1481-1485`, `onTokensColorsChanged` `:1487-1490` |
| Slider look: `minimapSlider.background`, `hoverBackground` and `activeBackground` are the scrollbar slider colours at 0.5. That makes dark `#797979` at 0.2, `#646464` at 0.35, `#bfbfbf` at 0.2; light `#646464` at 0.2, at 0.35, `#000000` at 0.3. The canvas has `opacity: 0.9` | `minimapColors.ts:48-58`, `src/vs/platform/theme/common/colors/miscColors.ts:53-63`, `minimap.css:18-26`, `:65-67` |

**The request's `[INFERENCE]` holds:** a row is 2 CSS px at device pixel ratio 1 and 2 (2/1 and 4/2). It is 1.6 CSS px at 1.25 and 1.33 CSS px at 1.5 and 3. VS Code behaves the same way, and so will yamt.

## What all three options share (data first, `skill://principles` §3)

**Pure data, all of it tested in node:**
```ts
// minimapLayout.ts — VS Code's MinimapLayout.create in yamt's numbers. Rows are numbered from 1, like VS Code's lines.
type MinimapInput = {
  scrollTop; viewportHeight; paddingTop; paddingBottom;   // Result scroller; documentPadding
  rows: number;          // visual rows: round(lineBlockAt(doc.length).bottom / LINE_HEIGHT_PX)
  height: number;        // minimap CSS height
  pixelRatio: number;
};
type Slider = { readonly top: number; readonly height: number };            // CSS px
type MinimapLayout = { readonly input: MinimapInput; readonly startRow: number; readonly endRow: number;
  readonly topPaddingRows: number; readonly rowPx: number /* device px */;
  readonly slider: Slider | null /* null = VS Code's !sliderNeeded; no NaN ratio */; readonly ratio: number };
type Columns = { readonly left: Box; readonly code: Box; readonly right: Box; readonly width: number }; // device px
function minimapScale(pixelRatio): 1 | 2
function minimapColumns(pixelRatio): Columns          // edges 6 CSS px each, code 120 × scale device px
function minimapLayout(input, previous: MinimapLayout | null): MinimapLayout
function rowAt(layout, offsetY): number                // press → row, clamped to [1, rows]
function rowTop(layout, row): number                   // device-px y of a row in the canvas
function centredScrollTop(row, input): number          // VS Code Center
function draggedScrollTop(start: MinimapLayout, delta): number
```

**Rows and where they are read** (brief point 2):
- Panes never wrap and have no block widgets. A collapsed run is one 20 px inline replace, and CodeMirror estimates lines it never drew at the measured height, so the height map is exact (#80 fact, `@codemirror/view index.js:5417-5419`). A Result row is therefore `round(block.top / LINE_HEIGHT_PX) + 1`.
- Row → block: `view.lineBlockAtHeight((row − 1) × 20)`.
- Wave rows: `Frame.layout().waves[i].center` (the one cache).
- Change spans: `Frame.layout().rows[i].center`.
- Problems: `forEachDiagnostic` → `lineBlockAt`, so a problem in hidden lines lands on its wave row.
- The find space is `documentPadding.top` (4 px, or 33 px while a find bar is open) and enters only as VS Code's `paddingTop` (`extraTop = floor(33 / 20) = 1`).

**Glyphs and colours:**
- `minimapGlyphs.ts` holds VS Code's prebaked tables (MIT header) and `getCharIndex`.
- `pane.ts` gets one table, `SYNTAX_COLOURS: { tag, colour: "--color-syntax-keyword" | … }[]`. `paletteHighlight` is built from it (`color: var(${colour})`), and so is a `tagHighlighter` whose classes are the token names. One source per fact; the palette test's literal-token scan still passes.
- The minimap reads `getComputedStyle(minimap).getPropertyValue(name)` for `--color-code`, the ten `--color-syntax-*` and `--color-diff-wave`. It reads them only when it is shown and when the center's `EditorView.darkTheme` facet changes, in the next frame, after App.vue has written `data-theme`. Never per frame.
- `rgbOf("#rrggbb[aa]")` returns `Rgb | null`. A missing value falls back to `--color-code`.

**The hold and its rename** (point 1, all options):
- `useAltHold()` stays as is. App passes `:minimap="altHeld"`.
- MergeView passes `minimap: () => props.shown && props.minimap && centerLine.value === null`. The last condition means no minimap when the Result pane itself is hidden behind the "not text" or "deleted" line: rule 3 says it draws what the Result shows.
- `useMergeController` option `minimap` → `MergeOptions.minimap` and `MergeController.showMinimap(shown)`. This replaces `marks`/`showMarks` one for one.
- A file built or shown while Alt is held draws on its first frame.

---

## Option A (recommended): `Frame` owns a canvas minimap in the right pane's `view.dom`, code cached in tiles

It rests on visions 2 (one geometry cache, one per-frame paint, one tint rule, one syntax table), 5 (canvas 2D only, no dependency), 1 (pure functions that each cite their VS Code source; the glyphs are data, not pixel code) and 4 (`slider: Slider | null`).

**Data:**
```ts
// minimap.ts
type MinimapParts = { views: PaneViews; folds: FoldFields; shown: boolean; follow: () => void /* ScrollSync.follow("center") */ };
class Minimap { show(shown); changed(update, rowsMoved): boolean; paint(frame: { rows: readonly ChunkRow[]; waves: readonly WaveRow[] }); destroy() }
// minimapTiles.ts
type Tile = { readonly canvas: HTMLCanvasElement; readonly to: number /* doc pos at its last row's end */ };
type Stale = "none" | "all" | { readonly from: number };
function staleTiles(facts: { docChanged; foldsChanged; themeChanged; treeBefore: number|null; treeAfter: number }): Stale
class MinimapTiles { draw(context, request); drop(stale: Stale); clear() }    // Map<tileIndex, Tile>, TILE_ROWS 128
// minimapPixels.ts (pure)
type Rgb = { r; g; b }; type PixelRows = { data: Uint8ClampedArray; width: number };
function paintRow(target: PixelRows, row: { y; text; colours: Uint8Array; tabSize }, look: { glyphs; palette: readonly Rgb[] }): void
function paintWave(target: PixelRows, y: number, colour: Rgb): void
```

### 1. Owner and element
- **Owner:** `Frame` owns `Minimap`, as it owned `MarkLanes`.
- **Element:** one `<div class="minimap" aria-hidden="true" hidden>` holding a `<canvas>` and a `<div class="minimap-slider">`, appended to `views.right.dom`. That is outside `scrollDOM` and `contentDOM`: CodeMirror, `SideFocus` (capture on `scrollDOM`) and `modClick` never see its presses, and `Folding` on the host ignores it because it has no `data-fold-run`.
- **CSS** (`.cm-editor > .minimap` in `theme.css`):
  - `position: absolute; top: 0; right: 0; bottom: 0`, width from `minimapColumns(dpr).width / dpr`, `max-width: 100%`, `overflow: hidden`, canvas anchored right;
  - `background: var(--color-panel)`, `border-left: 1px solid var(--color-control-border)` (the separator rule 2 asks for);
  - `visibility: visible`, so it shows when the right host is `invisible` for a deleted remote side;
  - `z-index: 400`, above the find panel (`.cm-panels` 300), the gutters (200, inside the scroller's own z 0 stacking context) and the scrollbar, below tooltips (500) (`@codemirror/view` `index.js:6864`, `:6979`, `:7022`, `:10640`).
- **Height:** `view.dom` fills the right host, which is the panes' row, so the column headers and toolbar are never covered and the layout never moves. The strips are other grid columns, so they are never covered either.
- **Survival:** a window resize, the file list hiding and the find space each raise `geometryChanged` on some pane, which marks the size dirty. The next frame re-reads the box `clientHeight`, the center's `clientHeight` and `devicePixelRatio`, and resizes the backing store. A device-pixel-ratio change is caught by comparing `devicePixelRatio` at each paint (no listener). The right pane's find bar sits under the minimap while it is shown.

### 2. Rows
As in the shared section, read through `Frame`'s `{rows, waves}`, `lineBlockAtHeight` and `lineBlockAt`. Pure tests: `minimapLayout.test.ts` and `minimapMarks.test.ts`.

### 3. Drawing
- **Canvas 2D, confirmed.** `@replit/codemirror-minimap` cannot sit over another pane, hard-codes its colours, ignores yamt's folds and calls `fillText` on every update (request facts). The canvas API covers everything here, so DR3 needs no row.
- **Code column:** 120 columns × `scale` device px. Rows are `2 × scale` device px.
- **A tile** is 128 rows rendered once into a detached canvas through `ImageData` (`paintRow`/`paintWave`, then `putImageData`). Each row's text is `sliceDoc(block.from, block.from + 120)`. Its colours come from `highlightTree(syntaxTree(state), syntaxColourClasses, …, from, to)`. A row inside a collapsed run is drawn as a 1-device-px line in `--color-diff-wave`. Lines the parser has not reached yet are drawn in `--color-code`, as the pane shows them. Tab width is `state.tabSize`.
- Tile pixels are the token's RGB with alpha = intensity (VS Code's blend, left to the compositor over the panel background). The canvas has `opacity: 0.9`. Light theme uses the 50/60 table, chosen from the `darkTheme` facet.
- **Per frame while shown:**
  1. read the center's `scrollTop` (`documentPadding`, `contentHeight` are CodeMirror getters, not DOM reads);
  2. compute `minimapLayout`;
  3. write the slider's `transform`/`height` if they changed;
  4. only if start row, end row or padding rows changed, or tiles went stale: `clearRect`, then `drawImage` the 4–5 tiles in the window. Tiles outside the window ±1 are dropped.

  Nothing else is measured on scroll.
- **Invalidation** (`staleTiles`, in `changed`, only while shown):
  - center doc change, fold-field change or theme change → all tiles;
  - syntax tree grown without a doc change → tiles whose `to` > the old tree length;
  - statuses → no tiles (only the B2 marks).
- **While hidden:** `changed` and `paint` return on their first line; the element is `display: none` (no layout, hit testing or paint); tiles are dropped. Showing renders the window's tiles in the next frame.
- **8 MiB files:** only the window's rows are read (each lookup is `O(log n)`), at most 120 characters per row.

### 4. Scroll and slider
- `minimapLayout` is VS Code's proportional `create`, branch for an editor without whitespace gaps, with `scrollBeyondLastLine` off.
- Covered and tested:
  - the file that fits (no slider);
  - taller than the Result but shorter than the minimap (rows still, slider moves);
  - taller than the minimap (the window moves);
  - the end of the document (last row last, slider bottom at the last row);
  - the find space as `paddingTop`;
  - the previous layout's anti-flicker.
- **#1219:** the minimap only ever writes the Result's `scrollTop` and calls `follow("center")`, the same path as a wheel over the Result. It is exposed exactly as much as today, no more: the minimap mirrors the Result, and a side can still land wrong at its own end.

### 5. Edges (B2)
**Data:**
```ts
type EdgeKind = Tone | "error" | "warning";
type EdgeMark = { top: number; bottom: number; kind: EdgeKind };  // document px
function changeMarks(rows: readonly ChunkRow[]): EdgeMark[]            // paneTone(chunk, status, "center"); null → none
function problemMarks(state: EditorState, blockAt: (pos) => Span): EdgeMark[] // error/warning only, warnings first
function markBoxes(marks, layout, columns): { x; y; width; height; kind }[]  // only marks in the window
```
- Width 4 CSS px inside each 6 CSS px edge; x is the edge plus 1 CSS px, rounded to device px.
- Minimum height 4 CSS px (2 rows); a one-line error is a 4×4 dot.
- A mark shorter than the minimum is centred on its span, so a removal's insertion point sits on its boundary. Marks are clamped inside the canvas.
- Warnings are painted before errors (rule 4); info and hint are dropped.
- **Colours:**
  - left edge: `--color-problem-error` and `--color-problem-warning` (the Result's underline tokens: one red and one yellow per meaning);
  - right edge: `--color-mark-inserted`, `--color-mark-modified`, `--color-mark-deleted` and `--color-mark-conflict`, kept from #80. They are the opaque stripe versions of each band hue; the band tokens themselves are 14 % alpha. Conflict is `#8150be`.
  - `--color-mark-error`, `--color-mark-warning` and `--color-mark-info` are removed in build A. There are no new tokens for the edges.
- The marks cache is dropped on `rowsMoved || linted(update.transactions)`. An applied change's mark goes on the next frame, also while Alt is held.

### 6. Pointer
On the box:
- `mousedown`: `preventDefault` + `stopPropagation`, as `strips.ts:230` `keepEditorFocus` does. Focus and selection stay; WebKit's focus change is mousedown's default.
- `pointerdown` with `button === 0 || pointerType !== "mouse"`: `scrollTop = centredScrollTop(rowAt(layout, offsetY), input)`, then `follow()`.

On the slider:
- `pointerdown`: `stopPropagation`, `setPointerCapture`, class `active`, keep the layout at the start.
- `pointermove`: `draggedScrollTop(start, clientY − startY)`, then `follow()`.
- `pointerup`, `pointercancel` or `lostpointercapture`: the drag ends.

Wheel, `{passive: true}`:
- `views.center.scrollDOM.scrollBy({left: dx·s, top: dy·s})`, then `follow()`. `s` is a private `wheelPixels` in `minimap.ts` (pixels; lines × 20; pages × `clientHeight`; it was `MarkLanes.wheelScale`).

`show(false)` mid-drag releases the capture and ends the drag (orchestrator default).

Reused: `ScrollSync.follow`, `Frame.layout()`, `paneTone`, `linted`, `LINE_HEIGHT_PX`. Clicks are immediate, matching VS Code's default (`smoothScrolling: false`). No focus, selection, fold or keyboard change happens.

### 7. Cutover
Build A, listed below.

### 8. Tests
Listed below.

### 9. Size
Listed below. Public surface: `MergeOptions.minimap: boolean` and `showMinimap(shown: boolean)`, replacing `marks`/`showMarks`. Net zero.

### 10. Plan row
The #81 draft is below.

---

## Option B: a Vue-rendered host in the grid, tiles as DOM canvases moved by `transform`, marks as `<div>`s

It rests on visions 1 (Vue readers see where it sits) and 5. It costs vision 2: placement in the template, contents in the editor.

**Data:**
- `MergeHosts.minimap: HTMLDivElement`, a `<div ref="minimap" class="col-start-5 row-start-2 justify-self-end z-10">` in `MergeView.vue`.
- Inside it, a `track` div, `rows × rowPx` tall, holding one `<canvas>` per 128-row tile at its absolute row offset. Only tiles near the window exist.
- Edges are `<div class="minimap-mark …">` inside the track, like #80's ticks.

**Points:**
1. **Element:** Vue places it, so the right host's `invisible` does not touch it. The controller fills it, as with the strip `<svg>`s. `shown` reaches it the same way. Stacking is decided in the grid (z-index over the right host's whole stacking context).
2. **Rows:** same.
3. **Drawing:** same tile rendering. Scrolling is a `translateY` on the track: no canvas draw per frame at all. Tiles are created and removed as the window moves. Marks need no palette (CSS tokens) and never move on scroll, because they live in track space.
4. **Scroll:** the same pure layout; `startRow` becomes the track's translate.
5. **Edges:** DOM nodes recomputed when dirty.
6. **Pointer:** same, on the host.
7. **Cutover:** same as A. Plus `MergeHosts`, `useMergeController` host plumbing and the paneHarness grid.
8. **Tests:** same pure tests. Browser tests read mark nodes instead of pixels.
9. **Size:** about +150 lines over A: tile node management plus 3 more ui files.
10. **Row:** "host in MergeView, contents by the editor".

**Cost:**
- More composited layers in WebKitGTK (a translated track plus N canvases). #51 measured layering both ways, so this is an unmeasured risk.
- Two owners of one element.
- The tile DOM bookkeeping is code A does not need.

## Option C: a CodeMirror `ViewPlugin` on the Result pane

It rests on vision 5 (idiomatic CodeMirror; `Frame` is untouched). It costs visions 2 and 1.

**Data:**
- `minimapShown: StateField<boolean>` on the center, with a `showMinimap` effect.
- `minimapPlugin(host: HTMLElement)` reads `chunkField`, `foldField`, the diagnostics and the tree from its own state, schedules through `view.requestMeasure`, and listens to the center's `scroll` itself.

**Points:**
1. **Element:** the same element, handed to the plugin by closure. `showMinimap` dispatches into the center on every Alt press, which runs every center update listener (saved point, server document, status mirror).
2. **Rows:** derived again from `chunkField` and `lineBlockAt`. That is a second copy of `Frame`'s `rows[].center`, which #80 rejected (#63's "copies of one fact").
3. **Drawing:** same tiles, but painted in CodeMirror's measure cycle plus the plugin's own scroll listener. That is a second per-frame loop beside `Frame`'s, against CM13 (one repaint per frame).
4. **Scroll:** same layout. A press only writes `scrollTop`; if the center is in `ScrollSync`'s echo frame, the sides miss it until the next scroll.
5. **Edges:** the plugin owns them.
6. **Pointer:** same.
7. **Cutover:** same.
8. **Tests:** same, plus effect and field tests.
9. **Size:** about the same, with `Frame` −0 and the plugin glue +~80 lines.
10. **Row:** "a center ViewPlugin".

**Cost:** two paint loops and two geometry derivations; the hold becomes editor state.

## Recommendation: option A

What it costs:
- `Frame` gains a part again.
- `minimap.ts` (~230 lines) and `minimapTiles.ts` are the subtle code: tile staleness on tree growth.
- The MIT glyph data needs `THIRD_PARTY_NOTICES.md`, `scripts/third-party-licenses.sh` (one `standard_text MIT "Microsoft Corporation"` entry) and a regenerated `THIRD_PARTY_LICENSES.txt`.
- The minimap covers the right pane's find bar and scrollbar while Alt is held.
- B is split into B1/B2 with one shared seam in `minimap.ts`.

---

## Build A: cutover (24 files, about −950/+40 lines)

**Delete:**
- `editor/internal/markLanes.ts`, `marks.ts`, `marks.test.ts`, `markJump.ts`.

**Change:**
- `internal/frame.ts`: drop the `jump`/`marks` parts, `MarkLanes`, `showMarks` and the `marksDirty` term.
- `editor/index.ts`:
  - drop the `jumpTo` import, the `jump` closure, `marks`, `MergeOptions.marks` and `showMarks` (−16 lines);
  - merge the center's `#statusSync`, `#serverSync` and `#savedSync` into one `#centerSync` listener in the same order (−8);
  - move `#statusesChanged`' mirror push into `internal/sideStatus.ts` as `pushStatuses(update, field, views): readonly ChunkSpan[] | null`, next to `showStatuses` (−7). This is a move, covered by the existing status-mirror tests.
  - Result: about 269 of 300 lines; B1 adds 6.
- `internal/viewport.ts` (−`thirdScrollTop`) and `viewport.test.ts` (−`:40-52`).
- `internal/sideFocus.ts` (−`focusChange`).
- `internal/geometry.ts` (−`PANE_TINT`: its only importers are `marks.ts` and `markJump.ts`).
- `internal/folds.test.ts`: the `revealSteps` import (`:31`), `jumpAt` (`:329-334`) and the three tests that use it (`:336-368`).
- `editor/theme.css` (−`.change-marks`, `.change-mark*`, `:321-368`).
- `src/style.css` (−`--color-mark-error/warning/info`, both themes; the four change tones stay for B2).
- `editor/problems.browser.test.ts`, `removals.browser.test.ts` (−`marks: false`).
- `ui/useMergeController.ts` and its test (−`marks` option, watch, the two tests `:299-326`).
- `ui/MergeView.vue` (−`marks` prop and option).
- `ui/App.vue` (−`:marks`, −`useAltHold()` call and import).
- Docs:
  - `docs/architecture.md`: §5.1 rows `:559-560`, §5.2 `:573`, `:576`, internals `:622-643`, `:737`, `:848`, `:886`;
  - `editor/AGENTS.md:9`;
  - `.omp/skills/project-map/SKILL.md` (editor/ marks entries, two state-ownership rows, `ui/altHold.ts` text);
  - `CHANGELOG.md` (the unreleased "Holding Alt …" entry).

`ui/altHold.ts` and its test stay untouched. Their importer comes back in B1 (`knip` counts tests as entries).

## Build B1: code, slider, press, drag and wheel (on A's commit; about 28 files, about 1,500 lines)

**New:**
- `editor/internal/minimapLayout.ts` (~120) + `.test.ts` (~230)
- `minimapPixels.ts` (~100) + `.test.ts` (~150)
- `minimapGlyphs.ts` (~45, MIT header)
- `minimapTiles.ts` (~120) + `.test.ts` (~80, `staleTiles`)
- `minimap.ts` (~230)
- `editor/minimap.browser.test.ts` (~260)

**Changed:**
- `editor/index.ts` (+6), `internal/frame.ts` (+15, `minimap.paint(layout)` after `scroll.sync`)
- `internal/pane.ts` (+10, the `SYNTAX_COLOURS` table and `syntaxColourClasses`) + `pane.test.ts` (+20)
- `editor/theme.css` (+40), `src/style.css` (+6: `--color-minimap-slider`, `-hover` and `-active` per theme, VS Code's values above)
- `problems.browser.test.ts`, `removals.browser.test.ts` (+`minimap: false`)
- `ui/useMergeController.ts` + test, `ui/MergeView.vue`, `ui/App.vue`
- Docs: `docs/architecture.md`, `editor/AGENTS.md`, project map, `CHANGELOG.md`
- Licence: `THIRD_PARTY_NOTICES.md`, `scripts/third-party-licenses.sh`, `THIRD_PARTY_LICENSES.txt`

If 28 files is too many, the 4 doc files can move to B2, which leaves B1 at 24.

**Contract B1 fixes for B2:**
- `minimapColumns(pixelRatio).left/right` are empty columns of the layout in B1.
- `rowTop(layout, row)` is exported.
- `Minimap.paint` receives `{rows, waves}`.
- `#draw` paints clear → tiles, and B2 inserts `#paintEdges(context, layout)` after the tiles.
- `changed` sets `#layoutDirty` on `rowsMoved`; B2 adds a `#marks` cache dropped on `rowsMoved || linted(…)`.
- `#readColours(style)` is where B2 reads its six tokens.

## Build B2: the two edges (8 files, about 440 lines)

- **New:** `editor/internal/minimapMarks.ts` (~70) + `.test.ts` (~170), `editor/minimapEdges.browser.test.ts` (~150).
- **Changed:** `minimap.ts` (the seams, ~+30), `docs/architecture.md`, `editor/AGENTS.md`, project map, `CHANGELOG.md`.

---

## Tests

`editor/` is not mutated (VF7). Each node test below is listed with the bug it catches and a one-line hand mutation that should make it fail.

**`minimapLayout.test.ts` (B1)**

| test | bug it catches | hand mutation |
|---|---|---|
| "scale doubles at ratio ≥ 2: a row is 2 CSS px at 1 and 2, 1.6 at 1.25" | 1 CSS px rows on HiDPI | `pixelRatio >= 2 ? 2 : 1` → `1` |
| "120 columns of one scale each, two 6 px edges in device px; 96 + edges CSS at 1.25" | blurry or too-wide columns | `MAX_COLUMNS * scale` → `MAX_COLUMNS` |
| "a file that fits: rows from the first, no slider" | NaN slider, or a box over everything | `maxSliderTop > 0` → `>= 0` |
| "taller than the Result, shorter than the minimap: rows stay, the slider moves by scrollTop × ratio" | the window scrolls when it shouldn't | the all-fit `>=` → `>` |
| "7,277 rows, 900 px, scrollTop 72,770: slider 90 high at 408.6, rows 3,435–3,884" (hand numbers) | the minimap's window doesn't follow the scroll | `consideringStart - sliderTop / rowCss` → `consideringStart` |
| "the end: scrollTop 144,648 → rows 6,828–7,277, slider at 810.4" | the last row never reached | drop the `Math.min(height − sliderHeight, …)` cap |
| "scrolling up never moves the window down, down never up" | flicker | `Math.min(start, previous.startRow)` → `start` |
| "find space 33 px in a small file: one padding row, row 1 drawn at 2 px" | rows ignore the find space | `floor(paddingTop / LINE_HEIGHT_PX)` → `0` |
| "a press: index + start − padding rows, within [1, rows]" | off-by-padding press | drop `- layout.topPaddingRows` |
| "Center: row 100 → 1,564; row 5 → 0" | the row's top is centred instead of its middle | drop `+ LINE_HEIGHT_PX / 2` |
| "drag: start + delta / ratio, from the start layout" | drag speed wrong | `/ ratio` → `* ratio` |

**`minimapPixels.test.ts` (B1)**

| test | bug it catches | hand mutation |
|---|---|---|
| `rgbOf` reads `#rrggbb` and `#rrggbbaa`, else null | channel swap | green slice `3,5` → `1,3` |
| "`T` at scale 1 paints VS Code's two intensities ×12/15 in the token's RGB; scale 2 paints 2×4" | glyph stride | `charWidth * charHeight` → `charWidth` |
| "light uses 50/60" | one table on both themes | `light ? lighter : normal` → `normal` |
| "a tab advances to the next stop; a space paints nothing" | tab width | `tabSize - (column % tabSize)` → `tabSize` |
| "column 121 and on is cut" | bleed into the next row | `>= MAX_COLUMNS` → `> MAX_COLUMNS` |
| "outside ASCII uses `getCharIndex`" | crash or wrong glyph | the modulo wrap removed |
| "a wave row is one device px in the wave colour across the code" | collapsed run not shown | `y + rowPx / 2` → `y` |

**`minimapTiles.test.ts` (B1)**
- "doc or folds or theme → all; tree grown → from the old length; statuses → none".
- Bug: stale colours after the parse grows, or a redraw on every apply.
- Mutation: `{ from: treeBefore }` → `"none"`.

**`pane.test.ts` (B1)**
- "minimap classes and the pane's highlight give each tag the same token".
- Bug: two tables drift.
- Mutation: one `colour` in `paletteHighlight`'s spec hard-coded.

**`minimapMarks.test.ts` (B2)**

| test | bug it catches | hand mutation |
|---|---|---|
| "right edge: each change the Result tints, in its tone; resolved none" | a decided change keeps its mark | `"center"` → `"local"` |
| "left edge: error and warning; info and hint none" | info shown | `info: "warning"` in the severity table |
| "errors after warnings" | yellow over red | sort reversed |
| "a problem in collapsed lines on its wave row" (fake `blockAt`) | mark off the wave | `blockAt(to).bottom` → `blockAt(from).bottom` |
| "minimum 4 CSS px, an insertion point centred, clamped" | invisible one-line marks | drop the `Math.max(…, MIN)` |
| "only marks in the window; through start row and padding" | marks drawn at file position | drop `- layout.startRow` |

**`ui/useMergeController.test.ts`** (Stryker-mutated, so no hand mutation): the two #80 tests come back renamed for `minimap`/`showMinimap`.

**WebKit, `pnpm test:browser`**

`minimap.browser.test.ts` (paneHarness), B1:
1. Never shown: no box laid out, `canvas.width === 0`, `elementFromPoint` at the right edge is `.cm-scroller`.
2. Shown: the box's right, top and height equal the right host's.
3. A keyword row's pixel equals `--color-syntax-keyword`; a wave row's pixel equals `--color-diff-wave`.
4. Collapsing off adds rows.
5. Scrolling the Result moves the slider to `minimapLayout`'s value.
6. A press centres the row, and the sides' `scrollTop` change. `activeElement`, the center selection, the folds and the right pane's selection are unchanged.
7. A slider drag of 50 px gives `draggedScrollTop`.
8. A wheel over it scrolls the Result.
9. `showMinimap(false)` mid-drag ends the drag.
10. `setPreferences(light)` changes the keyword pixel to the light token.

`minimapEdges.browser.test.ts`, B2: diagnostics injected (as `problems.browser.test.ts` does) give a red and a yellow pixel on the left edge and none for info. A conflict pixel on the right edge equals `--color-mark-conflict`. Applying it clears that pixel on the next frame.

If WebKit still cannot launch on this host (#80's recipe 3), use the fixture-page steps below.

**Fixture page** (dev server on its own port, MiniBrowser via `just webdriver 4447`), per acceptance line, dark and then Light:
- Dispatch Alt `keydown` → `.minimap:not([hidden])` with its rect at the right pane's right edge; `keyup` → hidden; Alt + `a` → hidden; `blur` → hidden; a repeat keydown → still hidden; a fresh keydown → shown.
- Pixel probes as in the browser test.
- No `.change-marks` in the DOM.
- `shot` for the owner.

**Real app** (`just app-session start-app --name m-final …`, `D=$(jq -r .display …)`):
- Repositories: `scripts/lsp-repo.sh --servers /tmp/yamt-m-ws/lsp` (errors and warnings, conflicts) and the vue trial repository (renderer.ts; long, with far-apart changes).
- Steps:
  1. No minimap without Alt.
  2. `xdotool keydown alt` → shown, rect at the window's right edge; `keyup alt` → hidden; `keydown alt` + `key Down` → hidden; `focus-away`/`focus-back` → hidden until a fresh `keydown alt`.
  3. Pixel probes for syntax, wave rows and both edges, red over yellow, no info.
  4. Alt held + `xdotool click` on a strip apply icon → its right-edge mark is gone.
  5. Toggle collapsing with Alt held → redrawn.
  6. `mousemove` to a row + `click 1` → that line is centred; the sides follow; cursor, selection, folds and focused pane unchanged; nothing selected or applied in the right pane.
  7. `mousedown 1` on the slider, `mousemove` 100 px, `mouseup` → scrolled; `keyup alt` mid-drag ends it.
  8. Wheel over the minimap scrolls.
  9. The owner's desktop: one Alt+drag (window-manager risk).
  10. Light theme via `--settings`, run through `pnpm -C frontend exec tsx scripts/app-session.ts` (#80's quoting note).

**Scroll timing** (`.omp/run/scroll-timing.py`, Xvfb, isolated HOME as in `AltMarksVerify.md`):
- Columns: base `09487ec` / HEAD / HEAD with `xdotool keydown alt` held.
- Rows: renderer.ts and pnpm-lock.yaml × 1 opened / all opened × middle / left.
- Pass if Alt held is ≤ base + 3 late frames of 200 and the mean is ≤ 17 ms.

## Sizes

| build | files | lines |
|---|---|---|
| A | 4 deleted + 20 changed | about −950 / +40 |
| B1 | 9 new + 19 changed | about 1,500 |
| B2 | 3 new + 5 changed | about 440 |

`MergeController` gains no surface net: `minimap` and `showMinimap` replace `marks` and `showMarks`.

## Draft plan §2 #81

| 81 | **The Result's minimap while Alt is held** (owner 2026-10-18, #1223: "a vscode minimap of the code and its conflicts/errors … errors on the left of minimap and conflicts on the right"; answers #1224; design `briefs/3.M-minimap-design.md` option A; copied from VS Code `minimap.ts` `MinimapLayout.create`, `getDesiredScrollTopFromDelta`, `revealLineNumber`, `_renderLine`, `minimapPreBaked.ts`, `editorOptions.ts` `_computeMinimapLayout`, microsoft/vscode main). **Hold:** #80's, unchanged (`ui/altHold.ts`); App → MergeView `minimap` → `shown && minimap` and the Result pane shown → `MergeOptions.minimap`/`showMinimap`. **Place:** one `div` in the right pane's `view.dom` (outside `scrollDOM`/`contentDOM`), right edge, the panes' row high, over text, scrollbar and find bar (z 400, under tooltips), opaque `--color-panel`, 1 px `--color-control-border` on its left; the layout never moves. **Code:** VS Code's `scale: 1`, `renderCharacters`, 120 columns: 2 CSS px rows at device pixel ratio 1–2 (VS Code's scale doubles at ≥ 2), VS Code's prebaked glyph intensities (MIT) in the Result's syntax tokens through the one `SYNTAX_COLOURS` table of `pane.ts`, canvas opacity 0.9; a collapsed run is one row drawn as a line in the wave colour; lines not yet parsed in `--color-code`; colours read from the theme only when shown or on a theme change. **Scroll:** VS Code's proportional layout as a pure function (find space as its top padding); the slider shows while held whenever the Result scrolls (VS Code's `mouseover` dropped), none when it all fits. **Edges:** left, the Result's errors over warnings (`--color-problem-*`), info and hints none; right, every change `paneTone(…, "center")` still tints (`--color-mark-*`); 4 CSS px wide, never under 4 CSS px tall. **Pointer:** a press centres its row (VS Code Center, immediate as VS Code's default `smoothScrolling: false`), the slider drags, a wheel scrolls the Result; the sides follow `ScrollSync.follow`; focus, cursor, selection and folds stay; Alt released mid-drag ends it. **Cost:** owned by `Frame`; code rows cached in 128-row tiles, redrawn only on doc, fold, theme, tree growth or pixel-ratio change; per scroll frame one `scrollTop` read, the slider and at most five tile copies; hidden, nothing runs. Replaces #80's scrollbar marks and their jump. | #80's scrollbar marks kept beside it (owner: remove); `@replit/codemirror-minimap` (a gutter inside one view's scroller, hard-coded colours, sees only `foldedRanges`, `fillText` every update); a center-pane ViewPlugin (a second paint loop and a second copy of the change rows, "shown" as editor state); a Vue-placed host with DOM tiles moved by `transform` and `div` marks (more WebKitGTK layers, #51; two owners of one element); one tall canvas of the whole file (canvas size and memory at 8 MiB); `fillText` per character; glyphs sampled from JetBrains Mono at runtime (font-load timing, pixel code); uniform blocks (VS Code's `renderCharacters: false`; the owner asked for the code); smooth click scrolling (not VS Code's default); `showSlider: 'mouseover'`; WebStorm stripe reds for problems (the underline tokens already mean "a Result error"); VS Code's Windows drag reset and full-width columns | 2, 5, 1, 4 |

## Deviations from the brief and request
1. The tree was read at `09487ec`, not `7141a81`.
2. `geometry.ts` `PANE_TINT` is removed in A. The request table says keep it, but its only users are the deleted `marks.ts` and `markJump.ts`.
3. `folds.test.ts` loses three tests (`:336-368`) beyond the cited lines, because they use the removed `jumpAt`.
4. A cuts the Alt chain at `App.vue` and B1 reconnects it under the new names. Leaving it in A would have meant a `showMarks` that does nothing.
5. B2 edits B1's `minimap.ts` at the fixed seams. Fully separate files would need a hook with one user (vision 5).
6. B1 is about 28 files. Moving its 4 doc files to B2 brings it to 24.
7. No minimap when the Result pane is replaced by its "not text" or "deleted" line. This is my reading of rule 3: it draws what the Result shows.
8. Not copied from VS Code: the Windows drag reset (`minimap.ts:1338-1340`), full-width characters counting as two columns, touch gesture handlers, and the `mouseover` slider (orchestrator default).
9. Left-edge colours reuse `--color-problem-error` and `--color-problem-warning`. `--color-mark-error`, `--color-mark-warning` and `--color-mark-info` are removed.

## Open risks
- The canvas cost on scroll in WebKitGTK is unmeasured. If the Alt-held timing is worse, the first fix to try is `will-change: transform` on `.minimap` (#51 precedent).
- Alt+drag is taken by window managers that move windows with Alt+drag.
- #1219 is unchanged.
- `THIRD_PARTY_LICENSES.txt` may not regenerate exactly on this host: the Ubuntu library section is added by the Linux release job.
- Last time, WebKit could not launch here for `pnpm test:browser`; the MiniBrowser steps are the fallback.
- At fractional device pixel ratios (Windows) the box's CSS width is fractional.
- When a language loads, the tree is replaced: `staleTiles` must treat that as "all", not as growth.

## Questions for the owner
1. When the whole Result fits on screen, VS Code shows no slider, because there is nothing to drag. I followed VS Code, so a short file shows only its rows. Would you rather see a box over everything?
2. Problem and change marks are never shorter than 4 px, so a one-line error is a 4×4 dot. Check it at the smoke screenshot.