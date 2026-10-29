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

## Reviews (round 1)

Mutation run `just mutants 8d2dd7d`: 85.4 % over 15 files (keys/keyText survivors mostly static literals; new-file
survivors in `searchRun.ts`, `mergeSearch.ts`, stores). Boundary fail: #1715 block (search `loadFile` bypassing
`landed`), #1716–#1718 promoted. Correctness fail: #1720–#1722 blocks (stale-run guards and one-file re-run guards
untested; hide could leave focus on body), #1723, #1724 promoted. Connect's WebKit run found #1719 (rows not hittable).

## Fix round 1 (`SearchWindowR1`, 41m53s, patch `fcdce10`, `.omp/run/patches/SearchWindowR1.patch`)

Search `loadFile` replies through `landed` with their stop; `searching.ts` the one writer of query and closed groups,
one record per full run in the runner; pure `searchListKeys.ts` (`stepSearchList`); hide: a saved body counts as none,
`focusShownFile()` when focus did not land; `SideColumn` owns the overlap and its `v-show`; `pl-7`. #1719's real cause:
WebKitGTK overlay scrollbars swallow clicks (a long group name scrolled sideways; the vertical bar took clicks within
20 px of the edge) — names truncate, `overflow-x-hidden`, rows end 20 px short. The box re-selects its text a frame
after show (WebKit dropped it every other show). Every item's test failed with its bug (outputs in the agent report).
WebKit (on a `/tmp` copy with the connect commit): merge page dark and light — all round-1 acceptance steps pass
(three icons on an unchanged line, filters, Match Case 22 → 10, groups, ×, Enter, Ctrl+B whole column, width 320/320,
keymap rebind, hit tests at every row for 1/2/5/30 rows, hide from body → Result focused); range page dark and light —
the same except **hiding from a body-focused fresh page leaves focus on body** (rangeStore asks the right path, so
likely RangeView's go-to with `match: null`, a connect file); compare dark: no panel, Ctrl+B as before. Not run: range
keymap rebind and Ctrl+B-then-hide, compare light. First Ctrl+Shift+S failure not reproduced on fixture pages.
Deviations (accepted): own #1719 fix; next-frame reselect; `SideColumn` props; per-run record; `stepSearchList` finds a
place's group as the path's first row.
