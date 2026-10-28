# Request — the diff window collapses unchanged lines behind the wave, with the merge window's toolbar toggle

Settled with the owner on 2026-10-28 (session 32); details by the orchestrator as owner (OR13), copied from the merge
window's rules (plan §2 #63, #64, #68) where marked. A design may refine a detail it names, never reopen a rule.
Facts: `.omp/run/notes/PlanScoutRangeList.md` part (B) (path:line at main `15ab31c`). "Diff mode" is the range window
(`yamt --diff=<a>..<b>`).

## Owner's words

- "for diff mode: I also want the collapse button like in the conflict resolver"

## Rules

1. **Button.** The range window's header (`RangeView.vue:51-79`) gains the merge window's toggle right after Previous
   and Next: "Collapse unchanged fragments", Lucide `chevrons-down-up`, a pressed look and `aria-pressed` while on; it
   leaves the keyboard where it was (#68). Disabled while the file shows no columns (binary, too large, …), as the
   arrows are. The range window has no right-click menu to hide it (non-goal).
2. **Runs and steps as #63, over two columns.** When a file opens, every run of lines outside the differences (before
   the first, between two, after the last) is computed per column from the reply's differences; up to three nested
   hidden ranges keep 4, 8 and 16 lines next to each change, none at the file's top and bottom edges; a range hides
   only when it covers at least 2 lines in that column; a step whose hidden lines equal the step outside it is
   dropped. The outermost hidden range shows as one line with the wave and no line number.
3. **Wave as #63/#64.** WebStorm's wave, colour and hover (1 px → 2 px in both columns and the strip, hand pointer),
   drawn across each column's line-number gutter and text and the strip between them as one unbroken line (#64's
   phase rule); a click on any part of a run's wave, the strip's part included, shows the next step in both columns;
   the keyboard stays where it was.
4. **Threads are never hidden** (orchestrator: a review window must never hide a comment). A line that holds a thread
   (or a new thread being written) counts as a change when runs are computed, so it shows with its 4 lines of context.
   Runs are computed when the file opens and each time collapsing turns on, from the differences and the threads then;
   a thread added later sits on a shown line and stays shown; a deleted thread's lines stay shown until the next open
   or on.
5. **On and off as #68.** On (the default): every run collapses back to its start, whatever clicks had shown. Off: every
   hidden line shows, no wave. Files opened later follow the current state. A cursor or selection inside lines that
   get hidden moves to the wave line's start / is dropped; the left column's top line stays where it is on screen and
   the right column lines up with it at once.
6. **Find and selection as #63.** A Ctrl/Cmd+F match or a selection end strictly inside hidden lines shows every hidden
   range holding it in both columns; select-all, Ctrl/Cmd+Home/End and the arrow keys do not (the cursor stops once on
   the wave line). Previous/Next change never lands in hidden lines (changes are never hidden).
7. **One stored choice** (orchestrator, vision 2: one fact "collapse unchanged lines" in one place): the range window
   reads and writes the merge window's stored choice (`ui/collapsing.ts`, `yamt.collapse.unchanged`; anything but a
   stored "off" means on). Turning it off in one window shows it off in the other at its next start. [INFERENCE: both
   windows share the app's storage, as the file list's list/tree choice already does, `fileListMode.ts:8`.]
8. **Unchanged**: the merge window's collapsing; the compare window (`yamt --diff` without a range): its columns are
   editable and recompute their differences on every edit, which the read-only range columns never do (#106).

## Acceptance

WebKit fixture (`?range`) and the real app on `scripts/range-repo.sh` (a long file with distant changes): at open the
unchanged stretches sit behind one wave across both columns and the strip; clicks show 4, 8, then the rest in both
columns; hover thickens the whole wave; the toggle shows everything and back, resetting what clicks had shown; the
choice survives a restart and matches the merge window's; a thread on an unchanged line in a long stretch stays shown
with its context, at open and after off → on; Ctrl/Cmd+F to a hidden line shows it; Previous/Next unaffected; the merge
window's collapsing behaves as before (its tests unchanged). Every editor rule tested; `just check` passes; dark and
light.

## Non-goals

Collapsing in the compare window; a right-click menu for the range header; remembering what clicks showed; collapsing
around AI edit diffs (`EditDiff.vue`).

## Slice graph (proposal; the session's orchestrator refines it)

| row | slice                                                                                                                                                        | owner    | owns (coarse)                                                                                          | needs |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------ | ----- |
| 1   | design: the fold code serving two columns without a second copy of #63's rules; thread lines as run edges; the frame's measure and scroll with hidden ranges | designer | read-only                                                                                              | —     |
| 2   | editor: two-column folds in `RangeController` (`skill://cm6-rules`)                                                                                          | web-impl | `editor/range.ts`, the compare frame/strip/views, `editor/internal/fold*`, `wavePhase.ts`, their tests | 1     |
| 3   | window: the toggle in the range header, the stored choice reaching the controller                                                                            | web-impl | `ui/RangeView.vue`, `ui/useRangeController.ts`, `ui/rangeStore.ts`, `ui/collapsing.ts` (shared now)    | 1     |
| 4   | final run: `just check`, WebKit, real app                                                                                                                    | verifier | —                                                                                                      | 2, 3  |

Rows 2 and 3 run side by side once the design fixes the contract (e.g. `RangeOptions.collapsed` plus
`RangeController.setCollapsed(on)`, the merge controller's shape, `editor/index.ts:58,224-227`). If the design sizes
row 2 above one implementer (~25 files, ~1,500 lines), split it.

## Facts and risks for the design

- The fold code is three-pane today: `foldRuns(chunks, docs)` takes 3-way `Chunk`s and `Pane`
  (`foldRuns.ts:17-21,69`); `FoldFields` has a `center` authority that the sides mirror (`folds.ts:27-31,255-302`);
  `Folds` needs `WaveHosts` (three panes, two strips, `wavePhase.ts:7-8`); `setCollapsed` dispatches on the centre view;
  the merge `Frame` and minimap read `FoldFields`. Pane-agnostic leaves: `foldSelection.ts`, `folding.ts`, `FoldLine`,
  `WaveMarker`, `waveTheme`, the level growth in `foldRuns.ts`.
- The range columns: `createReadOnlyColumnViews(..., { extensions })` and `CompareFrame({ fields, anchors })`
  (`range.ts:57-76`; a field listed in `fields` re-measures, `compareFrame.ts:96-104`); `CompareFrame` has no `realign`
  (the merge `Frame` does, `frame.ts:96`); differences are `Difference { left, right }`, not `Chunk`. Both are shared
  with the compare window, which must keep working unchanged.
- Thread rows are block widgets measured by a `ResizeObserver` (`threadHosts.ts:30`); hidden ranges beside them must
  keep the aligned bands right.
- #64's wave-phase rule and #82's far-scroll rule (WebKitGTK pulls back a far `scrollTop`) apply to the new wave and
  to every reveal.
