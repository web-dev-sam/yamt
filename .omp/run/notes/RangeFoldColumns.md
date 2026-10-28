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
