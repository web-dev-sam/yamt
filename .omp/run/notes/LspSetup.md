# LspSetup (3.Y-setup, board row 9)

Slice 3.Y-setup is built and all four acceptance items were observed: in the real app the question appears once, the servers start, a problem is underlined, Ctrl+S formats and saves, and TypeScript starts on focus after being installed. All six `pnpm -C frontend` recipes exit 0. `just map-check` will fail until the project map names the new files (exact entries below); I could not edit the map.

```
summary
  At start, once the first file list and the settings have loaded, yamt detects the repository's servers and adds
  the ones added by hand. If the repository has no stored answer it asks "Start this project's language servers?"
  (Start / Don't start are stored, Escape stores nothing), then calls setSpecs. On window focus it detects again
  without asking. Settings has a new "Language servers" section, and scripts/lsp-repo.sh builds the smoke
  repository. The #935 field guard is in ui/settings.ts.

files_changed
  frontend/src/ui/serverSetup.ts (new), serverSetup.test.ts (new), LanguageServerSettings.vue (new)
  frontend/src/ui/question.ts, question.test.ts, QuestionDialog.vue, SettingsView.vue, App.vue, store.ts,
    store.test.ts, settings.ts, settings.test.ts, AGENTS.md
  frontend/src/main.ts (granted by Main), frontend/src/lsp/index.ts (granted: one line removed)
  scripts/lsp-repo.sh (new)

tests_added
  serverSetup.test.ts (a real LanguageServers over a fake host that does detection lookups and answers initialize):
    start: no specs → no question, no servers, nothing stored
    start: stored Start → no question, oxfmt/oxlint running; stored Don't start → no question, nothing started
    start: an answer stored for another root does not count (the question comes)
    start: no answer → the question lists oxfmt, oxlint, TypeScript (not installed) for "frontend" plus the added pylsp
    start: Start is stored and starts; Don't start is stored and starts nothing
    start: Escape stores nothing and the servers show stopped
    start: another question already open counts as Escape; Escape on another question still resolves to its cancel
    start: added servers alone are asked about too
    start: a root that is not UTF-8 means nothing at all; a failing host context is logged (servers.detect_failed) and asks nothing
    fixture mode (no host): no question, no specs, no found servers, no warning; only the settings calls go out
    focus: detects again without asking; running servers keep their run (no stop, no new run); typescript-language-server installed meanwhile → TypeScript running
    focus: a repository without an answer is never asked and keeps its servers stopped
    focus: an older detection that answers last is dropped; focus before the start set-up has finished does nothing
    settings: Start applies at once; Don't start stops the running servers; Start again starts them; Start twice keeps the runs
    settings: an added server is stored, listed after the found ones, named "oxlint (2)" next to a found oxlint, starts under Start; Remove stops it
    settings: Remove drops only the server at its index
    the add form: Command splits on spaces; File types split on commas or spaces, leading dots dropped, lower-cased ("d.ts" kept); an empty field gives null
  question.test.ts: the servers question's lines per project folder ("… — web/", "… — repository root",
    "pylsp, gopls — added by you") and its note; projectLabel; existing cases moved to the new `list` / `note` shape
  settings.test.ts: "a load whose only difference is the action a key belongs to is adopted"
  #935: no test can show that a new generated field fails typecheck. `rest satisfies Record<string, never>` in
    sameStored, sameServers and sameAdded makes vue-tsc fail on any field they do not compare; typecheck exit 0 is the proof.

smoke_evidence
  1. pnpm -C frontend test → "Test Files 95 passed (95) / Tests 1192 passed (1192)"
     Stryker (the `just mutants` flags) on serverSetup.ts, question.ts:31-60, settings.ts:95-140:
       question.ts 100 %, serverSetup.ts 92.72 %, settings.ts 96.77 %.
     11 serverSetup.ts survivors, all with no observable difference:
       :46 `[\s,]+` → `[\s,]` (empty parts are filtered out anyway)
       :53 `+=` → `-=` and :168 `+=` → `-=` (the counters only need to change)
       :63 stale `return false` → `true` (the stale result is never written)
       :81 `root === null` (callers only reach it with a root)
       :118 `host !== null` (`started` is never true without a host)
       :131 three mutants on `setSpecs([], …)` (with no specs the options and the content do nothing)
     settings.ts:111 `other !== undefined` (the length check runs first; noted equivalent in SettingsIpc).
     settings.ts:128 `inUse.path !== read.path` → false was already surviving before this slice: settingsTarget reads
     one fixed path, so no test changes it.
  2. WebKit fixture page (`app-session start-fixture --name lspfx`, DPR 2). Fixture mode has no host, so the section
     shows only "Added by you".
     - Before adding: "Language servers\nAdded by you\nCommand\nFile types\nAdd …", Add disabled=true (10-fixture-empty.png)
     - Typed "pylsp  --check-parent-process" → still disabled; Tab, typed ".py, PYI rst" → enabled (11-fixture-filled.png)
     - Pointer on Add; then "gopls", Tab, "go", Enter → rows "pylsp --check-parent-process / py, pyi, rst / Remove" and
       "gopls / go / Remove", both fields cleared (12-fixture-added.png)
     - Pointer on "Remove pylsp --check-parent-process" → only gopls left (13-fixture-removed.png); light theme (14-fixture-light.png)
     - The input fields were focused through JS: app-session finds text boxes only by aria-label. The typing and the
       Add/Remove clicks were real input.
  3. Real app (`cargo tauri build --debug --no-bundle`; `scripts/lsp-repo.sh /tmp/yamt-test-lsp`; app-session start-app):
     - Question: "Language Servers\n\nStart this project's language servers?\n\noxfmt, oxlint, TypeScript (not installed) — web/\n\nyamt remembers your answer for this repository. You can change it in Settings.\n\nStart\nDon't start" (01-question.png)
     - Click Start → "oxfmt | Running, oxlint | Running, TypeScript | Not installed" (02-running.png); settings.json gained
       "repositories": { "/tmp/yamt-test-lsp": "start" }; processes `node …/oxfmt --lsp` (2916536) and `node …/oxlint --lsp` (2916542)
     - TypeScript menu: "…This project uses TypeScript 5.9.3, which needs the separate package typescript-language-server.\n\nIn web/:\n\npnpm add -D typescript-language-server\nCopy\n\nOr for all projects:\n\npnpm add -g typescript-language-server …" (03-typescript-menu.png)
     - Typed `debugger;` into the Result of web/src/math.ts → `cm-lintRange cm-lintRange-error:debugger;`, counts "1 error, 0 warnings" (04-problem.png)
     - Ctrl+S → the file on disk has `export const spaced = { a: 1, b: 2 };` (was `export const   spaced={a:1,b:2}`),
       `  debugger;` and git's markers kept; no "Not formatted" note (05-saved.png)
     - Stopped the session → "no yamt or server process left". Restarted with the saved settings.json →
       "no dialog || oxfmt=Running, oxlint=Running, TypeScript=Not installed" (06-restart-no-question.png)
     - Installed typescript-language-server 6.0.2 with npm into /tmp/yamt-tsls and linked it into web/node_modules/.bin.
       focus-away, then focus-back → "oxfmt=Running, oxlint=Running, TypeScript=Running" with no Restart; oxfmt/oxlint
       pids unchanged (2923271/2923277), new `typescript-language-server --stdio` (2924954) (07-typescript-started.png)
     - Settings section: "/tmp/yamt-test-lsp", Start pressed, Found: "oxfmt web/ oxfmt --lsp", "oxlint web/ oxlint --lsp",
       "TypeScript web/ typescript-language-server --stdio" (08-settings-app.png). "Don't start" → no server process,
       the file says "dontStart"; "Start" → all three running again (09-settings-start-again.png)
     - Closed the app (app-session stop) → `pgrep` for yamt and the servers: "no yamt or server process left"
     - Escape check in a fresh session: the question appears, Escape closes it, "oxfmt=Stopped, oxlint=Stopped,
       TypeScript=Stopped", and settings.json has no languageServers answer
     Screenshots are in /tmp/lsp-setup-shots/ (page captures from WebDriver).
  4. Each command run in frontend/ as `pnpm run <recipe> | tail` with the recipe's exit code:
     lint exit=0; typecheck exit=0; test exit=0 (1192 passed); unused exit=0;
     fmt:check exit=0 "All matched files use the correct format."; sfc-order exit=0

deviations_from_brief
  - createAppStore takes a 4th parameter `host: ServerHost | null` (granted by Main). main.ts builds the host once and
    hands it to LanguageServers and the store.
  - Start sequence: main.ts runs `Promise.all([store.loadFiles(), store.loadSettings()]).then(() => store.setUpServers())`.
    loadSettings moved there from App.vue's onMounted, so detection runs after both have finished.
  - Focus: App.vue awaits refreshFiles and loadSettings, then calls findServers.
  - Escape needs a third answer, which asking.ts (not Owned) cannot give. QuestionDialog emits `dismiss` on `cancel`,
    and the store's `dismissQuestion` (from serverSetup) counts the dismissal, then answers false. For every other
    question Escape still resolves to false.
  - QuestionText changed: `files` became `list` ({kind none | files | servers}) and `note` was added.
  - "Don't start" in Settings first calls setSpecs([]), so runs are halted rather than marked as stopped by the user;
    a later Start then starts them again on open.
  - The question appears when any found or added server exists (the brief's "list empty → nothing"). The Settings
    answer applies only when a root is known; in fixture mode it is only stored.
  - File types are also lower-cased (lsp matches lower-case extensions).
  - Settings with no root (fixture mode, or a root that is not UTF-8) show only "Added by you". Each Remove button is
    labelled "Remove <command>".
  - store.ts was at its 300-line cap, so `actions` now spreads `...state.guard` instead of copying its five members
    one by one. Behaviour is the same.
  - New exports: serverSetup.ts `ServerSetup`, `createServerSetup`, `parseAddedServer`; question.ts `projectLabel`.
    Store members: `serverRoot`, `foundServers`, `setUpServers`, `findServers`, `answerServers`, `addServer`,
    `removeServer`, `dismissQuestion`.
  - lsp/index.ts: removed the unused `ProjectLookups` re-export (granted by Main).
  - New script scripts/lsp-repo.sh rather than editing conflict-repo.sh. web/node_modules is a real folder of links,
    not one link to frontend/node_modules: yamt's project_files treats anything whose real path is outside the
    repository as Missing (crates/lsp-host/src/files.rs:30), so a whole-folder link hides typescript's package.json
    and TypeScript is never detected. typescript/package.json is a copy; the rest of the package is linked.
  - Needed for `just map-check`, outside my files (`.omp/skills/project-map/SKILL.md`, docs/architecture.md):
    ui "serverSetup.ts (detection at start and on focus, the question, setSpecs; `parseAddedServer`) +
    LanguageServerSettings (Settings → Language servers)"; scripts "scripts/lsp-repo.sh `<dir>`: language-server smoke
    repository (web/ with oxlint, oxfmt, TypeScript 5.9 linked from frontend/node_modules; 2 .ts conflicts)".

open_risks
  - crates/lsp-host/src/files.rs:30: if a project's node_modules/typescript links outside the repository (pnpm's
    global virtual store, a linked workspace), TypeScript is not detected at all. Found while building the smoke
    repository; not handled.
  - frontend/src/ui/serverSetup.ts:136 (changeAdded): adding or removing a server in Settings while a stale detection
    is in flight uses the last `found`; the next focus corrects it.
  - The real-app close was app-session stop (the driver and display are torn down), not the user's window close.
    Processes were gone either way.
  - /tmp/yamt-test-lsp (with typescript-language-server linked) and /tmp/yamt-tsls are left for Main to reproduce.
```

Checks for Main: `just check` (map-check needs the map entries above), `just mutants` on this patch, `pnpm -C frontend test:browser`.