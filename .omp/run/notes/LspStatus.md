# LspStatus (3.Y-status, board row 8)

Slice 3.Y-status is built. Everything the four acceptance items ask for was observed, with one gap: the Copy readback. Copy reported success, but WebKit refused `readText` (detail under 2). `lint`, `typecheck`, `test`, `fmt:check` and `sfc-order` exit 0. `unused` exits 1, but only on three exports in `lsp/index.ts` that nothing calls yet; they were already unused before this slice. The project map is not updated, so `map-check` will fail until it is (exact entries under deviations).

```
summary
  Each header row now has a status area left of the gear (all three placements): problem counts, the "Not formatted: …"
  note after a Save, and one button per server with a state dot. Clicking a server opens ServerMenu (state line,
  Start/Stop/Restart/Show log, or the install hint with Copy buttons). ServerLogView shows a server's log in the files
  grid cell. `screen` replaces `settingsOpen`. main.ts builds the app's one LanguageServers (Tauri host in the app,
  null in fixture mode). The 3 settings types now live in domain.ts (#934).

files_changed
  frontend/src/ui/ServerStatus.vue (new), ServerMenu.vue (new), ServerLogView.vue (new), serverText.ts (+test, new),
  servers.ts (+test, new), store.ts, store.test.ts, App.vue, MergeView.vue, MergeToolbar.vue, ChoiceView.vue, AGENTS.md
  frontend/src/main.ts
  frontend/src/ipc/tauri.ts, tauri.test.ts, ServerHost.ts, domain.ts, index.ts, ChunkSource.ts, fixtureSettings.ts
  frontend/src/lsp/index.ts, index.test.ts (granted by Main)

tests_added
  serverText.test.ts
    "rule 2/3: <kind> reads <line> with a <dot> dot" (13 rows): state words and dot for every state and fail reason
    "rule 3: the actions that apply per state"
    "rule 4: <manager> installs with …" (5 rows): both commands per manager; yarnBerry's global command is npm's
    "rule 4: an unknown manager gets npm's commands and the note to use your own"
    "rule 4: the TypeScript and eslint sentences, the PATH line and the come-back line"
    "rule 4: the folder line names the project folder, or the repository root for \"\""
    "rule 2: the format note is shown for the four refusals and hidden otherwise"
    "rule 2: the counts' title …", "rule 5: a log line's time is HH:MM:SS"
  servers.test.ts
    serverViews follow onChange; the actions map onto start/stop/restart by name;
    a shown log follows new lines while other logs and screens show none; serving only while a running server serves the path
  store.test.ts
    "screen: a server's log opens from the files or from settings, and Back returns to the files"
    "the format note: shown after a Save for the four refusals, hidden for the three others, replaced by the next Save"
    settings tests moved from settingsOpen to screen
  tauri.test.ts
    start passes a Channel whose messages reach onEvent and brands RunId
    a refused start passes through; run -1 rejects
    send, stop, context, findProgram, projectFiles map onto their commands
  lsp/index.test.ts
    "rule 1: serving(path) is true only while a running server serves the path" (extension, folder, stopped)

smoke_evidence
  1. Node tests: `pnpm -C frontend test` → Test Files 91 passed (91), Tests 1140 passed (1140)
  2. WebKit fixture page (`just app-session start-fixture`, MiniBrowser). Test-only setup, nothing committed: a `read`
     expression imported the dev server's own modules, unmounted the app and mounted a new store whose
     LanguageServers has an in-page fake host. It added specs oxlint, oxfmt (formats), TypeScript (not installed,
     pnpm) and eslint (not installed, unknown manager), plus logo.png (choice view) and gone.ts (deleted side, read-only header).
     - toolbar: hollow dots for oxlint/oxfmt, yellow for TypeScript/eslint (/tmp/lsp-shots/01-toolbar.png)
     - stopped menu: "oxlint\n\nStopped\n\nStart\nShow log"; focus on Start; ArrowDown → "Show log"; Up + Enter →
       title "Starting…" then "Running", counts "1 error, 1 warning" (02-crop.png, 03-crop.png)
     - running menu: "oxlint\n\nRunning\n\nStop\nRestart\nShow log"; Escape → 0 menus
     - Ctrl+S → status "Not formatted: oxfmt is not running" (04-crop.png)
     - TypeScript menu: "…This project uses TypeScript 5.9.3, which needs the separate package
       typescript-language-server.\n\nIn frontend/:\n\npnpm add -D typescript-language-server\nCopy\n\nOr for all
       projects:\n\npnpm add -g typescript-language-server\nCopy\n\nOr install it any other way that puts
       typescript-language-server on your PATH.\n\nyamt finds it when you come back to this window.\n\nShow log" (05)
     - Copy → button reads "Copied", so writeText resolved. readText was refused: "NotAllowedError: The request is not
       allowed by the user agent…". With writeText stubbed to reject, Copy left the command selected:
       getSelection() = "pnpm add -g typescript-language-server" (07-crop.png)
     - eslint menu: "In the repository root:", "npm install -D vscode-langservers-extracted", "npm install -g …",
       "Or the same with your package manager." (08-crop.png)
     - Show log: "Back\noxlint log\n\n19:33:14\nyamt\nStarting oxlint --lsp in the repository root\n\n19:33:14\nfake
       oxlint listening on stdio" (09-crop.png); Escape and Back both return to the files
     - Restart → "Stopping…" → "Running"; Stop → "Stopping…" → "Stopped", counts hidden
     - choice header and read-only header both show "oxlint | oxfmt | TypeScript | eslint" left of the gear (10-crop.png, 11-readonly-header.png)
  3. Real app (`cargo tauri build --debug --no-bundle` into /tmp; throwaway oxlint spec in main.ts for the build only,
     reverted right after; `scripts/conflict-repo.sh` repo with node_modules → frontend/node_modules and frontend's .oxlintrc.json):
     - Start → "Running"; typed `debugger;` into the Result → `.cm-lintRange cm-lintRange-error:debugger;`, counts "1 0" (21-crop.png)
     - Restart: oxlint pid 2759438 → 2765168; Stop → "Stopped", no repo oxlint left
     - Show log: "Starting oxlint --lsp in the repository root … Exited with code 0 …"
     - Start again (pid 2767409), then closed the window: app exited, `pgrep -af "yamt-test-lsp.*oxlint --lsp"` exit 1
  4. lint exit=0, typecheck exit=0, test exit=0, fmt:check exit=0 ("All matched files use the correct format."),
     sfc-order exit=0. unused exit=1: "addedSpecs src/lsp/index.ts:14:10 / detect …:14:22 / ProjectLookups …:15:15".
     `git grep` at HEAD shows no caller of these outside lsp/, so this was already failing before this slice.

deviations_from_brief
  - Contract addition (Main's decision): `LanguageServers.serving(path)` in lsp/index.ts; ServerView carries no file types.
  - Other contract additions: `createAppStore(source, startTheme, servers: LanguageServers)` takes a third parameter;
    `store.shownLog` (lines of the log on screen, refreshed on onChange and showServerLog); `store.serving(path)`.
  - ServerHost.ts now holds only the interface. Its data types are Generated aliases in domain.ts, exported from index.ts:
    RunId (brand, isRunId guard, `toStartReply`), HostEvent, ServerContext, ProgramFound, ProjectFile.
    ServerCommand is `Omit<Generated, "args"> & { readonly args: readonly string[] }` and StartReply's Started.run is the
    branded RunId, so neither is a plain alias: lsp passes readonly args, and the brief requires the brand.
  - createTauriServerHost lives in ipc/tauri.ts, not a new file, so the project map does not need a new ipc entry.
  - New exports: tauri.ts createTauriServerHost; domain.ts LanguageServerSettings, RepositoryAnswer, AddedServer (moved),
    RunId, ServerCommand, HostEvent, StartReply, ServerContext, ProgramFound, ProjectFile, toStartReply; servers.ts
    Screen, Servers, createServers; serverText.ts DotKind, ServerAction, InstallText, ACTION_LABELS, SHOW_LOG, EMPTY_LOG,
    COPY, COPIED, YAMT_MARK, stateLine, dotKind, serverActions, installText, formatNote, problemsTitle, logTitle, logTime.
  - Decisions the brief left open: the folder line for "" reads "In the repository root:"; closeServerLog always
    returns to the files, also when the log was opened from settings; the server button's accessible name is the
    server name, with the state words in title/aria-description; Copy buttons are menu items so the arrow keys reach them.
  - Not in my Owned files, needed for `just map-check`: add to `.omp/skills/project-map/SKILL.md` (and docs/architecture.md):
    ui "ServerStatus (status area left of the gear: counts, format note, server buttons) + ServerMenu (Start/Stop/Restart/
    Show log, install hint with Copy) + ServerLogView (a server's log in the files' cell); servers.ts (`createServers`:
    serverViews from onChange, shownLog, actions, `Screen`); serverText.ts (every server word)"; the state table row
    "settings view shown" becomes `screen` (files | settings | serverLog{name}).
  - SettingsButton.vue and SettingsView.vue needed no change: they already call openSettings/closeSettings.

open_risks
  - frontend/src/ui/ServerStatus.vue:19 (DOT_CLASSES) — the running dot uses `bg-success-border`, the only green token,
    and it is dark and hard to see (03-crop.png). A brighter success token would need style.css (not mine).
  - frontend/src/ui/ServerLogView.vue — following new lines at the end was not exercised live in WebKit: the fake host
    made only two lines. Only the empty state and the shown lines were seen.
  - frontend/src/ipc/tauri.ts (send) — `void commands.sendToServer(...)`: a rejected IPC call would be an unhandled rejection.
  - Clipboard: WebKit automation refuses readText, so the copied text was not read back. MiniBrowser ran on the owner's
    display :1, and `wl-paste` there returned an image, not the command.
  - The real-app close was `xdotool windowclose`: the private display has no window manager, so it could not send
    WM_DELETE. The app exited and no repo oxlint was left, but the normal close-request path was not taken.
  - frontend/src/ui/ServerMenu.vue — clicking the open server's own button closes the menu and opens it again; there is no toggle.
```