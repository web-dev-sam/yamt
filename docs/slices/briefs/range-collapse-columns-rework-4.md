# Slice RangeFoldColumnsR4 — repair 4: Ctrl/Cmd+End scrolls to the end with collapsing on

Board "Range collapse" row 4, repair round 4 (session 35). The final run (`RangeCollapseVerify`, notes
`.omp/run/notes/RangeCollapseVerify.md`) failed one step; the owner's Gate B answer for this feature ("Yes, run a third
repair pass", #1692) stands for repairing this slice's user-visible bugs (orchestrator, OR13: Gate B is asked once).
Earlier rounds: notes `.omp/run/notes/RangeFoldColumns.md` (rounds 1–3).

**#1693 (verifier, block)** — measured by the verifier, light theme, 1600×1000, range fixture
(`just app-session start-fixture --range-case review --threads seeded`), `src/board/board.ts`:

| tree                                                                     | failing / runs |
| ------------------------------------------------------------------------ | -------------- |
| HEAD `c0ccb3f`, collapsing on                                            | 10 / 20        |
| HEAD, collapsing off                                                     | 0 / 20         |
| pre-feature `f08c5b9` (`/tmp/yamt-r1/tree-f08c5b9`, no range collapsing) | 0 / 20         |

Every failure: the right column near the top (scrollTops [0, 13] or [0, 0]), the right cursor on line 17 or 18 after
a click; Ctrl+End → the right cursor goes to line 494 (the document's end) but **neither column scrolls** (the right
3102 px short of its end). Runs that started after a find had scrolled the columns to [888, 908] always passed
([2655, 3114]). So the reproducible case: collapsing on, click a right-column line near the top, Ctrl+End. Facts: the
last unchanged stretch after the last difference is hidden to the file's end (no context at the bottom edge, #63), so
the document's end is the end of a hidden range (an atomic, inline-replaced range drawn as the wave line);
`exactScroll.ts` lands far scrolls (#82); `ScrollSync` now retries once (rounds 2–3). Cause open.

## Target

Owned: `frontend/src/editor/internal/exactScroll.ts`, `exactScroll.test.ts`, `scrollSync.ts`, `scrollSync.test.ts`,
`foldView.ts`, `foldSteps.ts`, `folds.ts`, `columnFolds.ts`, `columnFolds.test.ts`, `rangeFolds.ts`,
`rangeFolds.test.ts`, `compareFrame.ts`, `compareFrame.test.ts`, `compareFocus.ts`, `frontend/src/editor/range.ts`
(all under `frontend/src/editor/internal/` unless a path is given).

Read-only: everything else. The merge window's tests stay byte-unchanged and passing (`wavePhase.test.ts`,
`foldRuns.test.ts`, `folds.test.ts`, `foldView.test.ts`, `foldSelection.test.ts`, `editor/strips.browser.test.ts`,
`editor/compare.browser.test.ts`); existing `scrollSync.test.ts`/`exactScroll.test.ts` expectations unchanged (add,
never edit). If the cause sits in a file you do not own, stop and name the file, line and exact change in
`deviations_from_brief`.

Non-goals: anything but #1693; logging left in the code.

## Acceptance

- The cause named with the logged values that show it.
- A node test on the pure part that fails before the fix (paste) and passes after; if the cause is DOM-only, say so
  and why.
- WebKit, range fixture, light **and** dark, on your tree: open `board.ts`, click a right-column line near the top,
  Ctrl+End → the right column at its end and the left lined up — **20 of 20 runs** (a loop, scrollTops per run);
  then Ctrl+Home → both at 0; the same from the left column; the #1689 repro (`/tmp/yamt-r1/ctrlend.sh`, clear the find
  field first) still lined up.
- WebKit, merge fixture (`just app-session start-fixture`), collapsing on: click a Result line near the top,
  Ctrl+End → the Result at its end, the sides lined up — 10 of 10; the same on `f08c5b9`'s tree for comparison.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
