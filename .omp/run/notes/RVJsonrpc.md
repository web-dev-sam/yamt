`frontend/src/jsonrpc/` now exists: language servers and the coming agent client share one JSON-RPC connection, and `lsp/` imports it with its behaviour unchanged. The new jsonrpc tests do not run under `pnpm -C frontend test` yet, because `frontend/vite.config.ts` doesn't include that folder (fix under deviations). Typecheck, lint, fmt:check and `test` pass. `unused` fails, only on `RangeSideLabel` in `src/ipc`, which this slice doesn't touch.

**summary**
- `frontend/src/jsonrpc/` (`index.ts`, `connection.ts`, `messages.ts`, `timers.ts`, `AGENTS.md`) holds the connection moved out of `lsp/internal/`, and `Answer` now lives there.
- `ConnectionOptions { cancelNotification: string | null }`: on a deadline, `$/cancelRequest` is sent only when it is set. With `null` the log line drops "; cancelled".
- `requestUntilAnswered(method, params)` has no deadline. It settles on its answer or on `close()`.
- The error reply now carries `code`, `message` and `data`. The envelope parse keeps `error.data` (`undefined` when absent).
- `lsp/` imports `../jsonrpc` and passes `{ cancelNotification: "$/cancelRequest" }`. `fences.ts` treats `jsonrpc` as framework-free (PM3) and flags any import from it into another `src/` module (PM2). `lsp/` may import it. The Root/WindowRoot types and the `markdownFence` hand-off are untouched.

**files_changed**
- New: `frontend/src/jsonrpc/{index.ts, AGENTS.md, connection.ts, connection.test.ts, messages.ts, messages.test.ts, timers.ts}`
- Deleted: `frontend/src/lsp/internal/{connection.ts, connection.test.ts, messages.ts, timers.ts}`
- Changed: `frontend/src/lsp/{index.ts, index.test.ts, AGENTS.md}`, `frontend/src/lsp/internal/{answers.ts, attempt.ts, attempt.test.ts, documents.ts, formatting.ts, handshake.ts, problems.ts, server.ts, serverDocs.ts}`, `frontend/scripts/{fences.ts, fences.test.ts}`

**tests_added**
- `jsonrpc/connection.test.ts`: the 8 moved tests. The first one now expects `{kind:"error", code:-1, message:"no", data: undefined}` exactly. The harness records `clearTimeout` calls.
  - `an error reply carries code, message and data`: omp's `-32603 / "Internal error" / data.details` reply comes through whole.
  - `a request with no cancel notification sends nothing on timeout`: nothing goes out before or after the deadline, and the log reads "No answer to session/new within 1.5 s".
  - `requestUntilAnswered never times out and settles on its answer`: a day of fake time passes without it settling; it settles on its answer, and no timer is ever cleared.
  - `requestUntilAnswered settles closed on close()`: it settles `closed` with the "server stopped" log line; a later call is `closed` at once and sends nothing.
- `jsonrpc/messages.test.ts`:
  - `an incoming error keeps its data, and reads undefined data when it has none`.
  - `outgoing messages are JSON-RPC 2.0 texts`.
- `scripts/fences.test.ts`:
  - `jsonrpc importing vue, @vueuse, @tauri-apps or an icon component violates PM3`.
  - `jsonrpc importing any other src/ module violates PM2`: covers ipc, `ipc/log`, lsp, `../main` and a look-alike `../jsonrpcx/b`.
  - `jsonrpc importing itself and valibot, and lsp importing jsonrpc, violate nothing`: also covers a `?raw` import from outside `src/`.

**smoke_evidence**
- `pnpm -C frontend typecheck` → exit 0
- `pnpm -C frontend lint` → exit 0
- `pnpm -C frontend fmt:check` → "All matched files use the correct format."
- `pnpm -C frontend test` → "Test Files 165 passed (165) / Tests 2107 passed (2107)". This includes every `lsp/` test and `fences.test.ts` (35 tests).
- jsonrpc tests, run through a temporary `/tmp` vitest config with `include: ["src/jsonrpc/**/*.test.ts"]` → "Test Files 2 passed (2) / Tests 14 passed (14)", all four named acceptance tests ✓.
- `pnpm -C frontend unused` → fails with only "Unused exported types (2) RangeSideLabel src/ipc/index.ts:92:3, src/ipc/rangeDomain.ts:6:13". That is already in the committed tree (`git diff HEAD -- frontend/src/ipc` is empty).
- Stryker:
  - `src/jsonrpc/connection.ts` → 95 killed, 0 survived, 2 no coverage: the unreachable `never` default in `#dispatch`.
  - `scripts/fences.ts:115-117` → 16 killed, 0 survived.
  - The survivors in `messages.ts` and `timers.ts` are module-level code (the schema and the timer table). Stryker can't switch those on after the module loads (the false-survivor case the justfile's `--ignoreStatic` note cites, #732); the text moved unchanged apart from `data`.

**deviations_from_brief**
- **Needed: `frontend/vite.config.ts`**, node project `include`: add `"src/jsonrpc/**/*.test.ts",` after line 39 (`"src/lsp/**/*.test.ts",`).
- **Needed: `frontend/.oxlintrc.json` line 132**: add `"src/jsonrpc/**"` to `files`, and add `jsonrpc/` to the messages on lines 140 and 146. To match the fences rule in oxlint too, add a jsonrpc-only override with the pattern `{"group": ["../**"], "message": "jsonrpc/ imports no other src/ module (PM2)."}`.
- **Needed: `justfile` line 138** (the `mutants` recipe): add `'frontend/src/jsonrpc/*.ts'`, or Stryker never mutates the new folder.
- **Needed: `.omp/skills/project-map/SKILL.md`** (PM6, `just map-check`):
  - a tree row: `frontend/src/jsonrpc  the one JSON-RPC connection (plan §2 #109): index.ts, connection (Connection, ConnectionOptions.cancelNotification, requestUntilAnswered, Reply with code/message/data, Answer), messages (Incoming, parseIncoming, parseWith, the four texts), timers (Timers, SYSTEM_TIMERS)`;
  - remove `connection` / `messages/protocol` / `timers` from the lsp row (keep `protocol`);
  - add `jsonrpc ◄── lsp` to the dependency arrows;
  - change PM2/PM3 to say jsonrpc is framework-free and imports no other `src/` module.
  - `docs/architecture.md` probably needs the same.
- **Additions to the Contract** (adding is allowed):
  - `index.ts` also exports `parseWith` and `type Parsed`. Seven `lsp/` files use them and they lived in the moved `messages.ts`.
  - `index.ts` also exports `type Answer`, `type ConnectionHandlers` and `type ConnectionOptions`.
- **Why `messages.test.ts` exists:** the Contract's exports (`Incoming`, `parseIncoming`, `requestText`, `notificationText`, `resultText`, `errorText`, `ConnectionHandlers`, `ConnectionOptions`) had no importer, so knip (TS16) failed. The tests now import them from `./index`, and `messages.test.ts` pins the error `data` parse and the outgoing texts.
- **Removed:** `lsp/index.ts` no longer re-exports `Timers`; its only user, `lsp/index.test.ts`, now imports it from `../jsonrpc`.
- **Decided:** with no cancel notification, a timeout logs "No answer to X within N s" without "; cancelled". The language-server log line is unchanged.
- **Decided:** a jsonrpc import into another `src/` module is reported under rule PM2.
- **Also edited:** `lsp/AGENTS.md`, for the moved files.

**open_risks**
- Until the `vite.config.ts` line lands, `pnpm test` and Stryker never run `jsonrpc/*.test.ts`. That includes the moved connection tests, so `lsp/` loses that coverage until then.
- `frontend/src/jsonrpc/connection.ts:73`: `#timedOut` deletes the pending entry before it calls `notify`. That matches the old order, so behaviour is unchanged.
- `.omp/run/slices.json` shows as modified in the worktree; I did not touch it.