# Slice RangeFoldCoreR1 — fix round 1: one copy of the mirror and reveal rules; threads from the right column tested

Board "Range collapse" row 2, fix round 1 (session 35). Round 1: `RangeFoldCore`, commit `f08c5b9`, brief
`docs/slices/briefs/range-collapse-core.md` (read it whole: its Contract still holds), notes
`.omp/run/notes/RangeFoldCore.md`. Reviews: boundary fail, correctness fail. The blocks, verbatim (promoted
`should`/`nit` marked):

1. **#1672 (boundary, block)** `columnFolds.ts:144` — "The rule for when the mirror's cursor moves (only when a count
   grew, so a step that only shows more lines leaves the cursor where it is) now exists twice. `mirrorSpec` writes it
   as `steps.hiding.some((count, run) => count > (before.hiding[run] ?? 0))`. `sideFoldPush` (folds.ts:192) writes the
   same rule inverted, as `counts.every((count, run) => count <= (before[run] ?? 0))`. No shared function holds it."
   Fix: one export in `foldSteps.ts` (e.g. `leaveCollapsedAfter(selection, before, steps, pane): EditorSelection |
   null` — null unless a count grew, else `leaveCollapsed`), called by `sideFoldPush` and `mirrorSpec`; `mirrorSpec`
   calls `leaveCollapsed` directly only when the runs were replaced.
2. **#1673 (boundary, block)** `columnFolds.ts:172` — "`revealFromRight` copies `sideReveals` (folds.ts:224-242) line
   for line: it returns early unless `selectionSet`, dispatches the reveal on the owner view, then calls
   `scrollIntoView(selection.main, { y: "center" })` on its own view." Fix: one exported listener in `folds.ts` (e.g.
   `revealOnOwner(reveal: (state: EditorState) => TransactionSpec | null, owner: () => EditorView): Extension`);
   `sideReveals` and the right column both use it.
3. **#1674 (boundary, should → promoted)** `columnFolds.ts:42` — "`ownerSteps.update` repeats `foldField`'s
   same-transaction reveal (folds.ts:103-107): build `hiddenLevels(next.runs, next.hiding)`, then apply each
   `reveals(…)` result through `shown`." Fix: `revealed<P>(steps, pane, selection): FoldSteps<P>` in `foldSteps.ts`,
   called by both field updates.
4. **#1675 (boundary, should → promoted)** `foldRuns.ts:11` — "`ColumnChange = Readonly<Record<Column, LineSpan>>`
   drops the `LeftLine`/`RightLine` brands that both of its sources carry (`Difference.left/right`,
   `ThreadLine.left/right`). If `unchangedLine` (columnFolds.ts:63) swapped its left and right lines, it would still
   compile." Fix: `type ColumnChange = Pick<Difference, "left" | "right">` (or an equivalent that keeps both brands).
5. **#1677 (correctness, block)** `columnFolds.test.ts:144` — "Every thread in the tests comes from the `thread()`
   helper, and that helper only builds `unchangedThreadLine("left", …)`, so `unchangedOnRight` threads … are never
   tested. If `columnFolds.ts:62-63` treated `unchangedOnRight` as one-sided and returned null for it, all 18 tests
   would still pass." Fix: `thread()` takes a column; the thread-splits test and the two-threads-on-one-line test run
   once per column with `unchangedThreadLine(column, { left, right })`, asserting the same waves each time; the
   duplicates test uses one thread from each column on the same line.
6. **#1678 (correctness, nit → promoted, deletion only)** `columnFolds.test.ts:389` — "a selection on a difference's
   first line reveals nothing" passes with `CONTEXT_LINES` 0 or the reveal removed; delete it.

## Target

Owned: `frontend/src/editor/internal/foldRuns.ts`, `frontend/src/editor/internal/foldSteps.ts`,
`frontend/src/editor/internal/folds.ts`, `frontend/src/editor/internal/columnFolds.ts`,
`frontend/src/editor/internal/columnFolds.test.ts`.

Read-only: everything else. A dependent slice (`RangeFoldColumns`) is building on round 1's contract right now in its
own copy: **every exported name and signature in the round-1 brief's Contract stays as it is** (`ColumnChange` may
change its definition per item 4, keeping its name; no consumer outside your files uses it). The merge window's fold
tests stay byte-unchanged and passing (`foldRuns.test.ts`, `folds.test.ts`, `foldView.test.ts`,
`foldSelection.test.ts`, `wavePhase.test.ts`, `editor/strips.browser.test.ts`).

Non-goals: anything outside the six items.

## Acceptance

- Items 1–3: each rule has one definition that both windows call (grep evidence: the old inline expressions are gone).
- Item 4: swapping `left` and `right` in `unchangedLine` fails `pnpm -C frontend typecheck` (paste the error, revert).
- Item 5: making `unchangedOnRight` one-sided (return null) fails the new per-column tests (paste, revert).
- Merge fold tests byte-unchanged; `pnpm -C frontend test`, `typecheck`, `lint`, `fmt:check`, `unused` pass.

## Skills

`skill://cm6-rules`, `skill://ts-conventions` (plus your autoloaded ones).
