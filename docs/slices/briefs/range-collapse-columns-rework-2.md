# Slice RangeFoldColumnsR2 — fix round 2: the columns stay lined up on Ctrl+End after a find

Board "Range collapse" row 4, fix round 2 (session 35; the last round this slice may have). Rounds so far:
`RangeFoldColumns` (`d6ab2b7`, brief `range-collapse-columns.md`) and `RangeFoldColumnsR1` (`a23dcba`, brief
`range-collapse-columns-rework-1.md`); notes `.omp/run/notes/RangeFoldColumns.md`. Both re-checks of round 1 passed.
One block remains:

**#1689 (block)** — a regression of this feature. Range fixture page (`just app-session start-fixture --range-case
review --threads seeded`, MiniBrowser 1600×1000), `src/board/board.ts`: click a right-column line, Ctrl+F
"renameColumn", Enter, Escape (scrollTops [888, 908]; one run revealed in both columns), then Ctrl+End in the right
column → scrollTops **[0, 3114]**: the right at its end, the left at the top (lines 1–47 against 410–488), and it stays
there. On `f08c5b9`'s tree (no range folds) the same steps give [8555, 9015], lined up. Present on `d6ab2b7` and
`a23dcba` (reproduced by the orchestrator). Repro script: `/tmp/yamt-r1/ctrlend.sh <root> <session>` with its probes
in `/tmp/yamt-r1/` (`openboard.js`, `midline.js`, `find.js`, `state.js`; `run.sh` reads a probe in a session's page;
pass your worktree as `<root>`).

Leads from the correctness reviewer (reading only, `[INFERENCE]`): (1) the right column's `revealOnOwner`
(`folds.ts:222-240`) sends `showSteps` to the left, then `scrollIntoView({ y: "center" })` on the right; the left grows
without a `scrollSnapshot`, so CodeMirror's scroll-anchor correction may fire a left scroll event a frame after the
sync while the left is still an echo (`scrollSync.ts:120-129`); (2) the follower's far write on Ctrl+End goes through
`exactScroll.placeFarScroll` (`exactScroll.ts:41-63`); (3) the anchors: `compareFrame.ts:59-62` sorts by left only and
`targets` (`scrollSync.ts:29-46`) scans for right ≥ y — a write of 0 or NaN would point there. Suggested first step:
log `sync`'s source, `middle(source)`, each follower's written `scrollTop` and the left's scroll events across
Find → Escape → Ctrl+End.

## Target

Owned: `frontend/src/editor/internal/scrollSync.ts`, `frontend/src/editor/internal/scrollSync.test.ts`,
`frontend/src/editor/internal/compareFrame.ts`, `frontend/src/editor/internal/compareFrame.test.ts`,
`frontend/src/editor/internal/exactScroll.ts`, `frontend/src/editor/internal/exactScroll.test.ts`,
`frontend/src/editor/internal/folds.ts`, `frontend/src/editor/internal/columnFolds.ts`,
`frontend/src/editor/internal/columnFolds.test.ts`, `frontend/src/editor/internal/rangeFolds.ts`,
`frontend/src/editor/internal/rangeFolds.test.ts`, `frontend/src/editor/range.ts`.

Read-only: everything else. Merge tests stay byte-unchanged and passing (`wavePhase.test.ts`, `foldRuns.test.ts`,
`folds.test.ts`, `foldView.test.ts`, `foldSelection.test.ts`, `editor/strips.browser.test.ts`,
`editor/compare.browser.test.ts`); existing `scrollSync.test.ts`/`exactScroll.test.ts` expectations unchanged (add,
never edit). If the cause sits in a file you do not own, stop and say which file and line in `deviations_from_brief`
with the exact change; do not work around it elsewhere. The compare window and the merge window behave as before.

Non-goals: anything but #1689; logging left in the code.

## Acceptance

- The cause named with evidence (the logged values that show it), in `smoke_evidence`.
- A node test on the pure part that fails before the fix (paste) and passes after; if the cause is DOM-only and no
  pure part exists, say so and why.
- WebKit, the repro on your tree, dark: after Ctrl+End the columns are lined up (left at its end, the last lines on
  both sides facing each other); also Ctrl+Home afterwards lines both up at the top; then the same steps with
  collapsing off (header toggle) — lined up. Screenshot paths.
- WebKit, merge fixture page (`just app-session start-fixture`): a find in the left pane to a hidden line, Escape,
  Ctrl+End in that pane — the three panes lined up, as on `f08c5b9`'s tree (`/tmp/yamt-r1/tree-f08c5b9`).
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
