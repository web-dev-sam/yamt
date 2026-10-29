# Slice SearchGoTo — go to a match in a pane on both controllers; the merge Result's live line-up

Board "Search" row 3 (session 35). Request `docs/slices/request-search.md` (read it whole: rules 8 and 10 are yours);
decision `docs/plan.md` §2 **#127** (read it whole), #126 (the reveal you rely on), #82 (far scrolls). Design:
`.omp/run/notes/SearchDesign.md` option A §3.3 (the contract and internals) and §3.6 "Editor tests (B3)" (given facts).
You build the designer's "B3". Beside you, `SearchCore` builds `frontend/src/search/` (no shared files). The window
build after you imports exactly the surface below.

## Target

Owned: `frontend/src/editor/index.ts`, `frontend/src/editor/range.ts`, `frontend/src/editor/internal/goTo.ts` (new),
`frontend/src/editor/internal/goTo.test.ts` (new), `frontend/src/ui/useMergeController.ts`,
`frontend/src/ui/useMergeController.test.ts`, `frontend/src/ui/useRangeController.ts`,
`frontend/src/ui/useRangeController.test.ts`, `frontend/src/editor/AGENTS.md`.

Read-only: everything else (`findMatch.ts`, `folds.ts`, `columnFolds.ts`, `viewport.ts`, `MergeView.vue`,
`RangeView.vue` included). Docs are the orchestrator's.

Non-goals: the search panel, stores, search core, IPC; calling `goTo` from any view (a later build); a new reveal path
(the selection's own fold reveal covers a collapsed stretch, #126); `revealSpan` (it writes `scrollTop` directly).

## Contract (fixed; you may add, never change)

```ts
// editor/index.ts (exports)
export type { Pane as MergePane } from "./internal/geometry";            // "left" | "center" | "right"
export type PaneMatch = { readonly line: number; readonly from: number; readonly to: number }; // 0-based line, UTF-16 columns in it
export type MergeGoTo = { readonly pane: MergePane; readonly match: PaneMatch | null };   // null: only the keyboard
export type ResultLineUp = {
  readonly result: string;                                                     // snapshot().asShown()
  readonly changes: readonly Readonly<Record<MergePane, { readonly start: number; readonly len: number }>>[]; // center live, sides fixed; 0-based lines
};
MergeController.goTo(target: MergeGoTo): void;
MergeController.lineUp(): ResultLineUp;
MergeController.onResultChange(listener: (() => void) | null): void;  // after each Result transaction with docChanged
// editor/range.ts
export type RangeGoTo = { readonly pane: Column; readonly match: PaneMatch | null };
RangeController.goTo(target: RangeGoTo): void;

// ui/useMergeController.ts — MergeHandle gains (and re-exports MergePane, PaneMatch, MergeGoTo, ResultLineUp)
resultVersion: Readonly<ShallowRef<number>>; // bumped at every build and on onResultChange
lineUp(): ResultLineUp | null;               // null while no controller exists
goTo(target: MergeGoTo): void;               // kept while no controller exists, applied once right after the next build, never again on a rebuild
// ui/useRangeController.ts — RangeHandle gains (and re-exports RangeGoTo)
goTo(target: RangeGoTo): void;               // kept in Live, applied once in build() after parts.build; ShownRange picks "goTo"
```

## Change

1. `internal/goTo.ts`: `matchRange(doc, match)` clamps the line to the document and the columns to that line (a stale
   search never throws); `goTo(view, match)` dispatches find's `selectMatch(matchRange(…))` (`findMatch.ts:61`:
   selection + centred `scrollIntoView`, `select.search`) and then `view.focus()`; `match: null` only focuses;
   `changeLines(doc, span)` turns a `ChunkSpan` into a `LineRange` (an insertion point, a span ending mid-line at the
   document's end, CRLF; CM1).
2. `MergeController.goTo`/`lineUp`/`onResultChange`; `RangeController.goTo`. `editor/index.ts` stays ≤ 300 lines
   (move code to internals if needed).
3. `useMergeController`/`useRangeController`: the handle members above; the pending go-to rule.
4. `editor/AGENTS.md`: one line — the go-to is find's selection; the reveal is the fold fields' own.

## Acceptance

- Node, design §3.6 "Editor tests (B3)": `matchRange` clamps a line past the end and columns past the line end;
  `changeLines` for an insertion point, an end-of-document mid-line span and CRLF; a go-to selection on a collapsed
  Result reveals the run (the fold field with a selection transaction; and a side pane's through `sideReveal`); a
  `goTo` before build is applied once after build and not after a rebuild; `resultVersion` bumps on an edit and on a
  rebuild; the range `goTo` waits for load, hosts and the thread list. `ui/` tests kill the mutants on your `ui/`
  lines (Stryker, SP5).
- WebKit, throwaway (no new `*.browser.test.ts`: Playwright's WebKit cannot launch here, #1242): on the merge fixture
  page and the range fixture (`?range=review`), call the controller's `goTo` from a probe (or through the handle) to a
  match inside a collapsed stretch in each pane: the selection's text equals the match, the stretch shows, the pane is
  focused, the view lands on it from the top of a long file (#82). Paste values and screenshot paths.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused` pass (`unused` may flag the new handle members
  until the window build calls them: report it, do not add fake callers).

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://vue-conventions`, `skill://verification` (plus your autoloaded
ones).
