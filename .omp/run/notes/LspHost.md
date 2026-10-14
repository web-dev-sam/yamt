# LspHost (3.Y-host, board row 6) — committed 99f7c07

I built slice 3.Y-host as the brief specifies: the new crate `yamt-lsp-host`, the `languageServers` settings entry with its two setters, the eight commands in the app, and the two new arch-check rules. The 123 tests across the three crates pass, and clippy, `cargo fmt --check` and `just arch-check` are clean. The Windows-only tests (`#[cfg(windows)]`) did not run on this Linux machine.

## summary
- New crate `crates/lsp-host`: a `Host` starts language-server programs, frames messages both ways, and stops them with std threads and channels only (no `Arc`, no async). It also does the program lookup and `project_files`, and includes `lsp-echo`, a small framed server the tests run as a real child process.
- `yamt-settings` stores the `languageServers` entry (answer per repository root, servers added by hand), with `set_repository_answer` and `set_added_servers`.
- `src-tauri`: new `servers.rs` with the six server commands; `set_server_answer` and `set_added_servers` in `settings.rs`. A `Mutex<Host>` is managed beside `Mutex<MergeSession>` (never locked together), and `stop_all` runs after `run_return`.
- `scripts/arch-check.sh`: `yamt-lsp-host` may not depend on any `yamt-*` crate, `tauri` or `serde_json`; `yamt-app` may now also depend on `yamt-lsp-host`.

## files_changed
- `crates/lsp-host/Cargo.toml`, `AGENTS.md`, `src/{lib.rs, run.rs, frame.rs, program.rs, files.rs}`, `src/bin/lsp-echo.rs`, `tests/{run.rs, files.rs}` (new)
- `crates/settings/src/{lib.rs, file.rs}`, `crates/settings/tests/{language_servers.rs (new), settings.rs, antialiasing.rs, config/mod.rs}`, `crates/settings/AGENTS.md`
- `src-tauri/Cargo.toml`, `src-tauri/src/{servers.rs (new), commands.rs, settings.rs, window.rs, lib.rs}`, `src-tauri/AGENTS.md`
- `scripts/arch-check.sh`
- `Cargo.lock` was updated by cargo: it now lists the `yamt-lsp-host` package and it as a dependency of `yamt-app`; nothing else changed in it.

## tests_added
**`crates/lsp-host/tests/run.rs`** (real `lsp-echo` child process):
- `a_message_comes_back_whole_with_a_multi_byte_body`: a UTF-8 body with 2-, 3- and 4-byte characters makes the full trip.
- `a_frame_split_across_two_writes_arrives_as_one_message`: the server writes one frame in two halves with a 50 ms pause; it arrives as one message.
- `two_frames_in_one_write_arrive_as_two_messages`: two frames in one write arrive as two messages, in order.
- `stderr_lines_arrive_as_log_lines_and_a_long_one_is_cut_at_8_kib`: each stderr line arrives as `Log`; a 16 KiB line arrives as exactly 8192 bytes, and the next line is still read normally.
- `stop_closes_the_input_and_a_cooperative_server_exits_once_within_the_grace`: `Exited{Some(0)}` within 2 s and nothing after it; a second stop and a send to the finished run do nothing; the pid is gone.
- `stop_kills_a_server_that_ignores_it_after_the_grace_and_exits_once`: the server is killed after at least 2 s, exactly one `Exited`, with `code: None` on unix; the pid is gone.
- `a_server_exiting_by_itself_reports_its_code`: `Exited{Some(7)}`.
- `a_dropped_event_receiver_stops_the_run_at_its_next_output`: the pid goes away.
- `stop_all_returns_with_no_child_left_also_one_that_ignores_stop`: both pids are gone when `stop_all` returns; each channel got exactly one `Exited`.
- `a_project_outside_the_repository_is_refused`: `../outer`, `a/../../outer` and `./x` are all refused.
- `a_project_reached_through_a_link_out_of_the_repository_is_refused` (unix only).
- `a_missing_project_folder_is_a_spawn_failure_and_a_missing_program_lists_the_search`.

**`crates/lsp-host/tests/files.rs`**:
- `project_files_answers_each_path_in_order`: a missing file, a folder, the root, text, exactly 64 KiB (`Text`), 64 KiB + 1 (`TooLarge`), not UTF-8 (`NotText`), and two paths escaping with `..` (`Missing`).
- `a_file_reached_through_a_link_out_of_the_repository_is_missing` (unix only).
- `find_program_searches_nothing_for_a_project_outside_the_repository`.

**`program.rs` unit tests** (program lookup):
- `the_project_s_own_bin_folder_wins_over_its_parents_and_path`
- `a_parent_s_bin_folder_up_to_the_root_comes_before_path`
- `path_entries_are_searched_in_their_order`
- `not_found_lists_every_folder_searched_in_order_and_stops_at_the_root`: a program placed above the root is not found.
- `a_program_with_a_separator_is_taken_relative_to_the_project_only`
- `a_file_without_execute_permission_is_not_a_program` (unix only)
- `windows_tries_each_pathext_extension_unless_the_name_has_one` (Windows only)
- `windows_skips_a_file_without_an_extension` (Windows only)

**`frame.rs` unit tests** (framing):
- `a_written_frame_counts_bytes_not_characters`
- `frames_read_back_whole_also_one_byte_at_a_time`
- `header_names_are_case_insensitive_and_other_headers_are_ignored`
- `a_length_above_64_mib_is_too_large_and_64_mib_is_read`
- `broken_frames_say_why`
- `a_header_line_without_end_is_broken_after_8_kib`
- `log_lines_lose_their_line_break_and_a_long_one_is_cut_at_8_kib`

**Settings (`tests/language_servers.rs`)**:
- `an_old_file_without_the_entry_reads_as_empty_and_stays_as_written`
- `an_answer_is_set_replaced_and_forgotten_by_the_repository_root`: the entry leaves the file once it is empty again.
- `added_servers_are_written_with_their_file_types_and_read_back`
- `a_malformed_language_servers_entry_is_broken_and_no_change_rewrites_the_file`: three malformed shapes; read and both setters fail; the file's bytes are unchanged.

**Settings unit test**: `the_language_server_entry_crosses_the_ipc_spelled_as_in_the_file`.

**App, mock runtime (`servers.rs`)**:
- `servers_context_names_the_session_s_repository_and_this_process`
- `find_program_finds_a_project_s_program_and_project_files_reads_the_repository`

## smoke_evidence
1. `cargo nextest run -p yamt-lsp-host -p yamt-settings -p yamt-app` → `Starting 123 tests across 12 binaries` … `Summary [ 2.243s] 123 tests run: 123 passed, 0 skipped`. In the lsp-host-only run: `PASS [ 2.014s] yamt-lsp-host::run stop_kills_a_server_that_ignores_it_after_the_grace_and_exits_once`, `PASS [ 0.026s] … stop_closes_the_input_and_a_cooperative_server_exits_once_within_the_grace`.
2. `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings` → `Finished` with no warnings. `cargo fmt --all --check` → `fmt-ok`. `just arch-check` → `arch-check: ok`. Each new rule was broken on purpose, the failure captured, then restored (the final run is `ok` again):
   - `serde_json` + `yamt-settings` added to lsp-host → `arch-check: yamt-lsp-host must not depend on: serde_json yamt-settings`, exit 1
   - `tauri` added to lsp-host → `arch-check: yamt-lsp-host must not depend on: serde_json tauri tauri-codegen tauri-macros tauri-runtime tauri-runtime-wry tauri-utils`, exit 1
   - `yamt-gitio` added to yamt-app → `arch-check: yamt-app depends on yamt-session, yamt-settings and yamt-lsp-host only, not: yamt-gitio`, exit 1
3. Bindings: I exported to `target/bindings-lsp.ts` instead of running `just bindings`, because `frontend/` is not in my Owned files. `diff frontend/src/ipc/bindings.ts target/bindings-lsp.ts` (61 added lines):
   - `import { invoke as __TAURI_INVOKE, Channel } from "@tauri-apps/api/core";`
   - `setServerAnswer: (current: StoredSettings, answer: "start" | "dontStart" | null) => typedError<SettingsRead, IpcError>(…"set_server_answer", { current, answer })`
   - `setAddedServers: (current: StoredSettings, added: AddedServer[]) => typedError<SettingsRead, IpcError>(…)`
   - `serversContext: () => __TAURI_INVOKE<ServerContext>("servers_context")`
   - `startServer: (command: ServerCommand, events: Channel<HostEvent>) => __TAURI_INVOKE<StartReply>("start_server", { command, events })`
   - `sendToServer: (run: RunId, message: string) => __TAURI_INVOKE<void>(…)`, `stopServer: (run: RunId) => __TAURI_INVOKE<void>(…)`
   - `findProgram: (program: string, project: string) => __TAURI_INVOKE<ProgramFound>(…)`, `projectFiles: (paths: string[]) => __TAURI_INVOKE<ProjectFile[]>(…)`
   - `export type HostEvent = { kind: "Message"; text: string } | { kind: "Log"; line: string } | { kind: "Exited"; code: number | null };`
   - `export type ProgramFound = { kind: "Found"; path: string; place: ProgramPlace } | { kind: "NotFound"; searched: string[] };`
   - `export type ProgramPlace = "Project" | "Path";`
   - `export type ProjectFile = { kind: "Missing" } | { kind: "Folder" } | { kind: "Text"; text: string } | { kind: "TooLarge" } | { kind: "NotText" };`
   - `export type RepositoryAnswer = "start" | "dontStart";`, `export type RunId = number;`
   - `export type ServerCommand = { program: string, args: string[], project: string };`
   - `export type ServerContext = { root: string | null, process_id: number };`
   - `export type StartReply = { kind: "Started"; run: RunId } | { kind: "NotFound"; program: string; searched: string[] } | { kind: "SpawnFailed"; program: string; message: string } | { kind: "OutsideRepository"; project: string };`
   - `export type AddedServer = { command: string[], fileTypes: string[] };`, `LanguageServerSettings = { repositories: { [key in string]: RepositoryAnswer }, added: AddedServer[] }`, `StoredSettings` gains `languageServers: LanguageServerSettings`

   These match the brief's Contract field for field (`process_id`, the `kind` tags, `"Project" | "Path"`). `ServerHost.ts` itself is not in this tree, so I compared against the brief's copy.

## deviations_from_brief
- **Root `Cargo.toml` lines needed:** add `"crates/lsp-host",` to `[workspace] members`, and `yamt-lsp-host = { path = "crates/lsp-host" }` to `[workspace.dependencies]`. After that, `src-tauri/Cargo.toml` can switch to `yamt-lsp-host.workspace = true`.
- `find_program` with a project outside the repository answers `NotFound { searched: [] }`, because `ProgramFound` has no "outside" variant.
- `set_server_answer`: when the root is not UTF-8, the window has no key to look the answer up by, so nothing is stored and the reply is the same as `load_settings`. Every settings command, the two new ones included, recolours the window as the existing ones do.
- Repository-relative paths (projects and `project_files`) accept only plain `/` segments. `..`, `.`, a drive or root segment is refused even when the result would stay inside (`a/../b`, `./x`); a leading `/` is ignored. An existing path must also resolve inside the canonical root, so links out of the repository are refused.
- A file `project_files` cannot read answers `Missing` (`ProjectFile` has no error variant).
- Framing decisions the brief left open:
  - A header line is capped at 8 KiB, so garbage without a newline cannot grow memory (RK27).
  - Too large, a header line too long, a missing or bad `Content-Length`, a non-UTF-8 body, or output ending mid-frame each send one `yamt: …` `Log` line and stop the run.
- Run thread decisions:
  - It also polls the child's exit every 20 ms, so a server that exits while something else still holds its stdout still produces `Exited`.
  - Before sending `Exited`, it waits up to 1 s for the readers, so the last output arrives before `Exited`.
  - "Stop" closes stdin first; the cooperative-stop test relies on this.
- Program lookup decisions:
  - On unix a candidate must be executable.
  - A name with a separator searches only its own folder; on `NotFound`, `searched` is that one folder.
- Settings decisions:
  - `languageServers` is written to the file only when it is not empty, like `keys`.
  - Both `repositories` and `added` are required inside the entry. I added no serde defaults, so the generated TS fields stay required.
- `RunId` numbering starts at 0 and wraps around.
- The server command tests live in `servers.rs`. To reuse the mock-window helpers, I made `commands::tests` `pub(crate)` (`Window`, `app`, `open_window`, `invoke`).
- I did not update `.omp/skills/ipc-contract/SKILL.md` or `docs/architecture.md`: they are outside my Owned files. Both should list the eight new commands and note the second `Mutex`.

## open_risks
- `src-tauri/src/servers.rs` (`forward`): Tauri 2.12.1's `Channel::send` (`ipc/channel.rs:458`) only fails when `webview.eval` fails. After a page reload the send still succeeds, so runs from the old page keep running until `stop_all` at close.
- `crates/lsp-host/src/run.rs` (`read_messages`, `read_log`): a dropped event receiver is noticed only at the server's next output, so a server that stays silent keeps running until stopped or until close.
- `run.rs` (`stop_now`): kill reaches only the direct child. On Windows, a `node_modules/.bin/*.cmd` runs through `cmd.exe`, so killing it may leave `node` running. Closing stdin and the `processId` argument are the only other ways out; process groups and Job objects are a non-goal.
- The Windows-gated tests (`PATHEXT`, `CREATE_NO_WINDOW`) were not run here; they need Windows CI.
- RK21: servers inherit yamt's environment unchanged, including the AppImage variables (brief §4).
- `src-tauri/src/commands.rs` is now 410 lines, over RS6's 400-line file rule. Nothing detects this (clippy counts per function). It is mostly the existing test module.
- Checks for the main agent to run: `just check` (it includes `bindings-check`, which fails until `bindings.ts` is regenerated) and `just mutants` on the changed lines.