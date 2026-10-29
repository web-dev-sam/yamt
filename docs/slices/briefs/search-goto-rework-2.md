# Slice SearchGoToR2 — fix round 2: a side-pane go-to on an open file lands in view

Board "Search" row 3, fix round 2 (session 36). Round 1 `4c42cc6` (brief `docs/slices/briefs/search-goto.md`), fix
round 1 `fe204ab` (`-rework-1.md`), notes `.omp/run/notes/SearchGoTo.md`. The final run's pass 2 (`SearchVerify2`,
report `agent://SearchVerify2`, screenshots `/tmp/yamt-se/verify/p2/fm-dark-repro.png`, `fm-light-repro2.png`) found
one failure, in the merge window's go-to. Rules: `docs/slices/request-search.md` rule 8 ("… selects the match …; it is
scrolled into view, a collapsed stretch around it shows (#63), and that pane gets the keyboard. A click on a row's pane
icon does the same in that pane"); plan §2 #127, #63, #68, #82.

**#1745 (block)** `editor/internal/goTo.ts:25` / `editor/merge.ts:208` `goTo`. A side-pane go-to (a row's Local or
Remote icon) on a merge file that is **already open**, after its Result was scrolled elsewhere, selects the match in that
side pane and gives the pane the keyboard, but the match stays out of view (`selection top −1849`, `inView false`; the
pane stays near the Result's place) and the collapsed stretch around it does not show. Every time, dark and light, both
side icons. A Result row works; the same icon on a file not yet opened works; a second click works. Repro (merge
fixture, collapsing on): Ctrl+Shift+S, search `ret = augmentor(ret)`, click its row (the Result jumps to line 170 of
`vue-core-compiler-von.ts`); search `let rawName = arg.content`; click its `Local (yours), line 45` icon.

The cause is open. Leads, not conclusions: the side panes follow the Result through `ScrollSync` (`scrollSync.ts`,
`Frame`), so a sync with the Result as source may overwrite the side's scroll after `selectMatch`'s `scrollIntoView`;
a side's hidden lines open only through the owner (`folds.ts` `revealOnOwner` / `sideReveals`, the selection's own
fold reveal), so the side's scroll target may be computed before the reveal reaches it; `exactScroll.ts` pins a far
scroll. Find the cause in WebKit first (log the order of the side's selection, the reveal, the sync and the scroll
writes), then fix it at the cause: a side-pane go-to ends with the match in view in that pane, its collapsed stretch
shown, the pane focused, the other panes following it as for any side scroll (the side as the sync's source,
`ScrollSync.follow`), with no change to Result go-tos, the range window's go-to, or any non-search scroll.

## Target

Owned: `frontend/src/editor/merge.ts`, `frontend/src/editor/internal/goTo.ts`, `goTo.test.ts`,
`frontend/src/editor/internal/folds.ts`, `frontend/src/editor/internal/frame.ts`, `frontend/src/editor/internal/scrollSync.ts`
and their `*.test.ts`. Change only what the cause needs; name every owned file you leave untouched as untouched.
Read-only: everything else. Need another file? Name it in `deviations_from_brief` with why, and do the rest.

## Acceptance

- Failing before, passing after: the repro above in WebKit, on a private display with `document.hasFocus()` true
  beside every read (`dbus-daemon --session --fork --print-address 1`, then `DBUS_SESSION_BUS_ADDRESS=<bus> just
  app-session start-fixture`, so `just webdriver` falls back to `xvfb-run`), dark and light: the side pane's selection
  equals the match, lies inside the pane's visible box at +0, +500 and +1000 ms, the stretch around it shows, that
  pane has the keyboard. Also the Remote icon, and after the fix: a Result row, an unopened file's side icon, a range
  window side icon (range fixture), each still in view at +500 ms. If a node test can pin the cause (a pure rule, e.g.
  the sync's source after a go-to), add it failing-before.
- `pnpm -C frontend sfc-order`, `typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.
- Paste values and screenshot paths.

## Skills

`skill://cm6-rules`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
