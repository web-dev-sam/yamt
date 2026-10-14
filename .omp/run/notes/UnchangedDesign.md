# UnchangedDesign — design output (3.U, board "Unchanged lines" row 1)

Chosen: option 1 (orchestrator, plan §2 #63). Open questions answered in plan #63: Ctrl/Cmd+A, Ctrl/Cmd+Home/End and arrows never show lines (WebStorm); no re-align after a click. The `*.browser.test.ts` steps move to WebKit smoke through `just webdriver` (Playwright WebKit cannot launch here, #423).

---

# 3.U design: unchanged lines collapse behind a wavy line

I made no file edits. Every claim about the tree cites `path:line` from HEAD as I read it. Anything I did not check in the code or in the CodeMirror sources is marked [INFERENCE].

## 0. Facts the design rests on

- **Where block decorations must come from.** CodeMirror lets only decorations provided directly from the state change vertical layout. `EditorView.decorations.compute([field], …)` is the pattern the tree already uses (`decorations.ts:50,88,103`). `Decoration.replace({block:true})` is named for collapsing in `docs/architecture.md` §6, and `lineBlockAt` already accounts for it.
- **The line-number gutter can show a marker beside a block widget.** `lineNumberWidgetMarker` (view `index.d.ts:2389`) feeds the line-number gutter's `widgetMarker` (view `index.js:11840`). The gutter then adds an element next to the widget block (`index.js:11658-11666`). `GutterMarker.elementClass` exists (`index.d.ts:2281`).
- **Gutter layout.** The gutters container is `position: sticky` (`index.js:11473-11480`) with z-index 200, and it sits before the content (`index.js:6974-6980`). Each `.cm-gutter` has `overflow: hidden` (`index.js:6994-7001`).
- **CodeMirror only listens on the content element.** Its own mouse handlers and every `EditorView.domEventHandlers` handler (so `modClick.ts:50-72` too) are registered on `contentDOM` (`index.js:4605-4616`). Events inside a widget whose `ignoreEvent()` returns true are skipped (`index.js:4896-4904`).
- **Atomic ranges.** `view.moveVertically` and `moveByChar` skip them (`index.js:8480-8522`). So does pointer selection (`index.js:4339,4855`). `selectAll` dispatches `userEvent: "select"` (commands `index.js:1084-1085`). The find step is `"select.search"` (`findMatch.ts:61-67`).
- **Dispatching from an update listener is allowed.** Listeners run after `updateState` returns to Idle (`index.js:8059-8071`). The tree already does it: `#statusesChanged` dispatches to both sides from the middle's listener (`index.ts:193-204`).
- **Why folding stays out of undo.** The middle's history snapshots only `placeSpans` (`chunkField.ts:120-125`), so any other field is outside undo by construction.
- **The cache and the frame.** The `Layout` cache is dropped by `rowsChanged` (`geometry.ts:50-58`, `index.ts:101-104`). The frame paints from the cache (`index.ts:218-229`). Strips already read layout once per frame: `getBoundingClientRect` and `documentTop` (`strips.ts:185-200`).
- **Scroll anchors** are chunk tops and bottoms plus the content ends (`scrollSync.ts:20-23`). The sync runs only for a pane that scrolled (`scrollSync.ts:87-93`).
- **Side panes.** The side press handler is a capture `mousedown` on `scrollDOM` (`sideFocus.ts:54,189-201`); it already skips presses that `modClickAction` acts on. Side arrow keys are bound to change navigation (`ipc/keys.ts:203-206`), so a side cursor never moves by arrow.
- **Bulk apply cursor.** It moves the cursor to `visible.first` when the cursor is off screen (`apply.ts:140-143`). `visible.first` comes from `lineBlockAtHeight` (`viewport.ts:9-21`).
- **Line brands can't be minted in `editor/`.** They are private to `ipc/domain.ts:3-8`. `DocPos` is private to `chunkField.ts:15,33-38`.
- **Lines are 20 px** as a literal string (`pane.ts:80`). `lineNumbers()` is in every pane (`pane.ts:246`). `createPane` takes `doc: string` (`pane.ts:234-265`).
- **Strips.** Each strip `mousedown` already calls `preventDefault` (`strips.ts:182`). Paths are kept per id and get a new `d` each frame (`strips.ts:217-232`). In read-only mode there are no icons (`index.ts:83`).
- **Content Security Policy** allows `img-src data:` (`src-tauri/tauri.conf.json:14`).
- **Budget limits.** oxlint caps files at 300 lines (`frontend/.oxlintrc.json:53`); `index.ts` is at 294.
- **What `app-session click` can reach.** It clicks elements by accessible name only (`frontend/scripts/app-session/find.ts:83`, `drive.ts:47-74`). There is no hover command and no click at a coordinate.

---

## 1. Common to every option (Q1, Q3, Q4, Q5, Q7, Q8)

### Q1. Runs and steps as one pure function

`editor/internal/foldRuns.ts`, data first:

```ts
export type Hidden = { readonly from: DocPos; readonly to: DocPos };
// whole lines: from = start of the first hidden line, to = end of the last one; at least 2 lines
export type FoldLevel = Readonly<Record<Pane, Hidden | null>>;
// one block: shown or hidden together in all three panes; at least one pane is non-null
export type Fold = { readonly hidden: readonly FoldLevel[] };
// one run: the levels still hidden, outermost first (0–3); showing a level drops it from the front
export function foldRuns(chunks: readonly Chunk[], docs: Readonly<Record<Pane, Text>>): Fold[];
// returns chunks.length + 1 runs; run k sits before chunk k
```

- **Algorithm.** It is WebStorm's, line for line. The run edges in pane p are `chunk.local | middle | remote` (`domain.ts:17-24`). Run k spans `[k = 0 ? -∞ : prev.start + prev.len, k = n ? +∞ : chunk.start)`. Shifts are `CONTEXT_LINES · 2^level`, with `CONTEXT_LINES = 4` as one constant. Each end is clamped to `[0, doc.lines]`, and a range exists only when `end - start ≥ 2`. A level is kept when some pane has a range and the level differs from the last kept level in at least one pane (yamt's "dropped equal level").
- **File edges.** The ±∞ ends keep nothing at the top and bottom.
- **No chunks.** There is one run, `(-∞, +∞)`. Level 0 is the whole pane; levels 1 and 2 equal it and are dropped. Every pane with at least 2 lines becomes one wave.
- **A run of 0–1 lines** has no level.
- **A pane with an empty document** (a deleted side, a `DiskNotText` middle). CodeMirror's empty `Text` has 1 line, so no range can reach 2 lines and the pane is null everywhere. That also means no strip join beside it, with no special case.
- **Runs that differ in length per pane** (a middle read from disk) are computed per pane. A level exists if any pane has a range.
- **Brands (vision 4).** Branded chunk ranges are read, never minted. Line numbers stay as local numbers inside the function and leave as `DocPos`, keyed by `Pane`, so mixing panes takes a different key. `DocPos` and `toDocPos` move from private `chunkField.ts:15,33-38` to `internal/docPos.ts`; folding is the second user.
- **The middle pane's ranges map through edits** with one pure function, `mapHidden(h, changes, doc): Hidden | null`:
  - `from` maps with `+1` and `to` with `-1`.
  - Both snap inward to whole lines. Text typed at a hidden edge joins a line that becomes visible.
  - Fewer than 2 lines gives `null`, which is rule 8's "shown".
  - Mapping keeps levels nested: a level that is null implies every deeper level is null.

With nested levels, rule 3's second sentence ("a pane whose outermost hidden level has no range shows the next one") can never apply. The code still implements it generally: `displayed(levels, pane)` is the first non-null `level[pane]`.

### Q3. Rendering in a pane

- **The construct.** Per run, the pane's displayed range becomes `Decoration.replace({ block: true, widget: new FoldWidget(run) })` over `[from, to]`, computed from state.
  - `estimatedHeight` returns `LINE_HEIGHT_PX`. That becomes one exported constant in `pane.ts`, which also feeds `pane.ts:80`. Off-screen hidden runs must have an exact height or far anchors drift.
  - `eq` compares the run index.
  - `ignoreEvent` keeps the default `true`.
  - The DOM is an empty `div.fold-line` with `height: 1lh`. `theme.css` already uses `1lh`.
- **Across the gutter.** The wave is drawn once per pane per run, through `lineNumberWidgetMarker`:
  - It returns `WaveMarker(run)`, whose `elementClass` makes the gutter cell `position: relative`.
  - Its `toDOM` builds `div.fold-wave[data-fold-run=k][role=button][aria-label]`, absolutely positioned at `left: 0`, `height: 1lh`, `width: 100cqi`.
  - `pane.ts` gains `.cm-scroller { container-type: inline-size }` and `.cm-lineNumbers { overflow: visible }`.
  - Because the gutters are sticky and above the content, this one element covers the gutter and the visible text area, never moves with horizontal scroll, and has no phase seam. It is also the single hit target for the whole line.
  - No line number shows: CodeMirror numbers text lines only, and the marker replaces the widget's empty cell.
  - [INFERENCE] how WebKitGTK handles `100cqi` inside a sticky gutter. This is the first thing the browser test checks.
- **The wave itself.** A CSS mask, not a long path:
  - `mask-image: url("data:image/svg+xml,…")` holds one 20×8 tile built in TypeScript from `connectors.waveTile(stroke)`. That is rule 6's four quadratic segments, `M0 1 Q2.5 1 5 4 Q7.5 7 10 7 Q12.5 7 15 4 Q17.5 1 20 1`.
  - `mask-repeat: repeat-x`, `mask-position: 0 waveTop(20) = 6px`.
  - `background-color: var(--color-diff-wave)`.
  - The tile is emitted through `EditorView.theme`, so step and height have one source (vision 2). The tile has no colour; the stroke is a named colour, which `palette.ts` does not flag.
  - [INFERENCE] masks load under `img-src data:`, and unprefixed `mask-*` works in WebKitGTK. Emit the `-webkit-` form too.
- **Theme token.** `--color-diff-wave`: #555555 in `@theme static` and #d0d0d0 in `:root[data-theme="light"]` (`style.css:3,59`; VU17 checks both).
- **Hover without rebuilding decorations.** `WaveMarker.eq` ignores hover. On a hover change, the hover owner toggles `fold-wave-hover` on `[data-fold-run="k"]` in the five hosts (an attribute selector, run only on hover change). Anything newly created (marker `toDOM`, a strip node) reads the current hovered run. The hover class swaps in the 2 px tile. `cursor: pointer` comes from CSS.

### Q4. Rendering in the strips

- **Joins are computed with the cache.** `Layout` becomes `{ rows, anchors, waves }`. `waves = waveRows(...)` lives in `geometry.ts` next to `chunkRows` and holds, per run, each pane's document-space top of its displayed wave block (`lineBlockAt(displayed.from).top`), or `null`.
- **Which joins exist.** Rule 7's "first level hidden in both adjacent panes" is the level each of the two panes displays; nesting guarantees it. So a join exists exactly when both panes display a wave for that run.
- **Per frame**, `gap.ts` gains `wavePaints({ waves, side }, shifts, size)`, modelled on `bandPaints` (`gap.ts:63-87`): shift by `documentTop - stripTop`, add `waveCenterY(lineHeight)` = (20 − 6 − 2)/2 + 3 + 1 = 10, filter with `crossesStrip`.
- **Kept nodes.** `GapStrip` gains a wave layer between the band layer and the icon layer. Per run it keeps a `<g data-fold-run>` holding a hit path (transparent stroke, 20 px wide, `pointer-events: stroke`) and the visible path (stroke `var(--color-diff-wave)`, 1 px, 2 px under `.fold-wave-hover`). Nodes are kept in a `Map` exactly as `#bands` is (`strips.ts:217-232`); only `d` and the hover class change per frame. Waves paint whether or not `onPress` is null, so read-only views get them (`strips.ts:192-194` returns early only for arrows).
- **The `drawConnectorLine` port** goes into `connectors/index.ts` as pure geometry: `waveJoinPath(join: { left: number; right: number }, width): string` with step 5 and half-height 3, following the brief's three branches (six half-waves; one quadratic segment below 5·step = 25 px; two cubic segments one way or the other). `waveTile(stroke)` and `waveCenterY(lineHeight)` share the same constants. All of it is tested on numbers like `bandPath`.

### Q5. Pointer: one hover model across five surfaces

- **Listeners.** Delegated listeners on the five hosts (`hosts.left/center/right` plus both strips), all on one `AbortController`, all keyed by `closest("[data-fold-run]")`:
  - `pointerover` sets the hovered run, or null for a non-wave target.
  - `pointerleave` sets null.
  - `mousedown` with button 0 on a wave calls `preventDefault()`, so focus and the browser's native selection stay. The strips already do this (`strips.ts:182`).
  - `click` with button 0 on a wave shows that run's outermost hidden level, then clears the hover (the clicked element may vanish).
- **Beating `sideFocus`.** Its capture `mousedown` fires first. It gets one guard, `if (foldRunAt(event.target) !== null) return;`, next to the existing scrollbar test (`sideFocus.ts:191`): no side mark, no focus.
- **`modClick` and CodeMirror's own press.** The overlay is in the gutter, outside `contentDOM`, so neither sees it (`index.js:4605-4616`). If a press ever lands on the empty widget, `ignoreEvent` stops it.
- **Text drag-select in the middle** across a wave: CodeMirror's mouse selection skips atomic ranges (`index.js:4855`). A release over the wave fires `click` on the common ancestor, not the wave, so nothing is shown.
- **In a strip**, the icon drag takes pointer capture only after an icon press (`drag.ts:73-80`). While captured, `click` targets the `<svg>`, which is not a wave.
- **The keyboard stays put.** There is no `focus()`, no dispatched selection and no `setMark` anywhere on this path (rule 4).

### Q7. Alignment and scroll (RK4, CM12)

- **Equal heights.** In a pane that has a range at the displayed level L, an inner run shows `(2·shift_L + 1)·20` px: kept lines on both inner ends plus one wave row, whatever the pane's run length. An edge run shows `(shift_L + 1)·20`. So every pane with a range shows an identical segment height between the same two chunk anchors.
- **Anchors stay as they are.** Linear interpolation between equal-length segments is a pure offset (`scrollSync.ts:25-42`). The two wave lines of a join sit exactly level whenever the sync placed the panes; S-curves appear only at clamped scroll ends, which is what `drawConnectorLine` is for.
- **A pane with no range at L** (a short run) never takes part in a join. Its segment stretches linearly, which is today's behaviour for unequal runs.
- **Cache drop.** A fold change alters heights, so `geometryChanged` drops the cache [INFERENCE that it arrives in the same update]. To make it certain, `rowsChanged` also compares the fold fields' identity.
- **No new layout read per scroll frame.** Wave tops come from the height map inside `#layout()`. Per frame only shifts are added, and hover changes touch classes only (plan §2 #51).

### Q8. Interactions

| Interaction | Effect of folding |
|---|---|
| Navigation, reveal (`viewport.ts:31-49`) and the on-screen rule | Changes are never hidden (runs exclude them). Rows are px from `lineBlockAt`, so reveal and `stepAlone` stay correct. |
| Bulk apply's visible lines | **Needs a fix.** If a wave is the top block, `visibleLines` (`viewport.ts:9-21`) returns a hidden line, and `bulkCursorTarget` (`apply.ts:140-143`) would put the cursor there. Fix: skip widget blocks (`BlockType`), taking the first text line after or the last before. A pure `textLineEdges` helper is tested. |
| Find space above line 1 (#44) | Padding only; untouched. |
| Removal bars and word marks | Only on change lines; never inside a hidden range. |
| Drag over icons (#45) | Icon rows sit at chunk tops, at least 4 lines from any wave. `coveredChunks` uses px tops. |
| `destroy()` (CM14) | Views take widgets and markers with them. `GapStrip.destroy` already clears the strip (`strips.ts:256`). The pointer `AbortController` is aborted. |
| Read-only view (#47) | Folds and clicks work; folding is not editing. |
| Deleted side | Null everywhere, as in Q1. |

---

## 2. The options (they differ in who owns "which levels are shown")

### Option 1: the middle field owns the folds, the sides mirror them (the `chunkField`/`sideStatus` pattern). **Recommended.**

**Data**
- Middle: `foldField(initial: readonly Fold[]): StateField<readonly Fold[]>`. Each level's `center` is mapped; `left` and `right` are fixed references from `foldRuns`.
- Effect: `showFolds = StateEffect.define<{ run: number; keep: number }>()`. It sets `hidden = hidden.slice(hidden.length - min(keep, hidden.length))`, which can only show.
- Sides: `sideFoldCounts: StateField<readonly number[]>`, the hidden-level count per run, set by `showSideFolds`. A side's ranges are the constant `foldRuns` output captured by its decoration extension. They never change, just as side decorations are "fixed side ranges + a mirror" (state table, `docs/architecture.md` §5.1).

**State (Q2)**
- One owner: `foldField`, which the strips and layout read.
- Update order in the field:
  1. map the centre ranges when the document changed;
  2. apply `showFolds`;
  3. reveal on `tr.selection` in the same transaction.
- The field returns the same array when nothing changed.
- **A click** is one dispatch: `center.dispatch({ effects: showFolds.of({ run, keep: n - 1 }), annotations: Transaction.addToHistory.of(false) })`. The middle's listener then pushes the counts to the sides, only when they differ (the `pushCovered` guard, `covered.ts:51-58`). That is three dispatches, all effect-only, none recorded by history, because the history snapshot is `placeSpans` only (`chunkField.ts:120-125`).
- **Undo and apply** just map the ranges and never show or hide (rule 8). The applied range ends at the hidden range's `from`, which maps with `+1`.

**Cursor and find (Q6)**
- **The predicate** is pure and shared: `revealKeep(levels, selection): number | null` shows every level whose range holds the selection, where "holds" means:
  - an end of the main selection lies strictly inside `(from, to)`, or
  - a non-empty selection lies within `[from, to]`, which covers a find match ending exactly at `to`.
- **Atomic ranges** per pane: `[from, start of the next line)`. An arrow press stops once on the wave (at `from` or `to`, never strictly inside) and the next press leaves. Sides bind their arrows to navigation (`keys.ts:203-206`).
- **Where it is detected:**
  - The middle reveals inside its own field, in the same transaction as `selectMatch`.
  - A side's listener on `update.selectionSet` sends one `showFolds` to the middle. The middle's push back carries no selection, so it cannot trigger again: no loop.

**Visions.** 2 (one owner), 4 (a level is one `Record<Pane,…>`, so levels can't fall out of step across panes), 1 (it copies a pattern readers already know).

**Cost.** The middle and the sides use different code. A side reveal goes side → middle → sides.

### Option 2: each pane owns its folds, and a coordinator broadcasts

**Data.** One field type in every pane: `paneFolds(pane, runs): StateField<readonly (readonly (Hidden | null)[])[]>`, that pane's ranges of the levels still hidden. The middle maps; every pane reveals inside its own transaction.

**State.** A click dispatches `showFolds` to all three. A pane whose own selection changed its counts broadcasts to the other two, guarded by "this transaction had no `showFolds` effect".

**Visions.** 1 (one symmetric field). **Costs:** vision 2 is broken (three owners of one fact; a missed broadcast misaligns panes) and vision 4 is weaker (equal level counts across panes is only a convention).

### Option 3: the controller owns the shown counts, every pane mirrors them (the `IconDrag` press / `pushCovered` pattern)

**Data.** `Folding.#keep: readonly number[]` sits next to the hovered run. Each pane holds its own ranges for every level (the middle mapped) plus a `keep` mirror, pushed by `pushFolds(views, keep)` with a guard.

**State.** Every reveal, the middle's included, goes pane listener → `folding.reveal` → push, so it is two transactions everywhere.

**Visions.** 2 (one owner, outside CodeMirror), 1 (symmetric). **Costs:** three mirrors instead of two; per-pane arrays keep equal lengths only by convention.

### Q9. File budget (Option 1; Options 2 and 3 replace `folds.ts` and `folding.ts` with about the same size)

`index.ts` 294 + about 20 for the fold wiring would break 300. The fix is to move the once-per-frame paint into `internal/frame.ts` (a `Frame` class):
- moved: `#frameId`, `#layoutCache` (`index.ts:62-63`), `#repaint` (`101-112`), `#layout` (`206-212`), `#requestFrame` (`218-229`), the cancel in `destroy` (`283-285`);
- net about −45 / +25, giving `index.ts` about 270;
- `#repaint` is referenced lazily, as `sideRunner` already does.

| File | Change | ~Lines |
|---|---|---|
| `editor/internal/docPos.ts` | new (moved from `chunkField.ts`) | 18 (chunkField −14) |
| `editor/internal/foldRuns.ts` | new | 85 |
| `editor/internal/folds.ts` | new: field, effects, `mapHidden`, `revealKeep`, side mirror | 150 |
| `editor/internal/foldView.ts` | new: widget, marker, decorations, atomic ranges, theme | 110 |
| `editor/internal/folding.ts` | new: hover owner, delegated pointer, push and forward | 130 |
| `editor/internal/frame.ts` | new (moved) plus waves | 75 |
| `editor/index.ts` | changed | −60 / +28 |
| `geometry.ts`, `gap.ts`, `strips.ts` | changed | +22, +30, +50 |
| `viewport.ts`, `sideFocus.ts`, `pane.ts` | changed (`LINE_HEIGHT_PX`, `doc: Text`, container, gutter overflow) | +8, +3, +12 |
| `connectors/index.ts` | changed | +55 |
| `editor/theme.css`, `src/style.css` | changed | +30, +2 |
| tests: `foldRuns`, `folds`, `foldView`, `connectors`, `gap`, `geometry`, `scrollSync`, `folds.browser` | new or extended | 150 + 200 + 70 + 70 + 45 + 30 + 25 + 160 |

That is about 25 files and about 1,550–1,650 changed lines, right at the cap. One more pane change: the three `Text`s are built before the views (`EditorState.create({ doc, lineSeparator }).doc`, so CodeMirror does the splitting), because `foldRuns` needs all three line counts before any field exists.

### Q10. Tests (node: the bug each test catches)

**`foldRuns.test.ts`**
- keeps 4/8/16 lines next to each change;
- nothing kept at the file's top or bottom;
- no chunks → one level hiding each pane;
- 9-line run → no level, 10 → one 2-line level;
- empty document → null;
- a run hidden in the middle only still creates the level;
- equal level dropped, unequal level kept;
- offsets end at the end of the last hidden line.

**`folds.test.ts`** (EditorState only)
- insert above → range shifts;
- typing at `from` or `to` shows that line and keeps the rest hidden;
- delete to 1 line → shown, and undo does not hide it again;
- `actionSteps` and bulk apply leave every count and range unchanged;
- one click drops only the outermost level, three clicks empty the run;
- a larger `keep` is ignored (never hides);
- after a click, `undo` returns false (the fold is not in history);
- a find selection inside shows through the innermost holding level;
- a match ending at `to` reveals;
- a cursor at `from` or `to` does not reveal;
- a side `revealKeep` gives the same keep as the middle for equal ranges;
- the push guard sends nothing when the counts are equal.

**`foldView.test.ts`**
- one block replace per run, at the outermost hidden level with a range;
- a pane with null at the outer level shows the next non-null one;
- no decoration once a run is empty;
- atomic set equals `[from, next line start)`.

**`connectors/index.test.ts`**
- exact path strings for level/wide, level/narrow (< 25 px), y1 > y2, y1 < y2;
- the tile path.

**`gap.test.ts`**
- a join only when both adjacent panes show a wave;
- none beside an empty side;
- y = top + shift + 10;
- off-strip waves are filtered.

**`geometry.test.ts`**: `waveRows` with an injected block-top function.

**`scrollSync.test.ts`**: anchors around folded runs of different length per pane give level wave tops (offset identity).

**WebKit** (`editor/folds.browser.test.ts`, Playwright WebKit, `pnpm test:browser`; synthetic data with changes about 100 lines apart):
1. Each pane shows one 20 px `.fold-wave` per run with no line number, and chunk tops are equal across panes after a sync scroll.
2. `userEvent.hover` on a middle wave adds `fold-wave-hover` in all three panes and both strips, and the cursor style is `pointer` [INFERENCE: the vitest-browser hover API].
3. Focus the left pane and click the middle's wave text area: the outer level is shown in all three panes; `document.activeElement`, the left side mark and the middle selection are unchanged. Three clicks remove the run's waves.
4. A click at a strip join's coordinates does the same.
5. In the middle, from the line above a wave, ArrowDown twice lands on the first line below it, and the wave stays.
6. Find in the left pane a word that exists only in hidden lines: the match is visible and that run's waves are gone in all panes.
7. Scroll horizontally on a long line: the wave's `getBoundingClientRect().left` does not change.
8. Apply, then undo: the wave count is unchanged.

**Real app.** `just app-session start-app` on `scripts/conflict-repo.sh`, then `click "<aria-label>" --nth k`, `press Down Down`, and `shot` before and after.

---

## 3. Recommendation: Option 1

It gives one owner, the middle field. The sides mirror counts exactly as they mirror statuses, so it uses a path reviewers already know (`index.ts:193-204`, `sideStatus.ts`). A level is one `Record<Pane, Hidden | null>`, so the three panes cannot disagree on which block is which. Middle reveals and rule 8's shrinking happen inside one field, in the same transaction as the selection.

**What it costs:**
- the middle and the sides are handled by different code;
- a side reveal takes two hops (side listener → middle dispatch → push);
- `index.ts` needs the `Frame` extraction (a move, no new logic) to stay under 300;
- the slice is at the size cap (about 25 files, about 1,600 lines). The natural split point is the strip half: `waveJoinPath`, `wavePaints`, the strip layer and their tests, about 300 lines.

`MergeController`'s public surface does not change.

## open_questions (for the product owner)

1. **Ctrl+A, Ctrl+Home, Ctrl+End with lines hidden at the file's top or bottom.** Under WebStorm's and CodeMirror's rule (a fold opens only when the cursor lands strictly inside), these keys put the cursor at the edge and the lines stay hidden; copying after Ctrl+A still copies every hidden line. The brief lists `selectAll` as something that shows lines. Should Ctrl+A show every hidden line in the file? The cost: one key undoes all the collapsing.
2. **After a click, panes can drift until the next scroll.** When one pane's run is too short to hide anything, a click grows the other panes but not that one, and they stay out of line until the user scrolls, as after an apply today. Should a click re-align the other panes right away, with the clicked pane holding still? The cost: the other panes jump under the pointer.

## deviations_from_brief

- **"A selection extended by keys" never shows lines.** With atomic ranges, key motion never lands strictly inside a hidden range, so only find, programmatic selections and a selection lying within a hidden range reveal. This matches WebStorm.
- **Rule 3's second sentence is vacuous** given nested levels. It is implemented generally anyway.
- **Pane waves get an invisible `aria-label`**, so `app-session click` can reach them by name.
- **Docs outside the slice's file scope must be updated by the orchestrator or curator**: §5.1 state table, §5.2 internals list, and `.omp/skills/project-map/SKILL.md`. `map-check` matches whole words only (`scripts/map-check.sh:10-12`), so a name like `frame` passes without being listed.
- **Proposed plan row** (DR5): "Folds: the middle field owns which levels are shown; the sides mirror the counts; the wave is a sticky line-number-gutter overlay with a CSS mask. Rejected: per-pane owners (three copies); a controller-owned vector (three mirrors); `@codemirror/language` folding (inline placeholders keep the line number, one fold per pane); a wave drawn in the content (horizontal-scroll phase needs the gutter width)."

## open_risks

- **WebKitGTK behaviours not checked:**
  - `100cqi` on a scroller with inline-size containment, inside a sticky, overflow-visible gutter;
  - mask data URLs under CSP `img-src`;
  - `geometryChanged` arriving with the decoration change (the fold-field identity check covers it).

  Fallback if the overlay misbehaves: draw the wave in the content widget with `position: sticky` and a measured gutter offset.
- **CodeMirror carrying a scroll target across a later transaction** when a side find match is revealed in a second transaction [INFERENCE].
- **The real app cannot hover, or click a strip at a coordinate, through `app-session`**: it has no move command and no coordinate click (`drive.ts:47-74`). The verifier needs `--x11` xdotool or a new command, which is outside `editor/**`.
- **The slice size is at the cap.** Split the strip half if the build overruns.