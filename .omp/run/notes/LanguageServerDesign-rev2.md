# 3.Y revision 2: language servers with owner rows #65–#67

This revision adds what you asked for: detection, the per-repository answer, the Settings entry for added servers, the Save contract, the three status-area placements, and the files shared with Save. Revision 1 still holds where this text does not replace it: the options and recommendation A (§1), the Rust host (§2.2), documents, pull diagnostics and server requests (§2.3–2.5), applying formatting (§2.6), problems (§2.7), platforms, fixture mode and the proposed rows. Nothing was built or run.

## 1. Detection (owner #67: "yamt detects oxlint, oxfmt, TypeScript and eslint")

### Where detection runs and where its rules live
- **The rules live in one TS table, `lsp/internal/presets.ts`.** For each server it lists what to look for, the command, the file types, whether it formats, and its settings. `lsp/internal/detect.ts` runs it as a pure function over the answers from two generic Rust lookups. Rust never learns server names (vision 2).
- **New lookup commands, in `yamt-lsp-host`:**
  - `find_program(program, project) -> ProgramFound { path, place: Local | OnPath } | NotFound { searched }`. This is the same lookup `start_server` uses (`program.rs`), so "detected" and "can start" never disagree.
  - `project_files(paths) -> Vec<ProjectFile>`, with `ProjectFile = Missing | Folder | Text { text } | TooLarge | NotText`.
    - Paths are repo-relative.
    - Text is capped at 64 KiB; it is used to read `package.json` versions.
    - A path outside the repository answers `Missing`.

### What counts as a project folder
- For every conflicted file in the list, yamt walks from the file's folder up to the repository root. The nearest folder with a `package.json` is that file's project.
- Each distinct project is checked once, when the window starts, after the first file list.
- A `pnpm install` run later is seen at the next start.

### The four presets
The facts in this table come from each tool's docs and source; I ran none of them.

| server | detected when, in a project folder | command | file types | formats |
|---|---|---|---|---|
| oxlint | `oxlint` found **in the project** (`node_modules/.bin`, walking up to the root) | `oxlint --lsp`; `initializationOptions` `[{ workspaceUri, options: { run: "onType" } }]` | js jsx mjs cjs ts tsx mts cts vue | no |
| oxfmt | `oxfmt` found in the project | `oxfmt --lsp` | js jsx mjs cjs ts tsx mts cts json jsonc json5 css scss less html vue md yaml yml toml graphql | yes |
| TypeScript | `node_modules/typescript/package.json` has major version ≥ 7 → `tsc`; otherwise `@typescript/native-preview` → `tsgo`; and a `tsconfig.json` or `jsconfig.json` in the project | `tsc --lsp --stdio` or `tsgo --lsp --stdio` (`cmd/tsgo/lsp.go`: stdio only; [the TS 7 release ships `tsc --lsp --stdio`](https://github.com/neovim/nvim-lspconfig/issues/4467)), plus `--clientProcessId <yamt pid>` (tsgo's parent watchdog flag) | ts tsx mts cts js jsx mjs cjs | no |
| eslint | an eslint config (`eslint.config.{js,mjs,cjs,ts,mts,cts}` or `.eslintrc{,.js,.cjs,.json,.yaml,.yml}`), `node_modules/eslint/package.json`, **and** the server `vscode-eslint-language-server` found locally or on PATH | `vscode-eslint-language-server --stdio`; `workspace/configuration` answered with `{ validate: "on", run: "onType" }` over eslint's defaults (its default is `validate: off`, eslint.ts:863) | js jsx mjs cjs ts tsx mts cts vue | no |

- Global installs do not count for oxlint, oxfmt or TypeScript: detection means "this project uses it".
- The eslint server is not part of eslint (it comes from `vscode-langservers-extracted`), so it may be on PATH.

### The spec shape changes
- `ServerSpec = { name, command: { program, args }, project, fileTypes, formats, settings?, initializationOptions? }`.
- `fileTypes` (extensions) replaces revision 1's globs, so `lsp/internal/patterns.ts` is dropped.
- A server serves a file when the file's extension is listed and the file lies under the spec's project folder.

## 2. The per-repository answer and servers added by hand

### Stored in the per-user settings file (the default you named)
The new entry, kept with the other entries under #57's rules:

```json
"languageServers": {
  "repositories": { "/home/wds/Projects/yamt": "start" },
  "added": [ { "command": ["pylsp"], "fileTypes": ["py"] } ]
}
```

**Rust side, in `yamt-settings`:**
- `StoredSettings.language_servers: LanguageServerSettings { repositories: BTreeMap<String, RepositoryAnswer>, added: Vec<AddedServer> }`.
- `RepositoryAnswer = Start | DontStart`; `AddedServer { command: Vec<String>, file_types: Vec<String> }`.
- Two setters on the existing `change()` pattern:
  - `set_repository_answer(places, current, root, Option<RepositoryAnswer>)`. `None` forgets the answer, so the question comes back.
  - `set_added_servers(places, current, Vec<AddedServer>)`.
- A malformed entry is a broken file, as a typed `theme` entry is today.

**Commands, in `src-tauri/src/settings.rs`, both answering `SettingsRead`:**
- `set_server_answer(current, answer)`. The key is Rust's own repository root (`Host::root()`, the same string `servers_context().root` gives the window).
- `set_added_servers(current, added)`.

### The question (words in `ui/question.ts`, through `asking.ts`)
- **When:** at start, after detection, if the repository has no answer and some detected or added server applies to this repository's files.
- **Words:** "Start this project's language servers?", then one line per server ("oxlint, oxfmt, TypeScript — frontend/"; "pylsp — added by you"), then "yamt remembers your answer for this repository. You can change it in Settings."
- **Buttons:** **Start** and **Don't start**; both are stored. Escape stores nothing and asks again next run.
- **One answer covers detected and added servers** (open question 1).

### What the answer does
- **Start:** each server starts when the first opened file it serves appears (revision 1 §2.3).
- **Don't start, or not answered:** the servers still show in the status area as "Stopped". Start from the menu works for this run only.
- Implementation: `setSpecs(specs, { startOnOpen })`.

### Settings section "Language servers"
New component `ui/LanguageServerSettings.vue` in `SettingsView.vue`, placed after Keymap:
- **This repository:** the root path, Start / Don't start buttons (`ChoiceButtons`), and "Not asked yet" when there is no answer.
- **Found in this repository:** the detected servers, read-only (name, project, command).
- **Added by you:** rows showing the command and file types, each with Remove.
  - The add form has two fields, as the owner named them: **Command** (split on spaces, so arguments containing spaces are not supported) and **File types** (extensions, separated by commas or spaces), plus an Add button.
  - Name = the program's file name, with "(2)" added if it repeats.
  - Project folder = the repository root.
  - Formats when the server offers formatting.
- Formatting order: detected formatters first (oxfmt), then added servers in list order.

## 3. The contract for Save (3.Z)

- **`MergeController.format(): Promise<FormatOutcome>`.**
  - It never rejects.
  - A second call while one runs returns the same promise.
  - It waits at most `FORMAT_TIMEOUT_MS` (5 s) **in total**, including waiting for a formatter that is still starting.
  - `FormatOutcome = { kind: "formatted" | "unchanged" | "changedMeanwhile"; server } | FormatRefusal`.
  - `FormatRefusal = { kind: "noFormatter" } | { kind: "notRunning"; server; state } | { kind: "failed"; server; message } | { kind: "timedOut"; server }`.
  - On `formatted`, the formatting is one undo step (`yamt.format`).
- **`useMergeController` handle: `format(): Promise<FormatOutcome | null>`** (`null` when the view has no controller). Added by build U.
- **`store.noteFormat(path, outcome)`** (from `ui/servers.ts`) records the outcome. That file's status area shows it ("Formatted by oxfmt", "Not formatted: oxfmt is not running", "Not formatted: oxfmt failed: <message>", …) until the next format or a rebuild of the view. The words live in `ui/serverText.ts`.
- **What Save does:**
  1. `const outcome = await handle.format();`
  2. `noteFormat(path, outcome);`
  3. Write `resultText()` as #65 describes, whatever the outcome. `changedMeanwhile` saves the current text.
- yamt sends no `didSave` (it advertises `didSave: false`); servers run in "on type" mode.
- Whether "Mark resolved" formats too is the save design's call.

## 4. The status area beside the gear (three places)

- `ServerStatus.vue` goes directly left of `SettingsButton` in all three header rows:
  - `MergeToolbar.vue:155`: with the shown file's problem counts.
  - `ChoiceView.vue:51`: no counts.
  - `MergeView.vue:138`, the read-only header: no counts.
- **The gear's `ml-auto` moves onto `ServerStatus`**, so the pair sits at the right end. In the two headers that use `justify-end`, nothing else changes.
- Hidden when no specs exist.
- No wrapper component: three explicit placements read easier than a component made only to hold two others.

## 5. Ownership split, revised

| build | owns |
|---|---|
| **R: Rust** | `crates/lsp-host/**` (host, framing, `program.rs`, `find_program`, `project_files`, the `lsp-echo` test server, `AGENTS.md`); `crates/settings/src/{lib.rs, file.rs}` and its tests (the `languageServers` entry, two setters); `crates/settings/AGENTS.md`; `Cargo.toml`; `Cargo.lock`; `src-tauri/Cargo.toml`; `src-tauri/src/{servers.rs (new), settings.rs, commands.rs, window.rs, lib.rs}`; `src-tauri/AGENTS.md`; `scripts/arch-check.sh`; `frontend/src/ipc/bindings.ts` (generated); `.omp/skills/ipc-contract/SKILL.md` |
| **P: protocol and editor** | `frontend/src/ipc/{ServerHost.ts (new), ChunkSource.ts (two settings methods), tauri.ts, fixtureSettings.ts, index.ts, domain.ts}`; `frontend/src/lsp/**` (including `internal/presets.ts` and `internal/detect.ts`; `patterns.ts` dropped); `frontend/src/editor/**` (`index.ts`, `theme.css`, `internal/{serverDoc, problems, format, lineDiff}.ts`, `AGENTS.md`); `frontend/src/style.css`; `frontend/package.json`; `pnpm-lock.yaml`; `frontend/.oxlintrc.json`; `frontend/scripts/fences.{ts,test.ts}`; `.omp/skills/cm6-rules/SKILL.md` |
| **U: chrome** | `frontend/src/ui/{ServerStatus.vue, ServerMenu.vue, ServerLogView.vue, LanguageServerSettings.vue, serverText.ts, servers.ts}` (new) and their tests; `ui/{store.ts, store.test.ts, settings.ts, question.ts, App.vue, MergeView.vue, MergeToolbar.vue, ChoiceView.vue, SettingsView.vue, useMergeController.ts, AGENTS.md}`; `frontend/src/main.ts`; `docs/architecture.md`; `.omp/skills/project-map/SKILL.md` |

- **Contracts between builds:** R fixes the six commands (`servers_context`, `start_server`, `send_to_server`, `stop_server`, `find_program`, `project_files`), the two settings commands, and their types. P fixes the `lsp/` and `editor/` surface (revision 1 §3, plus `detect`, `setSpecs(specs, { startOnOpen })` and `FormatOutcome` as in §3 above).
- **Order:** R and P start together; P maps `ipc/tauri.ts` last, after R's bindings exist. U starts after P.

## 6. Files Language servers and Save will both touch

- **Rust:**
  - `src-tauri/src/commands.rs`: both register commands.
  - `frontend/src/ipc/bindings.ts`: regenerated by both Rust builds.
  - `src-tauri/src/lib.rs` and `src-tauri/src/window.rs`: only if Save changes start or close.
  - `.omp/skills/ipc-contract/SKILL.md`.
- **IPC:** `ipc/ChunkSource.ts`, `ipc/tauri.ts`, `ipc/index.ts`, `ipc/domain.ts` (Save's reply types), `ipc/fixture.ts` (Save; fixture settings are mine only).
- **Editor:** `editor/index.ts` (my `format` and `onProblemsChange`; Save's composition of "what git wrote" and change listening). `editor/AGENTS.md` and `cm6-rules` if Save adds rules.
- **UI:**
  - `ui/store.ts` and `store.test.ts`: my `screen`, `servers`, `noteFormat`; Save's save action and unsaved state.
  - `ui/useMergeController.ts`: my servers in and problems/format out; Save's baseline and dot.
  - `ui/MergeView.vue`: my status area in the read-only header; Save's key, the dot in the Result header, and the Save call.
  - `ui/question.ts`: my start question; Save's close-question words.
  - `ui/App.vue`: my `screen`; Save only if it adds a window-wide key there.
  - `ui/MergeToolbar.vue`: my status area; Save if it adds anything to the toolbar.
  - `ui/AGENTS.md`.
- **Save only, not mine:** `ipc/keys.ts` and `ui/keyText.ts` (the Save action), `ui/closeGuard.ts`, `ui/views.ts`, `ui/diskChanges.ts`, `ui/problem.ts`, `ui/problemText.ts`, `crates/session/**`, `src-tauri/src/ipc_error.rs`.
- **Docs:** `docs/architecture.md` and `.omp/skills/project-map/SKILL.md` are shared; give them one owner per wave.
- **Suggested order:**
  1. LS-R.
  2. Save's Rust build, which then only adds commands and regenerates bindings. It can run alongside LS-P and LS-U, since they share no files, as long as only one Rust build regenerates bindings at a time.
  3. LS-P, then LS-U.
  4. Save's window build last, because it awaits `handle.format()` from LS-U and shares six ui/editor files with it.

## 7. Open questions for the owner (replacing revision 1 §5)

1. **Servers you added and the repository answer.** Should "Don't start" also keep your own added servers off in that repository (default: yes, one answer for everything, since your server still reads that repository's configs), or should your own servers always start?
2. **eslint without its language server.** eslint's language server is a separate install (`vscode-langservers-extracted`). Should yamt offer eslint only when that server is found (default), or offer it anyway and show "Not found — install vscode-langservers-extracted" in the status area?
3. **The answer is remembered by the repository's folder path.** A second worktree or a moved checkout asks again. Acceptable?
4. **Problems on conflict-marker lines and inside waiting changes** are shown by default. A file with markers left shows a burst of syntax errors until those conflicts are decided.
5. **A server that stops on its own** stays stopped until Restart (default), or restarts by itself (VS Code: up to 5 times in 3 minutes)?
6. **Started from a desktop menu (macOS especially),** node-based servers do not find `node`. Should yamt read the login shell's PATH at start (costs start time and runs your shell config), or show "not found" with the folders it searched (default)?

## 8. Risks added by this revision

- **TypeScript < 7:** `tsc` has no `--lsp`. The version check reads `node_modules/typescript/package.json`; TS 7's install layout is [INFERENCE].
- **eslint settings:** whether its configuration answer needs `workspaceFolder` is unchecked [INFERENCE].
- **Detection is local only:** a project whose `node_modules` is installed only at a parent above the repository root is not detected.
- **Splitting the Command field on spaces** cannot express quoted arguments.

## 9. Checks the main agent should run after all builds land

- `just check`.
- `pnpm test:browser` (the lint tooltip in WebKit).
- `cargo nextest run -p yamt-lsp-host -p yamt-settings`.
- Windows CI for the program-lookup tests.
- An app smoke on yamt's own repository: oxlint, oxfmt and TypeScript should be found in `frontend/`, and the question should appear once.