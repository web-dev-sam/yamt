# Slice SearchFinalFix — a 2 MiB line freezes the window; a hide scrolls the panes to the top

Board "Search" (session 36): search core round 2 and window round 4, one slice (standing answers #1744, #1753; #1757).
The final run's pass 3 (`SearchVerify3`, report `agent://SearchVerify3`, screenshots `/tmp/yamt-se/verify/p3/`) passed
the gate and every go-to, and found two defects. Rules: `docs/slices/request-search.md` rule 1 and its acceptance (the
window stays responsive), plan §2 #127. Core notes `.omp/run/notes/SearchCore.md`, window notes `SearchWindow.md`.

1. **#1754 (block)** A query that hits a 2 MiB one-line file freezes the range window: one frame of **844 ms** for
   `var a5=needle(5);` (834 ms for `var a7=needle(7);`); every other frame ≤ 18 ms. The row shows
   `min.js src 1 …eedle(5);var a6=needle(6); var a7=needle(7);`. Lead, not a conclusion: the core's preview keeps the
   whole rest of the line after the match (`frontend/src/search/internal/preview.ts:16`, `after = lineText.slice(to)`),
   so the row lays out a ~2 MiB text node. Measure first where the frame goes (the row's render and layout, or the
   match, places, digest or line-up work over that line; a `performance.now()` split or WebKit's timeline), then fix it
   at the cause. If it is the preview: cap `after` in the core the way VS Code does (its previews keep about 250
   characters per line; the 26 characters before the match stay), never splitting a surrogate pair, with a node test in
   `preview.test.ts` that fails before; the row still ends in an ellipsis. If it is elsewhere, the same rule: no single
   task over ~50 ms for one long line.
   Repro repository (one shell script, plain git with `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1`, every git
   call as `git -C <dir>`; the shell guard refuses `cd` + `git` in a scratch repository): `main` with one commit, then
   `feature` adding `src/min.js`, one line of 2 MiB such as `var a0=needle(0);var a1=needle(1);…` repeated, plus a few
   ordinary files. `just app-session start-app --name <n> --range main...feature --repo <dir> --home <tmp home>`,
   Ctrl+Shift+S, type `var a5=needle(5);`; measure the longest frame with a `requestAnimationFrame` probe running from
   before the query until results show.
2. **#1755 (block, rule 1)** `frontend/src/ui/SearchPanel.vue:76` `focusBack`. With the Result focused before the panel
   shows, hiding it scrolls **all three panes to 0** (`1183/1223/1543 → 0/0/0`, `600/600/800 → 0/0/0`), every time,
   in two files. Lead: `pane.focus()` (and `element.focus()` on line 70) runs without `{ preventScroll: true }`, so
   WebKit scrolls the tall content element into view. Required: a hide moves no pane and no list; the keyboard lands
   as today. Repro: merge fixture, click `vueuse-use-magic-keys.ts` in the file list, click inside the Result, scroll
   the Result to 900, Ctrl+Shift+S twice → all panes at 0.

## Target

Owned: `frontend/src/search/**` (the core: keep it framework-free, PM3), `frontend/src/ui/SearchResults.vue`,
`frontend/src/ui/SearchPanel.vue`. Read-only: everything else. Need another file? Name it in `deviations_from_brief`
with why, and do the rest.

## Acceptance

- `pnpm -C frontend sfc-order`, `typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.
- #1754, before and after, in the real range app (debug build from your tree: `cargo tauri build --debug --no-bundle`)
  on a private display: the longest frame for the two queries above (before ~840 ms; after under 100 ms), and where the
  time went before; the row's text after the match ends in an ellipsis.
- #1755, before and after, merge fixture on a private display (`dbus-daemon --session --fork --print-address 1`, then
  `DBUS_SESSION_BUS_ADDRESS=<bus> just app-session start-fixture`), `document.hasFocus()` true beside every read: every
  pane's `scrollTop` before and after the hide (equal ±1 px after), the keyboard in the Result; also with Local
  focused first, and with the Settings screen shown (the control focused before keeps the keyboard).
- Stop every session and kill the private `dbus-daemon` you start, by its PID, before you report.

## Skills

`skill://ts-conventions`, `skill://vue-conventions`, `skill://verification` (plus your autoloaded ones).
