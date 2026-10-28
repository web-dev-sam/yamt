# Slice RangeFoldColumns — the range columns collapse: wave across both columns and the strip, toggle, threads kept shown

Board "Range collapse" row 4 (session 35). Request `docs/slices/request-range-collapse.md` (read it whole: rules 1–8,
acceptance, non-goals); decision `docs/plan.md` §2 **#126** (read it whole), built on #63, #64, #68, #82, #106 (read
those rows). Design: `.omp/run/notes/RangeCollapseDesign.md` option A (read it whole; its facts with `path:line` are
given). You build the designer's "E2" plus the controller wiring. Already committed and yours to build on (read-only):
`RangeFoldCore` (the fold core: `foldRuns.ts` `columnRuns`, `foldSteps.ts`, `foldView.ts` `paneFoldView`,
`columnFolds.ts` — `ownerSteps`, `mirrorSteps`, `rangeRuns`, `renewSpec`, `stepSpec`, `mirrorSpec`, `rightReveal`,
`columnFoldExtension`; commit `f08c5b9`, brief `briefs/range-collapse-core.md`, notes
`.omp/run/notes/RangeFoldCore.md`) and `RangeCollapseToggle` (`useRangeStore().collapsing` and `toggleCollapsing`, the
header button; commit `fce7a2a`, brief `briefs/range-collapse-toggle.md`; a one-class fix round on `RangeView.vue` may
land beside you). Read their committed code first. The core's two listeners (`columnFolds.ts:158-190`) have no
DOM test yet: your fixture-page steps b, d and f are their proof.

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
`frontend/src/editor/range.browser.test.ts`, `frontend/src/editor/rangeThreads.browser.test.ts` (call sites only),
`frontend/src/editor/AGENTS.md`, `frontend/src/ui/useRangeController.ts`, `frontend/src/ui/useRangeController.test.ts`,
`frontend/src/ui/rangeThreads.ts`, `frontend/src/ui/rangeThreads.test.ts`.

No new `*.browser.test.ts`: Playwright's WebKit cannot launch on this host (`libicudata.so.74`, known since #1242)
and CI does not run the browser project, so a new probe would never run. The engine of record is MiniBrowser through
`just webdriver` (VF8): your WebKit evidence is the fixture page below, driven by a throwaway WebDriver script outside
the repository.

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

- Merge and compare unchanged: `git diff --stat` over the Read-only merge tests is empty; `pnpm -C frontend test`
  passes them.
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
- WebKit, fixture page (`just app-session start-fixture --range-case review --threads seeded`, MiniBrowser 1600×1000),
  dark **and** light, on `src/board/board.ts` (left 20–178 one unchanged stretch; the seeded thread at left 100 /
  right 101), measured from the page (`.fold-wave` cells, the strip's wave nodes, `.cm-line` text, scroll tops):
  a. At open: one wave per run in both gutters and one strip wave per run; the join's ends sit at both columns' wave
  centres within 1 device px; the thread line and 4 lines on each side of it shown.
  b. Clicks on the left wave, then the strip's wave, then the right wave show +4, +8, then the rest, in both columns;
  the focused column keeps the keyboard; a press on a wave's gutter cell opens no thread draft.
  c. Hover on one part thickens the run's wave in both columns and the strip (stroke 1 → 2 px), hand pointer.
  d. The header toggle off: no wave, every line shown; on after clicks: the start state; the left column's top line
  unchanged on screen and the right lined up in the same frame; a cursor inside lines that get hidden lands on the
  wave line's start.
  e. Add a thread on a hidden-adjacent shown line, then toggle off → on: it is shown with its 4 lines; adding it
  changed no wave until the toggle.
  f. Ctrl/Cmd+F to a word only in a hidden line of the right column shows it in both columns; select-all and
  Ctrl/Cmd+End reveal nothing.
  g. Previous/Next step through the 7 differences and change no wave.
  h. Reload with the stored choice off: the file opens with every line shown (files opened later follow it).
- Merge fixture page (`just app-session start-fixture`), dark: waves across three panes and both strips, a click shows
  the next step, the toolbar toggle off/on, a hover thickens the whole wave — as before (screenshots before your
  change from `f08c5b9`'s tree if you can build it in a scratch worktree under `/tmp`, else describe).
- Screenshots for a–h pasted (paths).

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`,
`pnpm -C frontend fmt:check`, `pnpm -C frontend unused`.

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://vue-conventions`, `skill://verification` (plus your autoloaded
ones).
