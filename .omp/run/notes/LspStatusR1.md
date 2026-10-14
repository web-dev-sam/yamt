# LspStatusR1 (3.Y-status fix round 1)

All nine findings are fixed. `pnpm -C frontend lint`, `typecheck`, `test`, `fmt:check` and `sfc-order` exit 0. In WebKit on the fixture page, the running dot is clearly visible in both themes, a second click on the open server's button closes its menu, and a capped log stays put when scrolled up and follows the end at the bottom. Three of the four mutation survivors on my files have no observable effect; the fourth was there before this round (details under `open_risks`). `just map-check` will fail until the project map names my three new files (exact entries under deviations).

```
summary
  Fixes all nine 3.Y-status findings (#957–#965). `serving` now leaves the rule to lsp and reads serverViews only so a
  computed re-runs on onChange. The running dot uses a new --color-success-signal token. Clicking the open server's
  button closes its menu. `Screen` lives in ui/screen.ts, and shownLog is re-read on every screen change, whoever
  writes it. Log rows keep stable keys and a scrolled-up log holds its place at the 2,000-line cap. Fixture mode
  (failed{noHost}) offers no Start/Restart, and the log view's Back word comes from serverText.ts.

files_changed
  frontend/src/style.css (--color-success-signal: #5fb865 Islands Dark, #208a3c Islands Light)
  frontend/src/ui/screen.ts (new, type only)
  frontend/src/ui/servers.ts, servers.test.ts
  frontend/src/ui/serverText.ts, serverText.test.ts
  frontend/src/ui/serverMenuToggle.ts, serverMenuToggle.test.ts (new; granted by Main)
  frontend/src/ui/logFollow.ts, logFollow.test.ts (new)
  frontend/src/ui/ServerStatus.vue, ServerMenu.vue, ServerLogView.vue, MergeToolbar.vue
  frontend/src/ui/useMergeController.ts (ProblemCounts re-export only)
  frontend/src/ui/store.ts (Screen import only)

tests_added
  logFollow.test.ts
    "below the cap, new lines drop nothing"
    "at the 2,000-line cap, each new line drops one above": a full 2,000-line log plus 3 new lines, capped → 3 dropped
    "equal lines are told apart by identity, not by value"
    "a log with none of the old lines left dropped them all": also covers [] → [x] and x → []
  serverMenuToggle.test.ts
    "a server's button opens its menu when none is open"
    "the open server's own button closes its menu" (#958)
    "another server's button moves the menu to that server"
  servers.test.ts
    "serving follows lsp's rule per path, whatever the other servers do": oxlint running, oxfmt stopped (#964, kills `.every`)
    "a computed over serving turns true when the server starts" (#964, kills dropping the reactive read)
    "leaving a shown log for files|settings by any writer empties shownLog": a direct `screen` write, as the store's
      pick/openSettings/closeSettings do (#960)
    "a shown log follows …" now also checks that shownLog is empty before any onChange (kills the servers.ts:20 survivor)
  serverText.test.ts "rule 3": added the row failed{noHost} → [] (#965)

smoke_evidence
  1. Each new test fails before its fix. I put the old behaviour (or the mutant) back with `edit`, ran the tests, then
     restored the fix.
     - Old servers.ts behaviour (`.every`, no screen watch) → `pnpm exec vitest run --project node src/ui/servers.test.ts`:
         × leaving a shown log for files by any writer empties shownLog   AssertionError: expected [ {…} ] to deeply equal []
         × leaving a shown log for settings by any writer empties shownLog
         × serving follows lsp's rule per path, whatever the other servers do   AssertionError: expected false to be true
         Tests  4 failed | 3 passed (7)
       (the 4th failure, "a shown log follows new lines …", only failed because showServerLog no longer calls readLog
        in my new code; it is not a test of the old behaviour)
     - `serving: (path) => servers.serving(path)` (no reactive read):
         × a computed over serving turns true when the server starts   AssertionError: expected false to be true
         Tests  1 failed | 6 passed (7)
     - serverActions failed → ["start","restart"], menuAfterClick always opens, droppedAbove → 0:
         × the open server's own button closes its menu   AssertionError: expected { name: 'oxlint', at: 10 } to be null
         × at the 2,000-line cap, each new line drops one above   AssertionError: expected +0 to be 3
         × equal lines are told apart by identity, not by value   AssertionError: expected +0 to be 1
         × a log with none of the old lines left dropped them all   AssertionError: expected +0 to be 2
         × rule 3: the actions that apply per state   AssertionError: expected [ 'start', 'restart' ] to deeply equal []
         Tests  5 failed | 27 passed (32)
     How #958 is proven: in node, by serverMenuToggle.test.ts (component-free); the click wiring, live in WebKit (item 2).
  2. WebKit fixture page (`just app-session start-fixture --name lspr1`, DPR 2). Throwaway setup, nothing committed:
     /tmp/lspr1-setup.js imports the dev server's modules, unmounts the app and mounts a new store. Its LanguageServers
     has an in-page fake host with oxlint and oxfmt, and `window.__emitLog(n)` makes the fake host send n stderr lines.
     - Dot pixel at the oxlint button: dark #5FB865, light #208A3C (`magick … txt:`).
       Screenshots: /tmp/lspr1-shots/dark-crop.png and light-crop.png. The running green dot is clearly visible next
       to the hollow stopped dot of oxfmt.
     - Toggle: click oxlint → "1 oxlint\n\nRunning\n\nStop\nRestart\nShow log"; click oxlint again →
       "menus=0 expanded=false"; click oxfmt → menu "oxfmt"; click oxlint while oxfmt's menu is open → menu "oxlint".
     - Log past the cap (2,100 lines, then 30 more at a time), following at the end:
         {"rows":2000,"atEnd":true,"scrollTop":38116,"last":"line 2130",…} … {"last":"line 2190",…,"atEnd":true}
     - Scrolled up to 20000, then 6 × 25 more lines:
         {"scrollTop":20000,"topRow":"line 1291","topOffset":-0.5}
         {"scrollTop":19512,"topRow":"line 1291","topOffset":0} … {"scrollTop":17075,"topRow":"line 1291","topOffset":-0.5}
       The row on top stays the same within half a pixel while the cap drops 25 rows above it each time.
       My first version re-measured the anchor at every update and crept 0.5 px per batch; the anchor is now kept until
       the user scrolls, so the error no longer adds up.
     - Back at the bottom, 2 × 40 lines: {"atEnd":true,"last":"line 2455"}, {"atEnd":true,"last":"line 2495"}
     - Back button → "logs=0 store.shownLog=0"; session stopped (webdriver and vite stopped, folder removed).
  3. `cd frontend; pnpm run <r> | tail` with pipefail:
       lint exit=0; typecheck exit=0;
       test: "Test Files  94 passed (94) / Tests  1167 passed (1167)" exit=0;
       fmt:check: "All matched files use the correct format." exit=0;
       sfc-order exit=0
     Mutation run on servers.ts, serverText.ts, logFollow.ts and serverMenuToggle.ts (`stryker … --ignoreStatic`,
     the same flags as `just mutants`). The survivors brief item 3 named:
       - servers.ts:24 (the empty start value of shownLog, now line 20): killed by the new assertion.
       - servers.ts:37 (`.some` → `.every`): that clause is gone; the rule is now lsp's.
       - servers.ts:26 (`screen.value.kind === "serverLog" ? … : []` → `true ? …`, now line 22): survives, but has no
         observable effect. On a non-log screen `screen.value.name` is undefined, and `LogBook.lines(undefined)`
         returns [] because no log has that name.
     Other survivors:
       - logFollow.ts:5 (`first === undefined ?` → `false ?`): no observable effect. `before.indexOf(undefined)` is -1
         because a log never holds undefined.
       - serverText.ts:195 (`{ hour12: false }` → `{}`): from round 1, not touched here (see open_risks).
     Final scores: serverMenuToggle.ts 100 %, logFollow.ts 88.89 %, serverText.ts 91.23 % (14 not covered: the
     exhaustive `default` arms and logTitle).

deviations_from_brief
  - #960: I took the brief's second option ("clear shownLog … whenever screen is not serverLog"). servers.ts runs
    `watch(screen, readLog, { flush: "sync" })`, so the store's writes (pick, openSettings, closeSettings) also re-read
    shownLog. showServerLog now only writes `screen`. closeServerLog still writes `{ kind: "files" }` itself instead of
    reusing a store transition.
  - #958: the open/close rule is the pure `menuAfterClick` in the new ui/serverMenuToggle.ts (Main granted it and asked
    to keep it out of servers.ts). OpenMenu now carries `opener: HTMLElement`, and ServerMenu takes a new required
    prop `opener`.
  - #963: rows are keyed by `firstKey + index`. `firstKey` grows by `droppedAbove(before, now)`, which looks up the new
    first line, by identity, in the old log (the brief said the old first line in the new log; that line is gone
    once anything is dropped). If none of the old lines survive, it counts them all as dropped, so the new keys
    never reuse an old row's key. The scroll anchor `{ key, offset, scrollTop }` is kept across updates until the
    user scrolls; this stops the half-pixel creep seen live.
  - #959 token values (the brief left them open): Dark #5fb865, Light #208a3c.
  - Needed for `just map-check`, outside my Owned files — `.omp/skills/project-map/SKILL.md` and
    docs/architecture.md, ui entry:
      "screen.ts (`Screen`: files | settings | serverLog{name}, the window's navigation type)",
      "serverMenuToggle.ts (`menuAfterClick`: the server button opens, closes or moves its menu)",
      "logFollow.ts (`droppedAbove`: lines the 2,000-line log dropped above, for stable log rows)".
    Also the state-table row for `screen`: its type is in ui/screen.ts, and shownLog follows every write to screen.
  - frontend/src/ui/AGENTS.md (not owned) still says servers.ts holds "`screen` for the log". It now reads screen
    and writes it only for showServerLog and closeServerLog.

open_risks
  - frontend/src/ui/ServerLogView.vue:84-85: if the user's top row is itself dropped by the cap, the anchor is cleared
    and that one update moves the view by the dropped rows. Not exercised live.
  - frontend/src/ui/ServerLogView.vue:36: a user scroll that lands exactly back on the last restored scrollTop keeps
    the old anchor, which is only a sub-pixel difference.
  - The live log check used app-session's `scroll` (it sets scrollTop), not wheel input.
  - frontend/src/ui/serverText.ts:195: `{ hour12: false }` → `{}` survives (from round 1, not in this brief). In
    en-GB the clock is 24-hour anyway, so it is likely an equivalent mutant.
```