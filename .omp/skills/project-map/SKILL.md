---
name: project-map
description: Where things live in yamt, which module may depend on which, who owns which state, and the five core visions every technical decision must cite. Read before touching any file.
---

# yamt — project map

Verified against commit: `65ab7d9` (settings feature: crate `settings`, the settings view, keys and themes; `map-check` ok). Full text: `docs/architecture.md`. Package names (`cargo -p`, `just`, arch-check) are in parentheses.

## Core visions (ranked; lower number wins a conflict)

1. **Readable by the product owner** — TS-proficient, Rust beginner. Clever is a defect.
2. **One source of truth per fact** — generated types, single state owner, one constant per tunable.
3. **Boundaries are enforced, not described** — every rule names its detector.
4. **Illegal states don't compile** — brands, constructive ranges, exhaustive matches, sum types.
5. **Small surface, boring design** — no abstraction without two users; no dependency the chosen stack covers.

## Tree

```
crates/merge-core   (yamt-merge-core) pure diff3 chunk model and per-side word changes: chunk, compute, apply, line (InlineRange/InlinePoint),
                    token (tokenizer), line_pairs (line pairing, Dice ≥ 50 %), word (`word_changes`), line_map (2-way `LineMap`: `exact`/`covering`,
                    used to locate disk conflict blocks in the stages, plan §2 #53). NO I/O, NO git, NO tauri, NO serde_json, NO tokio
crates/gitio        (yamt-gitio) git subprocess layer (ls-files -u/-s, cat-file --batch, update-index incl. --index-info/--force-remove, add, checkout -m, checkout-index: take, rollback;
                    version, attributes (check-attr), merge_config, hash-object --stdin-paths, merge_file (temp files, exit 0..127 = conflicts)). NO diff logic
crates/session      (yamt-session) MergeSession state machine; describe/take (`sides.rs`); finish/take/reset all-or-nothing (`writes.rs`); the only crate that knows both of the above.
                    Disk is the truth (plan §2 #52/#53): open (`open.rs`), what git wrote at start (`start.rs`), per-file disk memory and settling (`disk.rs`),
                    marker parsing and views (`markers.rs`), locating blocks in the stages (`locate.rs`), the middle seeded from the disk (`seed.rs`), DTO building (`merge_data.rs`)
crates/cli          (yamt-cli, bin yamt-cli) headless binary: classify / scan / golden / fixture
crates/conflict-repo (yamt-conflict-repo) dev-only: temp git repos whose merge stops with scripted conflicts (regular, symlink, gitlink; `conflict_repo_with`: config and attributes set before the merge); dev-dependency of gitio, session, cli
crates/settings     (yamt-settings) the per-user settings file (plan §2 #57): lib (types crossing the IPC, Error, read/set_theme/set_keys/relocate/theme_at_start),
                    places (default file, settings-location, `~/`), file (kept entries, temp file + rename, symlink target). Key strings are opaque here. NO tauri, NO yamt-* crate
src-tauri           (yamt-app) lib.rs (`run`, `export_bindings`: one tauri-specta builder for both bins) + graphics (NVIDIA guard, the one `unsafe`, plan §2 #43),
                    args, outcome (start-up decision, exit status), window (close fallback when the page is gone; theme at start: native background + `data-theme` script; `show_theme`),
                    commands, settings (`places` + the four settings commands), ipc_error (IpcError), frontend_log,
                    appimage (a relative repo path is resolved against OWD only when the running binary lives under $APPDIR with APPIMAGE set; never chdir);
                    bins `yamt` and `export-bindings` (→ ipc/bindings.ts; feature `bindings`, so no bundle carries it); tauri.conf.json (bundles: AppImage, deb, app, dmg); icons/icon.svg source (plan §2 #41)
release             README.md, LICENSE (MIT), CHANGELOG.md, THIRD_PARTY_NOTICES.md, THIRD_PARTY_LICENSES.txt (GENERATED, in every bundle), docs/screenshot.png, .github/workflows/release.yml (draft release on `v*`; plan §2 #38)
scripts/arch-check.sh    PM1: cargo tree edges, std::fs/process grep in merge-core, clippy threshold parity, `unsafe` only in src-tauri/src/graphics.rs
scripts/map-check.sh     PM6 (`just map-check`): every source file is named in this map
scripts/test-screen.sh   `place`: KWin rules put test windows on the Samsung screen when one is connected; `check` = `just test-window-check` (VF8, plan §2 #40)
scripts/conflict-repo.sh `<dir>`: smoke repository with 7 conflicts (3 goldens .ts/.vue/.tsx, CRLF, add/add, binary, deleted on one side), no user git config
scripts/git-sandbox.sh   sourced by conflict-repo.sh and golden-repo.sh: die, non-empty refusal, git ≥ 2.32 gate, user/system git config isolation (RK19), repo_git, golden_file_path
scripts/third-party-licenses.sh  `just third-party-licenses`: THIRD_PARTY_LICENSES.txt from `cargo metadata` + `pnpm licenses list --prod` + licence files on disk (jq);
                    `ubuntu-versions` appends the AppImage's library versions and the GNU GPL/LGPL texts (Linux job); both release jobs regenerate and `git diff --exit-code` it
root config         clippy.toml (too-many-lines 40, unwrap/expect/panic allowed in tests), crates/merge-core/clippy.toml
                    (disallowed_*; shadows root, keys duplicated), deny.toml, rust-toolchain.toml, Cargo.toml [workspace.lints], .cargo/mutants.toml
frontend/src/ipc    index.ts (public surface + the one app logger); domain.ts (brands by type guard, toDomain); ChunkSource.ts; fixture.ts (fixture mode (browser without the app): valibot over
                    fixtures/{golden,showcase}/*.json); fixtureSettings.ts (fixture mode's settings, in memory); bindings.ts (GENERATED); log.ts; tauri.ts (`createTauriSource` over `commands`);
                    window.ts (close-request guard, the only `@tauri-apps/api/window` importer); keys.ts (the one source of what keys mean, #57: actions, defaults, file text incl. `MacCtrl-`, labels, keyOfEvent, bindingsOf)
frontend/src/model  empty and unused (AGENTS.md only); reserved for pure TS shared by more than one module
frontend/src/editor CodeMirror 6 integration; public surface = MergeController(FileMergeData, hosts incl. two strip <svg>s, options { readOnly, preferences }): setPreferences (theme + keys, #57), undo, redo, historyKey (bound Undo/Redo from anywhere, #54), moveToChange (toolbar arrows, #56), resultText, summary, onSummaryChange,
                    applyAllNonConflicting, destroy; types `Side`, `MergeSummary`, `MergeOptions`, `Preferences`, `Direction`. internal/: pane (compartments: dark flag, keymaps), chunkField, status, sideStatus, apply, decorations, words, language, indent, side, keys (`cmKey`), sideKeys (the side keymap),
                    tone, lineSpan, geometry (where each chunk sits in each pane, px), gap (what a strip shows: the bands that cross it, each open change's icon row and hover titles, document space; plan §2 #51, #55), strips (keeps the strips' nodes and moves them per frame), drag (icon press/drag on the persistent strips, plan §2 #45), covered (drag highlight, no history), modClick (Ctrl/Cmd+click and +right-click, #46, #55),
                    find (find bar per pane on @codemirror/search, #44; bound keys) + findMatch (match count, label, step, select), scrollSync; keyboard focus (#54): navigation (pure rules: step, cross, after a decision, on screen, hit test, handover), sideMark (each side's focused/remembered change), sideFocus (clicks, Ctrl/Cmd+wheel, toolbar arrows #56, reveal),
                    viewport (visible area, WebStorm placement), wheel (wheel bursts → steps), historyKey (undo/redo shortcut from any target); theme.css; framework-free (all `*.test.ts` in `node`; `engine.browser.test.ts` is the WebKit probe)
frontend/src/icons.d.ts  types `~icons/*?raw` (string, editor/) and `~icons/*` (Vue component, ui/); plan §2 #34
frontend/src/connectors  index.ts: Span, Band, bandPath — pure band geometry → SVG path strings; no DOM
frontend/src/ui     Vue 3 chrome: App, FileList (emits select; vscode-icons via fileIcon.ts, plan §2 #39), MergeToolbar (emits move/applyLeft/applyRight/undo/redo/reset/finish; Undo/Redo hidden by `HISTORY_BUTTONS_SHOWN`), summaryLabel.ts, MergeView,
                    SettingsButton (the gear in every file's header row) + SettingsView (settings screen in the files' grid cell, `settingsOpen` in the store, #56: Theme, Keymap, Settings file, #57)
                    + KeymapList (the actions' rows, WebStorm's Keymap edit menu) + KeyRecorder (WebStorm's Keyboard Shortcut dialog); menuKeys.ts (`stepMenuItem`: both menus' Up/Down/Escape/Tab);
                    keyField.ts (`fieldKey`: what a key does in the dialog's field — record, confirm, cancel, leave, ignore, after WebStorm's ShortcutTextField);
                    useMergeController (only ../editor importer), store.ts singleton; problem.ts (Problem types, attempt, report) + ProblemBar + problemText.ts (failures in words, 2.1);
                    QuestionDialog + question.ts (Mark resolved / quit confirmations: words and decisions, 2.K); one MergeView per opened file (inactive = `invisible` + `content-visibility: hidden`: no layout or paint, state and scrollTop kept, plan §2 #51);
                    ChoiceView + choiceText.ts (two-button choice for files the editor cannot show, with a Result column; also the deleted-side view's words: sentences, labels, Result lines, plan §2 #36, #47);
                    sideHeaders.ts (`sideHeader(side, remote)`: "Local (yours)" / "Remote (theirs): <name>", plan §2 #50); nextFile.ts (`nextUnresolved`, #48); asking.ts (one question at a time, owned by the store);
                    closeGuard.ts (unsaved work per opened file and the window-close question, held by the store); sides.ts (`otherSide`, `Taken`: by a side or by the disk); deletedSide.ts (`deletedSideView`: what the deleted-side view shows, #47);
                    diskChanges.ts (`applyDiskChanges`: notices, dropped edits, refetch of shown files, plan §2 #52/#53); views.ts (shown views: fetch, put, reload; `takesASide`: choice file; `isEditable`: the middle is writable for this data);
                    NoticeBar + noticeText.ts (closable notices about files changed on disk, words only there);
                    settings.ts (the store's settings actions: load on mount/focus, theme, key edits, move; adopt a reply, #57); keymapEdit.ts (pure key-edit rules, the clash question);
                    keyText.ts (action names, places, groups; the Keymap edit menu `keymapMenu`, the + menu `setKeyMenu`, the conflict line `usedByText`)
frontend/src/main.ts     picks the source by `VITE_CHUNK_SOURCE` (`"tauri"` in the app, fixtures otherwise; typed in src/env.d.ts), reads the start theme from `<html data-theme>`, creates the store, loads the file list, mounts App
frontend/src/style.css   the colour palettes: Tailwind `@theme static` (Islands Dark) with stock colours reset (`--color-*: initial`), plan §2 row 24, and `:root[data-theme="light"]` (Islands Light, #57) redefining every token
frontend/scripts    check-sfc-order.ts (VU2); fences.ts (PM2/PM3/PM5, plus `~icons/*` without `?raw` in framework-free modules); palette.ts (VU17) — each with a .test.ts that reads src/ itself;
                    app-session.ts (`just app-session`: the shared CLI driving the real app on a private Xvfb through tauri-driver, or the fixture page through `just webdriver`) + app-session/:
                    args, argv, keys, find, placement, colours, state, folders, json (pure, tested); start, fixture, drive, focus, video, stop, processes, session, webdriver (thin)
frontend/fixtures   sample/{base,local,remote}.ts.txt (`just smoke-cli`); golden/<case>.json GENERATED by `just fixtures`, checked by `just fixtures-check`;
                    showcase/<case>.json GENERATED from `tests/showcase/<case>/` by `just fixtures` (demo cases, not goldens)
frontend/tsconfig   tsconfig.app.json: src/**, types [vite/client] (no Node globals in webview code); tsconfig.node.json: scripts/**, vite.config.ts, types [node]; typecheck = `vue-tsc -b`
frontend/vite.config.ts  Vitest projects: `node` (model, connectors, ipc, ui, editor `*.test.ts`, scripts) = `pnpm test`;
                    `browser` (`editor/**/*.browser.test.ts`, Playwright WebKit) = `pnpm test:browser`, not in `just check`
tests/golden/<case>      base.<ext> local.<ext> remote.<ext> README.md, expected.json (generated, `just golden-update`); scripts/golden-repo.sh rebuilds a case as a repo
tests/showcase/<case>    hand-written base/local/remote demo (`word-marks`), source of `fixtures/showcase`
docs/                    plan.md (decisions §2), architecture.md, ai-system.md, slices/SLICES.md, slices/briefs/, walkthroughs/
AGENTS.md                root, plus one per module: crates/*, src-tauri, frontend/src/*
```

## Dependency direction (detector in brackets)

```
merge-core ◄── session ◄── cli   (cli also uses merge-core directly)
gitio      ◄──┘        ◄── src-tauri ─generates─► ipc/bindings.ts
ipc ◄── editor ◄── ui ◄── main.ts      (ui reaches editor only through useMergeController; ui also imports ipc: types, logger, source)
connectors ◄── editor                 (model/ is empty and unused)
```

- [PM1] `gitio` never depends on `merge-core`; `merge-core` has no `std::process`/`std::fs`/`tauri`/`serde_json`/`tokio`; `src-tauri` (yamt-app) depends on `session` only, never directly on `gitio`/`merge-core`. Detector: `just arch-check` (`cargo tree --target all --all-features`; yamt-app's direct deps; std::fs/process grep), clippy `disallowed_*`.
- [PM2] `ui/**` never imports `@codemirror/*`, `@tauri-apps/*` (only `ipc/` talks to the app), `editor/internal/**`, `model/**` (at any depth). Detector: oxlint overrides (`/**` globs: oxlint 1.87 does not match nested specifiers with `/*`) + `frontend/scripts/fences.test.ts`.
- [PM3] `editor/**`, `model/**`, `connectors/**` never import `vue`, `vue/*`, `@vue/*`, `@vueuse/*`, `@tauri-apps/*`, or `~icons/*` without `?raw`. Detector: oxlint overrides + `frontend/scripts/fences.test.ts` (`~icons/*`: `fences.test.ts` only).
- [PM4] `ipc/bindings.ts` is generated; never hand-edited. Detector: hook `generated.ts` + `hooks.test.ts`, oxlint/oxfmt `ignorePatterns`, `just bindings-check` (diffs a fresh export in `target/`).
- [PM5] No module imports a sibling's `internal/` (bare `**/internal` included); no import cycles. Detector: oxlint overrides + `frontend/scripts/fences.test.ts`; `import/no-cycle` everywhere.
- [PM6] Every non-test source file under `frontend/src/` (except `ipc/bindings.ts`), `frontend/scripts/`, `scripts/`, `crates/merge-core/src/` is named in this map, and every IPC command / ChunkSource method is named in architecture (and ipc-contract). Detector: `just map-check`.

## State ownership (vision 2)

| state                                                 | owner                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| document text (all three panes)                       | CodeMirror `EditorState`                                                                                                                                                                                                                                                       |
| chunk current positions (center)                      | `editor/chunkField` StateField, mapped per CM1 (applied span pushes later ones; `to` capped at the next `from`), or set as given by `placeSpans` (an action's chained final spans, CM7; undo's snapshot through `invertedEffects`)                                             |
| chunk apply status                                    | same StateField: per-side status (`pending\|applied\|ignored`, plan §2 #33); `setStatus` only in the throwaway steps of an action's chain (CM7); dispatched: wholesale by `placeSpans` (actions, undo/redo) or ignored on both sides when the user deletes an open block (CM8) |
| left/right decorations                                | fixed side ranges + a read-only status mirror pushed by the controller (no history)                                                                                                                                                                                            |
| find space above line 1                               | `findSpace` field in every pane (`find.ts`), pushed by the controller each frame from "any pane's bar open" (no history, plan §2 #44)                                                                                                                                          |
| drag over the icons (press, covered highlight)        | press in `editor/internal/drag.ts`; highlight in a side-pane field (`covered.ts`) pushed by the controller (no history, plan §2 #45)                                                                                                                                           |
| which side pane has the keyboard                      | the browser's focus (CodeMirror's `cm-focused`), never copied; outlines are drawn only under it (plan §2 #54)                                                                                                                                                                  |
| each side's focused or remembered change              | `sideMarks[side]` field in that side pane's state (`sideMark.ts`, `SideMark` = `change{id}` \| `alone{remembered}`): set by `setMark`, moved on by the controller's `showStatuses` push when its change stops waiting (no history, plan §2 #54)                                |
| scroll positions                                      | DOM, driven by `editor/scrollSync`                                                                                                                                                                                                                                             |
| chunk rows and scroll anchors                         | one cache in `MergeController` (rows + the sync's anchors), dropped by `rowsChanged` (doc, measured heights, statuses); strip positions written per frame (plan §2 #51)                                                                                                        |
| file list, opened files, active file                  | `ui/store.ts` singleton via `useAppStore()`; each opened file's `MergeView` owns its controller and registers `{ unsaved, markSaved }` with `store.track`                                                                                                                      |
| saved baseline per opened file                        | non-reactive `let` in `useMergeController`: set when the controller is built, replaced by `markSaved` after a successful finish                                                                                                                                                |
| choice per file the editor cannot show (its sides)    | `choices` shallowRef in `ui/store.ts`: set by describe, dropped and described again by reset; Rust's index is the truth for "resolved"                                                                                                                                         |
| side taken (choice files and deleted-side text files) | one `taken` map in `ui/store.ts` (`Taken`: by a side or by the disk): set by `takeSide`, and by a disk change that staged a choice file (`diskChanges.ts`); a deleted-side file "resolved on disk" comes from its `middle` kind; deleted by reset (plan §2 #47, #52)           |
| marks in the file list                                | git's view: `files` re-read by `refreshFiles` on window focus (`useWindowFocus` in App.vue) and returned by each action (plan §2 #49)                                                                                                                                          |
| failure shown in the window                           | `problem` shallowRef in `ui/store.ts`; cleared by the next success or `dismissProblem()`; words only in `ui/problemText.ts`                                                                                                                                                    |
| settings view shown instead of the shown file         | `settingsOpen` shallowRef in `ui/store.ts`: `openSettings` (gear), `closeSettings` ("Back"), `pick` (file list); the files stay mounted, only hidden (plan §2 #56)                                                                                                             |
| settings in use (theme, keys, the file's path)        | `settings` shallowRef in `ui/store.ts`, changed only by settings replies (`ui/settings.ts`), re-read on window focus; `preferences` computed from it reaches every controller via `setPreferences`; the file itself is Rust's (`yamt-settings`, plan §2 #57)                   |
| page theme attribute `<html data-theme>`              | the shell's start script before the first frame; `main.ts` reads it; afterwards only `App.vue` writes it from `settings.theme`                                                                                                                                                 |
| notices about files changed on disk                   | `notices` shallowRef in `ui/store.ts` (one per path), written only by `ui/diskChanges.ts` from Rust's `DiskChange`s, closed by `dismissNotice`; words only in `ui/noticeText.ts` (plan §2 #52)                                                                                 |
| question waiting for an answer                        | `ui/asking.ts` (`createAsking`, held by the store state); words in `ui/question.ts`                                                                                                                                                                                            |
| summary counts of the open file                       | `shallowRef` in `useMergeController`, fed by `MergeController.onSummaryChange`                                                                                                                                                                                                 |
| captured index stages (for reset)                     | `session::FileState.stages`, captured at `open()`                                                                                                                                                                                                                              |
| what each file looked like on disk, its disk version  | `session::FileState.seen` (`Seen`: `GitOutput` \| `ViewFromStages` \| `ViewFromDisk`) and `settled` (last `DiskResult`, version); written only by `session` (plan §2 #53)                                                                                                      |

Vue state never holds an `EditorView`, a position, or document text.

## Where does X go?

| X                                                            | place                                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| a new git operation                                          | `gitio::Repo` method; bytes in/out; integration test with a real tempdir repo      |
| a new chunk property                                         | `merge_core::Chunk` → regenerate bindings → `ipc/domain.ts`                        |
| a new IPC command                                            | `src-tauri/src/commands.rs` (≤ 15 lines, delegates to `session`) → `just bindings` |
| an editor behaviour (apply, undo, decorations, strip arrows) | `editor/internal/*`, exposed only through `MergeController`                        |
| a new chrome widget                                          | `ui/<Name>.vue`, state in `store.ts`, actions in `store.ts`                        |
| a tunable number                                             | one `const` next to its only user, or `merge_core::DEFAULT_GAP`                    |
| a cross-cutting decision                                     | `docs/plan.md` §2 row citing a vision                                              |

## Line spaces (vision 4)

`BaseLine`, `MiddleLine`, `LocalLine`, `RemoteLine` are Rust newtypes; the window brands `MiddleLine`, `LocalLine`, `RemoteLine`, `ChunkId`, `DiskVersion` (created only in `ipc/domain.ts`; base lines do not reach the window, plan §2 #53); `DocPos` is a CM offset brand created only in `editor/`. `LineRange<L> = { start: L, len }`. Mixing any two is a type error by design.
