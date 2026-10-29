# Final run — one window-wide search in the merge and range windows

Board "Search" row 7 (sessions 35–36), pass 2. Rows 2–6b are committed and accepted (notes `.omp/run/notes/SearchCore.md`,
`SearchGoTo.md`, `SearchRangeTexts.md`, `SearchWindow.md` — incl. rounds 2–3 after pass 1 —, `SearchConnect.md`,
`SearchTidy.md`). Pass 1's report: `agent://SearchVerify` (its fixture 2a/2e failures came from an unfocused page,
#1738). Rules: `docs/slices/request-search.md`
(rules 1–13, acceptance) and `docs/plan.md` §2 **#127** (read both whole). Read-only (VF6); you fix nothing (VF1);
alone. **No mutation run** (VF7, owner #1630). Real-app sessions `v-se-…`; scratch under `/tmp/yamt-se/verify/`. The
owner's own yamt may be running: leave it alone; never `pkill`/`killall`. Do not run `pnpm -C frontend test:browser`
(Playwright's WebKit cannot launch here, #1242); MiniBrowser through `just app-session` is the engine of record (VF8).
Record every app's exit status with a wrapper.

## Recipes

1. `just check` from the main checkout at HEAD. Any failure is `gate: fail` with its first 30 relevant lines.
2. Both fixture pages (`just app-session start-fixture` for the merge window; `--range-case review --threads seeded`
   for the range window) on a **private display**: give `start-fixture` a private D-Bus session bus
   (`dbus-daemon --session --fork --print-address 1`, then `DBUS_SESSION_BUS_ADDRESS=<bus>`) so `just webdriver` falls
   back to `xvfb-run` instead of placing MiniBrowser on the owner's screen; record `document.hasFocus()` beside every
   selection or focus read (it must be true). MiniBrowser ~1600×1000, dark **and** light:
   a. Ctrl+Shift+S shows the panel above the file list, the box focused with its text selected; again hides it and the
   keyboard returns to the shown file; again shows the same query, rows, closed groups and dismissals.
   b. A word on an unchanged line: one row with every pane's icon (merge three, range two); a word only one side has:
   its own row with that icon; icons titled "<pane>, line N"; the summary "N results in M files".
   c. Filters: one pane off, two off (rows of the remaining pane only), all off → "Every pane is filtered out.";
   turning them on brings back nothing dismissed.
   d. Match Case narrows a mixed-case word.
   e. With collapsing on, a row whose match lies in collapsed lines: its file opens (one not yet opened, one opened),
   the selection's text equals the query in the Result (range: the new side) — read again 500 ms later, still
   equal —, the stretch around it shows, that pane has the keyboard; a click on a row's left-pane icon does the
   same in the left pane; keyboard: Down from the box, Up/Down, Left/Right on a group, Enter on a row.
   f. A group closes and opens; × on a row and on a group (counts drop); Enter in the box brings everything back.
   g. Merge: typing in the Result on a matching line updates that file's rows ~300 ms later; undo brings them back.
   h. Ctrl+B with the panel shown: the panel takes the whole column; both hidden: the column goes; the width handle
   sizes the column.
   i. Settings → Keymap: "Toggle search" in the Window group; rebind it, the new key toggles, Ctrl+Shift+S no longer
   does; reset it.
   j. The compare window (`?diff`): no panel, Ctrl+B and its tab list as before.
   k. At the default 240 px column and at 440 px: for every row of a query, the `<mark>` lies wholly inside its
   preview's box (when the match fits), the text after it gives way first, then the text before it from its left (its
   end next to the match stays); a match followed by a space, one preceded by a space and one beside a tab render as
   written (innerText per part); a long line ends in an ellipsis at the right.
   l. A new search lists from the top with no row active: search a common word, ArrowDown far down, Enter on a row,
   then type a query with few results → rows shown at once from the top; refine by a letter and toggle Match Case →
   Down from the box activates the first row at the top. Scrolled down, typing in the Result on a matching line
   (merge) keeps the list's position.
   m. Hide focus: Settings → Back → Ctrl+Shift+S twice → the shown file's lead pane has the keyboard (merge: Result;
   range: the right column); with the Local pane (range: left column) focused first → back there; with the Settings
   screen shown, Ctrl+Shift+S twice → the control focused before (not `BODY`), and Back does not jump into a pane.
3. Real app, merge window on `scripts/demo-repo.sh /tmp/yamt-se/verify/demo` (`just app-session start-app --name
   v-se-m --repo …`), dark and light: 2a, 2b, 2e (selection still equal 500 ms later), 2g, 2k at 240 px, 2l, 2m; Reset on a searched file
   updates its rows; a file changed on disk (edit it with `printf` from the shell) re-searches. The very first
   Ctrl+Shift+S after the app starts (window focused, nothing clicked yet) shows the panel — once seen not to; record
   what you see on each fresh start. A file shown as a choice (a binary one: a third session `start-app --name v-se-c
   --fresh-repo` shows `assets/logo.bin`), focus on the page: Ctrl+Shift+S twice → its first choice button ("Take
   left") has the keyboard.
4. Real app, range window on `scripts/range-repo.sh /tmp/yamt-se/verify/range` (`start-app --name v-se-r --range
   main...feature --repo …`), dark and light: 2a, 2b, 2e; binary, too-large, not-UTF-8, mode-only, kind-change and
   submodule files never appear.
5. Size: a scratch repository under `/tmp/yamt-se/verify/big` with a range of 2,000 changed text files (generated by a
   shell loop, plain git with `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1`) and one 2 MiB minified line: a
   query with more than 20,000 hits shows the cut sentence; the window stays responsive while it runs (type in the box
   and scroll the file list during the run; record the longest frame you can measure with a `requestAnimationFrame`
   probe).
6. Close (WM_DELETE_WINDOW) every app you started → exit statuses.

## Report

`gate: pass|fail`, the `just check` result line, one observed value or screenshot path per step.
