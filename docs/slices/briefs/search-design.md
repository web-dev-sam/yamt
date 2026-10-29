# Search — design: one window-wide search for the merge and range windows (board "Search" row 1)

Agent: `designer` (read-only). Output: two or three file-level options plus a recommendation (your output schema). You
design; the orchestrator chooses; afterwards builds run at most two at a time (proposal in the request: Rust ∥ search
core, then editor go-to ∥ window). Your recommendation must split the files into **disjoint** ownership lists per
build (name every file each build creates or changes), order them by dependency, and write every contract between
builds in full (types, signatures, IPC commands, store fields). Each build ≤ ~25 files and ≤ ~1,500 changed lines.

The request is settled: `docs/slices/request-search.md` (owner's words, rules 1–13, acceptance, non-goals). Read it
in full; a design may refine a detail it names, never reopen a rule. Scout facts with `path:line` at `15ab31c`:
`.omp/run/notes/PlanScoutSearch.md` (given; re-check only what changed since, listed below).

## Changed since the scout (HEAD after the range-collapse feature)

- **Range window collapsing** (plan §2 #126, `request-range-collapse.md`): the range columns collapse unchanged lines;
  the fold state lives in the left column (`editor/internal/columnFolds.ts` `ownerSteps`, right `mirrorSteps`);
  `editor/internal/rangeFolds.ts` wires it; `RangeController` has `setCollapsed` and `RangeOptions { preferences,
  collapsed, threads }`. A selection end strictly inside hidden lines reveals every range holding it in both columns
  — in the left through `ownerSteps`, in the right through `revealOnOwner` (`folds.ts`). #126 settles that the go-to
  **selects the match** (not a bare cursor at a line start), so this reveal covers it: the go-to adds no second reveal
  path. The merge window's reveal is the same rule (`foldField` / `sideReveals` → `revealOnOwner`, `foldSteps.ts`
  `revealed`).
- `useRangeController.ts` builds a file's columns only once the thread list was read once (`rangeThreads.ts`
  `listed`).
- Folder sums (#125): `FileTree.vue`/`FileList.vue` gained an optional `folder` slot; `RangeCounts.vue`.
- Scroll (HEAD `39182c2`): `ScrollSync.follow(source)` keeps the source until the next sync and a follower pulled
  off its written top is written again once (`scrollSync.ts`); `exactScroll.ts` pins only a moved scrollTop
  (`movedFarTop`); `CompareFrame.realign(source)` exists. A go-to's scroll should go through CodeMirror's
  `scrollIntoView`, as find and the toolbar arrows do (notes `.omp/run/notes/RangeFoldColumns.md` rounds 1–4).
- Board: `docs/slices/SLICES.md` sections "Range collapse" and "Folder sums"; decisions `docs/plan.md` §2 #124–#126.

## Fixed constraints

1. **One matcher** (vision 2): the same literal, case-insensitive-unless-Match-Case, one-line rule and the same case
   folding for every file and pane, in one place (Rust or TS — choose and justify; no new dependency without a stated
   reason, DR3).
2. **One place rule** (rule 7 a/b): lines that line up outside every change at the same column, or lines with the
   same text inside one change/conflict at the same column, are one row; the rule lives once and is pure-tested.
3. **The store never holds an `EditorView`, a position or document text** (architecture §5.1). An opened merge file's
   live Result is reachable only through its `MergeHandle.snapshot().asShown()`; say how the search reads it (a
   registry like the close guard's `track/untrack`, `closeGuard.ts:45-51`, or another way) and how rule 10's
   "follows the texts" is triggered without a second source of the text.
4. **Unopened files** (rule 6): merge window — every conflicted text file's three panes, the Result "as it would
   open"; range window — every changed file's two sides. Today the window gets texts only for opened files and the
   range re-reads and re-diffs per load (no cache). Choose where texts and line-up data come from (a new Rust command
   per window, a batched read, the existing per-file loads, a Rust-side search) and say what it costs per run on a
   large range, and how rule 12 ("the window never freezes") holds.
5. **Go-to** (rule 8): one controller method per window that selects a match range in a named pane, scrolls it into
   view (#82's far-scroll rule), shows a collapsed stretch (through the existing selection reveal), and gives that
   pane the keyboard; the handle surfaces (`MergeHandle`, `RangeHandle`) and how the window reaches the controller of
   the file it just opened (a file opened by the click may not have a controller yet).
6. **Layout** (rule 2): the panel above the file list sharing the column, its width and handle (#84); with the file
   list hidden the panel takes the column; both hidden, the column goes. `FileList.vue`'s `<aside>` carries the width
   today.
7. **Keys** (rule 1): "Toggle search", group "Window", default `Mod-Shift-s`, the file-list key's conditions; each
   root's window `keydown`.
8. **Search state** (rule 11): one owner per window (or one shared composable both stores hold, vision 2); remembered
   while hidden, not across restarts.
9. Pane filters, dismissals, re-runs, ordering, the 20,000-row cap: pure and tested.

## What each option must answer

1. Data structures first: the query, a file's searched texts and line-up data, a match, a row (place), a group, the
   dismissed set and how a dismissal survives a re-search of one file (rule 10), the filters.
2. Where each step runs (Rust or window), the IPC commands (names, request/reply types, error cases) if any, and the
   generated-bindings path (`skill://ipc-contract`).
3. The editor go-to contract for both controllers and how `ui/` calls it after opening a file.
4. The panel's components, the column wrapper, the store fields, the key action, both roots.
5. The ownership split per build with changed-line estimates, the dependency order, and which builds can run side by
   side (at most two implementers).
6. Tests: the pure tests (matcher, place rule, order, filters, dismissals, re-runs, cap) with the bug each catches;
   Rust tests if any; the WebKit fixture and real-app steps per acceptance line (Playwright's WebKit cannot launch on
   this host; MiniBrowser through `just webdriver` is the engine of record).

Read: `skill://ipc-contract`, `skill://cm6-rules`, `skill://ts-conventions`, `skill://vue-conventions`,
`skill://rust-conventions`, `skill://risk-register`, `skill://decision-record`, `docs/architecture.md` §3.3, §3.8, §4,
§5.1–§5.4, `docs/plan.md` §2 #44, #53, #61, #63, #82, #84, #86, #87, #104–#106, #126.
