# PlanScoutSearch — facts on seams for a window-wide search (merge and range windows)

Read-only scout run by the orchestrator on 2026-10-28 at main `15ab31c` (session 32, planning the requests after 0.6.0-beta.1). Facts cite `path:line` at that commit; `[INFERENCE]` marks guesses.

**Short answers**
- **Ctrl/Cmd+Shift+S is free.** It is not bound in any window, in the shared key table, or in any CodeMirror keymap yamt installs.
- **There is one key table.** All three windows and the Settings keymap list share it, but each root wires its own window `keydown`.
- **Merge window texts:** Rust reads every text file's base, local and remote at start. The window gets texts only for files it has opened. An open file's Result text can be read only through that view's `MergeHandle.snapshot()`, and the store holds no handles.
- **Range window texts:** nothing is cached. Each `load_range_file` call reads the blobs again and diffs them again.
- **Existing search:** only the per-pane in-file find bar (`@codemirror/search`). There is no search across files in TS or Rust.
- **No "reveal line" API** exists on either controller.
- **Rust:** `merge-core` is the pure crate. `regex` reaches `Cargo.lock` only through tauri's own dependencies.

**1. Keys**
- **The table:** `frontend/src/ipc/keys.ts:3-20` defines `KEY_ACTIONS`, 16 ids ending `"toggle-file-list"`. `KeyBindings = Readonly<Record<KeyAction, readonly Key[]>>`.
- **Defaults** (`keys.ts:191-207`):

  | Action | Keys |
  |---|---|
  | apply | Enter, Space |
  | ignore | Backspace, Delete, x |
  | next-change / previous-change | ArrowDown / ArrowUp |
  | left-side / right-side | ArrowLeft / ArrowRight |
  | undo | Mod-z |
  | redo | Mod-Shift-z, Mod-y |
  | save | Mod-s |
  | find | Mod-f |
  | find-next / find-previous | F3 / Shift-F3 |
  | close-find | Escape |
  | indent / outdent | Tab / Shift-Tab |
  | toggle-file-list | Mod-b |

- **Reading the settings:** `bindingsOf(stored)` (`keys.ts:271`) applies the stored overrides and reports unreadable keys and keys used twice. It is called in `ui/settings.ts:68,197`.
- **Rust keeps keys opaque:** `crates/settings/src/lib.rs:70-76` says "`keys` = action id → key strings … (the window knows the defaults; Rust never does)", stored as `BTreeMap<String, Vec<String>>`. `set_keys` is at `lib.rs:191-206`.
- **Matching a key press:** `pressesKey` (`keys.ts:245-248`) goes through `keyOfEvent`. Shift counts as part of the key: `const shift = event.shiftKey && isLetter(character)` (`keys.ts:241`). So Ctrl+Shift+S never matches `save` (Mod-s).
- **"Mod-Shift-s" is a valid key string.** `Mod-Shift-z` is already a default (`keys.ts:199`).
- **Settings keys UI** (`ui/keyText.ts`):
  - `ACTION_NAMES` (`:17-34`), `ACTION_PLACES` (`:36-53`, e.g. `"toggle-file-list": "anywhere in the window"`).
  - `KEYMAP_GROUPS` (`:55-67`, the last group is `{ title: "Window", actions: ["toggle-file-list"] }`).
  - `keyText.test.ts:31` asserts that the groups flattened equal `KEY_ACTIONS`.
  - `KeymapList.vue:41` renders every group with no per-window filter. `SettingsView.vue:99` hosts it, and every root's settings screen uses `SettingsView`.
- **`fileListKey`** (`ui/fileListKey.ts:16-26`): returns early if `event.defaultPrevented`, if a question is waiting, or if `!pressesKey(event, …bindings["toggle-file-list"], platform)`. Otherwise it calls `preventDefault()` and flips `fileListShown`. Each store wraps it: `store.ts:224-226`, `rangeStore.ts:202-204` (and the compare store).
- **How each root dispatches `keydown`:**
  - `App.vue:48-50`, `RangeApp.vue:46-48` and `CompareApp.vue:41-43` each have `useEventListener(window, "keydown", (event) => { fileListKey(event, navigator.platform); })`. That is the only window key each root handles.
  - Per view: `PaneFrame.vue:10-15` emits `shownKeydown` only while its view is `shown && !asking`. `MergeView.vue:162-170` handles `historyKey` (undo/redo, `editor/internal/historyKey.ts:19-31`, skipped in INPUT/TEXTAREA) and `save`. `CompareView.vue:49` handles `historyKey`. `RangeView` has no `shownKeydown`.
  - Other window listeners: `ToolbarMenu.vue:20` (capture), `ServerLogView.vue:20` (Escape), `altHold.ts:39-45` (capture, Alt only).
  - Range text boxes have their own `BOX_KEYS` (Mod-Enter, Escape) in `rangeKeys.ts:11-14`, and `isTypingTarget` in `rangeKeys.ts:26`.
- **CodeMirror keymaps actually installed:**
  - `pane.ts:66-75`: `MIDDLE_COMMANDS` (undo, redo, indent, outdent) as `Prec.high` (`:140-146`).
  - `pane.ts:191`: `keymap.of([...defaultKeymap, ...selectionHistoryKeymap])`.
  - `pane.ts:240-241`: `find` plus `findKeys`.
  - `sideKeys.ts:52-56`.
- **Ctrl/Cmd+Shift+S is unbound in all of them:**
  - `defaultKeymap` in @codemirror/commands 6.11.1 (dist `index.js:1796-1817`) has only `Shift-Mod-k` and `Shift-Mod-\\` as Shift-Mod keys. `historyKeymap` (`:569-575`) is filtered to the undoSelection/redoSelection bindings (Mod-u, Alt-u, macOS Mod-Shift-u).
  - `searchKeymap` (search dist `:1051-1059`, which has Mod-Shift-l, Mod-d, Mod-Alt-g) is never imported. `search()` adds no keymap (`:549-551`, `:1232-1235`).
  - Plan §2 #61 says the file-list key "acts anywhere in the window (a pane, a find box, the settings view…) except while a question waits…" (`docs/plan.md:98`).

**2. Merge window texts**
- **All files are read at start, in Rust:**
  - `open_files` (`crates/session/src/open.rs:71-104`) goes through every conflicted path with one `BlobReader`. `stored()` reads the base, ours and theirs bytes (`:174-193`).
  - `content()` decodes them into `Content::Text(Texts { base, local, remote, deleted })` (`open.rs:207-228`, `merge_data.rs:57-62`, `session.rs:81-84`).
  - Each file is also read from disk at open (`open.rs:116`) and kept in `FileState.seen` (`disk.rs:57-67`: `ViewFromDisk(OnDisk)`, `ViewRemembered{shown,…}`).
  - Limits: `decode_sides` turns Binary or over `MAX_TEXT_BYTES` (8 MiB, `merge-core/src/lib.rs:26`) into Unsupported (`decode.rs:26-34`).
- **The Result's starting text is built per `load`:** `MergeSession::load` (`session.rs:178-212`) calls `merge_data(...)` (yamt's diff3 → `Middle::Stages`) or `disk_merge_data` / `remembered_merge_data`. The IPC command is `load_file` (`src-tauri/src/commands.rs:101-102`). `describe` is at `session.rs:215` (`describe_file`, `commands.rs:143`).
- **The DTOs:**
  - `FileMergeData { path, middle, local, remote, deleted, eol, chunks, disk_version }` (`ipc/bindings.ts:223-232`).
  - `Middle = Stages{text} | Disk{text} | DiskNotText{found}` (`bindings.ts:390`).
  - Choice files get `FileSides { path, reason, local: SideContent, remote: SideContent }`, which carries no text: `SideContent` is `Text{lines}`, `Binary{bytes}`, etc. (`bindings.ts:234-240,614`). `UnsupportedReason` is at `bindings.ts:754`.
- **What the window loads, and when:**
  - At start it gets only `FileEntry {path,status,unsupported}` (`bindings.ts:217-221`), then `loadFiles` opens the first file (`store.ts:232-237`).
  - A text file is fetched only on `pick` (`store.ts:201-204`) → `open` (`:252`) → `fetchView` (`views.ts:45-53`, `loadFile` or `describeFile`).
  - `opened` only grows (`views.ts:30-37`) and is cleared only by `nextStop` (`stops.ts:40-41`). Every opened `MergeView` stays mounted (`App.vue:99-105`).
- **How the store reaches views:** it holds no controllers. "Vue state never holds an `EditorView`, a position, or document text" (`docs/architecture.md:779`). The only registry keyed by path is the close guard: `track(path, work: FileWork{unsaved()})` (`closeGuard.ts:8,11,27,45`), called by `MergeView.vue:83` (skipped when `deleted !== null`, `:82`) and undone by `untrack` at `:117`.
- **Reading the current Result text:**
  - `MergeController.snapshot()` (`editor/index.ts:251`) → `ResultSnapshot { asShown(), fileText(), unsaved, markSaved }` (`internal/savedPoint.ts:12-17`). `asShown: () => paneText(state)` is at `:90`.
  - It is exposed as `MergeHandle.snapshot()` (`useMergeController.ts:60`).
  - Save takes the handle from the view (`saving.ts:32,204`); `finish` takes a snapshot (`saving.ts:39,122`). This is the only route to the Result text.

**3. Range window texts**
- **No cache anywhere:**
  - `rangeStore.loadFile` (`rangeStore.ts:263-272`) calls `source.loadRangeFile(id)` every time, once per `RangeView` mount (`useRangeController.ts:180`).
  - Rust `load_range_file` (`src-tauri/src/range.rs:86-91`, `blocking_reply`) → `Range::load` (`crates/range/src/open.rs:95-100`) → `load_file`, which opens a new `blob_reader()` and runs `compare(&left,&right)` on every call (`load.rs:8-31`).
- **What Rust keeps:** `RangeState { range, threads, sending, _lock }` (`range.rs:20-25`). `Range` holds `entries` and `files: Vec<FileAt>` (blob ids and sizes from one diff-tree run plus `blob_sizes`, `open.rs:29-33,72-82`). No texts.
- **The listing** (`RangeEntry {id,path,change,lines}`, `bindings.ts:497-502`) does not say which files are text. `RangeFile` decides that only when loaded (`bindings.ts:507`).
- **Limits:**
  - No cap on the number of files. I found none in `entries.rs`; `RangeFileId(pub u32)` is at `lib.rs:23`.
  - `MAX_TEXT_BYTES` 8 MiB per side → `RangeFile::TooLarge{limit}` (`load.rs:38-41,70-73,83-85`).
  - Mounted views are capped by `MOUNTED_FILES = 16`, least recently shown dropped first (`rangeStore.ts:83,232-236`).

**4. Existing search**
- `@codemirror/search` 6.7.2 is in `frontend/package.json`. `editor/internal/find.ts:237-241` is `find = [findTheme, findSpace, search({ literal: true, createPanel: … FindPanel })]`. The keys `bind("find"| "find-next"| "find-previous"| "close-find")` use scope `"editor search-panel"` (`find.ts:42,245-263`).
- It is installed in every pane through `paneState` (`pane.ts:240-241`): the merge panes, and the compare and range columns (`compareViews.ts:8`).
- Helpers: `matches`, `findLabel`, `stepMatch` (selection + `EditorView.scrollIntoView(…, {y:"center"})`, `userEvent: "select.search"`) in `findMatch.ts:8-67`. `syncFindSpace` (`find.ts:72`) is used by `frame.ts:85` and `compareFrame.ts:110`. The library also has `SearchCursor`, `RegExpCursor` and `SearchQuery` (dist `:11,143,555`).
- This is plan §2 #44, "Ctrl/Cmd+F finds plain text in the focused pane" (`docs/plan.md:81`).
- There is no search across files. The only Rust "search" code is PATH lookup in `pipe/src/program.rs:117`.

**5. Layout and moving to a file or line**
- **Merge window:** the root is `App.vue:67`, `<div class="past-window-edges flex min-w-0 flex-1 gap-island p-island">`. Its first child is `<FileList v-show="fileListShown" … @select="pick">` (`:68-80`, footer slot holds `OperationLabel`). Next is the right column with notices and the `grid … grid-cols-[minmax(0,1fr)]` cell (`:98`).
- **Range window:** same shape in `RangeApp.vue:82-92` (`@select="showFile"`).
- **Compare window:** `CompareTabList` takes the same place (`CompareApp.vue:68-70`).
- **`FileList.vue`:**
  - The `<aside>` itself carries the width: `class="relative mr-(--island-overlap) flex w-60 shrink-0 flex-col …" :style="widthStyle"` (`:49-52`). Then come the header `<h2>Files</h2>` with the list/tree toggle (`:55`), `<slot name="footer" />` (`:97`) and `PanelWidthHandle` (`:98`).
  - Width comes from `usePanelWidth(list)` (`:19`, `usePanelWidth.ts:8-41`) → `createFileListWidth` (`fileListWidth.ts:16`, localStorage `yamt.files.width`, `FILE_LIST_BOUNDS` 160px…50vw, `:6-14`).
  - [INFERENCE] Because the width sits on the `<aside>`, a panel above it would need a wrapping column, or a slot inside the aside.
- **Selecting a file:**
  - Merge: `pick(path)` (`store.ts:201`) sets `screen` to `files`, then `open` sets `active`.
  - Range: `showFile(path)` (`rangeStore.ts:179`) → `show` (`:223`) sets `shown` and `visited`.
- **Moving to a line:** no public API on either controller.
  - `MergeHandle` = summary, problems, unsaved, `applyAllNonConflicting`, `moveToChange`, `undo`, `redo`, `historyKey`, `snapshot`, `format` (`useMergeController.ts:52-62`). The views are private `#views` (`editor/index.ts:169-176`).
  - `RangeHandle` = content, threadHosts, `moveToChange` (`useRangeController.ts:44-48`). `RangeController` has `setPreferences`, `moveToChange`, `showThreads`, `destroy` (`range.ts:96-118`).
  - Range threads are inline widgets. A line-number press starts or toggles a thread (`range.ts:85-94`), and no thread click scrolls anywhere.
  - Internal mechanisms that could be reused:
    - `revealSpan(view, span)` (`internal/viewport.ts:68`), used by `SideFocus.moveToChange` (`sideFocus.ts:112-115,236`) and `moveToDifference` (`compareFocus.ts:30-49`: selection dispatch, then `revealSpan`).
    - Fold auto-reveal: the center fold field opens folds when the selection lands inside one (`folds.ts:146-149`). `sideReveals` does the same for side panes and centres the view (`folds.ts:272-289`).

**6. Rust and dependencies**
- `yamt-merge-core` is pure. Its dependencies are `imara-diff`, `serde` and `specta` (`crates/merge-core/Cargo.toml`). `scripts/arch-check.sh:16-21` forbids serde_json, tokio and tauri; `:79-82` forbids `std::fs` and `std::process`. Modules are listed at `lib.rs:5-23`, with `compare` as the pattern for a pure function over texts.
- `yamt-range` may depend only on gitio and merge-core (`arch-check.sh:52`). `yamt-session` holds the merge texts.
- `regex` 1.13.1, `regex-automata`, `aho-corasick` and `memchr` are in `Cargo.lock:2608,18,1836`, but only as dependencies of `tauri-utils` (`Cargo.lock:3516`) and `urlpattern` (`:3967`). No yamt `Cargo.toml` lists them.
- The frontend has no regex package; it has built-in `RegExp` plus CodeMirror's `RegExpCursor` and `SearchQuery`.

**Where a search feature would plug in**
- **Keys:** add an action to `KEY_ACTIONS`, `DEFAULT_KEYS`, `ACTION_NAMES`, `ACTION_PLACES` and `KEYMAP_GROUPS` ("Window"), and update `keyText.test.ts:31`. Add a handler next to `fileListKey` in each root's window `keydown` (`App.vue:48`, `RangeApp.vue:46`) through store actions like `store.ts:224` and `rangeStore.ts:202`.
- **Layout:** the `FileList` slot in `App.vue:68-80` and `RangeApp.vue:83-92`, or `FileList.vue` itself (aside, header `:54-55`, footer slot `:97`). Width shared through `usePanelWidth`.
- **Merge window texts:**
  - Rust: `MergeSession.files[*].content` (`Texts`) and `seen` (all files, start-time), reached through a `commands.rs` command delegating to `session`, like `load_file` at `:101`.
  - Window: `opened` (FileMergeData) and, for edited Results, `MergeHandle.snapshot().asShown()`. That needs a registry like the close guard's `track/untrack` (`closeGuard.ts:45-51`, `MergeView.vue:83,117`).
  - Per-stop reset: `nextStop` / `stops.ts:40`.
- **Range window texts:** `Range.files` (blob ids) in `RangeState` (`range.rs:20`) or `load_file` (`load.rs:8`) on the Rust side; `RangeSource.loadRangeFile` (`ipc/RangeSource.ts:8`) on the window side.
- **Showing a result:** `pick` / `showFile` to switch file, then a new controller method built on `revealSpan`, selection dispatch and the fold reveal. Neither handle has one today; `MergeController` (`editor/index.ts:63`) and `RangeController` (`range.ts:41`) are where it would go.

[You have received this identical output 3 times. Re-reading 'agent://ScoutSearch' will not change it — use a narrower selector (path:A-B), or proceed with the edit.]