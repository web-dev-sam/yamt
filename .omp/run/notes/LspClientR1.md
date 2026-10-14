# LspClientR1 (3.Y-client fix round 1) — committed dd65e2b

Fix round 1 of slice 3.Y-client is done: all nine findings are fixed inside `frontend/src/lsp/**`, and `index.ts`'s public surface and `ipc/ServerHost.ts` are unchanged. The new tests for #900 and #901 fail on the old code and pass now. The five `pnpm -C frontend` recipes exit 0. Stryker leaves 6 new survivors, all on the #897 cleanup line in `index.ts`, and I don't think any test can catch them (open_risks 1). Two things need someone outside my files: map entries for `lsp/internal/run.ts` and `problems.ts` (deviation 10), and acceptance 2 is met only in part (open_risks 1).

```
summary
  A server's run is now one sum type, `Run` in lsp/internal/run.ts (idle / launching / starting / running / halting).
    `state` and `running` (attempt, docs, capabilities) are derived from it. Nothing else answers "running".
  Message routing and process start/stop moved from server.ts into attempt.ts. server.ts is now 242 lines (was 287).
  Problems (push, pull loop, the one slot, clearing) moved to problems.ts (`DocProblems`, `pushProblems`).
    The formatting request moved to formatting.ts; `Capabilities` and `hostContext` moved to handshake.ts.
    serverDocs.ts keeps only didOpen/didChange/didClose.
  Restart races are fixed (#900), an exit during shutdown ends the stop at once (#901), the initialize time-out is
    logged once (#895), and stopped servers are dropped from #retired (#897).

files_changed
  frontend/src/lsp/index.ts, frontend/src/lsp/AGENTS.md
  frontend/src/lsp/internal/{attempt,formatting,handshake,problems,server,serverDocs,state}.ts
  frontend/src/lsp/internal/run.ts (new)
  frontend/src/lsp/index.test.ts, frontend/src/lsp/internal/attempt.test.ts

tests_added
  index.test.ts:
    "rule 9: a server that exits during shutdown is not stopped again" (rewritten, #901)
      settle() with no 2 s advance; state is stopped; no host.stop; no 'No answer to shutdown within' line;
      the last message sent is "shutdown" (no exit, no $/cancelRequest after the exit).
    "rule 9: a stop after restart, during the old run's shutdown, keeps it stopped" (#900a)
      uses ignoresStop; state is "stopping" in the window; afterwards 1 host server, state stopped, one "Starting" log line.
    "rule 3: a spec removed after restart, during the old run's shutdown, starts nothing" (#900b)
      setSpecs([]) in the window: 1 host server, views empty, one "Starting" line.
    "destroy after restart, during the old run's shutdown, starts nothing" (#900c)
      destroy resolves; 1 host server; one "Starting" line.
    "rule 5: a document opened by a listener when its server starts running is opened once" (#903)
      2 didOpens for 2 documents.
    "rule 9: a stop before the host refused the start ends stopped"
      kills the `run !== null` survivor in Attempt.stop.
    Tighter assertions in existing tests, added to kill survivors:
      - an initialize error reply sends no shutdown (methods === ["initialize"]);
      - a closed document gets noFormatter and no formatting request is sent;
      - the malformed-push log line has source "yamt".
    "rule 10: an initialize time-out …": line 1458 is now "yamt: Stopped: the server did not answer initialize" (#895).
  attempt.test.ts (rewritten for the new API):
    - run gating: nothing is sent before Started;
    - a host that throws on start becomes SpawnFailed with its message;
    - an Exited closes the connection (the pending request settles "closed"), logs the code, reports it,
      and a later stop does not call host.stop.

smoke_evidence
  Acceptance 1, #900/#901/#903 tests failing BEFORE the fix (`pnpm exec vitest run --project node src/lsp/index.test.ts`):
     × rule 9: a server that exits during shutdown is not stopped again
       AssertionError: expected { kind: 'stopping' } to deeply equal { kind: 'stopped' }
     × rule 9: a stop after restart, during the old run's shutdown, keeps it stopped
       AssertionError: expected [ FakeServer{ run: 1, …(6) }, …(1) ] to have a length of 1 but got 2
     × rule 3: a spec removed after restart, during the old run's shutdown, starts nothing
       AssertionError: expected [ FakeServer{ run: 1, …(6) }, …(1) ] to have a length of 1 but got 2
     × destroy after restart, during the old run's shutdown, starts nothing
       AssertionError: expected [ FakeServer{ run: 1, …(6) }, …(1) ] to have a length of 1 but got 2
     × rule 5: a document opened by a listener when its server starts running is opened once
       AssertionError: expected [ { jsonrpc: '2.0', …(2) }, …(2) ] to have a length of 2 but got 3
           Tests  5 failed | 84 passed (89)
  After the fix: `-t "exits during shutdown|after restart|opened by a listener|refused the start"` → Tests 6 passed | 84 skipped
  Acceptance 1, structure:
    #892  run.ts `Run`; server.ts `get state() { return stateOf(this.#run) }`; `get running()`.
          index.ts and formatting.ts both use `server.running` (formatting's notRunning check is `server.running === null`).
    #893  serverDocs.ts has only open/change/close/closeAll plus has/uriOf/problems/pullAll.
          problems.ts has DocProblems (push/pull/pullIfAsked/clear/close) and pushProblems.
          formatting.ts sends textDocument/formatting itself; handshake.ts declares Capabilities.
    #894  attempt.ts holds #onEvent, #notified, #answer and stop (shutdown, exit, host.stop, waits for exit).
  Acceptance 2 (all original tests still pass): `pnpm test` → Test Files 79 passed (79), Tests 977 passed (977)
  Acceptance 3:
    pnpm lint       → "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"", no findings, exit 0
    pnpm typecheck  → "$ vue-tsc -b", no errors
    pnpm test       → 977 passed
    pnpm unused     → "$ knip --include exports,types", no findings
    pnpm fmt:check  → "All matched files use the correct format."
    stryker (--mutate index.ts and internal/{attempt,formatting,handshake,problems,run,server,serverDocs,state}.ts, --ignoreStatic):
      All files | 97.31 | 98.83 | 761 killed | 0 timeout | 9 survived | 12 no cov | 2 errors
      Survivors:
        handshake.ts:20,22   the "failed" kind literals, moved unchanged from index.ts:31,33
                             (already reported in the first round, open_risks 3)
        index.ts:37          `#startOnOpen = false` (already reported)
        index.ts:66-67       6 mutants on the new #897 filter; see open_risks 1
      No cov: only the exhaustive `default: never` branches.

deviations_from_brief
  1. #892: `Attempt` also keeps its `AnswerContext` (settings and folder). It needs them to answer requests now that
     #894 moved answering into it. Its `run` and `hasExited` are private fields, not public getters, because nothing
     outside reads them.
     Server has a `running` getter (attempt, docs, capabilities) instead of a separate `docs` getter.
     Every Run variant carries `attempt` (null when none), so "is this attempt current" is one comparison:
     `this.#run.attempt === attempt`.
     `launching` has no attempt: the Attempt is created once the context is ready, and a stop while launching goes
     straight to stopped.
     Run and `stateOf` live in a new file, internal/run.ts, so server.ts stays at 242 lines.
  2. #900: instead of a separate `#wantsStart` flag, the `halting` variant carries a mutable `startAfter`.
     start/restart set it, halt clears it, and the deferred launch runs only if it is still set.
     This keeps one sum type, as #892 asks.
  3. #894: Attempt calls back into Server for log and exited, plus a `docs()` lookup. Pushes and refresh pulls need
     the current run's documents.
     The "Exited with code …" line is now logged by Attempt (same text).
     Server.#release became Attempt.stop.
  4. #893: problems.ts exports `pushProblems(params, docs, log)`, which parses the push and finds the document by URI.
     `toProblem` is now private to problems.ts.
     DocProblems takes a `show` callback instead of the ResultDocument; this avoids a documents.ts ↔ problems.ts
     import cycle.
     ServerDocs keeps `pullAll` (the pull after every sync), `problems()` and `uriOf(entry): string | null`.
     formatting.ts uses that null as its "document is open on this server" check.
  5. #903: I chose the first option only: documents are opened before the state becomes running. A `has` guard in
     `open` would be a second check that no test can tell apart from this one.
  6. Removed two checks that the new structure makes redundant:
     - `reply.kind === "closed"` in initialize (the attempt identity check covers it);
     - the last `connection.close()` in stop (an exit already closes the connection; with no run, nothing is pending).
  7. Tests beyond the named ones: attempt.test.ts was rewritten for the new API, and four existing tests got tighter
     assertions (listed in tests_added).
  8. Promise.withResolvers is still not used (a rule suggested it): tsconfig lib is ES2023.
  9. Stryker temp dir: target/stryker-tmp-lspr1.
  10. Needed outside my files: skill://project-map and docs/architecture.md must name lsp/internal/run.ts, together
      with the lsp files still missing there from the first round, for `just map-check`.

open_risks
  1. Acceptance 2 asks for no new Stryker survivor on my lines, and 6 remain at frontend/src/lsp/index.ts:66-67
     (the #897 filter). The filter only frees memory. halt() on a server that has already stopped resolves at once
     and does nothing, so no public method can tell whether the stopped server was removed from #retired. I see no
     test that could kill these mutants.
  2. frontend/src/lsp/internal/run.ts:20 `startAfter` is the one mutable field in Run. It is mutated in place because
     the state does not change, so no change notification is needed.
  3. Two things rely on the host contract (Exited is the last event of a run) and on Attempt.stop running in order:
     - frontend/src/lsp/internal/server.ts `#halt`/`#halted`: a new attempt is created only after the old one exited
       or never started;
     - the attempt identity checks are what stop an old attempt's late messages from acting on a new one.
     The first-round risk still holds: a host that never sends Exited after stop() leaves the stop, and destroy(),
     waiting forever (attempt.ts:82).
```