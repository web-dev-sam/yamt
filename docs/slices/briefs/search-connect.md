# Slice SearchConnect — the views go to a finding and report Result changes; stops and disk changes re-run the search

Board "Search" row 6 (session 35). Request `docs/slices/request-search.md` (rules 8 and 10 are yours); decision
`docs/plan.md` §2 **#127**. Design: `.omp/run/notes/SearchDesign.md` option A §3.4 ("How the search reads live text"),
§3.5 (B5 and the view's go-to watch). Built before you (read-only; read their code first): the handles' `goTo`,
`lineUp`, `resultVersion` (`SearchGoToB`), the store's `search` (`Searching<P>`: `goTo`, `took`, `changed`, `clear`,
`rerun`) and `liveResults` (`LiveResults.track/untrack`) (`SearchWindow`), `RESULT_HEADER` in `sideHeaders.ts`.

## Target

Owned: `frontend/src/ui/MergeView.vue`, `frontend/src/ui/RangeView.vue`, `frontend/src/ui/stops.ts`,
`frontend/src/ui/stops.test.ts`, `frontend/src/ui/diskChanges.ts`, `frontend/src/ui/diskChanges.test.ts`,
`frontend/src/ui/saving.test.ts`, `frontend/src/ui/listing.test.ts` (their fakes only).

Read-only: everything else. Docs are the orchestrator's.

## Change

1. `MergeView.vue`: `store.liveResults.track(path, { lineUp: handle.lineUp })` beside the close guard's `track` (and
   `untrack` beside its `untrack`); watch `handle.resultVersion` → `store.search.changed(path)`; the go-to watch:
   `watch([search.goTo, () => props.shown], ([r, shown]) => { if (r && shown && r.path === path) { handle.goTo({ pane:
   r.pane, match: r.match }); search.took(r.id); } }, { immediate: true, flush: "post" })`; the Result's header word
   from `RESULT_HEADER` if the view spells it.
2. `RangeView.vue`: the same go-to watch with the range handle (`pane: Column`).
3. `stops.ts`: `search.clear()` where a stop's state is cleared; `search.rerun()` after the new stop's list arrives.
4. `diskChanges.ts`: `search.changed(path)` for every changed path.

## Acceptance

- Node: `stops.test.ts` — a new stop clears the results and re-runs with the same query after the list; `diskChanges`
  — a disk change re-searches only that path. Stryker on `stops.ts`/`diskChanges.ts` kills the mutants on your lines.
- WebKit, both fixture pages, dark and light, collapsing on: a row whose match lies in collapsed lines → its file
  opens, the selection's text equals the query in the Result (range: the new side), the stretch around it shows, that
  pane has the keyboard; a click on a row's left-pane icon → the selection in the left pane; a file not yet opened and
  one already opened both land; Enter on a row in the list does the same. Merge: typing in the Result on a matching
  line updates that file's rows ~300 ms later; Reset brings them back. Ctrl+Shift+S hide returns the keyboard to the
  shown file. Screenshots.
- The selection holds: `SearchGoToB` saw the go-to's selection shrink to a cursor 1–4 frames later in most WebKit
  probes (CodeMirror adopting the browser's selection via `DOMObserver.onSelectionChange`; a plain contenteditable on
  the app page lost its range too; notes `.omp/run/notes/SearchGoTo.md`). Read the pane's selection 500 ms after each
  go-to, in the fixture page **and** in the real app (`scripts/range-repo.sh`, `scripts/demo-repo.sh`), with the
  window focused (`document.hasFocus()` true): it must still equal the match. If it shrinks, find the cause (a row
  click's own mouseup or focus handling, the panel's focus return, WebKit) and fix it inside your files, or name the
  file, line and change in `deviations_from_brief`.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.

## Skills

`skill://vue-conventions`, `skill://verification` (plus your autoloaded ones).
