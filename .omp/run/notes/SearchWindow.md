# SearchWindow — notes (session 35)

Slice brief `docs/slices/briefs/search-window.md`; web-impl, isolated, 36m27s (ran out of budget). Patch `53e047b`
(base `8d2dd7d`), `.omp/run/patches/SearchWindow.patch`; 30 files, +2747 −114.

## Summary (implementer)

- Ctrl/Cmd+Shift+S toggles a panel above the file list in both windows: box, Match Case, one toggle per pane, a
  summary, a virtual list (`SearchPanel.vue`, `SearchResults.vue`, `searchIcons.ts`); `SideColumn.vue` holds the width
  handle ("File list width") with the panel on top of `FileList`.
- State: `createSearching` (`searching.ts`, one per store); the runner `searchRun.ts` (300 ms pause, 8 ms slices,
  one-file re-runs, stale replies dropped; `SearchSource`, `SEARCH_PAUSE_MS`).
- Sources: `mergeSearch.ts` (live `lineUp`, else opened data, else one kept `loadFile` reply; `LiveResults`
  track/untrack) and `rangeSearch.ts` (pages `searchTexts` once, kept for the run).
- `windowKey` in `fileListKey.ts`; "Toggle search" `Mod-Shift-s` in keys and keyText; `problem.ts` `search` action;
  `sideHeaders.ts` `RESULT_HEADER`; store.ts split: file opening moved unchanged to `opening.ts` (store.ts 253 lines).

## Tests

`fileListKey.test.ts`, `searching.test.ts` (fake timers: pause, Enter, newer run wins, dismissals back on Enter, Match
Case, filters without a run, one-file re-run keeping dismissals, stale one-file reads dropped, `clear`, yields between
slices, cut stops reading, survives hide/show, toggleKey guards, go pane choice, took, focusShownFile),
`mergeSearch.test.ts`, `rangeSearch.test.ts`, `keyText.test.ts`, `problemText.test.ts`, `searchText.test.ts`.

## Evidence (implementer)

test 2949 passed; lint, typecheck, fmt clean. `unused` fails on 5 types from earlier slices (`PaneMatch` ×2,
`LineChange` in `ipc/index.ts`, `MergeGoTo`, `RangeGoTo`). Stryker partly re-checked; static/moved survivors listed.
**WebKit acceptance not run** (budget): every item of the brief's WebKit line is open.

## Deviations

1. `ui/opening.ts` (granted). 2. `searching.ts` split into state + `searchRun.ts`. 3. `searchIcons.ts`. 4. `clear()`
   also drops a pending go-to. 5. `rerun()`/`enter()` on an empty box do nothing. 6. Range `forget`/`forgetAll` no-ops
   (texts kept for the run). 7. Range panes empty until `openRange` answers. 8. problemText words in one table.
2. Plain timers.

## Open risks (implementer)

`useVirtualList` inside the half-height cap, 22 px rows, the flat themes' −1 px overlap, `<mark>` colour, the focus
watcher on hide, keyboard scrolling via `scrollTop` — all unverified in WebKit; range order assumes Rust's id order
equals `start.files` order; the cut sentence's words unchecked against VS Code.
