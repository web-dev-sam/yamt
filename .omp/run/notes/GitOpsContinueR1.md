# GitOpsContinueR1 — notes (web-impl, 3.J row 8 fix round 1)

Output fields verbatim.

Both blocks (#1407+#1415, #1408+#1416) and the promoted shoulds #1409–#1414 are fixed, and all five pnpm checks pass. The new tests for blocks 1, 2 and #1414 fail on round 1's code (block 1 and #1414 only once their regression is put back) and pass now. StopView was seen in WebKit in dark and light, with Continue/Abort in its header. `store.ts` is 297 lines. One promoted should, #1413, is only partly met: the types now say the claims map must be reactive, but the compiler still accepts a plain `Map` (see deviations).

```
summary
- ui/gitRun.ts createGitRun() is the one owner of "git is running": run(stop, { call, endsApp, landing }) sets the flag, calls through `landed`, handles the reply while the flag is still set, and clears it unless the reply is a success that ends the app. Abort, Continue and closeGuard only read `running`.
- ui/emptyStop.ts: `emptyStop(facts)` is the pure empty-stop rule → { stopView, barProblem }. `keepStopMessage` keeps git's stop message for the whole stop, in its own ref (`stopMessage`), so a later problem can't erase it. The store exposes `emptyStop`; App.vue only binds it.
- Continue's hover words are in operationText.ts; `continueAction` is the single exhaustive switch and `continueLabel` is built from it. StopView's Continue/Abort sit in its header row. listedButtons/shownButtons take `operation: OperationView | null`. Writing.writing and ContinueTarget.writing are typed ShallowReactive.
- Fixture mode: `?empty` makes the second step a stop without files, with git's `edit` message.
- ui/AGENTS.md has the lines brief item 9 asks for.

files_changed
frontend/src/ui/gitRun.ts (new), frontend/src/ui/gitRun.test.ts (new), frontend/src/ui/emptyStop.ts (new), frontend/src/ui/emptyStop.test.ts (new),
frontend/src/ui/aborting.ts, aborting.test.ts, continuing.ts, continuing.test.ts, operationText.ts, saving.ts, store.ts, store.test.ts,
toolbarButtons.ts, toolbarButtons.test.ts, stops.test.ts (granted by Main: one call site and its import), App.vue, StopView.vue, MergeToolbar.vue, ToolbarMenu.vue, AGENTS.md (all under frontend/src/ui/),
frontend/src/ipc/fixtureOperations.ts, frontend/src/ipc/fixtureOperations.test.ts

tests_added
- store.test "an Abort git has not answered yet makes Continue running and refuses the close": real store; while Abort waits, continueState is running, mayClose() is false and the problem is { action: "close" }; after a refusal Continue is ready again (#1415).
- store.test "a Continue git has not answered yet makes Abort running and refuses the close": the reverse case.
- store.test "a stop without files shows git's message in the stop view, not the bar; settings hide it and later problems keep it": real store; Continue → Stopped to an empty list; the stop view shows the trimmed message and the bar shows nothing; on settings both are null; a later close problem and then an abort problem go to the bar while the message stays in the stop view (#1408).
- emptyStop.test (pure): empty stop with a message (trimmed) and without one (null, "", whitespace); a list with files; no recorded operation; the settings and serverLog screens; a later close or continue problem not erasing the message; keepStopMessage clears the old message during the move and keeps only a "stopped" problem's message.
- gitRun.test: a success that ends the app keeps the flag set; a success that doesn't, and a refusal, are handled while set and then cleared; a reply after the stop was dropped is not handled and clears the flag.
- continuing.test filesLeft test now includes a Remembered file → filesLeft, "1 file is not resolved yet" (#1414).
- fixtureOperations.test "?empty makes the second step a stop without files, with git's edit message, and the third lists them again".

smoke_evidence
- On round 1's code (`git archive e3e4063 frontend` into /tmp/r1, pnpm install --offline, new tests copied in):
  - Block 2: `vitest run src/ui/emptyStop.test.ts src/ui/store.test.ts` →
    "FAIL src/ui/emptyStop.test.ts … Cannot find module './emptyStop'"
    "× a stop without files shows git's message … TypeError: Cannot read properties of undefined (reading 'value')"
    "Tests 1 failed | 93 passed (94)".
    I also wrote round 1's App.vue rule (stopShown/stopped/barProblem) as an emptyStop.ts there: "× on another screen (settings) …", "× on another screen (serverLog) …", "× a later close or continue problem …" → "Tests 3 failed | 7 passed (10)".
  - Block 1: round 1 already shared one ref, so these tests pass on its code as it stands. I applied the regression #1415 names in round 1's store (`createAborting({ ...state, running: shallowRef(false) })`): "× an Abort git has not answered yet …" "AssertionError: expected 'ready' to be 'running'"; "× a Continue git has not answered yet …" → "Tests 2 failed". Round 1's store as it stands: "Tests 2 passed".
  - #1414: round 1's continuing.test with the Remembered lines added: "Tests 1 passed". With round 1's filter narrowed to `=== "Unresolved"`: "× files git lists as not resolved make it filesLeft …" "AssertionError: expected 'ready' to be 'filesLeft'".
- After the changes:
  - pnpm -C frontend typecheck → "$ vue-tsc -b" (no errors)
  - pnpm -C frontend test → "Test Files 125 passed (125)", "Tests 1745 passed (1745)"
  - pnpm -C frontend lint → oxlint + eslint, no output, exit 0
  - pnpm -C frontend unused → "$ knip --include exports,types" (no findings)
  - pnpm -C frontend fmt:check → "All matched files use the correct format."
  - wc -l frontend/src/ui/store.ts → 297
- WebKit (MiniBrowser through `just app-session start-fixture --name r1stop`):
  1. Opened `?operation=rebase&empty` and marked every file resolved ("All files are resolved. Continue rebase to let git go on.").
  2. Clicked Continue rebase. Screenshot /tmp/r1stop-dark.png: top line "Rebasing feature/reminders onto main · 2 of 3"; header row has "Continue rebase" (primary look), "Abort rebase", and the gear; body has "Git stopped without conflicts." and git's "Stopped at 8b4e7d0...  Show reminders on the board / … git rebase --continue"; no problem bar.
  3. Settings → no problem bar on that screen (`[role=alert]` none).
  4. Light → Back: data-theme "light"; /tmp/r1stop-light.png shows the same layout in the light palette.
  Session stopped (webdriver and vite stopped).

deviations_from_brief
- frontend/src/ui/stops.test.ts:315 (+ import): createAborting takes `gitRun: createGitRun()`. Main granted that file for this one change.
- A rejected Abort now reports its failure (and re-reads the list) while "git is running" is still set, as Continue already did. Round 1 cleared the flag first. This follows from one release rule for both (#1407).
- The empty-stop rule as decided: the bar leaves the `stopped` problem out whenever the stop is empty (operation recorded, no files), on every screen, so settings and server log show neither git's message nor a bar. With files listed or no recorded operation, the `stopped` problem stays in the bar. Git's message lives in the store's `stopMessage` (set by keepStopMessage, the store's only route to stops.ts `nextStop`), so a later problem doesn't erase it. stops.ts is read-only, so the message is copied from the `stopped` problem right after `nextStop`.
- #1413 is only partly met: Vue's ShallowReactive brand is an optional private member, so a plain `Map` still type-checks. I checked by building the store's map as `new Map()` (0 errors) and by a temporary `ShallowReactive<Map<…>> = new Map<…>()` probe (no error), both reverted. The types now state the requirement, but the compiler does not enforce it. Enforcing it would need a brand created only in one constructor; I did not add that.
- OperationButtons.vue, ProblemBar.vue, question.ts, problem.ts, problemText.ts, closeGuard.ts needed no change (closeGuard already took a `Readonly` running ref).
- AbortState and GitCall are no longer exported (knip: no importer once toolbarButtons takes the operation).
- The `?empty` fixture message is git's rebase `edit` stop text for every step operation; frontend/src/ipc/AGENTS.md (not owned) still names only `?operation=` and `?rewords`. Suggested addition: "`?empty`: the second step is a stop without files".
- I ran `pnpm install --offline` in the worktree, because it had no node_modules.

open_risks
- frontend/src/ui/gitRun.ts:21-31: no try/finally. If a `landing` throws (nextStop or reportFailure rejecting), "running" stays set and the window can't close, as in round 1.
- frontend/src/ui/saving.ts:19, continuing.ts:18: the ShallowReactive types are not enforced by the compiler (see deviations).
- frontend/src/ui/gitRun.ts:27: a success that ends the app leaves "running" set for good, as in round 1. This depends on Rust closing the window.
- The project map / architecture.md entries for gitRun.ts and emptyStop.ts (and round 1's continuing.ts, currentStop.ts, OperationButtons.vue, StopView.vue) are not in my slice, so `just map-check` will flag them until Main adds them.
```

Main should run `just check`, `just map-check` (after the map lines) and `just mutants` on `ui/{gitRun,emptyStop,continuing,aborting,operationText,toolbarButtons}.ts`.

## Boundary re-check: fail — #1407–#1416 fixed; new block #1420 (stop message held twice). Mutants on changed lines: 2 word-constant survivors (#1421 dropped).
