# LspClient (3.Y-client, board row 4) — committed cf932f2

Slice 3.Y-client is done: `frontend/src/lsp/` and `ipc/ServerHost.ts` are in place, and every acceptance line passed when I ran it. Real oxlint and oxfmt servers show problems, format a file, and leave no process behind. One thing to know first: oxfmt answers `null` to a format request until it has its configuration, so a Save in the first moments after it starts comes back `unchanged` even when the file is badly formatted (open_risks 1).

```
summary
  frontend/src/lsp/ is yamt's own language-server client. It is framework-free (fenced in oxlint and in scripts/fences.ts) and imports only type definitions from ipc/.
  lsp/index.ts exports LanguageServers, OpenDocument, ResultDocument, DocVersion, ServerSpec, InstallHint, PackageManager,
    ServerState, FailReason, ServerView, LogLine, ProblemSeverity, LinePosition, ServerProblem, FormattingOptions,
    FormatRefusal, FormatReply, plus Timers (the type of the constructor's clock argument).
  ipc/ServerHost.ts (type-only re-export from ipc/index.ts) exports RunId, ServerCommand, HostEvent, StartReply, ServerContext, ProgramFound, ProjectFile and ServerHost.
  Internal files: messages (JSON-RPC envelope), protocol (valibot schemas for the LSP subset read), connection, answers, server, attempt (one process run), serverDocs,
    documents, handshake, formatting, edits, uri, languageIds, log, state, spec, json, timers, version.

files_changed
  frontend/src/ipc/ServerHost.ts (new), frontend/src/ipc/index.ts
  frontend/src/lsp/index.ts, frontend/src/lsp/AGENTS.md
  frontend/src/lsp/internal/{answers,attempt,connection,documents,edits,formatting,handshake,json,languageIds,log,messages,
    problems,protocol,server,serverDocs,spec,state,timers,uri,version}.ts
  tests: frontend/src/lsp/index.test.ts and frontend/src/lsp/internal/{answers,attempt,connection,edits,json,spec,uri,version}.test.ts
  frontend/scripts/fences.ts, frontend/scripts/fences.test.ts, frontend/.oxlintrc.json

tests_added
  lsp/index.test.ts (78 tests). A fake ServerHost plays scripted JSON-RPC servers under vitest fake timers. Each test names the rule it pins:
    rule 1    serving by extension and folder (frontend/ vs frontendish/, .css, upper-case .VUE); URI and languageId in didOpen
    rule 2    lazy start; a document already open at setSpecs; startOnOpen false until start(name); install → notInstalled, never started;
              a user stop survives setSpecs; no host → failed{noHost}; start/stop act on the named spec only; no second process on start
    rule 3    an unchanged spec (deep-equal settings) keeps its run; a newly installed one starts without Restart;
              a changed spec is stopped and restarted and its problems cleared; a removed spec is stopped;
              a user stop carries over only within the same name; restart clears it
    rule 4    initialize carries every field in the brief; order initialize → initialized → didChangeConfiguration → didOpen;
              30 s time-out → failed{timedOut} and the run is stopped; error reply or malformed result → initializeFailed;
              each start reply maps to its reason; root null, a rejected context and a throwing host.start fail the start;
              the context is read once; a Windows root
    rule 5    sync 300 ms after the last change, full text, rising versions, CRLF text unchanged;
              one take serves every server; close sends didClose; a closed document is not opened later
    rule 6    push and pull land in one slot; pushes with and without a version; bad versions are dropped and logged;
              previousResultId is sent; "unchanged" keeps the items; a stale pull is pulled again (one in flight per document);
              a sync of one document pulls every document on that server; refresh → null, then a new pull; failed, timed-out
              or malformed pulls are logged; problems are cleared on stop, crash and removal
    rule 7    answers end to end; log and show messages go to the log; $/progress and telemetry/event are dropped
    rule 8    formatter choice in list order; waits for a starting formatter; noFormatter, notRunning (stopped, crashed),
              failed (error reply, overlapping edits, malformed edits, a throwing take); timedOut at 5 s total (also after a 2 s start wait);
              unchanged; the UTF-16 emoji case and a multi-line edit; a pending sync is not repeated after format
    rule 9    crash → crashed{code}; pending requests fail; it stays crashed; restart; stop before the host replies, before the
              context arrives, and during initialize; a server that exits during shutdown is not stopped again; destroy waits for every stop
    rule 10   log keeps the last 2,000 lines across restarts; line sources and texts; onChange fires and unsubscribes
    rule 11   malformed messages are logged and dropped
  answers.test.ts      the answers table row by row (configuration sections, null answers, workspaceFolders, showMessageRequest, applyEdit, -32601, -32602)
  connection.test.ts   ids, time-out with $/cancelRequest, close, answering server requests, malformed messages
  edits.test.ts        UTF-16 positions, CRLF, ordering, inserts at one position, overlap, clamping, a lone CR
  uri.test.ts          spaces, #, non-ASCII, Windows drive (server's lower-case %3A), \\?\ prefix, UNC
  json, spec, version, attempt tests: deep equality, section lookup, extension and serving, languageId, the version brand, run gating
  fences.test.ts       lsp importing vue or @tauri-apps → PM3; lsp importing editor, ui, model or connectors → PM2; ipc and own internal/ allowed

smoke_evidence
  Acceptance 1 (node tests):
    `pnpm -C frontend test` → "Test Files  79 passed (79) / Tests  939 passed (939)"; the lsp/ files alone: "Tests  137 passed (137)"
  Acceptance 2 (throwaway node ServerHost on child_process with Content-Length framing; oxlint --lsp and oxfmt --lsp on a temp
  project with copies of .oxlintrc.json and .oxfmtrc.json; script deleted after the run):
    showProblems oxlint v1 lint.ts: [{"from":{"line":1,"character":2},"to":{"line":1,"character":11},"severity":"error","message":"`debugger` statement is not allowed\nhelp: Remove the debugger statement","source":"oxc","code":"eslint(no-debugger)"}]
    format reply after 1000 ms: {"kind":"formatted","server":"oxfmt","sent":"export   const   x  =  {a:1,b:  2}\n","result":"export const x = { a: 1, b: 2 };\n"}
    after destroy, children exit codes: [ 0, 0 ]
    log oxlint: [yamt] Starting oxlint --lsp in the repository root / [yamt] Exited with code 0   (oxfmt the same)
    pgrep -af "wt/tfe344d9af/m/frontend/node_modules/.*(oxlint|oxfmt).* --lsp" → no lines, exit 1
    (I scoped pgrep to this worktree's binaries; a bare `pgrep -f "oxlint --lsp"` also matches language servers started from /home/wds/Projects/yamt, which I did not start.)
  Acceptance 3 (`pnpm -C frontend lint`, `typecheck`, `test`, `unused`, `fmt:check`), all exit 0:
    lint      "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"" with no findings
    typecheck "$ vue-tsc -b" with no errors
    test      939 passed
    unused    "$ knip --include exports,types" with no findings
    fmt:check "All matched files use the correct format."
  Not asked, but run: stryker over lsp/*.ts and lsp/internal/*.ts with --ignoreStatic. The last full run reported 6 survivors
    out of 1,054 mutants; I then added tests for the four uncovered failure paths and did not run stryker again.
    Survivors I believe cannot be detected are in open_risks 3. On fences.ts, every mutant on my changed lines was killed.

deviations_from_brief
  1. frontend/.oxlintrc.json: added "src/lsp/**" to the framework-free override and named lsp/ in its two PM3 messages.
     Main granted ownership. Without it, the root `**/internal/**` pattern rejects lsp/index.ts importing ./internal/*.
  2. fences.ts labels the lsp import ban (editor, ui, model, connectors) as PM2 and the framework ban as PM3.
     Needed outside my files: skill://project-map must extend the PM2/PM3 text and name every new file for `just map-check`
     (frontend/src/ipc/ServerHost.ts, frontend/src/lsp/index.ts, frontend/src/lsp/internal/*.ts); docs/architecture.md likewise.
  3. Contract additions: lsp/index.ts exports `Timers = { now, setTimeout, clearTimeout(id: number | undefined) }` as the
     constructor's optional second argument (default: the system clock). ServerHost.ts has one-line doc comments for `project`,
     `send` and `stop`; the `stop` one records Main's clarification (stop resolves once signalled; Exited always follows; "stopped" is reached on Exited).
  4. Internal split differs from the suggestion: added protocol.ts, serverDocs.ts, attempt.ts, handshake.ts, json.ts, timers.ts and
     version.ts (each one concern); no separate sync.ts, documents.ts holds the 300 ms sync.
  5. Decisions the brief left open:
     - A null repository root, or a context() that rejects, fails the start as initializeFailed with a message.
     - Format: the first spec in list order that is running and advertises formatting wins; one still starting is waited for;
       otherwise the first formats-spec that is not running (stopped, crashed, failed, stopping, notInstalled) gives notRunning,
       else noFormatter. No host, or a closed document, gives noFormatter.
     - A user stop is carried by name onto a changed spec of the same name.
     - Pull requests time out after 30 s (logged, $/cancelRequest sent).
     - Every request time-out logs "No answer to <method> within N s; cancelled"; pending requests at close log "...: the server stopped".
     - A diagnostic without severity counts as "error"; a numeric code becomes a string.
     - A pushed version that is not a positive integer, or is newer than the last one sent, is dropped and logged.
     - A malformed initialize result is initializeFailed.
     - A malformed workspace/configuration request gets -32602 and is logged.
     - Unknown notifications are dropped silently.
     - initializationOptions is omitted when null; didChangeConfiguration is always sent.
     - A stale pull is re-pulled because every sync asks for a pull again, so a reply for an older version always has another pull behind it.
     - Problems are cleared (and didClose sent) when a stop begins, and at once on a crash.
     - `project` is taken without a trailing slash (no normalisation).
     - URIs: a Windows \\?\ prefix is stripped, the drive letter is upper-cased, a UNC server becomes the URI authority; a server's
       URI is decoded and its drive letter case folded before comparing.
  6. Promise.withResolvers (a rule hook suggested it) is not used: tsconfig.app.json's lib is ES2023, which lacks it.
  7. I ran stryker mutation testing myself (target/stryker-tmp-lsp, already ignored by git).

open_risks
  1. oxfmt answers `textDocument/formatting` with null until its own workspace/configuration request has been answered. Probed
     directly: a format sent right after start came back `unchanged`; the same request 1 s later was `formatted`. A Save in the first
     moments after oxfmt starts can therefore report `unchanged` (lsp/internal/formatting.ts:79-110). I did not work around it (out of scope).
  2. Server.#release waits for `Exited` after host.stop (lsp/internal/server.ts:259-275), as Main specified. If a host ever fails to send
     Exited, that stop and destroy() never finish.
  3. Mutation survivors I believe no test can tell apart:
     - server.ts:129 `markStarted(null)` in the failed-context path
     - server.ts:160 `reply.kind === "closed"` (the attempt check already covers it)
     - index.ts:31 and :33, the "failed" kind literals in readyContext
     - index.ts:47, the initial `#startOnOpen` value
     Exhaustive `default` branches show as uncovered.
  4. [INFERENCE] The Windows root form from Rust (verbatim \\?\ prefix, drive case) is not checked on Windows (lsp/internal/uri.ts:10-31).
  5. LanguageServers keeps servers removed by setSpecs in `#retired` so destroy() can wait for them, so the list grows by the removed
     ones per setSpecs (lsp/index.ts:74-76).
  6. In the smoke run oxlint pushed the same version-1 problems twice; harmless, the editor gets the same slot twice.
```