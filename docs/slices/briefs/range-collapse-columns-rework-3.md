# Slice RangeFoldColumnsR3 — fix round 3 (owner-approved, Gate B #1692): one retry per scroll-led sync

Board "Range collapse" row 4, fix round 3 (session 35; the owner allowed a third round for this block only). Round 2:
`RangeFoldColumnsR2`, commit `c95743a`, brief `range-collapse-columns-rework-2.md`; notes
`.omp/run/notes/RangeFoldColumns.md` "Fix round 2". Its re-check found one block:

**#1691 (correctness, block)** `scrollSync.ts:141` — "`#endEchoes` arms itself again with no limit: the retry's own
`sync` makes the moved pane an echo again, and the next `#endEchoes` retries again. A pane the user scrolls on every
frame, starting in the frame after another pane's sync, is therefore written back to the old source's position every
frame for as long as the input lasts. Example: flick Result or the left column with touchpad momentum, then scroll
Remote or the right column before the momentum ends. That pane stays frozen for the whole gesture, in both windows.
Before this commit it took the lead on the second frame. The same missing limit lets a follower that WebKitGTK pulls
back on every write cause a re-sync every frame without end." Fix: allow one retry per sync from a scroll event —
the sync started by `#endEchoes`' `follow` skips the moved check when its own echo window ends (e.g. a `#retried` flag
cleared by the next sync from a scroll event). Add a `scrollSync.test.ts` case: right scrolled and synced, then the
left scrolled by 100 in each of two frames — fails on `c95743a`, expects the left to lead by the second frame; and a
case for a follower pulled back on every write: one retry, then no more frames requested.

## Target

Owned: `frontend/src/editor/internal/scrollSync.ts`, `frontend/src/editor/internal/scrollSync.test.ts`.
Read-only: everything else. Existing tests unchanged (add, never edit); merge tests byte-unchanged.

Non-goals: anything but #1691.

## Acceptance

- Both new tests fail on `c95743a` (paste) and pass after; R2's three tests still pass.
- WebKit, range fixture (`just app-session start-fixture --range-case review --threads seeded`), dark: the #1689 repro
  `/tmp/yamt-r1/ctrlend.sh <your tree> <session>` still ends lined up ([2655, 3114] or equal), Ctrl+Home [0, 0].
- WebKit, both windows: scroll one pane with repeated wheel steps (a WebDriver wheel action of several steps), then
  immediately wheel the other column/pane: the second one takes the lead within one frame of its first step (record the
  scrollTops per step).
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
