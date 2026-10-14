# LspSetupR1 (3.Y-setup fix round 1, board row 9)

All eight findings are fixed. All three acceptance items were observed: the "fails before the fix" runs, the real-app checks on `scripts/lsp-repo.sh`, and all six recipes exiting 0. The one gap is that the real-app close went through `app-session stop`, not a user window close.

```
summary
  Asking a question now ends in "yes", "no" or "dismissed": `asking.dismiss()` is Escape, and a second `ask` while one
  waits is dismissed at once. The exit, Mark-resolved and key-clash questions treat anything but "yes" as cancel.
  serverSetup alone runs the start and focus sequences (`startUp`, `refocus`). The answer in force is whatever the
  settings file holds after a write. "Don't start" calls the new `LanguageServers.haltAll()`. Every server word
  (`projectLabel`, `NOT_INSTALLED`, `serverLabel`) now lives in serverText.ts. File types with an inner dot give null,
  and `settingsActions` is built once.

files_changed
  frontend/src/ui/asking.ts, asking.test.ts (new), closeGuard.ts, saving.ts, saving.test.ts, settings.ts, settings.test.ts,
  serverSetup.ts, serverSetup.test.ts, serverText.ts, serverText.test.ts, question.ts, question.test.ts,
  LanguageServerSettings.vue, App.vue, store.ts, store.test.ts, AGENTS.md (ui)
  frontend/src/main.ts
  frontend/src/lsp/index.ts, frontend/src/lsp/index.test.ts

tests_added
  asking.test.ts: "Yes/No ends the question as yes/no"; "Escape ends the question as dismissed"; "a second question while
    one waits is dismissed at once and leaves the first waiting"; "answering or dismissing with nothing asked does nothing"
  lsp/index.test.ts:
    "haltAll stops every run without a user stop; Start on open starts them again"
    "haltAll shows a crashed server as stopped and tells onChange listeners"
    "haltAll leaves startOnOpen as it was and starts nothing until a document opens"
    "a Start on open right after haltAll, while the old run still stops, starts a new run" (fails if haltAll halts in place)
    "a server the user stopped stays stopped after haltAll and a Start on open"
    "destroy waits for runs halted by haltAll"
  serverSetup.test.ts (the fake now models a settings file whose writes can fail, plus loadFiles/refreshFiles/loadSettings):
    #973: "settings: a Don't start whose write fails leaves the running servers running" (with a refocus afterwards);
          "settings: a Start whose write fails leaves the servers stopped";
          "settings: Don't start while Don't start is stored keeps a server started by hand" (haltAll only when the stored answer changes)
    #969: "settings: a server the user stopped stays stopped through Don't start and Start"
    #975: "focus after a failed start look finds the servers, applies the stored answer and asks nothing";
          "focus after a failed start look never asks a repository without an answer"
    #968: "start: the file list and the settings are in before detection starts";
          "focus: the file list and the settings are refreshed before detection runs again";
          "focus: before the start set-up has finished, focus refreshes but does not detect";
          fixture mode now also checks the load/refresh order
    #976: "the add form: a file type with a dot inside can never match a file, so it gives null"
    "start: as many added servers as found ones still bring the question"
    "start: a Start whose write fails starts nothing" (see deviations)
    Removed: "Escape on another question still means its cancel" (now covered by asking.test.ts)
  serverText.test.ts: projectLabel ("" → "the repository root") and serverLabel ("TypeScript (not installed)")
  store.test.ts: Escape (`dismissQuestion`) on the exit question resolves to "do not close";
    "start-up loads the file list and the settings; focus loads both again"

smoke_evidence
  1. Fails before the fix. New tests were copied into a `git archive HEAD` copy, and into a copy of the fixed tree with
     each fix undone. Both copies were in /tmp and are now deleted.
     HEAD: asking.test.ts → all 5 ×: "expected true to be 'yes'", "expected false to be 'no'",
       "TypeError: asking.dismiss is not a function", "expected false to be 'dismissed'";
       haltAll tests 5 × "TypeError: languageServers.haltAll is not a function"
     Fixes undone (old answer(): halt + apply(given); started only after a successful look; no dot check):
       × focus after a failed start look finds the servers … — "expected {} to deeply equal { oxfmt: 'running', … }"
       × focus after a failed start look never asks … — "expected {} to deeply equal { oxfmt: 'stopped', … }"
       × settings: a Don't start whose write fails … — received oxfmt/oxlint "starting" (halted, then restarted on focus)
       × settings: a Start whose write fails leaves the servers stopped — received "running"
       × settings: Don't start while Don't start is stored keeps a server started by hand
       × the add form: a file type with a dot inside … gives null
     haltAll that halts in place (instead of new Server objects):
       × a Start on open right after haltAll … — "expected [ FakeServer{ run: 1 } ] to have a length of 2 but got 1"
       × a server the user stopped stays stopped … — "expected [ 'stopped', 'stopped' ] to deeply equal [ 'stopped', 'running' ]"
     After the fix: pnpm -C frontend test → "Test Files 96 passed (96) / Tests 1215 passed (1215)"
     Stryker (the `just mutants` flags, --ignoreStatic) on asking.ts, serverSetup.ts, and the changed lines of closeGuard,
       saving, settings, serverText, store and lsp/index.ts: asking/closeGuard/saving/settings/store 100 %,
       serverSetup 95.39 %, serverText 94.12 %, lsp/index.ts 86.36 %. The 11 survivors:
       - serverSetup.ts:51 `[\s,]+`→`[\s,]`, :59 `+=`→`-=`, :69 stale `return false`→`true`, :87 `root === null`: the same
         survivors as round 1, no observable difference.
       - serverSetup.ts:42-44 (STORED_REPLIES) and serverText.ts:36 (NOT_INSTALLED): module-level constants that the vitest
         runner does not re-evaluate (#732). The same mutants applied by hand fail "Start/Don't start in the question is
         stored …" and "notInstalled reads Not installed" / "a server reads as its name …".
       - lsp/index.ts:152-153: pruning `#retired` after a halt. This code moved unchanged from setSpecs. destroy() halts an
         already-halted server, which resolves at once, so there is no observable difference.
  2. Real app: `cargo tauri build --debug --no-bundle`; `scripts/lsp-repo.sh /tmp/yamt-lsp-r1`; `just app-session`
     (tauri-driver/MiniBrowser on Xvfb)
     - Question: "Language Servers … oxfmt, oxlint, TypeScript (not installed) — web/ …"
     - Escape → "no dialog || oxfmt=Stopped, oxlint=Stopped, TypeScript=Not installed"; settings.json is
       {"antialiasing","theme"} only, with no languageServers answer; no server process
     - New session started with that settings.json → the same question again
     - Start → "oxfmt=Running, oxlint=Running …", file says "/tmp/yamt-lsp-r1": "start"; children 3023782 oxfmt --lsp,
       3023788 oxlint --lsp
     - Settings "Don't start" → "oxfmt=Stopped, oxlint=Stopped"; no server process; file says "dontStart"
     - Settings "Start" → running again: 3025179 oxfmt, 3025185 oxlint; file says "start"
     - focus-away / focus-back → "no dialog || oxfmt=Running, oxlint=Running …"; pids still 3025179 / 3025185
     - TypeScript menu: "… In web/:\n\npnpm add -D typescript-language-server …"
     - Settings Found: "oxfmt web/ oxfmt --lsp … TypeScript web/ Not installed"
     - Close (`app-session stop`) → "no yamt or server process left"
  3. In frontend/: lint exit=0; typecheck exit=0; test exit=0 (1215 passed); unused exit=0;
     fmt:check exit=0 "All matched files use the correct format."; sfc-order exit=0

deviations_from_brief
  - New or renamed exports:
    - asking.ts: `Reply`; `Asking.dismiss`; `ask` now resolves Reply.
    - serverSetup.ts: `ServerSetup.startUp` and `refocus` replace `setUpServers`/`findServers`; `dismissQuestion` is removed.
    - serverText.ts: `projectLabel` (moved from question.ts, now "the repository root"), `NOT_INSTALLED`, `serverLabel`
      (moved from question.ts).
    - lsp/index.ts: `LanguageServers.haltAll()`.
    - Store: `startUp`, `refocus`, and `dismissQuestion` (now asking's).
  - haltAll replaces each Server with a fresh one carrying its `userStopped`, and retires the old one. It does not halt
    in place, because `#startIfServing` only starts a server whose state is "stopped": a Start soon after "Don't start"
    would find the old run still stopping and never start it. The race test above fails for the in-place version.
    `setSpecs` and `haltAll` share a new private `#retire`. A side effect: haltAll shows a crashed or failed server as
    "stopped".
  - Decision 8: `settingsActions(state)` is built once in createAppStore and passed to `actions`. createServerSetup gets
    the same functions through `{ ...state, ...acts, host, servers }` (acts also carries loadFiles/refreshFiles), not
    through a separate `settingsActs` const.
  - store.ts at 300 lines (its cap). To get there I merged the two `./problem` imports, inlined `createCloseGuard` into
    `state`, and inlined `settingsActions(state)`.
  - Outside the findings: the start question also applies what the settings hold after the write (same rule as #973).
    So a Start whose write fails starts nothing and the next start asks again; before, it started anyway. Test: "start: a
    Start whose write fails starts nothing".
  - The question line now reads "— the repository root" (was "— repository root"), per decision 2.
  - Executor `new Promise` kept in asking.ts: tsconfig lib is ES2023, so `Promise.withResolvers` has no types.

open_risks
  - frontend/src/lsp/index.ts:72-77 (haltAll): a server that crashed or failed before "Don't start" afterwards shows
    "stopped", not its failure. The round-1 `setSpecs([])` trick did the same.
  - The real-app close was `app-session stop` (driver and display torn down), not the user closing the window. No
    process was left either way.
  - /tmp/yamt-lsp-r1 is left for Main to reproduce the checks.
```

Checks for Main: `just check` (map-check still needs round 1's map entries, #971), `just mutants` on this patch, `pnpm -C frontend test:browser`.