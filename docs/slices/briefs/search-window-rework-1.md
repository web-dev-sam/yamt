# Slice SearchWindowR1 — fix round 1: late replies land in their stop, one writer per panel state, clickable rows, the runner's guards tested, the WebKit acceptance

Board "Search" row 5, fix round 1 (session 35). Round 1: `SearchWindow`, commit `53e047b`, brief
`docs/slices/briefs/search-window.md` (its Contract and **its whole WebKit acceptance line** hold: round 1 ran out of
budget before any WebKit step — you run them all), notes `.omp/run/notes/SearchWindow.md`. Both reviews failed, and the
connect slice (`SearchConnect`, running beside you on `MergeView.vue`, `RangeView.vue`, `stops.ts`, `diskChanges.ts`)
found a WebKit defect. Verbatim (promoted `should`s marked):

1. **#1715 (boundary, block)** `mergeSearch.ts:86` — "The search's `loadFile` reply does not go through
   `landed(stop, …)`. Line 102 hands any failure to `reportFailure` before the runner checks its generation. So a read
   sent in one stop and answered after `nextStop` puts "Search stopped: …" on the next stop. If that answer is
   `StopMovedOn`, it calls `nextStop` a second time and clears the views of the stop just opened." Fix: give
   `MergeSearchTarget` the store's current `stop` (a getter on `state`), capture it before each `loadFile`, and call
   `landed(stop, () => attempt(…))`; a `null` reply means no text and no report; keep `forgets` only for the in-stop
   `changed(path)` case.
2. **#1719 (found in WebKit 2.54.2, block)** `SearchResults.vue` — "when the results list fits without scrolling (e.g.
   2 rows), every row after the first can't be clicked. `document.elementFromPoint` at the 2nd row returns the
   `[role=tree]` container … It reproduces on a fresh fixture page every time: Ctrl+Shift+S, type "scope ?
   scope.offset", then hit-test the 2nd row. A list long enough to scroll (22 rows) is fine. Setting the tree's
   overflow-y to visible and back once clears it, so WebKit's overflow clip for hit testing goes stale while
   useVirtualList's content grows." Fix: `overflow-y-auto` as a class from the first render instead of
   `containerProps`' inline style, or an overflow touch after rows change; prove by hit tests at every row for 1, 2, 5
   and 30 rows.
3. **#1720 (correctness, block)** `searchRun.ts:106,141` — "Both stale-run guards are untested … an older query's run
   would keep writing its matches into the newer run's results, or switch `running` off … while the newer run is
   still reading." Fix: in `searching.test.ts`, hold the newer run on its second file and let the older run's file
   land first; the older query's match never appears in `rows`, `running` stays true until the newer run ends.
4. **#1721 (correctness, block)** `searchRun.ts:151` — the one-file re-run guards (`:151` `changed()` with no run must
   not throw — every edit hits it; `:152`/`:137` a file the current run has not reached added out of order, stale
   ranks; `:97` a null re-read marking the results cut). Fix: three cases — `changed` with no results reads nothing
   and does not throw; `changed` for a file the previous run read but the held current run has not reached adds no
   group; a re-read where `file()` returns null drops that file's group and the summary keeps `cut: false`.
5. **#1722 (correctness, block)** `SearchPanel.vue:57` — "Hiding the panel can leave the keyboard nowhere … If the
   panel was shown while focus sat on `<body>`, the saved element is `body` … `body.focus()` runs and
   `focusShownFile()` never does … The same happens when the saved element was a file-list row that Ctrl+B hid
   since." Fix: a saved `document.body` counts as no element; after `element.focus()`, call
   `props.search.focusShownFile()` whenever `document.activeElement !== element`.
6. **#1716 (boundary, should → promoted)** `searchRun.ts:24` — "`RunRefs` lets the runner write the panel's own state.
   It writes `query` in `typed` … and empties `closed` in `fullRun`, while `searching.ts:157` also toggles `closed`."
   Fix: `query` and `closed` written only in `searching.ts`; the runner takes an `onFullRun` callback; `RunRefs` holds
   only `results`/`running` plus read-only `query`/`matchCase`.
7. **#1717 (boundary, should → promoted)** `SearchResults.vue:104` — the list's keyboard step rules live in the
   component where no node test reaches them. Fix: a pure `ui/searchListKeys.ts` (rows, active index, key → next index
   or toggle) with a node test, as `menuKeys.ts` `stepMenuItem`; the component keeps the active key, the scroll and
   the emits.
8. **#1723 (correctness, should → promoted)** `searchRun.ts:116` — the 8 ms slice limit is untested. Fix: 1 ms files —
   no publish and no yield before 8 ms have passed, then one publish.
9. **#1724 (correctness, should → promoted)** `store.ts:151`, `rangeStore.ts:190` — the search's `nextStop`
   forwarding and the range's `shownPath` survive. Fix: a `store.test.ts` case where `loadFile` answers `StopMovedOn`
   during a search and the store reaches the next stop (after item 1, from the stop it was sent in); a `rangeStore`
   case where `search.focusShownFile()` asks for the shown file's path.
10. **#1718 (boundary, nit → promoted)** `SearchPanel.vue:87` — the column's overlap margin lives in the panel; an
    inline `paddingLeft` for place rows. Fix: the overlap between the column's children in `SideColumn.vue`; a `pl-7`
    class.

## Target

Owned: round 1's files (`frontend/src/ui/`: `searching.ts`, `searching.test.ts`, `searchRun.ts`, `searchIcons.ts`,
`searchText.ts`, `searchText.test.ts`, `mergeSearch.ts`, `mergeSearch.test.ts`, `rangeSearch.ts`,
`rangeSearch.test.ts`, `searchListKeys.ts` (new), `searchListKeys.test.ts` (new), `SearchPanel.vue`,
`SearchResults.vue`, `SideColumn.vue`, `FileList.vue`, `App.vue`, `RangeApp.vue`, `store.ts`, `store.test.ts`,
`opening.ts`, `rangeStore.ts`, `rangeStore.test.ts`, `fileListKey.ts`, `fileListKey.test.ts`, `AGENTS.md`).

Read-only: everything else — in particular the connect slice's files above. The contract in round 1's brief holds.

## Acceptance

- Node: items 3, 4, 7, 8, 9 tests fail on the bug they name (paste one failing output per item), pass after; Stryker on
  `searchRun.ts`, `mergeSearch.ts`, `searching.ts`, `store.ts`, `rangeStore.ts` — no survivor left on the lines the
  reviews named (paste).
- WebKit, both fixture pages, dark **and** light — round 1's whole WebKit line (show/hide with focus and the text
  selected, icons per pane, the three filter cases, Match Case, a group closing and opening, × on a row and a group
  then Enter, Ctrl+B with the panel shown, the width handle sizing both, a row click opening its file, Settings →
  Keymap listing and rebinding "Toggle search", the compare window unchanged), plus: item 2's hit tests; item 5 from a
  fresh page with focus on body (hide → the shown file's pane has the keyboard) and after Ctrl+B hid the list.
  Screenshots.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check` pass (`unused` is the connect slice's to close).

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
