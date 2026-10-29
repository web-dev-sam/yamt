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

## Re-check after fix round 1

Boundary pass (#1715–#1718), correctness pass (#1719–#1724; no window-side cause for the range hide focus — it hands
`{ pane: "right", match: null }` to RangeView, so the cause is after: connect R1). Mutation run `just mutants a214c2a`:
96.9 %, survivors equivalent or static (searchRun.ts:70,75,148,157; mergeSearch.ts:17-19,132) or unchanged lines
(store.ts:121,142,203). Accepted.

## Fix round 2 (session 36, after the final run; `SearchWindowR2`, 19m43s, patch `632e7be`, `.omp/run/patches/SearchWindowR2.patch`)

From the final run (`SearchVerify`, gate pass): #1735 the match off screen at the default 240 px; #1737 a new query's
list blank at the old scroll position; #1736 (promoted) hide → the Settings button. Fixed: the before-text box shrinks
from its left (`justify-end`, `overflow-clip`, the after-text gives way first); `searching.ts` `fullRuns` (fed by
`onFullRun`) → SearchResults scrolls to the top on a new search, clamps to the end otherwise; hide restores a
remembered pane (`[role=textbox][aria-multiline=true]`, same path, connected) else `focusShownFile`. WebKit (Xvfb,
`hasFocus` true) before/after both pages, dark/light; real app dark: 240 px `hidden` 18→0 (merge), 11→0 (range), 11→0
(app); rendered 0 → 10; Settings → Result pane, Local kept. 2988 tests. `just mutants 79cba9f`: searching.ts 85/85
killed. Reviews: boundary pass (#1739 should promoted: no note for `overflow-clip`; #1740 nit dropped), correctness
fail: #1741 the keyboard row survives a new search, #1742 a hide with Settings shown drops the keyboard to body and a
waiting go-to takes it on Back (#1743 should dropped). Gate B (owner #1744): a third round, `SearchWindowR3`.

## Fix round 3 (Gate B; `SearchWindowR3`, 17m41s, patch `6b8f3fa`, `.omp/run/patches/SearchWindowR3.patch`)

A new search clears `activeKey` with the scroll to the top (#1741); both roots pass `shownPath` only while
`screen.kind === 'files'`, and with no file on screen a hide refocuses the element saved at show, never a go-to
(#1742; `Remembered.element`, the pane test at hide time); the `overflow-clip` note (#1739); `ui/AGENTS.md` Search
paragraph updated. WebKit (Xvfb, `hasFocus` true) before/after, both pages, dark/light: Down after a refine or Match
Case → the first row at the top (before: none active, Enter opened an off-screen place); Settings shown, toggle twice
→ Back button (before: `BODY`), Back → gear, no jump; files screen kept (lead pane; Local kept). Hidden-panel edit:
rows show, clamped. `just mutants 1fd6caa`: nothing to mutate. Re-checks: boundary pass, correctness pass (open
risk: a pane saved on the files screen, then Settings, then hide → `focus()` on an invisible pane does nothing, body;
same as rounds 1–2, not reachable without clicking back into the panel). Accepted.
