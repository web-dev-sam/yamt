# 3.Y: language servers design (plumbing)

**Recommendation: option A.** yamt writes its own small LSP client in the window, in a new module `frontend/src/lsp/`. Rust is only a pipe: a new crate `yamt-lsp-host` starts the server processes and passes messages through. Problems show through `@codemirror/lint`. Formatting is applied as line-level edits that yamt computes itself.

Main costs:
- About 800 lines of protocol code in TS that yamt maintains, checked with valibot.
- About 400 lines of Rust, written with threads and std channels.
- One new npm runtime dependency, `@codemirror/lint`. No new Rust crates.

Nothing was built or run. I read the code and sources listed below.

## 0. Facts I checked that shape the design

1. **CodeMirror's client fits one server per editor, and yamt needs three on a `.ts` file.** In `@codemirror/lsp-client` 6.3.0 ([plugin.ts](https://unpkg.com/@codemirror/lsp-client@6.3.0/src/plugin.ts), [workspace.ts](https://unpkg.com/@codemirror/lsp-client@6.3.0/src/workspace.ts), [diagnostics.ts](https://unpkg.com/@codemirror/lsp-client@6.3.0/src/diagnostics.ts)):
   - `LSPPlugin.get(view)` is `view.plugin(lspPlugin)`, and `view.plugin` returns the **first** instance it finds (`@codemirror/view` dist `index.js:8389-8392`).
   - The default workspace's sync (`syncFiles`), the push-diagnostics handler and the change tracking used for formatting (`WorkspaceMapping`) all go through it.
   - So two clients on one Result pane read and clear each other's unsent changes. oxlint, oxfmt and TypeScript together on one file cannot work.
2. **It answers every request from the server with "method not found" (-32601).** `receiveMessage` ([client.ts](https://unpkg.com/@codemirror/lsp-client@6.3.0/src/client.ts)) has handlers for notifications only. Its `initialize` sends `processId: null` and only a `rootUri`, with no `workspaceFolders`.
3. **eslint asks for its settings, pulls its problems, and lints nothing by default.**
   - Its server advertises `diagnosticProvider`, so it serves problems only on request ([eslintServer.ts](https://github.com/microsoft/vscode-eslint/blob/main/server/src/eslintServer.ts)).
   - It asks for settings with `getConfiguration({ scopeUri, section: '' })` ([eslint.ts:935](https://github.com/microsoft/vscode-eslint/blob/main/server/src/eslint.ts)).
   - Its default is `validate: Validate.off` (eslint.ts:863).
   - This confirms the brief's [INFERENCE] about `workspace/configuration`. eslint is pull-only, like TypeScript 7.
4. **oxfmt sends one edit from the first difference to the last.** `compute_minimal_text_edit` trims the common prefix and suffix and returns a single `TextEdit` ([server_formatter.rs:259-266](https://github.com/oxc-project/oxc/blob/main/apps/oxfmt/src/lsp/server_formatter.rs)).
   - If formatting touches line 3 and line 400, every open block in between becomes empty and is marked ignored on both sides (rule CM8).
   - So yamt must diff the server's result itself before applying it. This answers the brief's "which servers do" [INFERENCE].
5. **CodeMirror's client sends text with `\n` line breaks only** (`file.doc.toString()` in `didOpen`). In a CRLF pane (`lineSeparator "\r\n"`), a `"\n"` in a formatter's `newText` would not split the line. yamt must insert lines as a `Text`, not as a string.
6. **Tauri channels work with the current permissions.**
   - tauri-specta rc.25 generates `Channel<T>` arguments (`lang/js_ts.rs:107-145`).
   - Tauri 2.12.1 exempts the channel's internal fetch from the permission check (`webview/mod.rs:2081-2083`). Messages over 8 KB go through that fetch (`ipc/channel.rs:37`).
   - So `capabilities/main.json` needs no change.
7. **`@codemirror/lint`'s `setDiagnostics` turns lint on by itself** and brings the underline and hover tooltip (dist `index.js:126-137`, `lintHover` at :897). Problems then move with edits through its own state.
8. **Rows #65 and #67 already exist in `docs/plan.md`; the brief treats both points as open.**
   - #65: "Save" is a key action on Ctrl/Cmd+S that formats first, as one undo step.
   - #67: yamt detects the four servers, asks once per repository, and other servers are added in Settings.
   - My design still takes a list of server specs as input. This build adds no Ctrl+S binding; the Save build calls `format()`.

## 1. Options (data structures first)

### Option A (recommended): the window speaks LSP with yamt's own client; Rust is a pipe

**Data structures:**
- **Rust:**
  - `Host { root, runs: BTreeMap<RunId, Running> }` and `ServerCommand { program, args, project }`.
  - `HostEvent = Message{text} | Log{line} | Exited{code: Option<i32>}`.
  - `StartReply = Started{run} | NotFound{program, searched} | SpawnFailed{program, message} | OutsideRepository{project}`.
- **TS:**
  - `ServerSpec` (the input from whatever config source).
  - `ServerState`, a sum type: `stopped | starting | running{formats} | stopping | crashed{code} | failed{reason}` with `reason = notFound | spawnFailed | initializeFailed | timedOut | noHost`.
  - `DocVersion` brand, `ServerProblem`, `FormatReply`.
- **Editor side:** `ResultDocument`, the contract the editor implements: `path`, `take(version) → text`, `showProblems(server, version, problems)`.

**Visions:**
- 1: the owner follows one message in TS.
- 2: the Result text has one owner, CodeMirror; Rust keeps no copy.
- 3: new fences for `lsp/`; arch-check forbids `serde_json` in the host.
- 5: no Rust dependency; one npm dependency.

**Cost:** Rust about 400 lines plus about 250 test lines. TS: `lsp/` about 800, editor about 300, ui about 450, each with tests. New npm dependency: `@codemirror/lint` (6.9.7 is already in the lockfile, pulled in by `lang-javascript`). LSP types are hand-written valibot schemas for the subset yamt reads.

**Reading path for the owner, one message end to end:** `ServerStatus.vue` → `ui/servers.ts` → `lsp/index.ts` → `lsp/internal/server.ts` → `connection.ts` → `ipc/tauri.ts` → `src-tauri/src/servers.rs` → `lsp-host` writer thread → the server's stdin. Back: `lsp-host` reader thread → channel → `connection.ts` → `server.ts` → `editor/internal/serverDoc.ts` → lint.

### Option B: Rust speaks LSP; the window gets typed problems and edits

**Data structures:** a Rust `Documents { path → (version, text) }` per server, a table of pending requests with deadlines, serde structs for the LSP subset, and `Problems{path, version, items}` / `FormatReply` events.

**Cost:**
- About 1,300 Rust lines. The reader thread and command calls share the request table, which needs `Arc` (forbidden outside src-tauri) or a new single-thread "actor" pattern.
- `serde_json` in a new crate needs a decision row.
- Rust holds a second copy of every Result text (against vision 2 and plan §4's "the frontend owns the buffer").
- The window still needs version mapping, so versions live in two languages.
- Formatting must wait on a reply without blocking Tauri's main thread, so it needs async commands or a reply channel.
- **Gain:** typed IPC and a simpler fixture mode.
- **Rejected on vision 1:** the hardest Rust for a Rust beginner, sitting on protocol code a TS reader would follow more easily.

### Option C: CodeMirror's `@codemirror/lsp-client` behind A's pipe

**Data structures:** an `LSPClient` per server, a Transport that answers server requests before the client sees them, a custom `Workspace`, yamt's own pull extension and format step.

**Cost:**
- npm: `@codemirror/lsp-client`, `@codemirror/lint`, plus pulled-in `marked`, `@codemirror/autocomplete`, `vscode-languageserver-protocol` / `vscode-jsonrpc`.
- About 450 TS lines that work around the library.
- **Limit:** one server per Result pane (fact 1). Getting around it needs a fan-out proxy (clever, a defect under vision 1) or dropping TypeScript or oxlint for `.ts` files.
- What the library still gives after the workarounds: the `initialize` exchange and request ids and timeouts, about 150 lines.
- **Rejected:** it cannot serve the owner's named servers together.

## 2. Recommended design (A), by brief item

### 1. Where the protocol is spoken
- In the window, in `frontend/src/lsp/` (framework-free, like `editor/`).
- Rust only frames bytes. Messages cross as opaque JSON strings.
- Server messages are external data, so they are parsed once with valibot at the boundary. The #19 exception covers only our own Rust's payloads, not servers' messages.

### 2. The Rust host: crate `crates/lsp-host` (`yamt-lsp-host`)
- **Dependencies:** no `yamt-*` crates, no tauri, no `serde_json`. Uses std, `thiserror`, `tracing`, `serde`, `specta`.
- **Threads per run:**
  - A **run thread** owns the `Child`. It waits on a control channel for `Stop` or `OutputClosed`, then waits up to `STOP_GRACE` (2 s), kills, reaps, and sends `Exited`.
  - A **writer thread** owns stdin and writes queued messages as `Content-Length` frames. A blocked write never blocks a stop, because the kill breaks the pipe.
  - A **stdout reader** reads frames and sends `Message`. Above `MAX_MESSAGE_BYTES` (64 MiB) it logs a line and stops the run. At end of file it sends `OutputClosed`.
  - A **stderr reader** sends `Log` lines, each capped at `MAX_LOG_LINE_BYTES` (8 KiB).
  - No `Arc`, no async (§7).
- **Commands** (`src-tauri/src/servers.rs`, each thin):
  - `servers_context() -> ServerContext { root: Option<String>, process_id: u32 }`. `root` is `None` when the path is not UTF-8. The process id goes into `initialize`, so servers can exit when yamt dies.
  - `start_server(command, events: Channel<HostEvent>) -> StartReply`. A three-line forwarding thread copies the run's std channel into the Tauri channel. When a send fails (the page is gone), the run stops itself.
  - `send_to_server(run, message)`: fire-and-forget, only queues, never blocks the main thread.
  - `stop_server(run)`.
- **Lifetime:**
  - `Mutex<Host>` is managed beside `Mutex<MergeSession>`; the two are never locked together.
  - `window.rs` builds `Host::new(session.root())`. After `run_return` it calls `stop_all()`, which signals every run and then joins each thread, so no child outlives a normal close.
- **Program lookup** (`program.rs`):
  - A name with a path separator is taken relative to the project root.
  - Otherwise yamt searches `node_modules/.bin` in the project folder and each parent up to the repository root, then `PATH`.
  - Windows: tries the `PATHEXT` extensions and skips files without one. Since Rust 1.77.2, std runs `.cmd` files through cmd.exe with escaping.
  - `NotFound` lists every folder searched.
- **Errors:** start failures are replies, not `IpcError`s. The problem bar's exhaustive switch stays unchanged.

### 3. Documents
- `LanguageServers` exists once per window, which means once per repository, with one connection per spec.
- **Which files are open on servers:** every opened file with an editable Result, shown or hidden. This way imports between two conflicted files see each other's unsaved work. Read-only and choice views are not opened.
- **URIs:** `file://` of the real file under the repo root, with Windows drive handling. URIs that come back from a server are compared after decoding (`lsp/internal/uri.ts`).
- A server serves a file when the file matches the spec's globs and lies under its project folder.
- `MergeController.destroy` sends `didClose`. A rebuild after reset or a disk change becomes close, then open with the new text.
- **Sync:** one version counter per document (the `DocVersion` brand is created only in `lsp/`). The full text from `sliceDoc` is sent `SYNC_DELAY_MS` (300 ms) after typing stops. The full-text form is valid for every sync kind and keeps the file's real line endings.
- **Start:** lazy. A spec starts when the first opened file it serves appears. A server the user stopped stays stopped until Start or Restart.

### 4. Pull diagnostics
- yamt advertises `textDocument.diagnostic` and `workspace.diagnostics.refreshSupport`.
- For a server with `diagnosticProvider`, every sync pulls `textDocument/diagnostic` for every open document on that server, sending the `previousResultId` back; an "unchanged" reply keeps the last items. One pull is in flight per document per server, and a stale reply triggers a new pull.
- `workspace/diagnostic/refresh` → answer `null` and pull again.
- Pushed problems (`publishDiagnostics`) and pulled ones land in the same slot, `showProblems(server, version, …)`.

### 5. Requests from the server: the table yamt answers (`lsp/internal/answers.ts`, pure)

| request | answer |
|---|---|
| `workspace/configuration` | per item: `spec.settings` looked up by section (`""` = everything), or `null` |
| `client/registerCapability`, `unregisterCapability` | `null`, and ignored: no file watching (#49, #52) |
| `window/workDoneProgress/create` | `null` |
| `workspace/workspaceFolders` | the project folder |
| `workspace/diagnostic/refresh` | `null`, then pull again |
| `window/showMessageRequest` | `null`, and the message goes to the log |
| `workspace/applyEdit` | `{ applied: false }`, logged |
| `*/refresh` (other) | `null` |
| anything else | -32601, logged |

- **Notifications:** `logMessage` and `showMessage` go to the log, never to a dialog. `$/progress` and `telemetry/event` are dropped.
- **`initialize`:** sends `processId`, `rootUri` and `workspaceFolders` (the project), `positionEncodings: ["utf-16"]`, and `spec.initializationOptions`. Then `initialized`, then `didChangeConfiguration`.
- **Stop:** `shutdown` (2 s), then `exit`, then `stop_server`.

### 6. Formatting (for #65's Save)
- `MergeController.format(): Promise<FormatOutcome>`. A second call while one is running returns the same promise.
- **Steps:**
  1. Sync now.
  2. `textDocument/formatting` goes to the first running spec, in list order, that has `formats: true` and the server capability. A formatter still starting is waited for, up to its start timeout.
  3. If the document changed since that version → `changedMeanwhile`, nothing applied.
  4. Otherwise yamt applies the server's edits to the text it sent, diffs old and new lines (`lineDiff.ts`, a pure Myers diff on lines), and dispatches one transaction `{ changes (insert: Text), userEvent: "yamt.format" }`.
- **Result:**
  - One undo step: `yamt.*` events never join neighbours, and the chunk snapshot restores spans and statuses.
  - Open blocks map by CM1 rules. A block is ignored only if formatting deletes all of its lines (CM8), as typing would.
  - The file's own line endings are kept.
- `FormatOutcome = formatted | unchanged | changedMeanwhile` (each with the server), or `FormatRefusal = noFormatter | notRunning{state} | failed{message} | timedOut` from `lsp/`.
- **Seam for the Save build:** `await handle.format()`, record the outcome for the status area, then write. Optionally `LanguageServers.saved(path)` sends `didSave`.

### 7. Problems in the Result
- `editor/internal/problems.ts` keeps one list per server per Result, merges them, and dispatches `setDiagnostics` on the middle pane only.
- Server positions are converted on the synced text and mapped through edits not yet sent. Problems for an older version are dropped. Pushes without a version count as the latest.
- Problems inside waiting changes are shown (the brief's default).
- Counts go out through `MergeController.onProblemsChange({ errors, warnings, other })` into a `shallowRef` in `useMergeController`, the same pattern as `summary`.
- **Theme:** `theme.css` replaces lint's fixed SVG underline with `text-decoration: wavy var(--color-problem-*)`. New tokens go in both palettes in `style.css`. Tooltips use `parent: document.body` (see risks).

### 8. Status area and log
- `ServerStatus.vue` sits left of the gear in all three header rows. It shows the shown file's counts plus every configured server: name and a state word.
- `ServerMenu.vue` (Start, Stop, Restart, Show log) reuses `menuPosition.ts`, `menuKeys.ts` and the teleport rules.
- **What the files' grid cell shows:** `settingsOpen` becomes `screen: files | settings | serverLog{name}`. Two booleans would allow "both open"; this is a clean cutover of `App.vue`, the store and its tests.
- `ServerLogView.vue` shows the log with Back.
- **The log belongs to `lsp/`:** one per server name, surviving restarts, the last `LOG_LINES` (2,000) lines. Sources are stderr, server messages and yamt's own lines (start, exit, unanswered requests, failures).
- Words live in `ui/serverText.ts`.
- When there are no specs, the status area is hidden.

### 9. Platforms
- Windows `.cmd` lookup as in item 2.
- yamt passes its environment through unchanged. From a terminal (`git mergetool`, `gmt`) servers find node; from a desktop menu (macOS especially) `#!/usr/bin/env node` fails with exit 127. The log then shows stderr and the folders searched (open question 3).

### 10. Fixture mode (browser without the app)
- No server host (`null`). Every spec shows "Language servers run only in the app".
- `format()` → `noFormatter`.

## 3. Ownership split (disjoint files)

**Order:** R and P start together. P writes `ipc/tauri.ts`'s server host last, after R's `bindings.ts` lands. U starts after P's public surface lands.

| build | owns (creates or changes) | fixed contract it provides |
|---|---|---|
| **R: Rust host** (rust-impl) | `crates/lsp-host/**` (lib, framing, program lookup, run threads, `src/bin/lsp-echo.rs` test server, tests, `AGENTS.md`); `Cargo.toml`; `Cargo.lock`; `src-tauri/Cargo.toml`; `src-tauri/src/{servers.rs (new), commands.rs, window.rs, lib.rs}`; `src-tauri/AGENTS.md`; `scripts/arch-check.sh` (app may depend on `yamt-lsp-host`; lsp-host: no `yamt-*`, no tauri, no `serde_json`); `frontend/src/ipc/bindings.ts` (generated by `just bindings`); `.omp/skills/ipc-contract/SKILL.md` | the four commands and the `HostEvent`, `StartReply`, `ServerCommand`, `RunId`, `ServerContext` shapes in §2 item 2 |
| **P: protocol and editor** (web-impl) | `frontend/src/ipc/{ServerHost.ts (new), tauri.ts, index.ts, domain.ts (RunId brand)}`; `frontend/src/lsp/**` (`index.ts`; `internal/{connection, messages, server, answers, state, patterns, uri, languageIds, log}.ts` with tests; `AGENTS.md`); `frontend/src/editor/{index.ts, theme.css, AGENTS.md}`; `editor/internal/{serverDoc, problems, format, lineDiff}.ts` with tests (plus a WebKit browser test for the tooltip); `frontend/src/style.css` (problem tokens); `frontend/package.json` and `pnpm-lock.yaml` (`@codemirror/lint`); `frontend/.oxlintrc.json` and `frontend/scripts/fences.ts`, `fences.test.ts` (`lsp/**` fence: no vue, tauri, editor, ui); `.omp/skills/cm6-rules/SKILL.md` (dependency list) | `LanguageServers` (constructor `(host \| null)`, `setSpecs`, `start`, `stop`, `restart`, `views()`, `log(name)`, `onChange`, `open(doc)`, `saved`, `destroy`); types `ServerSpec`, `ServerView`, `LogLine`, `FormatRefusal`; `MergeOptions.servers`; `MergeController.format()` and `onProblemsChange()`; `ProblemCounts`; `FormatOutcome` |
| **U: chrome** (web-impl) | `frontend/src/ui/{ServerStatus.vue, ServerMenu.vue, ServerLogView.vue, serverText.ts, servers.ts}` (new) with tests; `ui/{store.ts, store.test.ts, App.vue, MergeView.vue, MergeToolbar.vue, ChoiceView.vue, SettingsView.vue, useMergeController.ts (servers in, problems out), AGENTS.md}`; `frontend/src/main.ts` (builds `LanguageServers` from the source's host); `docs/architecture.md` (§2, §3.5, §3.7 new, §4, §5, §7); `.omp/skills/project-map/SKILL.md` | — |

Plan rows go to the orchestrator (DR5).

## 4. Proposed decision rows (#68 onward)

- **Who speaks LSP.** The window speaks LSP with yamt's own client (`frontend/src/lsp`, valibot over a subset of LSP 3.17); Rust is a framed pipe. Rejected:
  - `@codemirror/lsp-client`: one client per editor (fact 1), "method not found" to every server request (eslint never lints), push only, formatting that collapses blocks (fact 4).
  - Rust speaking LSP: a second owner of the text, `Arc` or an actor, about 1,300 lines.
  - `vscode-languageclient`: built for Node.

  Visions 1, 2, 5.
- **The host crate.**
  - A new crate `yamt-lsp-host`, plus arch-check rules.
  - src-tauri holds two Mutexes, never nested; the §7 rule "no `Arc` outside src-tauri's single `Mutex<MergeSession>`" is amended to two.
  - Four threads per run on std channels; one Tauri `Channel` per run.
  - Children killed and reaped at close; `processId` sent so servers can follow yamt's exit.

  Rejected: putting servers in `gitio` (it is the git layer); Tauri events (the docs say they are not built for throughput); process groups or Job objects (would need `unsafe` or a new crate). Visions 3, 1, 5.
- **`@codemirror/lint` joins the editor's dependency list.** Rejected: hand-made underline and tooltip, which would rebuild lint's state field and hover (vision 5).
- **Formatting is applied as yamt's own line diff of the server's result**, one `yamt.format` undo step, skipped when the user typed meanwhile, line endings kept. Rejected: applying server edits as sent (fact 4). Visions 2, 4.
- **Every opened editable Result is open on every matching server**; URIs are the real files; no file watching (`registerCapability` accepted and ignored). Vision 2, #49, #52.
- **`screen` replaces `settingsOpen`** (vision 4).

## 5. Open questions for the owner

1. **Problems on conflict-marker lines and inside waiting changes.** Showing them (the default) means a file opened from disk with markers left shows a burst of syntax errors until those conflicts are decided. Hiding them inside waiting changes would also hide real errors in the base text the user keeps.
2. **A server that stops on its own.** Should it restart by itself (VS Code: up to 5 times in 3 minutes), or stay stopped with its exit code shown until Restart? Default: stays stopped.
3. **PATH when yamt starts from a desktop menu, mainly macOS.** Node-based servers do not find `node` then. Should yamt read the login shell's PATH at start, as VS Code does? That costs start time and runs the user's shell config. The alternative is showing "not found" with the folders searched and asking for an absolute path. Default: the latter.
4. **TypeScript's own formatter.** Should it format on Save when it is the only formatting server set up? Default: no. The detected TypeScript and eslint specs carry `formats: false`; only oxfmt, or a server the user marks, formats.

## 6. Open risks and deviations from the brief

- **Deviation:** #65 and #67 already settle Save and setup (fact 8), so no format key ships here. `MergeController.format()` is the seam, used only by tests until the Save build. No user sees servers until the config slice of #67 calls `setSpecs`; the orchestrator should schedule it right after. An app smoke with a real server needs that slice.
- **Deviation:** new IPC types, so IPC9 applies; this is reported here.
- **Tooltip placement [INFERENCE]:** the pane wrappers have `will-change: transform`, which can trap CodeMirror's fixed-position tooltips. P must check in WebKit that `tooltips({ parent: document.body })` keeps the theme classes.
- **Crash cleanup [INFERENCE]:** if yamt itself crashes, children see only stdin closing; tsgo's behaviour then is unverified. `processId` reduces the risk.
- **CM8:** formatting that removes every line of an open block marks it ignored, as typing would. This is rare (a block of only blank lines).
- **URIs:** servers may send back differently encoded URIs; yamt decodes before comparing. Windows drive-letter case is still to be tested.
- **Sync size:** full-text sync sends the whole file per typing pause, through IPC and the pipe. Incremental sync is possible later from the editor's change set.
- **Config slice detail [INFERENCE]:** eslint's settings must set `validate: "on"`; whether it also needs `workspaceFolder` is unchecked.

## 7. Checks the main agent should run after all builds land

`just check` covers arch-check, bindings-check, fences, map-check and the node tests. Also run `pnpm test:browser` for the tooltip probe, and `cargo nextest run -p yamt-lsp-host` with the `lsp-echo` server. On Windows CI, run the program-lookup tests that are gated to that platform.
