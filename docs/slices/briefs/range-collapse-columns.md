# Slice RangeFoldColumns — the range columns collapse: wave across both columns and the strip, toggle, threads kept shown

Board "Range collapse" row 4 (session 35). Request `docs/slices/request-range-collapse.md` (read it whole: rules 1–8,
acceptance, non-goals); decision `docs/plan.md` §2 **#126** (read it whole), built on #63, #64, #68, #82, #106 (read
those rows). Design: `.omp/run/notes/RangeCollapseDesign.md` option A (read it whole; its facts with `path:line` are
given). You build the designer's "E2" plus the controller wiring. Already committed and yours to build on (read-only):
`RangeFoldCore` (the fold core: `foldRuns.ts` `columnRuns`, `foldSteps.ts`, `foldView.ts` `paneFoldView`,
`columnFolds.ts` — `ownerSteps`, `mirrorSteps`, `rangeRuns`, `renewSpec`, `stepSpec`, `mirrorSpec`, `rightReveal`,
`columnFoldExtension`; brief `briefs/range-collapse-core.md`) and `RangeCollapseToggle` (`useRangeStore().collapsing`
and `toggleCollapsing`, the header button; brief `briefs/range-collapse-toggle.md`). Read their committed code first.

Facts (given, at `a6fe62a`, files you own unchanged since):

- `CompareFrame` (`compareFrame.ts:67-124`): `fields` re-measure (`:96-104`), cached layout of rows and anchors
  (`:47-65`), paints bands only (`:106-116`), owns `ScrollSync<Column>` whose `follow(source)` exists
  (`scrollSync.ts:100-104`); no `realign`. `CompareStrip(strip)` (`compareStrip.ts:13-24`) paints bands.
  `compare.ts` (the compare window) uses both and stays untouched.
- `createReadOnlyColumnViews(texts, hosts, wiring: ReadOnlyWiring)` (`compareViews.ts:24-28,86-101`) passes one
  `extensions` to both columns; only `range.ts:55` calls it. Every column has `exactScroll` (#82) via `everyPane()`.
- Merge wave geometry: `wavePhase.ts` (`WaveHosts` = three panes + two strips, `paneEnds`, `panePhases`, `layoutOf`,
  `phaseStyle`, `writePhase`, `WavePhases`), `gap.ts` `wavePaints`, `geometry.ts` `WaveRow`, `strips.ts`
  `GapStrip#paintWaves` (`:160-174`) and `waveNode` (`:66-76`); `waveJoinPath`, `waveCenterY` in `connectors/`.
- `threadNumbers.ts:105-127`: a `mousedown` on any line-number cell starts a thread; the wave marker sits in that
  gutter (`foldView.ts:49-72`); the hover comment icon rule is `theme.css:509-521`.
- `useRangeController.ts`: `RangeParts<H>` (`:50-63`), `build` (`:86-101`) builds then calls
  `showThreads(parts.threads())` (`:100`); `followRange` watches `[content, hosts]` (`:112-118`), `preferences`,
  `threads`; `rangeThreadParts` (`:155-170`); `useRangeController(file, hosts, { preferences })` (`:172-187`) already
  holds `useRangeStore()`. `rangeStore.ts:256-261` shows the first file before awaiting `threads.load()`; the thread
  list starts empty (`rangeThreads.ts:276`) — the start-up race of design fact 5.
- Fixture `?range=review`, `src/board/board.ts`: differences start at left lines 19, 179, 199, 254, 308, 415, 461;
  left 20–178 is one unchanged stretch; `--threads seeded` puts an `unchangedOnRight` thread at left 100 / right 101.

## Target

Owned: `frontend/src/editor/internal/wavePhase.ts`, `frontend/src/editor/internal/gap.ts`,
`frontend/src/editor/internal/geometry.ts`, `frontend/src/editor/internal/strips.ts`,
`frontend/src/editor/internal/compareStrip.ts`, `frontend/src/editor/internal/compareFrame.ts`,
`frontend/src/editor/internal/compareFrame.test.ts`, `frontend/src/editor/internal/compareViews.ts`,
`frontend/src/editor/internal/compareViews.test.ts`, `frontend/src/editor/internal/threadNumbers.ts`,
`frontend/src/editor/internal/threadNumbers.test.ts`, `frontend/src/editor/internal/rangeFolds.ts` (new),
`frontend/src/editor/internal/rangeFolds.test.ts` (new), `frontend/src/editor/range.ts`, `frontend/src/editor/theme.css`,
`frontend/src/editor/rangeFolds.browser.test.ts` (new), `frontend/src/editor/range.browser.test.ts`,
`frontend/src/editor/rangeThreads.browser.test.ts`, `frontend/src/editor/AGENTS.md`,
`frontend/src/ui/useRangeController.ts`, `frontend/src/ui/useRangeController.test.ts`, `frontend/src/ui/rangeThreads.ts`,
`frontend/src/ui/rangeThreads.test.ts`.

Read-only: everything else — the core's files, `editor/compare.ts`, `editor/index.ts`, `ui/RangeView.vue`,
`ui/rangeStore.ts`. The merge window's tests stay **byte-unchanged and passing**: `wavePhase.test.ts`,
`foldRuns.test.ts`, `folds.test.ts`, `foldView.test.ts`, `foldSelection.test.ts`, `editor/strips.browser.test.ts`,
`editor/compare.browser.test.ts`. Docs are the orchestrator's.

Non-goals: collapsing in the compare window; a right-click menu; remembering what clicks showed; collapsing in AI edit
diffs; search code (the next feature's go-to selects its match, so rule 6's reveal covers it).

## Contract (fixed; you may add, never change)

```ts
// editor/range.ts (exported through editor/index.ts unchanged)
export type RangeOptions = {
  readonly preferences: Preferences;
  readonly collapsed: boolean; // the store's choice at build: files opened later follow it (rule 5)
  readonly threads: readonly ShownThread[]; // the file's threads at build: shown at once, and run edges (rule 4)
};
export class RangeController {
  constructor(texts: RangeTexts, hosts: CompareHosts, options: RangeOptions, events: RangeEvents);
  setCollapsed(collapsed: boolean): void; // on: runs from the differences + the threads last shown, every run at its
  // start; off: every line shown; the left column's top line held, the right lined up at once; not in history
  showThreads(threads: readonly ShownThread[]): void; // as today; remembered for the next on; never recomputes runs
  // setPreferences, moveToChange, destroy unchanged
}
// editor/internal/compareFrame.ts — opt-in parts, defaults keep the compare window as it is
//   `waves?: (views) => readonly WaveRow<Column>[]` in the frame's parts; `realign(source: Column): void`
// editor/internal/compareStrip.ts — `new CompareStrip(strip, hovered?)`: waves painted only with `hovered`
// editor/internal/compareViews.ts — `ReadOnlyWiring.extensions: (column: Column) => Extension`
// ui/rangeThreads.ts — `listed: Readonly<ShallowRef<boolean>>`: true once the first load settled, success or failure
// ui/useRangeController.ts — RangeParts gains `collapsed: MaybeRefOrGetter<boolean>` and `listed: () => boolean`;
//   `build(texts, hosts, options: RangeOptions, events)`; useRangeController's own signature is unchanged and
//   reads `store.collapsing` itself (as it reads `store.threads`)
```

## Change

Follow the design's option A sections 3–5 and "E1 → E2 builds on it" (`RangeFolds`, `columnWaves`, the controller
wiring), with these settled points:

1. Wave geometry shared, merge numbers unchanged: `WaveChain`/`chainEnds`/`ChainPhases` in `wavePhase.ts` with
   `WavePhases` the merge's three-pane case (its exports and their signatures kept); `WaveRow<P = Pane>`;
   `joinPaints` in `gap.ts` with `wavePaints` mapped onto it; `WaveLayer` in `strips.ts` used by the merge's
   `GapStrip` and by `CompareStrip`. The range chain: left → (strip) → right; the left leaves at the strip's left edge,
   the right enters at its right edge (#64).
2. `rangeFolds.ts`: `RangeFolds` (`Folding([left, right, strip], run => left.dispatch(stepSpec(…)))`, `ChainPhases`,
   `hovered`, `column(column)`, `renew(runs, collapsed)` dispatching `renewSpec` with `left.scrollSnapshot()`,
   `destroy()`), `columnWaves(views)`.
3. `CompareFrame`: the fold fields in `fields`, the optional `waves` part in the cached layout and passed to the strip,
   `realign(source)` = `ScrollSync.follow(source)`. `CompareStrip`: a `WaveLayer` only when given `hovered`.
4. `range.ts`: `#folds` built before the views; per-column extensions add `this.#folds.column(column)`; the frame gets
   `fields: [differenceField, threadField, ownerSteps, mirrorSteps]` and `waves: columnWaves`; the constructor renews
   with `options.collapsed` and `rangeRuns(differences, options.threads, docs)` then shows `options.threads`;
   `#threads` keeps the last list `showThreads` got; `setCollapsed(on)` = renew from `#threads` + `#frame.realign("left")`.
5. A press on a wave's gutter cell starts no thread (`threadNumbers.ts`), and the hover comment icon does not show on
   it (`theme.css`).
6. `rangeThreads.ts` `listed`; `useRangeController.ts`: `build` waits until `parts.listed()` (watch sources
   `[content, hosts, listed]`), passes `{ preferences, collapsed: toValue(parts.collapsed), threads: parts.threads() }`
   and no longer calls `showThreads` after building; `watch(toRef(parts.collapsed), on => controller?.setCollapsed(on))`;
   `ShownRange` adds `"setCollapsed"`; `rangeThreadParts` also returns `listed`.
7. Call sites: `compareViews.test.ts:43` (`extensions: () => []`), `range.browser.test.ts:24` and
   `rangeThreads.browser.test.ts:167` (options gain `collapsed: false, threads: []`).
8. `frontend/src/editor/AGENTS.md`: a short paragraph — the fold core serves both windows; the range's state lives in
   the left column (`columnFolds.ts`), its view and waves in `rangeFolds.ts`.

## Acceptance

- Merge and compare unchanged: `git diff --stat` over the Read-only merge tests is empty; `pnpm -C frontend test` and
  `pnpm -C frontend test:browser` pass them.
- Node (design tests 18–32): two columns and one strip — the left leaves at the strip's left edge, the right enters at
  its right edge; the merge chain through `chainEnds` equals `paneEnds`/`panePhases`; `ChainPhases` writes both
  columns' phase on resize and removes it on destroy; `columnWaves` gives each run's wave top per column (null where
  nothing hides); `joinPaints` joins the two tops level; waves reach the strip with the rows and re-measure when a fold
  field changes; `realign` writes the other column on the next sync though the source did not scroll; a frame without
  waves paints none; read-only columns get their own column's extensions; `useRangeController`: built with the
  store's choice and the threads at that moment, a toggle reaches every live controller through `setCollapsed` with
  no rebuild, a file opened after the toggle builds with the new state, nothing builds before the thread list was read
  once, a failed list still builds, a thread change calls `showThreads` and never `setCollapsed`; `rangeThreads`:
  `listed` turns true after the first load settles, success or failure. `ui/` tests kill the mutants on your `ui/`
  lines (Stryker, SP5); for three editor tests (realign, own-column extensions, wave join level) paste the failing
  output after a one-line sabotage, then revert.
- WebKit, `editor/rangeFolds.browser.test.ts` (a 200-line pair, changes at lines 20 and 150, a thread at line 100,
  dark and light, screenshots in `/tmp/yamt-range-folds`): at open `.fold-wave` in both gutters and one strip wave per
  run, the join's ends at both waves' centres within 1 device px; clicks on the left wave, the strip's wave, the
  right wave show +4, +8, then the rest in both columns, focus unchanged; hover on one part thickens the run's wave in
  both columns and the strip; `setCollapsed(false)` → no wave, `(true)` after clicks → the start state, the left's top
  line unchanged on screen and the right aligned next frame, a cursor inside moved to the wave line's start; the
  thread line and 4 lines around it shown at open and after off → on; a thread added through `showThreads` changes
  no wave; a press on the wave gutter fires no `startThread`; a search match in a hidden line of the right column
  shows it in both columns; `moveToChange` lands on a difference and changes no wave.
- WebKit, fixture page (`just app-session start-fixture --range-case review --threads seeded`, MiniBrowser 1600×1000),
  dark **and** light, on `src/board/board.ts`: the 20–178 stretch behind one wave across both columns and the strip,
  the seeded thread shown with its context; clicks show 4, 8, the rest; the header toggle off shows every line, on
  resets; Ctrl/Cmd+F to a word in a hidden line shows it; Previous/Next unaffected. Merge fixture page
  (`just app-session start-fixture`): waves, clicks and toggle as before. Screenshots pasted.

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`,
`pnpm -C frontend test:browser`, `pnpm -C frontend fmt:check`.

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://vue-conventions`, `skill://verification` (plus your autoloaded
ones).
