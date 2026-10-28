# Slice RangeFoldColumnsR1 — fix round 1: one realign rule for both windows, one wave-start and phase rule, the missing evidence

Board "Range collapse" row 4, fix round 1 (session 35). Round 1: `RangeFoldColumns`, commit `d6ab2b7`, brief
`docs/slices/briefs/range-collapse-columns.md` (read it whole: its Contract and Acceptance still hold), notes
`.omp/run/notes/RangeFoldColumns.md`. Both reviews failed. The blocks, verbatim (promoted `should`s marked):

1. **#1679/#1686 (block)** `compareFrame.test.ts:456` builds `{ left: change, right: change }` from plain numbers;
   the core's fix round (`9ccae0f`) made `ColumnChange` `Pick<Difference, "left" | "right">` with branded line
   ranges, so `pnpm -C frontend typecheck` fails. Fix: take the change from a `loadCompareFixture` reply's
   `comparison.differences`, as `rangeFolds.test.ts:153-170` does; no cast.
2. **#1680 (boundary, block) + #1688 (correctness, should → promoted)** `compareFrame.ts:115` — "Deviation 1 adds a
   second rule for which pane leads the scroll sync, and a second piece of state that decides it. `CompareFrame` keeps
   `#realignFrom` and only calls `follow` at the start of the next frame, so it overrides a clamped scroll event. The
   merge's `Frame.realign` (frame.ts:96-98) still calls `follow("center")` at once, and the same clamped side-pane
   event can still win there." Fix: the pending-follow rule moves into `ScrollSync` (`scrollSync.ts:68-120`): a
   `follow(source)` stays the source until the next `sync`, and a non-echo scroll event before then does not replace
   it. `CompareFrame.realign` and the merge's `Frame.realign` are then one-line `follow` calls; `#realignFrom` and its
   frame-start branch go. `scrollSync.test.ts` gets the clamped-event case (a follow, then another pane's scroll
   event, then the sync: the followed pane leads). The merge gains the same fix (its #68 rule: the sides line up with
   the middle at once).
3. **#1681/#1687 (block)** — missing acceptance evidence: WebKit step h (reload with the stored choice off: the file
   opens with every line shown), step f in the light theme (a measurement, not only a screenshot), and the merge
   fixture checks (a click shows the next step, toggle off/on, hover thickens the whole wave across three panes and
   both strips) — the only DOM evidence that the reshaped `WavePhases`/`WaveLayer`/`wavePaints` behave as before.
   Also: `/tmp/yamt-rfc/m-on-after.png` shows the merge's Remote pane at line 363 while the Result shows 93 after a
   toggle on. Fix: run h, f-light and the merge steps (dark), with the window focused, on your commit **and** on
   `f08c5b9`'s tree (a scratch `git worktree`/`git archive` under `/tmp`), paste measurements and screenshot paths;
   after item 2 the merge toggle from a deep scroll must keep the Result's top line and line the sides up — show it,
   and say whether the base tree showed the misalignment.
4. **#1682 (boundary, should → promoted)** `wavePhase.ts:154` — "`ChainPhases.#measure` restates the phase rule (a
   pane's snapped scroller left edge plus its chain end, then `wavePhase`) that `panePhases` (:69-76) also holds.
   `layoutOf` and `panePhases` now have no app caller, only the merge's `wavePhase.test.ts`." Fix: one generic
   `chainPhases(first, next, scrollers)` (or equivalent) returning each pane's `WavePhase | null`, called by
   `ChainPhases.#measure`; `panePhases`/`layoutOf` thin mappings onto it (as `wavePaints` maps onto `joinPaints`), so
   `wavePhase.test.ts` (byte-unchanged) pins the path the app runs.
5. **#1683 (boundary, should → promoted)** `rangeFolds.ts:18` — "`waveTops` re-derives where a wave sits. It copies
   the core's private `hiddenIn` (`columnSteps` + `hiddenLevels`, columnFolds.ts:113-116), the merge's `startsIn`
   rule `displayed(fold, pane)?.from` (folds.ts:81-83) and `waveRows`' `lineBlockAt(start).top` (geometry.ts:58-71)."
   Fix: one generic `waveStartsIn(folds, pane)` beside `displayed` in `foldRuns.ts`; `folds.ts` `startsIn` and the
   range's waves call it (through an exported core helper for the range's displayed folds); one rule from starts to
   tops (`geometry.ts`) used by `waveRows` and `columnWaves`.
6. **#1684 (boundary, should → promoted)** `ui/rangeThreads.ts:137` — "`toggle` was compressed to fit the 300-line
   cap … The next addition to rangeThreads.ts will again be squeezed in." Fix: restore the plain add/delete loop and
   move the open-set rules (`open`, `toggle`, `boxOf`'s open lookup) into their own module held by `rangeThreads`, as
   it holds `rangeAdds.ts` (name it `rangeOpen.ts` or as fits), with its tests moved or added beside it.

## Target

Owned: `frontend/src/editor/internal/scrollSync.ts`, `frontend/src/editor/internal/scrollSync.test.ts`,
`frontend/src/editor/internal/frame.ts`, `frontend/src/editor/internal/compareFrame.ts`,
`frontend/src/editor/internal/compareFrame.test.ts`, `frontend/src/editor/internal/wavePhase.ts`,
`frontend/src/editor/internal/geometry.ts`, `frontend/src/editor/internal/foldRuns.ts`,
`frontend/src/editor/internal/folds.ts`, `frontend/src/editor/internal/columnFolds.ts`,
`frontend/src/editor/internal/rangeFolds.ts`, `frontend/src/editor/internal/rangeFolds.test.ts`,
`frontend/src/editor/internal/columnFolds.test.ts`, `frontend/src/editor/AGENTS.md`, `frontend/src/ui/rangeThreads.ts`,
`frontend/src/ui/rangeThreads.test.ts`, `frontend/src/ui/rangeOpen.ts` (new), `frontend/src/ui/rangeOpen.test.ts` (new).

Read-only: everything else. The merge window's tests stay **byte-unchanged and passing**: `wavePhase.test.ts`,
`foldRuns.test.ts`, `folds.test.ts`, `foldView.test.ts`, `foldSelection.test.ts`, `editor/strips.browser.test.ts`,
`editor/compare.browser.test.ts`; existing `scrollSync.test.ts` expectations unchanged (add, never edit). The compare
window stays unchanged. Docs (`docs/architecture.md`, the project map) are the orchestrator's: report renamed or new
names in `deviations_from_brief`.

Non-goals: anything outside the six items.

## Acceptance

- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused` pass; `git diff --stat d6ab2b7` over the
  Read-only merge tests is empty.
- Item 2: the new `scrollSync.test.ts` case fails with the old immediate-`follow` behaviour (paste, revert); grep shows
  no `#realignFrom` and both realigns as `follow` calls.
- Items 4–5: grep shows one phase rule and one wave-start rule (the old inline expressions gone); a sabotage of each
  shared helper fails both a merge test and a range test (paste, revert).
- Item 6: `rangeThreads.ts` well under 300 lines; the open-set tests pass in their new home; `ui/` tests kill the
  mutants on your `ui/` lines (Stryker on `rangeThreads.ts` and the new module, SP5).
- Item 3: the WebKit evidence listed there, dark and light where stated, with paths.

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`,
`pnpm -C frontend fmt:check`, `pnpm -C frontend unused`.

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
