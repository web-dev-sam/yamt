Plan scout (merge-request overview): window chrome and launch modes — `ScoutChrome`, session 37, at main `d97a270`

# Window chrome and launch modes in yamt

## Summary

- **Three modes, one window per process.** `yamt --diff` opens the pasted-text compare window. It knows no repository and refuses `--repo`, and only one runs per data folder. `yamt --diff=<a>..<b>` / `<a>...<b>` opens the range window: it resolves the repository from `--repo` or `.`, and only one runs per repository and commit pair. Each process builds exactly one webview, labelled `"main"`, and the page picks its root once at load from `<html data-window>`.
- **No way to start another window today.** No code starts another yamt process, there is no in-place switch to another mode, and there is no shell or opener plugin, so nothing can open a URL in the system browser yet.
- **Gear placement.** The gear is `SettingsButton.vue`, which takes no props. It sits inline in each per-tab or per-file `<header>` in `PaneFrame`'s `#header` slot. There is no shared header component, so every mounted view renders its own copy.
- **Settings view.** Settings is `screen = {kind:"settings"}` in each window's store. It closes only through its "Back" button; Escape does not close it.
- **Drop-down building blocks.** `useDropdownMenu`, `useMenuPlacement`/`belowLeft`, `menuPosition` and `menuKeys` are generic. The ready-made menus (`ServerGroup`, `ServerMenu`, `ToolbarMenu`, `ServerStatus`) all import the merge window's store, so neither the compare nor the range window can use them.
- **Missing UI pieces.** There is no relative-time formatter, no avatar or user chip, no checkbox input, and no tooltip you can click inside.
- **Per-repository storage.** The settings file keys `languageServers.repositories` and `languageServers.off` by repository root, but only the merge window can write them. The only per-repository precedent in localStorage is `yamt.servers.pinned`.

## Report

### Q1. Launch modes

- **`Invocation`** (`src-tauri/src/args.rs:32-44`) has five variants:
  - `Merge { repo }`
  - `Compare`
  - `Range { spec, repo, ai }`
  - `Help`
  - `Version`
- **Usage text:** `args.rs:6-24`; line 13 says "With --diff … no repository needed, its tabs kept between runs".
- **Bare `--diff`:**
  - It becomes `Invocation::Compare`. `--diff` together with `--repo` is refused with `"--diff compares pasted text and takes no --repo"` (`args.rs:26,103-104`; test at `args.rs:169-173`).
  - Dispatch is `window::run_compare()` (`src-tauri/src/lib.rs:55`), which calls `open_compare` → `open_with_data_folder(COMPARE_TITLE "Compare — yamt", WindowKind::Compare, Ai::Off, compare::manage_store_in, …)` (`window.rs:24,73-94`). That path never reads the working directory or a repository; `compare.rs:23-28` only opens the `TabStore`.
  - `appimage::repo_from_start_dir` runs only for Merge and Range (`lib.rs:56-64`). Inside an AppImage, AppRun changes the working directory to `$APPDIR/usr`, and the start folder is kept in `OWD` (`appimage.rs:4-11`). So a bare `--diff` process's working directory is not the user's folder there.
- **`--diff=<range>`:**
  - The repository defaults to `.` (`args.rs:29,105-109`).
  - `run_range` calls `Resolved::resolve(repo, spec)`, which runs `Repo::discover(cwd)` (`range.rs:29-33`; `crates/range/src/open.rs:37-38`).
  - The title is `"<range as typed> — <root folder> — yamt"` (`range.rs:73-75`).
  - `RangeState { range, threads, sending, _lock: PairLock }` is managed once (`range.rs:20-25,45-66`), and `Range::root()` exists (`open.rs:134-136`).
  - The page does not receive the root: `RangeStart` has only `{range, left, right, files}` (`ipc/bindings.ts:540-545`).
  - `--ai` is kept only for Range (`args.rs` tests at around 215-226).
- **Start script:** `start_script(theme, kind, ai)` sets `dataset.theme`, `dataset.window` = `merge|compare|range`, and `dataset.ai="on"` only for Range with AI on (`src-tauri/src/start_script.rs:8-20`). It is injected through `.initialization_script` (`window.rs:133-139`). `WindowKind::name` is at `window.rs:49-63`.
- **One-window rule for bare `--diff`:**
  - `crates/compare/src/files.rs:27-42` takes a `File::try_lock` on the lock file in `<data_dir>/yamt/compare/`.
  - On failure the error is `Error::Locked` = `"another yamt --diff window is open (<folder>)"` (`crates/compare/src/lib.rs:116-121`), passed through as the start-failure line (`src-tauri/src/compare.rs:35-47`; test at around `compare.rs:300-307`).
  - The app folder is `<data_dir>/yamt` (`window.rs:123-125`).
- **Pair lock for ranges:**
  - `PairLock::take` locks `<range_dir>/<repo key>/<left oid>-<right oid>/lock`. The repo key is the common git dir's folder name plus FNV-1a 64 of that directory, so every worktree of one repository shares it (`crates/range/src/lock.rs:24-46,109-131`).
  - The lock is taken before listing and reading threads (`range.rs:52`).
  - The refusal reads `"another yamt window shows <l>..<r> of <root>"` (test at around `range.rs:301-318`).
  - Plan row 107: several range windows on different pairs, plus a `--diff` window, may run at once (`docs/plan.md:139`).

### Q2. Gear and other top-right buttons, the Settings view, drop-downs

- **`SettingsButton.vue`** takes no props and calls `useSettingsStore().openSettings` (whole file, around 19 lines).
- **Compare window:** `CompareView.vue:45-91`. `<PaneFrame>` `#header` → `<header class="flex h-10 shrink-0 items-center gap-1 px-2">` holds Format, `CompareLanguagePicker`, ↑ ↓, then `<SettingsButton class="ml-auto" />` (line 89).
- **Range window:** `RangeView.vue:67-109`. The header holds file icon, heading, note, ↑ ↓, collapse toggle, `<RangeSendButton class="ml-auto" />` (107), then `<SettingsButton />` (108).
  - When the range is empty, the header holds only the gear (`RangeApp.vue:133-141`).
  - While `start === null` (`openRange` not answered yet, or it failed), no view and no gear exist (`RangeApp.vue:123,134`).
- **Copies per view.** `CompareApp.vue:85-90` renders one `CompareView` per visited tab. `RangeApp.vue:123-131` renders one `RangeView` per visited file, at most `MOUNTED_FILES` = 16 (`rangeStore.ts:90`). Hidden views stay mounted, so every header (and every gear) exists once per mounted view.
- **`PaneFrame.vue`:**
  - props `{shown, asking, columns}` (line 4)
  - emits `shownKeydown` only while shown and no question waits (5, 10-16)
  - slots `header` (24) and default with `stripLayer` (30)
  - hidden with `invisible [content-visibility:hidden]`
- **Settings state:**
  - `Screen = files | settings | serverLog{name}` (`ui/screen.ts`).
  - Range store: `screen` at `rangeStore.ts:100`, `openSettings`/`closeSettings` at 222-227. Showing a file resets to files (244).
  - Compare store: `compareStore.ts:106,134-139`; `addTab`/`showTab` reset to files (224, 228).
  - The views render with `shown && screen.kind==='files'` (`CompareApp.vue:89`). `<SettingsView v-if="screen.kind==='settings'">` sits in the same grid cell (`CompareApp.vue:91`; `RangeApp.vue:142-144`, where the slot holds `AgentSettings`).
  - The shared seam is `settingsStore.ts:11-38` (`registerSettingsStore`/`useSettingsStore`), registered by each root (`rangeStore.ts:203`, `compareStore.ts:142`).
- **Escape handling:**
  - `SettingsView` closes only through "Back": `goBack` closes, then refocuses the element focused before (`SettingsView.vue:22,31-44,64-70`). Its only `@keydown.esc` restores the path input (112).
  - The precedent for Escape closing a screen is `ServerLogView.vue:21,85-89` (Escape, not already handled, no question waiting → `closeServerLog`).
- **Merge window only:** `ServerStatus` / `ServerGroup` (the "Servers" drop-down) live in `MergeToolbar`, `MergeView`, `ChoiceView` and `StopView`. `ServerGroup.vue:11`, `ServerMenu.vue:19`, `ToolbarMenu.vue:7` and `ServerStatus.vue:11` all import `useAppStore`, the merge window's store.
- **Generic drop-down pieces:**
  - **`useDropdownMenu<T>({menu, opener})`** returns `{openFor, above, toggle(which), close(), menuKey(e)}` (`useDropdownMenu.ts:16-22,100-134`).
    - It closes on a click outside (opener ignored), on a capture-phase right-press outside, and on window blur.
    - Opening focuses the first `MENU_ITEMS` entry (59-74).
    - `menuKey`: Escape/Tab close and refocus the opener; Up/Down step (76-98).
    - `above` flips the menu up when it would overflow the nearest scrolling ancestor (65, 71).
    - Users: `CompareLanguagePicker` (absolute, `CompareLanguagePicker.vue:23,62`), `ServerGroup` (teleported fixed, `ServerGroup.vue:22-26,68-77`), `PresetPicker`, `KeymapList`.
  - **`useMenuPlacement(menu, at)`** gives `{left, top}`; **`belowLeft(opener)`** gives the point under the opener (`useMenuPlacement.ts:8-28`).
  - **`menuPosition`** is a pure clamp into the window (`menuPosition.ts:7-12`).
  - **`menuKeys.ts:1`**: `MENU_ITEMS = "[role=menuitem], [role=menuitemcheckbox]"`.
  - **A popover that stays open:** `ServerMenu.vue`. It is teleported and fixed (135-143), closes on a capture-phase `pointerdown` outside, gives focus back to the opener on Escape/Tab, and closes on window blur (27-31, 85-100).

### Q3. Roots, stores, sources, fixtures

- **`main.ts`:**
  - `windowKind`: in the app, `dataset.window`; in fixture mode, `?range` → range, `?diff` → compare (37-50).
  - `startCompare` (59-63) and `startRange` (79-84) pick the Tauri source in the app (`VITE_CHUNK_SOURCE==="tauri"`) and the fixture source otherwise.
  - `rangeAgent` is built only with `data-ai` or `?ai` (70-77).
- **`createRangeStore(source, startTheme, agent)`** (`rangeStore.ts:179-205`):
  - refs: `start`, `shown`, `visited`, `problem`, `screen`, `settings`, `fileListShown`
  - `threads`, `gitlab` (`createGitLabCheck`, 161), `search`, `collapsing`, `ai`
  - `startUp` = `openRange` + `loadSettings`, then `threads.load()` + `gitlab.checkNow()` (265-280)
  - `useRangeStore` throws before creation
- **`createCompareStore(source, startTheme)`**: `compareStore.ts:113-144`.
- **Sources:**
  - `SettingsSource = Pick<ChunkSource, loadSettings | setTheme | setAntialiasing | setKeys | moveSettings | setServerAnswer | setServerSwitch | setAddedServers | setAgent>` (`ipc/ChunkSource.ts:63-74`)
  - `CompareSource extends SettingsSource` (`CompareSource.ts:12-21`)
  - `RangeSource extends SettingsSource, ReviewSource` with `openRange`, `loadRangeFile`, `searchTexts` (`RangeSource.ts:6-10`)
  - `ReviewSource` includes `checkGitLab()` and `sendQueue` (`ReviewSource.ts:5-17`)
  - `createTauriRangeSource` spreads `createTauriReview()` and `createTauriSettings()` (`tauriRange.ts:7-21`)
  - `scripts/map-check.sh:30-34` requires every ChunkSource, CompareSource, RangeSource and ReviewSource method to be named in `docs/architecture.md`.
- **Fixture sources:**
  - `createFixtureRangeSource(log, search, files)`: cases from `import.meta.glob("../../fixtures/range/*.json")`, chosen by `?range=<case>` (default `review`; a miss is logged as `range.fixture_miss`); it spreads `createFixtureReview` and `createFixtureSettings` (`fixtureRange.ts:21-24,121-131,150-180`).
  - `createFixtureCompareSource`: `fixtures/compare/*.json`, `?diff=<case>` (`fixtureCompare.ts:47-50,212-218`).
  - `?gitlab=<script>`: the `GitLabScript` union and `shownGitLabScript` (`fixtureGitLab.ts:5-18,72-84`).
  - In-memory settings with `REPOSITORY="/fixture/repository"` (`fixtureSettings.ts:17,135`).
- **Fixture JSON:** `frontend/fixtures/{golden,showcase,compare,range}` are generated by `just fixtures` (`justfile:31,41-51`). Range cases come from `scripts/range-repo.sh` (`review` = `main...feature`, `empty`).
- **Serving a fixture window:**
  - `app-session start-fixture` starts `pnpm -C frontend dev --port <free> --strictPort`, then `just webdriver <port>` (WebKitWebDriver), then MiniBrowser (`/usr/lib/webkitgtk-6.0/MiniBrowser --automation`), then POST `/url` = `http://localhost:<port>/<search>` (`frontend/scripts/app-session/fixture.ts:23-50`).
  - Search flags: `--diff`, `--diff-case`, `--range-case`, `--threads`, `--gitlab`, `--ai` (`startArgs.ts:91-110`).
  - The `webdriver` recipe is `justfile:80-87` (Samsung screen, or `xvfb-run` otherwise).
  - In the real app, `start-app --glab <scenario>` (range only, `startArgs.ts:121-133`) puts `scripts/fake-glab` first on `PATH` with `YAMT_FAKE_GLAB*` set (`start.ts:99-108`).
  - The Vitest browser project covers only `src/editor/**/*.browser.test.ts` (`vite.config.ts:14`).

### Q4. Starting another process or window

- No code starts yamt itself.
  - `std::env::current_exe` appears in production code only in AppImage detection (`appimage.rs:17`); elsewhere only in test helpers (`crates/conflict-repo/src/lib.rs:221`, `crates/pipe/src/bin/line-echo.rs:121,132`).
  - Subprocess starters that exist: git (`gitio/run.rs:63`), glab (`gitio/glab.rs:57`), and the generic program runner in `pipe/run.rs:131`.
- No shell or opener plugin:
  - `src-tauri/Cargo.toml` dependencies are yamt crates plus tauri, tauri-specta, specta, tracing, gtk.
  - Capabilities allow only `core:event:allow-listen` and `core:window:allow-destroy` for window `"main"` (`capabilities/main.json:5-6`).
  - CSP is `connect-src 'self' ipc: http://ipc.localhost; img-src 'self' data:` (`tauri.conf.json:14`).
  - A GitLab link today is shown as text with a Copy button (`RangeMessage.vue:200-210`).
- One window per process:
  - `open_and_wait` builds one `WebviewWindow` labelled `"main"`, then `run_return` (`window.rs:23,127-144`).
  - State is managed once before that window opens (`window.rs:98-121`; `range.rs:60`).
  - `with_commands` registers every window's commands, but state for only one mode (`commands.rs:15-73,91-97`).
- No in-place navigation: there is no `location.*`, `navigate` or `pushState` in `frontend/src`, and `main.ts` picks the root once (100-115). [INFERENCE] A reload re-runs the same start script, so the page comes back in the same mode; `on_page_load` already treats a reload as an event (`commands.rs:94-96`).

### Q5. Shared UI helpers in `frontend/src/ui/`

- **Relative time ("x ago"):** none. There is no `RelativeTimeFormat` anywhere in `frontend/src`. The only time formatter is `logTime` (HH:MM:SS, `serverText.ts:189-191`). `Message.written` (seconds since 1970, `bindings.ts:376-377`) is never shown in `ui/`.
- **Avatar or user chip:** none (no matches for avatar, username or author). The CSP `img-src 'self' data:` (`tauri.conf.json:14`) [INFERENCE] would block remote avatar URLs.
- **Multi-select or checkbox list:** there is no `<input type="checkbox">`. Existing patterns:
  - `role="menuitemcheckbox"` with `aria-checked` and a Check icon: `ToolbarMenu.vue` (74-98; closes after each choice), `CompareLanguagePicker.vue` (single choice, closes on pick), `ServerGroup.vue` pin (95-104).
  - `role="switch"`: `LanguageServerSettings.vue:78-82`.
  - `ChoiceButtons.vue`: a generic single-choice group of `aria-pressed` buttons.
- **Tooltips:** none of them can be clicked into.
  - `OperationLabel.vue` draws its own tooltip: it opens on `mouseenter`, closes on `mouseleave` (60-61), and is `pointer-events-none` (70). Placement comes from `operationTooltip.ts` `tooltipBox({tagTop, textLeft, viewport})` → `{left, bottom, maxWidth ≤ 480, maxHeight}`.
  - The removal tooltip is a CodeMirror `hoverTooltip` in `editor/internal/removalTooltip.ts:46-50`, unreachable from `ui/` (PM2).
  - Shared tooltip styling: `@utility hover-tooltip` and `tooltip-text` (`style.css:169-180`).
  - The only popovers that stay open for interaction are click-opened: `ServerMenu` and the `useDropdownMenu` menus.

### Q6. Frontend fences

- **Allowed directions** (`.omp/skills/project-map/SKILL.md:246-248`): ipc ◄ editor ◄ ui ◄ main.ts; ipc ◄ lsp; connectors ◄ editor. Range additions are in `docs/architecture.md:109-113` (jsonrpc imports nothing from src; agent imports only the ipc and jsonrpc indexes and is built only in `main.ts`).
- **Rule tables:** `docs/architecture.md:115-132`. `.omp/GUARDRAILS.md:8-13` has rows PM1-PM6 only. PM7 and PM9 appear in `fences.ts`, in architecture (124, 113) and in the project map (257, PM7 only).
- **`frontend/scripts/fences.ts`:**
  - `FRAMEWORK_FREE_MODULES` (32-40): editor, model, connectors, lsp and agent are `framework-free`; jsonrpc and search are `self-contained`, meaning they import no other `src/` module (128-131).
  - `ui/` must not import `@codemirror/*`, `@tauri-apps/*` (97-103), `editor/internal`, or `model/` (113-121).
  - No module imports another module's `internal/` (PM5, 138-142); import cycles are checked (198-252).
  - Window roots (`ROOT_FILES` 56-63; `WINDOW_FILE` `/^src\/ui\/(?:use)?(compare|range)[^/]*\.(ts|vue)$/i`, 63) must not import another window's root files or `lsp/` (PM7/PM9, 159-175). The check is direct imports only.
  - AI files are range-only (68-74, 177-182).
- **oxlint:**
  - `ui/**` restrictions, including `bindings.ts`: `.oxlintrc.json:93-130`.
  - The framework-free list (editor, model, connectors, lsp, jsonrpc, agent, search: no vue, `@vueuse`, `@tauri-apps`, or another module's internal): 131-170.
- **Where a new pure module like `search/` sits:** `frontend/src/<name>/index.ts` plus `internal/` and an `AGENTS.md`. It needs entries in `fences.ts` `FRAMEWORK_FREE_MODULES`, the `.oxlintrc.json` file list (132-139), the Vitest node include list (`vite.config.ts:33-44`), and the project map (PM6 / `just map-check`). `model/` is not an option for chrome: `ui` may not import `model/` (PM2). The search core is documented in `frontend/src/search/AGENTS.md`.

### Q7. Settings file and per-repository storage

- **Entries:** `theme`, `antialiasing`, `keys`, `languageServers`, `agent` (`crates/settings/src/file.rs:12-16`). Unknown top-level entries are kept as written (`Loaded.others`, `file.rs:21-25,37-58`).
- **Per repository:** `LanguageServerSettings { repositories: root→answer, off: root→set of server keys, added }` (`lib.rs:104-110`). It is written only by `set_repository_answer` / `set_server_switch` (`lib.rs:211-250`).
  - On the Tauri side both go through `at_host_root`, which reads the root from `State<HostState>` (`src-tauri/src/settings.rs:98-151`).
  - `HostState` is managed only for the merge window (`servers.rs:20-23`, via `with_session`, `commands.rs:75-87`).
  - [INFERENCE] Those two commands fail in the compare and range windows.
  - The window applies `off` only in `serverSetup.ts` `offServers` (74-79).
- **`ipc/keys.ts`** holds key-binding actions (3-21), not storage keys.
- **localStorage precedent:**
  - `serverPins.ts`: `yamt.servers.pinned` = `{root: [keys]}` (14, 34-62), through `storedValue` (`windowStorage.ts:15-31`).
  - localStorage is shared across window kinds: `yamt.collapse.unchanged` is one stored choice for both windows (`rangeStore.test.ts:575-602`).
  - The range page has no root string to key by (`RangeStart`, Q1).

## Files

- `src-tauri/src/args.rs:6-114`: modes, usage text, refusals.
- `src-tauri/src/lib.rs:46-66`: dispatch per mode.
- `src-tauri/src/window.rs:23-144`: one webview, `WindowKind`, data folder.
- `src-tauri/src/start_script.rs:8-20`: the `data-*` attributes.
- `src-tauri/src/range.rs:20-75`: range state, pair lock, title.
- `src-tauri/src/compare.rs:23-47`: tab store and its refusals.
- `crates/range/src/lock.rs`, `crates/compare/src/files.rs:27-42`: the two locks.
- `src-tauri/src/commands.rs:15-97`: command registration.
- `src-tauri/src/review.rs:137-148`, `crates/review/src/send.rs:25-37,253-266`, `crates/gitio/src/glab.rs:35-85`: GitLab check and the glab runner.
- `frontend/src/main.ts`: root selection.
- `ui/{CompareApp,RangeApp,CompareView,RangeView,PaneFrame,SettingsButton,SettingsView}.vue`: window chrome.
- `ui/{settingsStore,rangeStore,compareStore,screen}.ts`: state.
- `ui/{useDropdownMenu,useMenuPlacement,menuPosition,menuKeys,operationTooltip,windowStorage,serverPins}.ts`: shared helpers.
- `ui/{ServerGroup,ServerMenu,ToolbarMenu,CompareLanguagePicker,OperationLabel,ChoiceButtons,RangeSendButton,RangeMessage}.vue`: existing menus, tooltip, buttons.
- `ipc/{ChunkSource,CompareSource,RangeSource,ReviewSource,tauriRange,fixtureRange,fixtureCompare,fixtureGitLab,fixtureSettings}.ts`: sources.
- `frontend/scripts/fences.ts`, `frontend/.oxlintrc.json`, `frontend/vite.config.ts`: fences and test projects.
- `frontend/scripts/app-session/{fixture,startArgs,start}.ts`, `justfile:31-101`: fixture sessions.
- `crates/settings/src/{lib,file}.rs`, `src-tauri/src/settings.rs:98-151`: settings storage.
- `src-tauri/tauri.conf.json:14`, `src-tauri/capabilities/main.json`: CSP and permissions.

## Architecture

The Rust shell parses an `Invocation`, manages one mode's state, then opens one `"main"` webview whose start script names the mode. `main.ts` mounts the matching root (`App`, `CompareApp` or `RangeApp`) with a Tauri or fixture source. Each root store registers the shared `settingsStore` seam, which serves the gear and `SettingsView`. Each per-tab or per-file view renders its own header with the gear inside `PaneFrame`. GitLab access exists only in the range window, through the `check_gitlab` / `send_queue` commands that run glab with the repository root as working directory.
