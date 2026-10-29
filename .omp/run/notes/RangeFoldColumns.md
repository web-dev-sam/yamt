# RangeFoldColumns — notes (session 35)

Slice brief `docs/slices/briefs/range-collapse-columns.md`; web-impl, isolated, 29m25s, based on `494e10a` (before the
core's fix round). Patch `d6ab2b7` (base `98f48aa`), `.omp/run/patches/RangeFoldColumns.patch`; 21 files, +954 −142.

## Summary (implementer)

- The range columns and strip show the merge window's wave; clicks show 4, 8, the rest in both columns; hover
  thickens the wave in both columns and the strip; the header toggle reaches live controllers via `setCollapsed`.
- Unchanged-line threads are run edges; columns build only after the thread list was read once (a failed read
  builds too).
- Shared wave geometry: `chainEnds`/`ChainPhases` (`WavePhases` the merge's case), `joinPaints`, `WaveLayer`;
  `CompareFrame` optional `waves` and `realign`; `CompareStrip` paints waves only with `hovered`.
- A press on a wave's gutter cell starts no thread and shows no comment icon.

## Tests

`rangeFolds.test.ts` (chain edges, merge chain = `paneEnds`, `ChainPhases` write/remove, `columnWaves`, `joinPaints`);
`compareFrame.test.ts` (waves re-measured after a step, `realign` writes the other column, a clamped scroll before the
frame does not lead after `realign`, no waves without the part); `compareViews.test.ts` (own-column extensions);
`useRangeController.test.ts` (build options, toggle without rebuild, later file follows, waits for the list, failed
list builds, thread change never `setCollapsed`); `rangeThreads.test.ts` (`listed`, toggle only its own threads).

## Evidence (implementer)

- Merge/compare tests byte-unchanged; node 203 files / 2788 tests (on its base); typecheck, lint, fmt, knip clean.
- Sabotage: `realign` no-op, both columns `extensions("left")`, left join with the right shift, immediate `follow` —
  each fails its test.
- Stryker (`useRangeController.ts`, `rangeThreads.ts`): 293 killed, 10 survived, 7 no coverage; none on changed lines
  per the implementer (`useRangeController` body has no node coverage, holds `collapsed: store.collapsing`).
- WebKit fixture `?range=review&threads=seeded`, `board.ts`, 1600×1000: a (dark/light) join offsets 0.000 px, thread
  97–105 / 98–106 shown; b clicks 24/97 → 28/93 → 36/85 → all in both columns, focus kept, wave gutter press opens no
  draft; c hover 1 → 2 px in all three parts, pointer; d off/on keeps top line 101 at −2 px, right aligned first frame,
  cursor in line 140 → wave start; e thread on line 28 changes no wave until off → on, then 24–32 shown; f (dark only)
  Ctrl+F "renameColumn" reveals in both columns, select-all/Ctrl+End reveal nothing; g Next/Previous through the 7
  differences, no wave change. Screenshots `/tmp/yamt-rfc/`.
- **Not done:** h (reload with the choice off); f in light; merge clicks, hover and toggle with focus.

## Deviations

1. `CompareFrame.realign(source)` applies `follow` at the start of the next frame (a shrinking column fired a clamped
   scroll before the frame and led the sync); a test pins it. Accepted (the brief's "= follow" was a fact, the
   behaviour rule 5 holds).
2. `rangeThreads.ts` `toggle` rewritten shorter (300-line cap). 3. `followLive` helper (40-line cap).
3. Acceptance h, f light, merge checks incomplete. 5. Probes via `just app-session` + throwaway JS.

## Integration (orchestrator, after applying on `98f48aa`)

`pnpm -C frontend typecheck` fails: `compareFrame.test.ts:456` builds a `ColumnChange` from plain numbers; the core's
fix round (`9ccae0f`) branded it (`Pick<Difference, …>`), which the R1 brief wrongly said no consumer outside the core
used. Node tests 203 / 2790 pass; lint clean. Finding #1679.

## Open risks (implementer)

- `compareFrame.ts:113-129`: with another window focused, a deep-scroll collapse lost the top line in both windows,
  the merge window on `f08c5b9` too [#82 / `scrollSnapshot` interplay?].
- `range.ts:89`: the first renew runs before the language loads.
- `mirrorSpec` not exercised from a right-column cursor.

## Fix round 1 (`RangeFoldColumnsR1`, 17m19s, patch `a23dcba`, `.omp/run/patches/RangeFoldColumnsR1.patch`)

Blocks #1679–#1688. `ScrollSync.follow(source)` keeps the source until the next sync (a clamped scroll of another pane
no longer leads); `CompareFrame.realign` and the merge `Frame.realign` one-line `follow` calls, `#realignFrom` gone.
One phase rule (private `chainPhases` in `wavePhase.ts` for `ChainPhases.#measure` and `panePhases`; `layoutOf` only
snaps), one wave-start rule (`foldRuns.waveStartsIn`), one starts→tops rule (`geometry.waveTops`, used by `waveRows`
and `columnWaves`); `columnFolds.hiddenIn` exported. `ui/rangeOpen.ts` (`createRangeOpen`, `RangeOpen`, `StoredBox`):
each stored thread's box key and open state, the plain toggle loop; `rangeThreads.ts` 298 → 265 lines.
`compareFrame.test.ts:456` takes its change from a fixture reply (typecheck green).

Evidence: 204 files / 2795 tests; typecheck, lint, fmt, knip clean; merge tests byte-unchanged; `scrollSync.test.ts`
additions only. Sabotage: old echo-only rule → 2 tests fail (merge sync and range realign); `chainPhases`,
`waveStartsIn`, `waveTops` each fail merge and range tests. Stryker `rangeOpen.ts` 57/57, `rangeThreads.ts` 168 killed,
survivor :98 equivalent, others untouched lines. WebKit (MiniBrowser 1600×1000, focused): h off → reload all shown,
on → reload collapsed; f light: find reveals right 71/left 70, select-all and Ctrl+End reveal nothing; merge dark
on this tree and `f08c5b9` identical (waves [4,4,3], hover in 3 panes + 2 strips 1 → 2 px, a click +4 lines, toggle
off/on); merge toggle from a deep scroll: now Result clamped at top line 92 with sides lined up, base `f08c5b9` lost
its place (the reviewed m-on-after.png defect predates this feature, fixed now); range toggle keeps left top 101.
Screenshots `/tmp/yamt-r1/`.

Deviations (accepted): `rangeOpen.ts` also holds stored box keys and `shownFor`'s stored part (to get well under 300);
the toggle test moved there; `chainPhases` private (knip); `layoutOf` unchanged (no phase rule in it); `hiddenIn`
exported. Names for docs: `waveTops`, `waveStartsIn`, `chainPhases`, `hiddenIn`, `rangeOpen.ts`.

Open: a range desync on Ctrl+End after a find (#1689) — reproduced by the orchestrator: present on `d6ab2b7` and
`a23dcba`, absent on `f08c5b9` (no range folds): a regression of this feature.

## Re-check after fix round 1

Boundary pass (#1680–#1684 resolved), correctness pass (#1686–#1688 resolved; the new follow rule sound for the
minimap's `follow` callers; the merge deep-toggle defect predates the feature and is now fixed). Mutation run
`just mutants 4ce52c4`: `rangeOpen.ts` 57/57; `rangeThreads.ts` survivors :98 (equivalent) and pre-existing lines.
Open: #1689 → fix round 2 (`briefs/range-collapse-columns-rework-2.md`).

## Fix round 2 (`RangeFoldColumnsR2`, 14m24s, patch `c95743a`, `.omp/run/patches/RangeFoldColumnsR2.patch`; 2 files +94 −3)

#1689 cause (logged, then logging removed): the sync wrote the left 2807.5 (clamped 2655) after Ctrl+End in the
right; inside CodeMirror's gap IntersectionObserver measure, WebKit pulled the left to 0 (no script wrote it; 145 px of
rendered lines were in view, so `farTop` returned null and nothing pinned); the left's trusted scroll event at 0 was an
echo and was ignored. Fix (`scrollSync.ts`): when the echo window closes, a follower no longer at its written top makes
the same source lead the next sync (unless a `follow` was asked meanwhile); the second write is far, so exactScroll's
pin lands it. Tests (additions only): moved follower written again (fails without the fix: `expected 2 to be 3`),
landed followers ask nothing, a follow during the echo window keeps its own source. WebKit: range Ctrl+End after a
find [2655, 3114] lined up (was [0, 3114]); Ctrl+Home [0, 0]; collapsing off [8555, 9014] (base [8555, 9015]); merge
find + Ctrl+End [1961, 2081, 2353] equal to `f08c5b9`. 204 files / 2798 tests; typecheck, lint, fmt, knip clean.
Open risks (implementer): a follower pulled back every frame would re-sync every frame (logs: one retry landed); a user
scroll on a follower inside the one-frame echo window now snaps to the source; merge checked in one scenario.

## Fix round 3 (owner-approved Gate B #1692; `RangeFoldColumnsR3`, 8m33s, patch `.omp/run/patches/RangeFoldColumnsR3.patch`)

#1691: each pending sync carries a pass (`first` | `retry` | `last`): a scroll- or follow-led sync may retry once when
its echo window ends; after the retry a follower moved again leads (unless a scroll or follow already chose a source)
and asks no frame; after `last` nothing. At most two extra syncs per scroll-led sync. Tests (additions only): a
follower scrolled every frame after another pane's sync is written back once, then leads (fails on `c95743a`:
`[[1000,1000],[1000,1000]]`); a follower pulled back on every write → frames asked `[1, 0, 0]` (fails on `c95743a`:
`[1, 1, 0]`); after the retry a source scrolled again keeps the lead. WebKit: #1689 repro still [2655, 3114], Ctrl+Home
[0, 0]; scripted per-frame steps (WebKitWebDriver's wheel action scrolls +Δ then −Δ): range and merge — the second pane
written back once, leads from its second step (on `c95743a` frozen for the whole gesture). 204 files / 2801 tests;
typecheck, lint, fmt, knip clean. Deviations (accepted): the second pane leads on its second step, not its first (the
first step cannot be told from WebKit's pull-back; before `c95743a` it also led on the second frame); after the retry
a moved follower leads instead of nothing. Open: a follower pulled back on both writes leads (the panes line up at the
pulled place); merge checked in one file with collapsing off; no real touchpad momentum.
