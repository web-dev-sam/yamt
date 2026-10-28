# Range collapse: design for the merge window's collapsing in the range window

Designer `RangeCollapseDesign`, 2026-10-28, at `a6fe62a` (brief `docs/slices/briefs/range-collapse-design.md`); the
output below verbatim. **Orchestrator's choice (session 35):** Option A, recorded as plan §2 #126. Builds re-cut from
the designer's E1/E2/W for two-implementer waves: `RangeFoldCore` (= E1) ∥ `RangeCollapseToggle` (W's label, store,
button), then `RangeFoldColumns` (= E2 + `useRangeController.ts`, `rangeThreads.ts` `listed`, `RangeView.vue`'s
`collapsed` option, their tests). Docs (`docs/architecture.md`, project map, `CHANGELOG.md`) are the orchestrator's.

I recommend **Option A**. It has a shared pure fold core, the left column holds the fold state and the right copies it, and the shared compare frame and strip get two opt-in hooks.

It needs no Rust and no IPC change: everything is inside `frontend/src/**`. The merge window's fold tests need no edits, and `editor/compare.ts` is not touched. I edited no files.

## Facts at HEAD that shape the design

1. **Runs are computed once and never replaced.**
   - `foldRuns(chunks, docs)` builds levels over `PANES` through `CHUNK_RANGE` (`foldRuns.ts:17-21,44-78`).
   - The middle's `foldField` sets its runs in `create()` (`folds.ts:132-154`). `collapseSpec` only rewrites `hiding` (`folds.ts:171-187`).
   - Rule 4 wants runs recomputed at each off → on. So the range needs a "replace the runs" transition that the merge never had.
2. **The side mirror holds only the counts.**
   - The sides keep `hiding` counts and read the fixed `fields.runs` (`folds.ts:27-31,99-105,156-161`).
   - `folds.test.ts:360` pins the mirror's value as `[3, 2, 3]`.
   - So a mirror that also carries runs (the range needs one) cannot replace the merge's without editing merge tests.
3. **The pure rules are already independent of panes or nearly so.**
   - `foldSelection.ts` (`holds`, `revealKeep`, `leaveAllHidden`) is pane-free.
   - `folds.ts:72-130` (`hidingAll`, `hiddenLevels`, `displayedIn`, `shown`, `reveals`) only read `level[pane]`.
   - `Folding(hosts, show)` takes any elements (`folding.ts:19`).
   - Only _building_ a per-pane record generically would need a cast. The design avoids that: generic code reads records, and each window builds its own record literally.
4. **Thread lines.**
   - `removed`/`added` thread lines always lie inside a difference: `anchorAt` makes them only when `linePlace` says `inside` (`threadAnchor.ts:35-45`).
   - Only `unchangedOnLeft`/`unchangedOnRight` carry both lines (`ipc/threadLine.ts:8-11`). They become run edges.
   - A thread's block row sits at the end of its own line (`threadField.ts:23-38`).
   - Drafts are `ShownThread`s with `shown: "draft"` (`rangeThreads.ts:111-116`).
5. **Start-up race (new finding).**
   - `startUp` shows the first file before it awaits `threads.load()` (`rangeStore.ts:256-261`). The list starts as `{ threads: [] }` (`rangeThreads.ts:276`).
   - The window builds the controller as soon as the texts and hosts exist, then calls `showThreads(parts.threads())` (`useRangeController.ts:85-100`).
   - So the first file can compute its runs before the stored threads arrive, and a stored thread would sit inside hidden lines. That breaks rule 4.
6. **Pressing the wave's gutter cell would start a thread.**
   - The range columns' line-number `mousedown` starts a thread on any gutter cell (`threadNumbers.ts:105-127`).
   - The wave marker lives in that same gutter (`foldView.ts:49-72`). A press on the wave would start a thread on the first hidden line.
   - The hover comment icon would also show on the wave cell (`theme.css:509-521`).
7. **In two columns, a run hides the same lines on both sides.**
   - Lines between differences are identical in both columns. So each level hides the same number of lines left and right.
   - Consequences:
     - Every strip join is level.
     - The left and right waves always come as a pair.
     - Thread rows never sit beside only one hidden side.
     - The existing difference and thread anchors stay correct with no wave anchors (`compareFrame.ts:47-64`, `threadField.ts:70-80`).
8. **Shared code and its other callers.**
   - `createReadOnlyColumnViews` passes one extension set to both columns (`compareViews.ts:24-28,86-101`), and only `range.ts:55` calls it.
   - `CompareFrame` has no `realign` and paints only bands (`compareFrame.ts:106-116`). `ScrollSync.follow(source)` already exists (`scrollSync.ts:100-104`).
   - Every column already has `exactScroll`, through `everyPane()` (`compareViews.ts:97`, `paneViews.ts:45`).
9. **Fixtures.** `?range=review` has `src/board/board.ts` with differences starting at left lines 19, 179, 199, 254, 308, 415 and 461 (`fixtures/range/review.json:126,174,194,228,293,313,333`). `?threads=seeded` puts an `unchangedOnRight` thread at left 100 / right 101 inside the 20–178 stretch (`fixtureThreads.ts:41`).

## Option A (recommended): shared pure core, the left column holds the state, opt-in frame and strip hooks

Visions served: **2** (one copy of each #63 rule), **4** (constructive chain, sum-free illegal states avoided), **5** (no new abstraction without two users: every generic piece has the merge and range windows as callers), **1** (each window builds its records literally; no casts).

### Data structures

**`foldRuns.ts`** (generic types, private generic level loop)

```ts
export type FoldLevel<P extends string = Pane> = Readonly<Record<P, Hidden | null>>;
export type Fold<P extends string = Pane> = { readonly hidden: readonly FoldLevel<P>[] };
export type LineSpan = { readonly start: number; readonly len: number };
export type ColumnChange = Readonly<Record<Column, LineSpan>>; // a difference, or a thread's unchanged line (len 1 both)
function runEdge(before: LineSpan | undefined, after: LineSpan | undefined): RunEdge; // private
function runLevels<P extends string>(
  panes: readonly P[],
  levelAt: (shift: number) => FoldLevel<P>,
): FoldLevel<P>[]; // private
export function foldRuns(chunks: readonly Chunk[], docs: Readonly<Record<Pane, Text>>): Fold[]; // unchanged signature
export function columnRuns(
  changes: readonly ColumnChange[],
  docs: Readonly<Record<Column, Text>>,
): Fold<Column>[];
export function displayed<P extends string>(fold: Fold<P>, pane: P): Hidden | null;
```

- `runLevels` holds the 4/8/16 loop, `CONTEXT_LINES`, `LEVEL_GROWTH`, `LEVELS`, the "hides" rule and the "differs from the step outside it" rule.
- `hiddenLines` (the at-least-2-lines rule) stays private and is shared by both run builders.

**`foldSteps.ts`** (new, pure; moved out of `folds.ts:72-130,194-196`)

```ts
export type ShowFolds = { readonly run: number; readonly keep: number };
export type FoldSteps<P extends string> = {
  readonly runs: readonly Fold<P>[];
  readonly hiding: readonly number[];
};
export function hidingAll<P extends string>(
  runs: readonly Fold<P>[],
  collapsed: boolean,
): readonly number[];
export function sameCounts(a: readonly number[], b: readonly number[]): boolean;
export function hiddenLevels<P extends string>(
  runs: readonly Fold<P>[],
  counts: readonly number[],
): readonly Fold<P>[];
export function displayedIn<P extends string>(folds: readonly Fold<P>[], pane: P): Hidden[];
export function shown<P extends string>(steps: FoldSteps<P>, show: ShowFolds): FoldSteps<P>;
export function nextStep<P extends string>(steps: FoldSteps<P>, run: number): ShowFolds;
export function reveals<P extends string>(
  folds: readonly Fold<P>[],
  pane: P,
  selection: SelectionRange,
): ShowFolds[];
export function leaveCollapsed<P extends string>(
  selection: EditorSelection,
  steps: FoldSteps<P>,
  pane: P,
): EditorSelection | null;
```

- `folds.ts` keeps all of its exports.
- `export type FoldState = FoldSteps<Pane>` is an alias, not a re-export.
- `showFolds` and `setHiding` stay defined in `folds.ts`.
- `collapseSpec` and `sideFoldPush` call `leaveCollapsed`. That is the same code path with the same behaviour.

**`columnFolds.ts`** (new: the range's fold state)

```ts
export type ColumnSteps = FoldSteps<Column>;
export const ownerSteps: StateField<ColumnSteps>;   // left column: the one owner (#63's "middle", here the left = the base)
export const mirrorSteps: StateField<ColumnSteps>;  // right column: changed only by the push
const showSteps = StateEffect.define<ShowFolds>();  // owner only
const setSteps = StateEffect.define<ColumnSteps>(); // owner: renew; mirror: push
```

- The owner's `update` handles three things: `showSteps` → `shown`, `setSteps` → the value, and `tr.selection` → `reveals(…, "left")` in the same transaction (as `folds.ts:145-150`).
- The mirror only takes `setSteps`.

**Wave geometry, shared by both windows**

```ts
// wavePhase.ts — constructive chain: a pane, then (strip, pane) links
export type WaveChain<P extends string> = {
  readonly first: P;
  readonly next: readonly { readonly strip: Element; readonly pane: P }[];
};
export function chainEnds<P extends string>(
  first: P,
  next: readonly { readonly strip: Edges; readonly pane: P }[],
): ReadonlyMap<P, WaveEnds>;
export class ChainPhases<P extends string> {
  constructor(
    chain: WaveChain<P>,
    hosts: Readonly<Record<P, HTMLElement>>,
    views: () => Readonly<Record<P, { readonly scrollDOM: Measured }>>,
  );
  destroy(): void;
}
export class WavePhases extends ChainPhases<Pane> {
  constructor(hosts: WaveHosts, views: () => MeasuredPanes);
} // merge, same signature
// paneEnds / panePhases / layoutOf / phaseStyle / writePhase: same signatures, computed through chainEnds
// geometry.ts
export type WaveRow<P extends string = Pane> = Readonly<Record<P, number | null>>;
// gap.ts
export function joinPaints(waves: readonly WaveRow<Column>[], shifts, size): WavePaint[]; // wavePaints({waves, side}) maps STRIP_PANES[side] onto it
// strips.ts
export class WaveLayer {
  readonly node: SVGGElement;
  constructor(hovered: () => number | null);
  paint(paints: readonly WavePaint[]): void;
} // GapStrip#paintWaves (strips.ts:160-174) + waveNode (:66-76) move here
```

### 1. Generic core and run edges

- `foldRuns` and `columnRuns` both call the private `runLevels`.
- Differences and threads become one sorted `ColumnChange[]`, built by `columnChanges(differences, threads)` in `columnFolds.ts`:
  - each `unchanged*` thread gives `{ left: { start: l, len: 1 }, right: { start: r, len: 1 } }`;
  - `removed`/`added` threads are skipped, because they are already inside a difference;
  - duplicate lines are dropped;
  - the list is sorted by left start, then right start. The tie-break matters: a difference with an empty left range and a thread on the next line share a left start, and only sorting by the right start too keeps the thread line out of the next run.
- Every `shown` kind counts: open, collapsed and draft.
- Merge call sites are unchanged.

### 2. State

- **Which field decides:** `ownerSteps` in the left column decides what is hidden. The right column copies it through a left update listener, using `mirrorSpec`.
  - `mirrorSpec` moves the right's selection only when the runs were replaced or a count grew, as `sideFoldPush` does (`folds.ts:227-246`).
- **Clicks:** `Folding([left, right, strip], run => left.dispatch(stepSpec(left.state, run)))`. A click on either column or on the strip shows the next step in both.
- **Reveal from the right:** a right listener turns a selection into `rightReveal` and dispatches it on the left, then calls `scrollIntoView` on the right. This is `sideReveals`' pattern (`folds.ts:272-290`).
- **Renew:** `renewSpec(left, runs, collapsed)` = `setSteps({ runs, hiding: hidingAll(runs, collapsed) })` plus `leaveCollapsed`. It is used for open, on and off:
  - on = runs recomputed from the differences and the last threads, every step hidden;
  - off = every line shown.
- **No history:** every spec carries `Transaction.addToHistory.of(false)`. The columns are read-only, and no edit maps the runs.
- **Where the threads come from:**
  - at open, `options.threads`;
  - at on, the list `showThreads` last received (`#threads`).
  - `showThreads` never renews.

### 3. Frame and scroll

- **Measuring:** `CompareFrame` gets `fields: [differenceField, threadField, ownerSteps, mirrorSteps]`, so a step change re-measures (`compareFrame.ts:96-104`). `lineBlockAt` measures the folded layout.
- **Waves:** a new optional part `waves?: (views) => readonly WaveRow<Column>[]` adds `waves` to the cached layout. `paint(views, rows, waves)` forwards them to `CompareStrip`, whose `WaveLayer` exists only when `hovered` is given. The compare window's strip DOM stays byte-identical.
- **Realign:** new method `realign(source: Column)` calls `this.#scroll.follow(source)`.
- **Toggle:**
  1. The left dispatches `renewSpec` together with `left.scrollSnapshot()`.
  2. The push updates the right.
  3. `realign("left")` makes the next frame write the right's `scrollTop`.
  - So the left's top line stays put and the right lines up at once, as the merge's `setCollapsed` does (`index.ts:224-227`).
- **#82 (far scroll):** every follower write and reveal goes through CodeMirror scroll requests or `scrollTop` writes, which `exactScroll` already covers in every column.
- **Thread rows:** they sit only at thread lines, which are run edges, or at difference ends, never inside hidden lines. Because hidden ranges are equal in both columns, the aligned gaps and `threadAnchors` stay correct. No wave anchors are needed (fact 7).
- **Compare window:** it passes no `waves`, never calls `realign`, keeps the editable path in `compareViews` and calls `new CompareStrip(hosts.strip)` as before. `editor/compare.ts` is untouched.

### 4. Wave phase

- The chain is `{ first: "left", next: [{ strip: hosts.strip, pane: "right" }] }`.
- The left column leaves at the strip's left edge (tile x = 5). The right column enters at its right edge (x = 15).
- No pane has two edges, so no period is stretched. These are the same edge meetings the merge's left and right panes have.
- The merge passes the chain `left → (local) center → (remote) right`. Its ResizeObserver observe order and its numbers are unchanged.

### 5. Find and selection

- **Left column:** the owner field reveals in the same transaction for a Ctrl/Cmd+F match or any selection end strictly inside hidden lines (`foldSelection.ts:5-12`).
- **Right column:** the reveal goes through the left, and the push brings it back. Both columns show it.
- **What does not reveal:** select-all, Ctrl/Cmd+Home/End and the arrows never produce a strictly-inside end. `atomicRanges` from the shared `paneFoldView` stops the cursor once on the wave line.
- **Previous/Next:** they select a difference's first line, which is never hidden because 4 context lines are always kept.
- **The next feature's search go-to:** it must select the match range, as Ctrl/Cmd+F does, rather than a bare cursor at a line start. Then this same reveal covers it. A cursor exactly at a wave line's start is, by #63's rule, not inside.

### 6. Contract — see the recommendation.

### 7. Ownership — see the recommendation.

### 8. Tests — see the recommendation.

## Option B: same state as A, but the range gets its own frame and strip

- **Structures:** as in A, plus a new `RangeFrame` (copying `measure`, `syncFindSpace`, the cache and `ScrollSync<Column>`) and a new `RangeStrip` (bands plus `WaveLayer`).
- **Effect on #106:** range would no longer share `CompareFrame` and `CompareStrip`, which #106 records it should.
- **Visions:** 3 (the compare files would be provably untouched) against 2.
- **Answers to the eight questions:** 1, 2, 4 and 5 are as in A. For 3, the realign and waves live in `RangeFrame`, and the thread anchors are passed to it. For 6–8, as in A, plus about 150 duplicated lines and a test file for each copy.
- **Rejected:** two copies of the find space, the cached layout, the sync and band keying (vision 2). A gets the same compare-unchanged guarantee from opt-in parts with defaults.

## Option C: one fold object outside the EditorStates, both columns copy it

- **Structures:** a plain `ColumnFolds { steps: FoldSteps<Column> }` class. Both columns get a mirror field set by `setSteps`. Clicks and reveals from either column call `ColumnFolds.show/reveal`, which dispatches to both.
- **Visions:** 5 (symmetric, no owner asymmetry, the simplest renew).
- **Rejected:**
  - It is #63's explicitly rejected "the controller owning them with three mirrors (three copies of one fact, vision 2)". Under DR1 there is no new information: read-only columns remove the mapping, not the copies.
  - A reveal also lands one dispatch after the selection in the column that holds the selection, instead of in the same transaction.

## Recommendation: Option A, and what it costs

### Costs

- **Merge code is edited, not only extended.** `folds.ts` (helpers moved out), `foldView.ts`, `wavePhase.ts`, `strips.ts`, `gap.ts` and `geometry.ts` change shape while keeping behaviour. The guard is that every merge test runs unedited, plus `strips.browser.test.ts`.
- **The first file waits for the thread list.** The columns stay empty until the first thread-list read settles, success or failure; that is milliseconds in practice. This is the fix for fact 5. The rejected alternative — revealing a thread that arrives inside hidden lines — would show the whole run instead of 4 lines of context, and would be a second reveal path.
- **API changes:**
  - `RangeOptions` gains two required fields.
  - `RangeParts.build` takes `RangeOptions`, and the window stops calling `showThreads` right after building.
  - `ReadOnlyWiring.extensions` becomes a function of the column.
- **Size and builds:** about 1,650 changed lines in the editor, so the editor work is split into two parallel builds (E1, E2), plus the window build (W).
- **The left column decides the fold state.** This is invisible to users, because both columns always show the same steps.

### Generic core: final API

These are the types and signatures listed under Option A's data structures. In addition:

- `foldView.ts` exports the per-pane view:
  ```ts
  export function paneFoldView<P extends string>(
    shown: {
      readonly field: StateField<unknown>;
      readonly folds: (state: EditorState) => readonly Fold<P>[];
    },
    pane: P,
    hovered: () => number | null,
  ): Extension; // decorations, atomicRanges, lineNumberMarkers, waveTheme (foldView.ts:149-161 generalised)
  ```
  The merge's private `foldView(wiring, pane)` becomes a 3-line call to it.
- `foldDecorations<P extends string>(folds: readonly Fold<P>[], pane: P)` — the merge test's call `foldDecorations(FOLDS, "center")` still infers `Pane`.

### The editor ↔ window contract

```ts
// editor/range.ts (exported via editor/index.ts:45-46 unchanged)
export type RangeOptions = {
  readonly preferences: Preferences;
  readonly collapsed: boolean; // the store's `collapsing` at build
  readonly threads: readonly ShownThread[]; // the file's threads at build: shown at once, and run edges (rule 4)
};
export class RangeController {
  constructor(texts: RangeTexts, hosts: CompareHosts, options: RangeOptions, events: RangeEvents);
  setCollapsed(collapsed: boolean): void; // on: runs from the differences + the threads last shown, every run at its start;
  // off: every line shown; left top line kept, right realigned; not in history
  showThreads(threads: readonly ShownThread[]): void; // unchanged behaviour; remembered for the next on; never recomputes runs
  // setPreferences, moveToChange, destroy unchanged
}
```

**Window side:**

- **Store:** `RangeStore = SettingsStore & Collapsing & {…}`, and `createRangeStore` spreads `...createCollapsing()`, as `store.ts:181` does. The fence PM9 only bars `store`/`App` (`fences.ts:55-66`).
- **Label:** `collapsing.ts` exports `COLLAPSE_LABEL = "Collapse unchanged fragments"`. `toolbarButtons.ts:50` uses it, so the words have one source.
- **Thread list read:** `RangeThreads.listed: Readonly<ShallowRef<boolean>>` becomes true once the first `load()` settles, success or failure.
- **`useRangeController` and `followRange`:**
  - `RangeParts` gains `collapsed: MaybeRefOrGetter<boolean>` and `listed: () => boolean`.
  - `build(texts, hosts, options: RangeOptions, events)` — `build()` returns early while `!parts.listed()`, and the watch sources become `[content, hosts, listed]`.
  - Options at build: `{ preferences: toValue(...), collapsed: toValue(parts.collapsed), threads: parts.threads() }`.
  - The post-build `showThreads` call (`useRangeController.ts:99`) is removed.
  - New watch: `watch(toRef(parts.collapsed), on => controller?.setCollapsed(on))`.
  - `ShownRange` adds `"setCollapsed"`.
  - `rangeThreadParts` also returns `listed`.
  - `useRangeController(file, hosts, { preferences, collapsed })`.
- **`RangeView.vue` button:**
  - It goes after Next (`RangeView.vue:64-74`).
  - `ChevronsDownUp`, with `:title` and `:aria-label` set to `COLLAPSE_LABEL`.
  - `:aria-pressed="collapsing"` and `:disabled="!columns"`.
  - `@mousedown.prevent` (keeps the keyboard) and `@click="toggleCollapsing"`.
  - Classes as `MergeToolbar.vue:198`: `rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent aria-pressed:bg-row-selected aria-pressed:hover:brightness-110`.

### Internal contract E1 → E2 (`editor/internal/columnFolds.ts`)

```ts
export type ColumnSteps = FoldSteps<Column>;
export const ownerSteps: StateField<ColumnSteps>;
export const mirrorSteps: StateField<ColumnSteps>;
export function columnChanges(differences: readonly Difference[], threads: readonly ShownThread[]): ColumnChange[];
export function rangeRuns(differences: readonly Difference[], threads: readonly ShownThread[], docs: Readonly<Record<Column, Text>>): Fold<Column>[];
export function columnSteps(state: EditorState, column: Column): ColumnSteps;
export function renewSpec(left: EditorState, runs: readonly Fold<Column>[], collapsed: boolean): TransactionSpec;
export function stepSpec(left: EditorState, run: number): TransactionSpec;
export function mirrorSpec(right: EditorState, steps: ColumnSteps): TransactionSpec | null;
export function rightReveal(right: EditorState): TransactionSpec | null;
export type ColumnFoldWiring = { readonly views: () => ColumnViews; readonly hovered: () => number | null };
export function columnFoldExtension(column: Column, wiring: ColumnFoldWiring): Extension;
// left: ownerSteps + paneFoldView + push listener; right: mirrorSteps + paneFoldView + reveal listener
```

E2 builds on it:

```ts
export class RangeFolds {
  // rangeFolds.ts
  readonly hovered: () => number | null;
  constructor(hosts: CompareHosts, views: () => ColumnViews); // Folding([left,right,strip]), ChainPhases
  column(column: Column): Extension;
  renew(runs: readonly Fold<Column>[], collapsed: boolean): void; // left.dispatch(renewSpec, { effects: left.scrollSnapshot() })
  destroy(): void;
}
export function columnWaves(
  views: Readonly<
    Record<
      Column,
      { readonly state: EditorState; lineBlockAt(pos: number): { readonly top: number } }
    >
  >,
): WaveRow<Column>[];
```

`RangeController` wiring:

- `#folds = new RangeFolds(hosts, () => this.#views)` is created before the views.
- `extensions: column => [threadField, threadNumbers(…), this.#folds.column(column)]`.
- `new CompareStrip(hosts.strip, this.#folds.hovered)`.
- `CompareFrame({ …, fields: [differenceField, threadField, ownerSteps, mirrorSteps], waves: columnWaves })`.
- At the end of the constructor: `#renew(options.collapsed)`, then `showThreads(options.threads)`.
- `setCollapsed(on)` = `#renew(on)` + `#frame.realign("left")`.

### Who owns which file (disjoint across the three builds)

**E1 — editor fold core and range fold state** (6 files, about 790 lines)

| file                                  | change                                                                                                                | lines   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------- |
| `editor/internal/foldRuns.ts`         | generic `Fold<P>`/`FoldLevel<P>`/`displayed`, private `runLevels`/`runEdge`, `LineSpan`, `ColumnChange`, `columnRuns` | +40/−22 |
| `editor/internal/foldSteps.ts`        | new: the pure step state moved from `folds.ts`, plus `leaveCollapsed`                                                 | +90     |
| `editor/internal/folds.ts`            | imports `foldSteps`, `FoldState` alias; exports unchanged                                                             | +15/−65 |
| `editor/internal/foldView.ts`         | generic `foldDecorations`/`waveMarkers`, exported `paneFoldView`; `Folds` unchanged                                   | +22/−12 |
| `editor/internal/columnFolds.ts`      | new: everything in the E1 → E2 contract                                                                               | +175    |
| `editor/internal/columnFolds.test.ts` | new                                                                                                                   | +350    |

**E2 — editor geometry, frame, strip and controller** (20 files, about 1,000 lines)

| file                                   | change                                                                                                | lines   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| `editor/internal/wavePhase.ts`         | `WaveChain`, `chainEnds`, `ChainPhases`; `WavePhases` extends it                                      | +50/−30 |
| `editor/internal/gap.ts`               | `joinPaints`; `wavePaints` maps onto it                                                               | +18/−12 |
| `editor/internal/geometry.ts`          | `WaveRow<P = Pane>`                                                                                   | +1/−1   |
| `editor/internal/strips.ts`            | `WaveLayer` (used by `GapStrip`)                                                                      | +35/−28 |
| `editor/internal/compareStrip.ts`      | optional `hovered` → `WaveLayer`; `paint(…, waves)`                                                   | +18/−4  |
| `editor/internal/compareFrame.ts`      | optional `waves` part, layout waves, `realign`                                                        | +22/−5  |
| `editor/internal/compareViews.ts`      | `ReadOnlyWiring.extensions: (column) => Extension`                                                    | +3/−3   |
| `editor/internal/threadNumbers.ts`     | `mousedown` returns false when `foldRunAt(target) !== null`                                           | +4      |
| `editor/internal/rangeFolds.ts`        | new: `RangeFolds`, `columnWaves`                                                                      | +95     |
| `editor/range.ts`                      | options, `#threads`, `setCollapsed`, wiring                                                           | +32/−6  |
| `editor/theme.css`                     | `:not(.fold-wave-cell)` on the hover comment icon (`:509-511`)                                        | +1/−1   |
| `editor/internal/rangeFolds.test.ts`   | new                                                                                                   | +170    |
| `editor/internal/compareFrame.test.ts` | new tests                                                                                             | +60     |
| `editor/internal/compareViews.test.ts` | `:43` call site to `extensions: () => []`, plus 1 test                                                | +22/−1  |
| `editor/rangeFolds.browser.test.ts`    | new WebKit probe                                                                                      | +330    |
| `editor/range.browser.test.ts`         | `:24` options add `collapsed: false, threads: []`                                                     | +1/−1   |
| `editor/rangeThreads.browser.test.ts`  | `:167` options, same change                                                                           | +1/−1   |
| `frontend/src/editor/AGENTS.md`        | fold paragraph                                                                                        | +6      |
| `docs/architecture.md`                 | §5.1 rows at `:748-750,764`, §5.2 `RangeController`, editor module list `:962-970`                    | +25/−5  |
| `.omp/skills/project-map/SKILL.md`     | name `foldSteps.ts`, `columnFolds.ts`, `rangeFolds.ts`; the collapsing row adds the range store (PM6) | +10/−3  |

**W — window** (11 files, about 260 lines)

| file                            | change                                            | lines   |
| ------------------------------- | ------------------------------------------------- | ------- |
| `ui/collapsing.ts`              | `COLLAPSE_LABEL`                                  | +3      |
| `ui/toolbarButtons.ts`          | `LABELS.collapse` uses it                         | +2/−1   |
| `ui/rangeStore.ts`              | `Collapsing` in the type, `...createCollapsing()` | +4/−1   |
| `ui/rangeThreads.ts`            | `listed`                                          | +10     |
| `ui/useRangeController.ts`      | the contract above                                | +25/−8  |
| `ui/RangeView.vue`              | the button, `collapsed` option                    | +20/−2  |
| `ui/useRangeController.test.ts` | build fake takes options; new tests               | +80/−10 |
| `ui/rangeStore.test.ts`         | new test                                          | +25     |
| `ui/rangeThreads.test.ts`       | new test                                          | +25     |
| `ui/AGENTS.md`                  | note                                              | +3      |
| `CHANGELOG.md`                  | entry                                             | +3      |

No merge test file is touched. The only test edits are the range call sites named above. W compiles against E1 and E2's new `RangeOptions`; check the three together after all land.

### Node unit tests: name and the bug each catches

**`columnFolds.test.ts` (E1)**

1. _runs come from the differences per column: before the first, between two, after the last_ — right-column runs built from left line numbers, or a missing last run.
2. _each run keeps 4, 8 and 16 lines next to each change and none at the file's edges, in both columns_ — context kept at the file's edges, or a second copy of the level loop drifting.
3. _a stretch under 2 lines hides nothing; a level equal to the one outside it is dropped_ — a click that changes nothing.
4. _a thread on an unchanged line splits its stretch and keeps 4 lines around it in both columns — open, collapsed and draft alike_ — rule 4 ignored, or only open threads counted.
5. _threads on removed or added lines change no run_ — a one-sided edge shifting the other column.
6. _a thread on the line after an insertion point sorts after the difference and stays shown_ — sorting by left start only.
7. _a click on a run's wave shows its next step in both columns_ — the right column not copying, or a click step taken from the right's counts.
8. _the right column numbers runs as the left does_ — a strip or right-column wave opening a different run.
9. _on hides every run back to its start whatever clicks showed; off shows every line in both columns_ — on keeping clicked steps, or the right column not copying.
10. _runs at on come from the threads given then; showing thread rows leaves the steps untouched_ — runs recomputed on a thread add.
11. _at on, a cursor inside lines that get hidden moves to the wave line's start and a selection with an end inside is dropped, left by `renewSpec` and right by `mirrorSpec`_ — cursor left inside the atomic hidden lines.
12. _counts that only shrink leave the right column's cursor alone_ — a click moving the right column's cursor.
13. _a selection end strictly inside hidden lines shows every range holding it, from the left (same transaction) and from the right (through the left)_ — a right-column reveal never reaching the left's field.
14. _select-all, the document's start and end, and a cursor on the wave line's edges reveal nothing_ — `holds` made non-strict.
15. _a search match inside hidden lines (`selectMatch`) shows it_ — rule 6's find case.
16. _a selection on a difference's first line reveals nothing_ — context lost so that Previous/Next lands in hidden lines.
17. _every fold transaction is kept out of history_ — `addToHistory` missing.

**`rangeFolds.test.ts` (E2)** 18. _two columns and one strip: the left leaves at the strip's left edge, the right enters at its right edge_ — right column phased as "through" or as leaving. 19. _the merge chain's ends and phases through `chainEnds` equal `paneEnds`/`panePhases`_ — the generic chain off by one strip. 20. _`ChainPhases` writes both columns' phase on resize and removes both on destroy_ — phase variables left on the hosts. 21. _`columnWaves` gives each run's wave top in both columns, null where nothing hides_ — right-column top read from the left. 22. _`joinPaints` joins the two tops level with `waveJoinPath`_ — shifts swapped.

**`compareFrame.test.ts` (E2)** 23. _waves reach the strip with the rows and re-measure when a fold field changes_ — a stale wave join after a click. 24. _`realign` writes the other column on the next sync though the source did not scroll_ — the right column misaligned after the toggle. 25. _a frame without waves paints none_ — the compare window changed.

**`compareViews.test.ts` (E2)** 26. _read-only columns get their own column's extensions_ — the left's fold field installed in the right column.

**Window (W)** 27. `useRangeController.test.ts` — _built with the store's collapsing and the threads at that moment_ — collapsed ignored at build. 28. `useRangeController.test.ts` — _a toggle reaches every live controller through `setCollapsed`, with no rebuild_ — the watch missing. 29. `useRangeController.test.ts` — _a file opened after the toggle builds with the new state_ — the value read once at mount. 30. `useRangeController.test.ts` — _nothing builds before the thread list was read once_ — fact 5's race. 31. `useRangeController.test.ts` — _a failed list still builds_ — columns stuck empty. 32. `useRangeController.test.ts` — _a thread change calls `showThreads`, never `setCollapsed`_ — recompute on add. 33. `rangeStore.test.ts` — _the range store's collapsing is `yamt.collapse.unchanged`, anything but "false" is on_ — a second key (rule 7). 34. `rangeThreads.test.ts` — _`listed` turns true after the first load settles, success or failure_.

### Acceptance steps

- **WebKit, automated:** `editor/rangeFolds.browser.test.ts`, a 200-line pair with changes at lines 20 and 150 and a thread at line 100. It runs in dark and light and keeps screenshots in `/tmp/yamt-range-folds`.
- **Fixture page:** `just webdriver` + `just app-session start-fixture --range-case review --threads`, on `src/board/board.ts`.
- **Real app:** `scripts/range-repo.sh /var/tmp/rr` + `just app-session start-app --repo /var/tmp/rr --range main..feature`, on `src/board/board.ts` (left 20–178 is one unchanged stretch).

| acceptance line                                                    | WebKit (automated test, fixture page)                                                                                                                                                                          | real app                                                                                                                                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| one wave across both columns and the strip at open                 | `.fold-wave` in both gutters and `.strip-wave-line` per run; join ends at both wave centres within 1 device px; `--fold-wave-x` and `--fold-wave-period` set on both hosts                                     | the wave across left, strip and right in the 20–178 stretch                                                                                                                                          |
| clicks show 4, 8, then the rest in both columns                    | a click on the left gutter wave, then the strip's `.strip-wave-hit`, then the right wave; shown line counts grow +4/+8/rest on each side in both columns; focus stays on the focused column                    | same; the keyboard stays in the column                                                                                                                                                               |
| hover thickens the whole wave                                      | pointer over the right wave → `fold-wave-hover` on the run's nodes in left, right and strip                                                                                                                    | visual                                                                                                                                                                                               |
| toggle shows all and back, resetting clicks                        | `setCollapsed(false)` → no `.fold-wave`; `(true)` after clicks → start state; the left's top line is unchanged and the right is aligned next frame; a cursor inside goes to the wave start                     | header button pressed/unpressed, `aria-pressed`                                                                                                                                                      |
| survives restart, matches the merge window                         | —                                                                                                                                                                                                              | toggle off, close, reopen: off; `scripts/conflict-repo.sh /var/tmp/cr` + `start-app --repo /var/tmp/cr`: the collapse button is unpressed [INFERENCE: shared localStorage, as for `yamt.files.view`] |
| a thread in a long stretch stays shown, at open and after off → on | the thread line and 4 lines around it outside every `.fold-line`; a thread added via `showThreads` leaves the wave count unchanged; off → on still shows it; a press on the wave gutter fires no `startThread` | fixture thread left 100 / right 101; in the real app, add a thread on left line 100, toggle off/on                                                                                                   |
| Ctrl/Cmd+F to a hidden line shows it                               | a search match in a hidden line of the right column → both columns show it                                                                                                                                     | search a word from a line inside 20–178                                                                                                                                                              |
| Previous/Next unaffected                                           | `moveToChange` → the selection is at a difference and the wave count is unchanged                                                                                                                              | arrows step through the 7 differences                                                                                                                                                                |
| merge window as before                                             | merge test files unchanged; `strips.browser.test.ts` passes                                                                                                                                                    | merge window on `/var/tmp/cr`: waves, clicks, toggle                                                                                                                                                 |
| every rule tested, `just check`, dark and light                    | `just check`, `pnpm test:browser`                                                                                                                                                                              | Settings → Theme Light / Dark                                                                                                                                                                        |

## Deviations from the brief and proposed plan row

1. **Three builds instead of two:** E1 and E2 split the editor work, with the internal contract above.
2. **Rule 4 detail:** "the threads then", at open, means the stored list once it has been read (the `listed` gate). `RangeOptions` carries the threads.
3. **Changed seams shared with the compare window:**
   - `RangeParts.build` takes `RangeOptions`;
   - `ReadOnlyWiring.extensions` is per column;
   - `CompareStrip(strip, hovered?)`, `CompareFrame` gets `waves?` and `realign`.
4. **Proposed plan row (DR5), #126:**
   - **Decision:** the range window collapses unchanged lines with #63/#68's rules. The run and step rules are shared (`foldRuns` `runLevels`, `foldSteps.ts`, `paneFoldView`, `WaveLayer`, `ChainPhases`). The left column's `ownerSteps` holds the state and the right copies it. Thread lines on unchanged lines are run edges, and runs are recomputed at open and at each on. Columns are built only after the thread list was read once. The stored choice is shared with the merge window.
   - **Rejected:** a range-own frame and strip (Option B: two copies, vision 2); a fold object outside the states (Option C: #63's rejected copies); revealing late-arriving threads instead of gating (a whole run shown, a second reveal path).
   - **Visions:** 2, 4, 5.

## Open risks

- **Merge code edited:** the merge's fold code is restructured with unchanged behaviour. The detector is every unedited merge test plus `strips.browser.test.ts`.
- **Shared storage not proven:** that the merge and range processes share localStorage is [INFERENCE]. Only the real-app restart step proves it.
- **Search go-to must select the match:** the next feature's go-to has to select the match range, not a bare cursor at a line start; a bare cursor at a wave's first position is, by #63, not inside, so the line would stay hidden.

## Open questions

None. The request answers every product question.
