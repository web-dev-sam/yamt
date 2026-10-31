# Slice line-ranges-editor — drag on the line numbers, GitLab's order, tint, a range's box and folds

Design: `docs/slices/briefs/line-ranges-design.md` option A (§0 "Editor facts", §1 "GitLab's order", "Drag", "Box,
badge, tint, collapse"). Request rules 1–5, 8. Facts with a source below are given; re-check only `[INFERENCE]`.

## Target

**Owned:** `frontend/src/editor/**`. You create `internal/diffOrder.ts`, `internal/diffOrder.test.ts`,
`internal/threadDrag.ts`, `internal/threadTint.ts`, `internal/threadTint.test.ts`; you change `range.ts`,
`internal/threadNumbers.ts` (+ test), `internal/threadRows.ts` (+ test), `internal/columnFolds.ts` (+ test),
`internal/threadHosts.ts`, `theme.css`, `rangeThreads.browser.test.ts`, `AGENTS.md`, and any other editor test that
builds a `ShownThread` (`line` → `place`).

**Read-only:** `frontend/src/ipc/**` (the domain build's `ThreadPlace`, `DiffLine`, `ShownThread`, `diffLineOf`,
`onePlace`, `sameDiffLine`, `isOneLine` are in the tree: `line-ranges-domain.md` Contract), `frontend/src/ui/**`.

**Needs:** the domain build committed. Runs beside the window build (`line-ranges-window.md`), which writes the ui
against the `RangeEvents` below.

**Typecheck while the window build runs:** errors are expected only in files under `src/ui/` (they still read `line`
until the window build lands); zero under `src/editor/`.

**Non-goals:** automatic scroll at a column's edge; keyboard or Shift+click selection; changing a range after it starts;
the merge and compare windows; anything in `ui/` (the hover reaches the editor through its own hosts, not through Vue).

## Contract

Fixed for the window build (`editor/index.ts` exports are unchanged in name):

```ts
// range.ts
export type RangeEvents = {
  readonly startThread: (place: ThreadPlace) => void; // on release of a gutter press; a one-line place for a press-release on one line
  readonly toggleThreads: (keys: readonly string[]) => void; // unchanged: a press on the count badge
  readonly hosts: (hosts: ReadonlyMap<string, HTMLElement>) => void; // unchanged
};
// RangeController.showThreads(threads: readonly ShownThread[]) — unchanged; ShownThread is ipc's { key, place, shown }
```

Internal shapes (yours to refine; the names below are what the design and the tests use):

```ts
// internal/diffOrder.ts — GitLab's one-column order over the reply's differences (pure)
export function orderIndex(differences: readonly Difference[], line: DiffLine): number;
export function lineAtIndex(differences: readonly Difference[], index: number): DiffLine;
/** The earlier of the two in GitLab's order is `start` (its DiffLine), the later `end` (its ThreadLine, keeping the
 *  column it was picked in); the same index gives `onePlace(press)`. */
export function placeBetween(differences: readonly Difference[], press: ThreadLine, pointer: ThreadLine): ThreadPlace;
/** `pointer` clamped to the unbroken run of shown lines around `press` (a collapsed run hides unchanged lines in both
 *  columns: one stretch of indices); a clamped unchanged end takes the pointer's column. */
export function shownEnd(differences: readonly Difference[], hiddenLeft: readonly LineSpan[], press: ThreadLine, pointer: ThreadLine): ThreadLine;
/** Per column, the lines to tint: unchanged in both, removed in the left, added in the right. */
export function placeSpans(differences: readonly Difference[], place: ThreadPlace): Readonly<Record<Column, readonly LineSpan[]>>;
/** The place's unchanged lines, one ColumnChange per stretch between differences. */
export function unchangedRuns(differences: readonly Difference[], place: ThreadPlace): ColumnChange[];

// internal/threadTint.ts — one StateField per column, set by one effect
export const showTint: StateEffectType<readonly LineSpan[]>;
export const threadTint: Extension; // Decoration.line({ class: "cm-thread-tint" }) + a gutterLineClass marker, class "cm-thread-tint"

// internal/threadDrag.ts
export function pointedLine(views: ColumnViews, differences: readonly Difference[], clientX: number, clientY: number): ThreadLine | null;
export class ThreadDrag { start(press: ThreadLine, event: MouseEvent): void; destroy(): void; }

// internal/threadHosts.ts
new ThreadHosts({ views, columns, hovered: (key: string | null) => void }) // pointerenter/pointerleave on each host it creates

// internal/threadNumbers.ts
export type NumberPress = { readonly kind: "drag"; readonly line: ThreadLine } | { readonly kind: "toggle"; readonly keys: readonly string[] };
```

Order formulas (0-based `Difference` lines): unchanged `(l, r)` → `l` + the `right.len` of every difference `d` with
`d.left.start + d.left.len ≤ l`; removed `l` in `d` → `l` + the `right.len` of the differences before `d`; added `r` in
`d` → `d.left.start + d.left.len` + the `right.len` of the differences before `d` + `(r − d.right.start)`. Example on
board.ts (`frontend/fixtures/range/review.json` `files[7]`: `d0` 19+1/19+2, `d1` 179+0/180+3, `d2` 199+1/203+1):
unchanged 196/200 → 196 + 2 + 3 = 201; unchanged 198/202 → 203; removed 199 → 204; added 203 → 205.

## Change

1. `diffOrder.ts` and `diffOrder.test.ts` (node). Tests, each named by the bug it catches: the order lists an
   unchanged line once and a change's removed lines before its added ones, with pure additions and removals at the
   file's first line and last line (catches added-before-removed, an off-by-one at an edge); `lineAtIndex(orderIndex(x))
   === x` for every line of a fixture with all difference shapes; `placeBetween` gives one place dragged up or down,
   the end keeps its picked column (`unchangedOnLeft` vs `unchangedOnRight`), and press = pointer gives `onePlace`; a
   one-column drag from an unchanged line to an added line spans the change's removed lines (rule 2); `shownEnd` stops
   at the last shown line before a hidden stretch going down and going up, and a pointer on a hidden line clamps the
   same; `placeSpans` and `unchangedRuns` split at every difference, for an in-column and a both-sides place.
2. `threadTint.ts` (+ node test: tinted lines and their gutter cells carry the class; a new set replaces the old; an
   empty set clears). `theme.css`: `.cm-editor .cm-line.cm-thread-tint` and `.cm-editor .cm-gutterElement.cm-thread-tint`
   get `background-image: linear-gradient(var(--color-selection), var(--color-selection))` (`--color-selection`:
   `pane.ts:98`), a layer over a difference's own background colour.
3. `threadNumbers.ts`: the gutter `mousedown` handler keeps today's guards (`:109-124`: left button, a number cell,
   not a wave, `pressedLine` not null) and returns `true` (no native selection) `[INFERENCE: @codemirror/view's gutter
   calls preventDefault when a handler returns true; check it in node_modules and say so]`; the controller gets
   `(view, line, onBadge, event)`. `numberPress` → `drag` or `toggle`. `lineCounts` counts by
   `shownLine(thread.place.end)`. Test updates.
4. `threadDrag.ts`: `pointedLine`: the column whose `view.dom` x range holds the pointer (in the strip, the half it is
   in); y clamped into that column's `scrollDOM` box; `lineBlockAtHeight(y − view.documentTop)` → a text line of the
   file (`pressedLine`'s rule) → `anchorAt(differences, column, line)`; over a thread row, below the last line or in an
   empty column, the other column at that height by the same rule; else `null`. `ThreadDrag.start` adds, in the capture
   phase, `pointermove` and `pointerup`/`pointercancel` on `document`, `keydown` on `document` (Escape: preventDefault,
   stopPropagation, cancel), `scroll` on both columns' `scrollDOM` (recompute from the last pointer position), `blur`
   on `window` (cancel); release, cancel and `destroy` remove all of them. A null `pointedLine` keeps the last end.
5. `threadHosts.ts`: `hovered` on `pointerenter`/`pointerleave` of each host (`#create`), removed with the host.
6. `threadRows.ts`: a row by `place.end` (`placeOf`, `shownColumn(place.end)`); tests: a range's row sits under its
   end; two ranges ending on one line share a row.
7. `columnFolds.ts`: `columnChanges` takes `unchangedRuns(differences, thread.place)` of every shown thread (any shown
   kind, drafts included, plan §2 #126), sorts them by left start, merges overlapping or touching runs, then the
   differences (which never overlap them); a helper gives the left column's hidden lines as `LineSpan`s
   (`hiddenIn` + `displayed`). Tests: every unchanged line of a range stays shown under collapse, split across a
   difference; two overlapping ranges merge so neither's lines hide (without the merge `columnRuns` starts a run inside
   the longer one, `foldRuns.ts:25-30, 86-101`); today's one-line tests with `onePlace`.
8. `range.ts`: wires it: `#pressed` → toggle, or `ThreadDrag.start` with the pressed `ThreadLine` and the hidden left
   lines read at the press; on move, the tint of `placeBetween(press, shownEnd(…))`; on release,
   `events.startThread(place)`; on cancel, the drag's tint goes. The tint dispatched to each column is the union of the
   drag's place, every `shown: "draft"` thread's place and the hovered host's thread place (dropped when that key is not
   in the last `showThreads`); dispatch only when a column's spans change.
9. `rangeThreads.browser.test.ts` (WebKit, `pnpm -C frontend test:browser`), with a probe case whose differences hold a
   one-sided and a two-sided change:
   - "a press and release on one line number starts a one-line thread on release, nothing on press" (replaces `:297`;
     the badge test in it stays);
   - "a drag over four right-column numbers across unchanged and added lines tints them and the change's removed lines
     on the left, and starts the range on release";
   - "a drag from a removed line on the left to an added line on the right starts a both-sides range; upwards gives the
     same place";
   - "Escape during a drag starts nothing and clears the tint" (held drag: dispatched `mousedown` on the cell, then
     `pointermove`, then Escape, then `pointerup`);
   - "a scroll during a drag moves the end to the line under the pointer" (held drag; `scrollTop` changed, `scroll`
     dispatched, then `pointerup`);
   - "a drag selects no text in either column" (`userEvent.dragAndDrop` from one number cell to another; both views'
     selections unchanged and `document.getSelection()` collapsed);
   - "a drag stops at a collapsed run's wave" (collapsed option on; a drag past the wave ends on the line above it);
   - "the pointer over a thread's box tints its lines in both columns; leaving clears them" and "a draft's lines stay
     tinted";
   - keep "an added file's empty left column and the empty line after a last newline start no thread" (`:368`).
10. `editor/AGENTS.md`: the range threads paragraph (`:19`) names `diffOrder.ts`, `threadDrag.ts`, `threadTint.ts`, the
    place's two ends and the hover through the hosts.

## Acceptance

- `pnpm -C frontend test src/editor` → all pass (paste the summary line and the new test names).
- `pnpm -C frontend test:browser src/editor/rangeThreads.browser.test.ts src/editor/range.browser.test.ts` → all pass
  (paste them). If WebKit cannot launch, say so verbatim (VF5).
- `pnpm -C frontend typecheck` → zero errors under `src/editor/`; the remaining ones only under `src/ui/` (paste counts).
- `pnpm -C frontend exec oxlint --type-aware src/editor` clean.
- `editor/` is not mutated (VF7): each test above names the bug it catches, and for `diffOrder.ts` paste one hand
  mutation per formula (e.g. added before removed) and the failing test it trips, then restore.

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://comment-policy`, `skill://risk-register` (RK34, RK35; new RK50,
RK51 in the design §5).
