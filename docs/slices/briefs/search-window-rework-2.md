# Slice SearchWindowR2 — fix round 2: the match stays visible, a new search's list shows its rows, hide returns to the shown file

Board "Search" row 5, fix round 2 (session 36). Round 1 `53e047b` (brief `docs/slices/briefs/search-window.md`), fix
round 1 `fcdce10` (`-rework-1.md`), notes `.omp/run/notes/SearchWindow.md`. The final run (`SearchVerify`, full report
`agent://SearchVerify`, screenshots under `/tmp/yamt-se/verify/`) passed the gate and every other step; three defects
remain, all in this slice's files. Rules: `docs/slices/request-search.md` rules 1 and 7.

1. **#1735 (block, rule 7)** `SearchResults.vue:172-177`. At the default 240 px column, the match is outside the
   visible row in 9 of 12 merge rows and 8 of 19 range rows: the core's preview keeps up to 26 characters before the
   match (`frontend/src/search/internal/preview.ts`, VS Code's cut, `…` when cut), `before` and the `<mark>` are
   `shrink-0`, so they fill the text area and the `after` span renders 0 px wide. Repro: merge fixture, query
   `codeFeatures`; range fixture, query `card`; compare each `<mark>`'s right edge with its preview span's right edge.
   Required: whenever the row's text area is at least as wide as the match, the whole match is visible. Space is given
   up in this order: the text after the match first (cut at its right with an ellipsis, as now), then the text before
   it, cut from its **left** (its end next to the match stays). Every character still renders as written (spaces and
   tabs around the match, `SearchTidy`'s fix: no `nowrap` on these spans). CSS only; the core's preview is unchanged.
   Beware `direction: rtl` for the left cut: it reorders punctuation at the ends of a left-to-right text.
2. **#1737 (block, rule 7)** `SearchResults.vue`. After a new query with fewer rows the list keeps its old scroll
   position and shows no rows while the summary counts them (seen: `scrollTop 757`, `scrollHeight 1540`,
   `clientHeight 343`, 0 rows rendered, "9 results in 1 file"); rows come back only after scrolling to the top. Repro:
   merge fixture, search `return`, ArrowDown far down the list, Enter on a row, then type a query with few results.
   Required: a new search (a new query, Match Case toggled, Enter in the box) shows its list from the top, as VS Code
   does; a row change that is not a new search (the Result typed in, a disk change, a dismissal, a filter, a group
   closed) keeps the list where it is, except that rendered rows never drop to none while rows exist (clamp to the
   end). The list's scroll position has one owner: this component.
3. **#1736 (should, promoted; rule 1)** `SearchPanel.vue:58-71` `focusBack`. Hiding returns the keyboard to whatever
   had it before the panel showed; after Settings → Back that is the Settings button, not the shown file. Repro: click
   Settings, then Back, then Ctrl+Shift+S twice → `BUTTON Settings` focused. Required: hiding gives the keyboard to the
   shown file — back to the pane that had it before the panel showed when that was one of the shown file's panes
   (still connected, same path: today's case of the Local pane keeps working); otherwise as `focusShownFile` does (the
   lead pane; a choice file's first button, a range sentence — `useSearchGoTo` callers, unchanged). Never to a button,
   toolbar or header control. Keep the existing rule that a hide with the keyboard outside the panel moves nothing.
   `ui/` imports nothing from `@codemirror/*` (fence); if you need to know whether an element is a pane, use what the
   views already expose or a DOM marker inside your owned files, and say which in your report.

## Target

Owned: `frontend/src/ui/SearchResults.vue`, `frontend/src/ui/SearchPanel.vue`, `frontend/src/ui/searching.ts`,
`frontend/src/ui/searching.test.ts`. Read-only: everything else. Need another file? Name it in
`deviations_from_brief` with why, and do the rest.

## Acceptance

- `pnpm -C frontend sfc-order`, `typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.
- WebKit on a **private display with `document.hasFocus()` true**, recorded beside every read (MiniBrowser on the
  owner's screen lacks focus and shrinks selections, #1738: give `just app-session start-fixture` a private D-Bus
  session bus so `just webdriver` falls back to `xvfb-run`, as `SearchVerify` did), both fixture pages, dark and light,
  before and after the fix:
  - item 1 at 240 px (the default) and 440 px: for every row of `codeFeatures` (merge), `card` (range), a match
    preceded by a space, one followed by a space and one beside a tab: the `<mark>` lies wholly inside its preview
    span's box, and the rendered text (innerText per part) is the line's text there; a long line ends in an ellipsis
    at the right; at 240 px a cut before-text shows its end next to the match.
  - item 2: the repro above → rows rendered at once from the top; then, scrolled down, typing in the Result on a
    matching line (merge) keeps the list's position.
  - item 3: Settings → Back → Ctrl+Shift+S twice → the shown file's lead pane has the keyboard; with the keyboard in
    the Local pane first → back to the Local pane.
- Real app (`just app-session start-app` on `scripts/demo-repo.sh`), dark: item 1 at 240 px and item 3. Paste values
  and screenshot paths.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
