# Slice SearchWindowR3 — fix round 3 (Gate B, owner #1744): a new search starts the keyboard at the top, a hide with no file on screen, the clip note

Board "Search" row 5, fix round 3 (session 36). Round 2 `632e7be` (brief `docs/slices/briefs/search-window-rework-2.md`,
report `agent://SearchWindowR2`) fixed the final run's three defects; its reviews (`agent://SearchWindowR2Boundary`,
`agent://SearchWindowR2Correct`) found the items below. Rules: `docs/slices/request-search.md` rules 1, 7, 8. Keep every
round-2 behaviour (the match visible at 240 px, a new search lists from the top, the clamp, the pane-or-`focusShownFile`
hide while a file is on screen).

1. **#1741 (block, rule 8)** `SearchResults.vue:42`. A new search scrolls the list to the top, but the keyboard's active
   row (`activeKey`) carries over: place keys survive a refined query (`codeF` → `codeFe`) or a Match Case toggle, and
   group keys are the path, so the old active row is still found at an index that may be off screen. Down from the box
   reaches `focusList`, which picks row 0 only when nothing is active; the next Enter opens a place the user cannot see
   and the next Down scrolls away from the top. Fix: a new search (the `fullRuns` watch) also clears `activeKey`, so the
   keyboard starts at the first row, as VS Code does.
2. **#1742 (block, rule 1 / #1722)** `SearchPanel.vue:71`. With the Settings screen or a server log shown, show then
   hide now calls `focusShownFile()`, whose go-to waits until the file's view is shown (`shown` needs
   `screen.kind === 'files'`, `App.vue` ~112/119, `RangeApp.vue` ~126; `useSearchGoTo` checks it): the keyboard drops
   to `<body>` and the waiting request takes the keyboard when the user presses Back. Fix: the panel learns whether a
   file is on screen (pass it a file only when the files screen shows, e.g. `screen.kind === 'files' ? active : null`
   in `App.vue` and the same in `RangeApp.vue`, or an equivalent prop). No file on screen: refocus the element saved at
   show if still connected (round 1's behaviour there), never a go-to. A file on screen: round 2's rule, unchanged.
3. **#1739 (should, promoted)** `SearchResults.vue:207`. The before-text box uses `overflow-clip`, not
   `overflow-hidden`, because with `hidden` WebKitGTK 2.54 left a row's before-text scrolled by 1 px (scrollLeft −1);
   nothing says so. Add a one-line template comment beside the #1719 comment (per `skill://comment-policy`).
4. **Docs** `frontend/src/ui/AGENTS.md`, the Search paragraph (~line 45): `onFullRun` also counts `fullRuns`;
   `SearchResults.vue` alone owns the list's scroll position (top on each new search, clamped to the end when rows
   shrink, `keepInView` for the keys); the hide rule (a file on screen: the remembered pane — CodeMirror's content
   element, `role=textbox aria-multiline` — when still connected on the same path, else `focusShownFile`; no file on
   screen: the element saved at show).

Also observe once (WebKit, merge fixture), and fix in `SearchResults.vue` only if it shows no rows: with the results
scrolled far down, hide the panel, change that file's rows while hidden (type over a match in the Result so its row
goes), show again → the list shows rows. Report the values either way.

## Target

Owned: `frontend/src/ui/SearchResults.vue`, `frontend/src/ui/SearchPanel.vue`, `frontend/src/ui/App.vue`,
`frontend/src/ui/RangeApp.vue`, `frontend/src/ui/AGENTS.md`. Read-only: everything else. Need another file? Name it in
`deviations_from_brief` with why, and do the rest.

## Acceptance

- `pnpm -C frontend sfc-order`, `typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.
- WebKit on a private display with `document.hasFocus()` true beside every read (a private D-Bus session bus for
  `just app-session start-fixture`, as round 2 did), both fixture pages, dark and light, **before and after**:
  - item 1: search, ArrowDown far down, then refine the query (one more letter) and toggle Match Case: after each, Down
    from the box activates the first row at the top and Enter opens that row's place.
  - item 2: Settings shown, Ctrl+Shift+S twice → the element focused before the show has the keyboard (not `BODY`);
    then Back → the keyboard does not jump into a pane by itself. Files screen: Settings → Back → Ctrl+Shift+S twice
    → the lead pane; Local pane first → Local (round 2 kept).
  - the observation above, with values.
- Paste values and screenshot paths.

## Skills

`skill://vue-conventions`, `skill://comment-policy`, `skill://verification` (plus your autoloaded ones).
