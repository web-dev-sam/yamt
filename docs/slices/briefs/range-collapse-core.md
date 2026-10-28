# Slice RangeFoldCore — one fold core for the merge window's panes and the range window's two columns

Board "Range collapse" row 2 (session 35). Request `docs/slices/request-range-collapse.md` (read it whole: rules 1–8,
acceptance, non-goals); decision `docs/plan.md` §2 **#126** (read it whole), built on #63, #64, #68 (read those rows).
Design: `.omp/run/notes/RangeCollapseDesign.md` option A (read it whole; its facts with `path:line` are given). You
build the designer's "E1". A window slice (`RangeCollapseToggle`, `ui/` only) runs beside you; a later editor slice
(`RangeFoldColumns`) builds the frame, strip, wave phase and `RangeController` on your contract — so the contract
below is exactly what it will import.

## Target

Owned: `frontend/src/editor/internal/foldRuns.ts`, `frontend/src/editor/internal/foldSteps.ts` (new),
`frontend/src/editor/internal/folds.ts`, `frontend/src/editor/internal/foldView.ts`,
`frontend/src/editor/internal/columnFolds.ts` (new), `frontend/src/editor/internal/columnFolds.test.ts` (new).

Read-only: everything else. In particular the merge window's fold tests stay **byte-unchanged and passing**:
`foldRuns.test.ts`, `folds.test.ts`, `foldView.test.ts`, `foldSelection.test.ts`, `wavePhase.test.ts`,
`editor/strips.browser.test.ts`; `foldSelection.ts`, `folding.ts`, `wavePhase.ts`, `strips.ts`, `gap.ts`,
`geometry.ts`, `compare*.ts`, `editor/range.ts`, `editor/index.ts`.

Non-goals: the frame, strip, wave phase, `RangeController`, the window (later slice and the window slice); any
behaviour change in the merge window; collapsing in the compare window; remembering what clicks showed.

## Contract (fixed; you may add, never change)

```ts
// editor/internal/foldRuns.ts — generic types; the merge's call sites compile unchanged (P defaults to Pane)
export type FoldLevel<P extends string = Pane> = Readonly<Record<P, Hidden | null>>;
export type Fold<P extends string = Pane> = { readonly hidden: readonly FoldLevel<P>[] };
export type LineSpan = { readonly start: number; readonly len: number }; // 0-based first line, line count (Chunk's shape)
export type ColumnChange = Readonly<Record<Column, LineSpan>>; // a difference, or a thread's unchanged line (len 1 both)
export function foldRuns(chunks: readonly Chunk[], docs: Readonly<Record<Pane, Text>>): Fold[]; // signature unchanged
export function columnRuns(changes: readonly ColumnChange[], docs: Readonly<Record<Column, Text>>): Fold<Column>[];
export function displayed<P extends string>(fold: Fold<P>, pane: P): Hidden | null;
// one private runLevels (CONTEXT_LINES 4, LEVEL_GROWTH 2, LEVELS 3, the "hides" and "differs" rules) and one private
// hiddenLines (MIN_HIDDEN_LINES) serve both builders

// editor/internal/foldSteps.ts — the pure step state moved out of folds.ts:72-130,194-196
export type ShowFolds = { readonly run: number; readonly keep: number };
export type FoldSteps<P extends string> = { readonly runs: readonly Fold<P>[]; readonly hiding: readonly number[] };
export function hidingAll<P extends string>(runs: readonly Fold<P>[], collapsed: boolean): readonly number[];
export function sameCounts(a: readonly number[], b: readonly number[]): boolean;
export function hiddenLevels<P extends string>(runs: readonly Fold<P>[], counts: readonly number[]): readonly Fold<P>[];
export function displayedIn<P extends string>(folds: readonly Fold<P>[], pane: P): Hidden[];
export function shown<P extends string>(steps: FoldSteps<P>, show: ShowFolds): FoldSteps<P>;
export function nextStep<P extends string>(steps: FoldSteps<P>, run: number): ShowFolds;
export function reveals<P extends string>(folds: readonly Fold<P>[], pane: P, selection: SelectionRange): ShowFolds[];
export function leaveCollapsed<P extends string>(
  selection: EditorSelection,
  steps: FoldSteps<P>,
  pane: P,
): EditorSelection | null; // #68 rule 8: a cursor in hidden lines → the wave line's start; a selection end inside → dropped

// editor/internal/folds.ts — every export kept with its signature; `FoldState = FoldSteps<Pane>` is a type alias;
// `collapseSpec` and `sideFoldPush` call `leaveCollapsed` (same behaviour)

// editor/internal/foldView.ts — `Folds` unchanged; the per-pane view generic and exported
export function foldDecorations<P extends string>(folds: readonly Fold<P>[], pane: P): DecorationSet; // merge test call infers Pane
export function paneFoldView<P extends string>(
  shown: { readonly field: StateField<unknown>; readonly folds: (state: EditorState) => readonly Fold<P>[] },
  pane: P,
  hovered: () => number | null,
): Extension; // decorations, atomicRanges, lineNumberMarkers (WaveMarker), waveTheme — foldView.ts:149-161 generalised;
// the merge's private per-pane view becomes a short call to it

// editor/internal/columnFolds.ts — the range window's fold state (new)
export type ColumnSteps = FoldSteps<Column>;
export const ownerSteps: StateField<ColumnSteps>; // left column: the one owner of runs and counts
export const mirrorSteps: StateField<ColumnSteps>; // right column: changed only by mirrorSpec
export function columnChanges(differences: readonly Difference[], threads: readonly ShownThread[]): ColumnChange[];
export function rangeRuns(
  differences: readonly Difference[],
  threads: readonly ShownThread[],
  docs: Readonly<Record<Column, Text>>,
): Fold<Column>[];
export function columnSteps(state: EditorState, column: Column): ColumnSteps;
export function renewSpec(left: EditorState, runs: readonly Fold<Column>[], collapsed: boolean): TransactionSpec;
export function stepSpec(left: EditorState, run: number): TransactionSpec; // next step of one run
export function mirrorSpec(right: EditorState, steps: ColumnSteps): TransactionSpec | null; // null: nothing to copy
export function rightReveal(right: EditorState): TransactionSpec | null; // a spec for the LEFT view, from the right's selection
export type ColumnFoldWiring = { readonly views: () => ColumnViews; readonly hovered: () => number | null };
export function columnFoldExtension(column: Column, wiring: ColumnFoldWiring): Extension;
// left: ownerSteps + paneFoldView + an update listener pushing mirrorSpec to the right view;
// right: mirrorSteps + paneFoldView + an update listener sending rightReveal to the left view (then scrollIntoView on the right),
// as sideReveals does (folds.ts:272-290)
```

`ColumnViews` and `Column` are the existing types (`compareViews.ts`, `ipc`). Every spec built here carries
`Transaction.addToHistory.of(false)`.

## Change

1. `foldRuns.ts`: generic types; a private `runEdge(before, after)` over `LineSpan`s; the level loop as one private
   `runLevels` both builders call; `columnRuns` builds `Record<Column, …>` literally (no casts, vision 4). The merge's
   `CHUNK_RANGE` mapping stays merge-side.
2. `foldSteps.ts`: move the pure step helpers out of `folds.ts` (`folds.ts:72-130,194-196`) generic over the pane key,
   plus `leaveCollapsed` (the cursor/selection rule now inside `collapseSpec`/`sideFoldPush`). `folds.ts` imports them,
   keeps every export and its behaviour; `showFolds`/`setHiding` stay defined in `folds.ts`.
3. `foldView.ts`: `foldDecorations` and the gutter markers generic; export `paneFoldView`; the merge path calls it.
4. `columnFolds.ts`: `columnChanges` (design §1: each `unchangedOnLeft`/`unchangedOnRight` thread line → one-line change
   in both columns; `removed`/`added` thread lines skipped — they lie inside a difference; duplicates dropped; sorted
   by left start, then right start; every shown kind counts — open, collapsed, draft); `rangeRuns` =
   `columnRuns(columnChanges(…), docs)`; `ownerSteps` reduces `showSteps` → `shown`, `setSteps` → the value, and a
   selection change → `reveals(…, "left")` in the same transaction (as `folds.ts:145-150`); `mirrorSteps` only takes
   `setSteps`; `renewSpec` = `setSteps({ runs, hiding: hidingAll(runs, collapsed) })` + `leaveCollapsed`;
   `mirrorSpec` moves the right's selection only when the runs were replaced or a count grew (as
   `sideFoldPush`, `folds.ts:227-246`); `columnFoldExtension` as in the contract.

## Acceptance

- `git diff --stat` over the six merge test files in Read-only is empty, and `pnpm -C frontend test` passes them.
- Node, `columnFolds.test.ts`, one test per bug (design "Node unit tests" 1–17): runs from the differences per column
  before the first / between two / after the last; 4, 8, 16 lines kept next to each change and none at the file's
  edges, in both columns; a stretch under 2 lines hides nothing and a level equal to the one outside it is dropped; a
  thread on an unchanged line splits its stretch and keeps 4 lines around it in both columns — open, collapsed and
  draft alike; threads on removed or added lines change no run; a thread on the line after an insertion point sorts
  after the difference and stays shown; a step on a run shows its next step in both columns (owner then mirror); the
  right column numbers runs as the left does; on hides every run back to its start whatever steps were shown, off
  shows every line, in both columns; runs given at a renew replace the old ones and a mirror copy leaves counts
  alone otherwise; at a renew a cursor in lines that get hidden moves to the wave line's start and a selection with
  an end inside is dropped (left via `renewSpec`, right via `mirrorSpec`); counts that only shrink leave the right's
  cursor alone; a selection end strictly inside hidden lines shows every range holding it, from the left (same
  transaction) and from the right (`rightReveal`); select-all, the document's start and end, and a cursor on a wave
  line's edges reveal nothing; a search match inside hidden lines (`selectMatch` from `@codemirror/search`, or the
  selection it makes) reveals it; a selection on a difference's first line reveals nothing; every fold transaction is
  out of history.
- Each test fails on the bug it names (editor/ is not mutated: for three of them — thread edges, mirror copy, reveal
  from the right — paste the failing output after a one-line sabotage, then revert).

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`, `pnpm -C frontend fmt:check`.

## Skills

`skill://cm6-rules`, `skill://ts-conventions` (plus your autoloaded ones).
