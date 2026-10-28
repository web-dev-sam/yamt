# Range collapse — design: the merge window's collapsing in the range window's two columns (board "Range collapse" row 1)

Agent: `designer` (read-only). Output: two or three file-level options plus a recommendation (your output schema). You
design; the orchestrator chooses; afterwards **two `web-impl` builds run in parallel**: an editor build (`editor/**`)
and a window build (`ui/**`). Your recommendation must split the files into two **disjoint** ownership lists (name
every file each build creates or changes) and write the contract between them in full (the editor surface the window
calls). Everything is inside `frontend/src/**` (no Rust, no IPC — say so if your design needs one).

The request is settled: `docs/slices/request-range-collapse.md` (rules 1–8, acceptance, non-goals). Read it in full
first; a design may refine a detail it names, never reopen a rule. The merge window's feature it copies is plan §2 #63
(runs and steps), #64 (one unbroken wave, phase rule), #68 (toggle, cursor and scroll on toggle), #82 (far scroll in
WebKitGTK); read those rows in full. Range window: #103–#106 (#106 = `RangeController` beside `CompareController`).

## Fixed constraints

1. **No second copy of #63's rules** (vision 2). Runs, the 4/8/16 levels, the "covers at least 2 lines" and "drop a step
   equal to the one outside it" rules, reveal-on-selection, the wave widgets and the wave phase each stay in one place
   that both windows use. Merge-only parts (the centre authority, three panes, two strips, `Chunk`) may stay merge-only.
2. **The merge window's collapsing behaves as before and its tests stay unchanged**: `foldRuns.test.ts`,
   `folds.test.ts`, `foldView.test.ts`, `foldSelection.test.ts`, `wavePhase.test.ts` and every other merge test pass
   without edits to their expectations. A generic core may sit under the functions they call. If an option needs to
   touch a merge test file at all, it names the file, the line and why (a call-site rename at most).
3. **The compare window (`yamt --diff` without a range) is unchanged** (rule 8): it shares `CompareFrame`,
   `CompareStrip`, `compareViews`, `columnMarks`, `compareFocus` with the range window. Folding is opt-in for the
   range columns only.
4. **Threads are never hidden** (rule 4): a line holding a thread, or the line of a new thread being written, counts as
   a change when runs are computed. Runs are computed at file open and at each off → on, from the differences and the
   threads at that moment; never on a thread add or delete in between.
5. **One stored choice** (rule 7): the range window reads and writes `ui/collapsing.ts`'s `yamt.collapse.unchanged`.
   Fence PM9 bars range files from importing the merge store or `App` (`frontend/scripts/fences.ts:55-66`);
   `collapsing.ts` itself is not a root file.
6. **Next feature** (board "After 0.6.0-beta.1" row 4, window-wide search): its go-to will open a file in the range
   window and put the selection on a line. Rule 6's reveal (a selection end strictly inside hidden lines shows every
   range holding it in both columns) must cover that path, so search adds no second reveal path. No search code now.

## Facts in the tree (HEAD `a6fe62a`; editor files unchanged since the scout's `15ab31c`)

Scout facts with `path:line`: `.omp/run/notes/PlanScoutRangeList.md` part (B). In short:

- Fold code is three-pane: `foldRuns(chunks, docs)` over 3-way `Chunk`s and `Pane` (`foldRuns.ts:17-21,69`);
  `FoldFields { runs; center; sides }` with the centre as authority mirrored to the sides (`folds.ts:27-31,255-302`);
  `Folds` takes `WaveHosts` = three panes + two strips (`foldView.ts:185-196`, `wavePhase.ts:7-8`); `setCollapsed`
  dispatches on the centre view (`foldView.ts:197-202`); the merge `Frame` (`frame.ts:9,55,74-75,96-98`, `realign()` =
  `scroll.follow("center")`), `minimap.ts:17,82` and `strips.ts:118` read fold state. Pane-agnostic:
  `foldSelection.ts`, `folding.ts` (`Folding(hosts: readonly Element[], show)`), `FoldLine`, `WaveMarker`, `waveTheme`,
  the level growth in `foldRuns.ts`.
- Range columns: `createReadOnlyColumnViews(texts, hosts, { settings, updated, extensions })` and
  `CompareFrame({ views, strip, fields, anchors })` (`editor/range.ts:51-83`); a field listed in `fields` re-measures
  (`compareFrame.ts:96-104`); `ScrollSync<Column>`; `CompareFrame` has no `realign`. Differences are
  `Difference { left: LineRange; right: LineRange }` (`ipc/bindings.ts`), not `Chunk`. `RangeOptions = { preferences }`
  (`range.ts:33`); `useRangeController.ts` builds it.
- Threads: a per-column block-widget field `threadField` plus `threadAnchors` in `CompareFrame`; rows measured by a
  `ResizeObserver` (`threadHosts.ts:30`); `showThreads(threads)` (`range.ts:105-116`); a new thread being written is a
  `ShownThread` too [INFERENCE: check `ipc/rangeDomain.ts` / `rangeThreads.ts` for the draft's shape].
- Merge toggle path: `ui/collapsing.ts` (`createCollapsing` → `{ collapsing, toggleCollapsing }`, `storedValue`, key
  `yamt.collapse.unchanged`, anything but `"false"` is on); merge store spreads it (`store.ts:181`); `MergeToolbar.vue`
  button `collapse` (`ChevronsDownUp`, `keepsKeyboard: true`, `selected: collapsing`); `useMergeController.ts:46,154-156,184`
  watch → `setCollapsed`; `editor/index.ts:58,83-84,224-227` (`MergeOptions.collapsed`, `new Folds(...)`,
  `setCollapsed` → `folds.setCollapsed` + `frame.realign()`).
- Range header: `ui/RangeView.vue:51-79` (Previous/Next disabled while `!columns`, `moveToChange`); no context menu.
- Sizes: `editor/range.ts` 131 lines, `editor/index.ts` 293, `folds.ts` 290, `foldView.ts` 216, `wavePhase.ts` 129,
  `compareFrame.ts` 124 (oxlint `max-lines` 300, `max-lines-per-function` 40).

## What each option must answer

1. **Generic core**: which functions/types become column-agnostic (a pane key type parameter, a record of ranges per
   key, …) and what merge-facing wrappers keep the merge tests' call sites; how `Difference` and thread lines become
   run edges (rule 4) through the same run code `Chunk`s use.
2. **State**: with no centre pane, which field is the authority for each run's shown-step count in two columns (one
   field per column mirrored from one side, one shared object outside the states, …), how a click on either column's
   wave or the strip shows the next step in both, how off/on (rule 5) and runs recomputed at on (rule 4) are
   transitions, why none enters history; where the threads' lines come from at open and at on.
3. **Frame and scroll**: how `CompareFrame` measures rows and anchors with hidden ranges, the strip's wave joins
   (`CompareStrip` today draws bands only), the left column's top line held on toggle and the right lined up at once
   (rule 5; a `realign` or equivalent), #82 on every reveal, and how thread rows beside hidden ranges keep the aligned
   bands right. The compare window must not change.
4. **Wave phase** (#64) with two columns and one strip: which edges meet, what `WaveHosts`/`wavePhase.ts` become.
5. **Find and selection** (rule 6) in both columns, reusing `foldSelection.ts`; select-all, Ctrl/Cmd+Home/End and
   arrows do not reveal; Previous/Next never lands in hidden lines.
6. **Contract** between the two builds: `RangeOptions` field(s), `RangeController` method(s), what `useRangeController`
   watches, where the range store holds `collapsing` (reusing `createCollapsing`), the header button
   (`RangeView.vue`: after Previous/Next, `aria-pressed`, keeps the keyboard, disabled while `!columns`).
7. **Ownership split**: every file per build with a changed-line estimate (each ≤ ~25 files, ≤ ~1,500 lines); if the
   editor build is larger, split it into two editor builds with disjoint files and a fixed internal contract.
8. **Tests**: `editor/` is not mutated, so name the node unit tests that fail for each rule's plausible bug (two-column
   runs from differences, thread lines as edges, step growth in both columns from either side, off/on reset, runs
   recomputed at on and not on a thread add, cursor/selection on toggle, reveal on find/selection and not on
   select-all, top line held), and the WebKit fixture (`?range`) and real-app (`scripts/range-repo.sh`) steps for the
   acceptance lines.

Read: `skill://cm6-rules`, `skill://ts-conventions`, `skill://vue-conventions`, `skill://risk-register`,
`skill://decision-record`, `docs/architecture.md` §5.1–§5.4, `docs/plan.md` §2 #63, #64, #68, #82, #103–#106;
`.omp/run/notes/UnchangedDesign.md`, `.omp/run/notes/WaveToggleDesign.md`, `.omp/run/notes/RangeDesign.md`,
`.omp/run/notes/ThreadsDesign.md`.
