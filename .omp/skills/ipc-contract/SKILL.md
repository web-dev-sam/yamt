---
name: ipc-contract
description: How the Rust↔frontend contract of yamt is defined, generated, changed and consumed — tauri-specta bindings, domain brands, error enum, logging channel, ChunkSource. Read before touching any type that crosses the IPC.
---

# IPC contract

One source of truth: the Rust types in `merge-core`, `session` and `src-tauri` annotated with
`#[derive(serde::Serialize, specta::Type)]`. `frontend/src/ipc/bindings.ts` is generated
from them and committed.

## Changing the contract

1. Edit the Rust type/command.
2. `just bindings` (runs `cargo run -p yamt-app --features bindings --bin export-bindings`).
3. Update `ipc/domain.ts` (`toDomain`) if a DTO shape changed — `ipc/words.ts` (`toSideWords`) for `SideWordChanges`.
4. Commit Rust + `bindings.ts` + `domain.ts` (and `words.ts`) together.

- [IPC1] `bindings.ts` is never hand-edited. Detector: hook `generated.ts`; `just bindings-check`
  diffs a fresh export against the committed file.
- [IPC2] Nothing outside `ipc/` imports `bindings.ts` or sees a DTO; consumers get domain
  types from `ipc/index.ts`. Detector: oxlint `no-restricted-imports`.
- [IPC3] Rust newtypes (`MiddleLine`, `LocalLine`, `RemoteLine`, `ChunkId`, `DiskVersion`) arrive as `number`;
  `ipc/domain.ts` is the only place that applies the TS brands, by type guard (`n is MiddleLine`), never `as` (TS4).
- [IPC4] Errors cross as one `#[serde(tag = "kind")] enum IpcError` with structured fields
  (plan §2 #41: `Git`, `UnknownPath`, `Unsupported { path, reason }`, `WriteFailed`; #53:
  `NotAFile { path }`, `ReadFailed { path, message }`; #57: `SettingsBroken { path, message }`,
  `NotAbsolute { path }`, `NoConfigFolder`; #74: `MergeAborted`); never a string. The frontend `switch`es on
  `kind` exhaustively. A disk change is a reply (`WriteReply::ChangedOnDisk`, `FileList.disk_changes`), never an error.
- [IPC5] Commands are thin (≤ 15 lines): lock the `Mutex<Merge>` (`src-tauri/src/merge.rs`), call one `session`
  method, map the error — or, for settings, compute `Places` and call one `yamt_settings`
  function. No logic in `src-tauri`.
- [IPC6] Strings are UTF-8 text already validated by `session`; binary/non-UTF-8 never
  reaches the webview (`FileEntry.unsupported` carries the reason instead).

## Commands (v0)

```
list_files()                      -> FileList { files, disk_changes, merging }   settles disk changes, then re-reads `git ls-files -u`: marks are git's view, plan §2 #49/#53; `merging` = MERGE_HEAD and no rebase, re-read each time (#74)
load_file(path)                   -> FileMergeData   `middle: Stages{text} | Disk{text} | DiskNotText{found}`, chunks with their middle range, words and `waiting` (SideLines | Markers{open, between, close} | AsShown: what Save writes while a side waits, #69), `disk_version`; `deleted: Side | null` (#47)
finish_file(path, text, disk_version)   -> WriteReply   Written{files} | ChangedOnDisk{files, change} (old version or unseen disk change: nothing written, #53)
save_file(path, text, disk_version)     -> WriteReply   finish_file without `git add`: the file stays conflicted; the own write updates `seen` only, never a DiskChange, the disk version stays (#65/#69)
reset_file(path, disk_version)    -> WriteReply   back to this run's start: captured stages + the bytes found at open (#66/#69)
describe_file(path)               -> FileSides   what each side holds (Missing/Text/Binary/NonUtf8/TooLarge/Link/Commit), `disk_version`
take_side(path, side: Side, disk_version) -> WriteReply   resolve with one side (deleted side = git rm), plan §2 #36
side_names()                      -> SideNames { local, remote }   each SideName Branch{name} | Commit{short_id, subject, message} or null; HEAD's branch or commit, what is merged in; read once at open, #50/#62
abort_merge()                     -> ()          `git merge --abort`; refused → Git{message}, the merge stays; done → every merge command answers MergeAborted, the window is destroyed (no close question), exit 1 `merge aborted` (#74)
log(entry: LogEntry)              -> ()          fire-and-forget; frontend never awaits it
load_settings(current: StoredSettings)          -> SettingsRead   the file in use, created from `current` when missing, never rewritten by a read, #57
set_theme(current, theme: Theme)                -> SettingsRead   re-reads, replaces `theme`, writes; each settings command recolours the native window
set_antialiasing(current, antialiasing: Antialiasing) -> SettingsRead   re-reads, replaces `antialiasing`, writes; applied by the shell at the next start (Linux), #60
set_keys(current, changes: Vec<KeysChange>)     -> SettingsRead   re-reads, sets (`Some`) or removes (`None`) each action's entry, writes
move_settings(current, path)                   -> SettingsRead   absolute or `~/`; an existing file is used, a missing one created from `current`
set_server_answer(current, answer: RepositoryAnswer | null) -> SettingsRead   keyed by the host's repository root (`servers_context().root`); null forgets it, #67/#70
set_added_servers(current, added: Vec<AddedServer>)         -> SettingsRead   replaces the servers added by hand (`{ command, fileTypes }`)
servers_context()                 -> ServerContext { root: Option<String>, process_id }   language servers (crate yamt-lsp-host, #70): root None when not UTF-8
start_server(command: ServerCommand, events: Channel<HostEvent>) -> StartReply   Started{run} | NotFound{program, searched} | SpawnFailed | OutsideRepository; events Message{text} | Log{line} | Exited{code}, Exited once and last
send_to_server(run: RunId, message) -> ()   queues one JSON-RPC body; framing is Rust's; never blocks
stop_server(run: RunId)           -> ()   signals; killed after 2 s; Exited follows on the channel
find_program(program, project, folders) -> ProgramFound   Found{path, place: Project | Path | Home} | NotFound{searched}: folders.project up to the root, then PATH, then folders.home
project_files(paths: Vec<String>) -> Vec<ProjectFile>   Missing | Folder | Text{text} (≤ 64 KiB) | TooLarge | NotText; repo-relative, outside the repository = Missing
```

Plan §2 #37/#41. No `quit_if_done`: after the last file the app stays open, and closing the window
exits 0 only when every file is resolved. The generated `commands` (`just bindings-check`) are the
authority. `SideContent.bytes` is `u64` exported as `number` (`#[specta(type = u32)]`).

## Frontend side

- [IPC7] `ChunkSource` (`ipc/ChunkSource.ts`; list/load/finish/save/reset/describe/take return `SourceResult`, failure =
  the generated `IpcError`) is the interface the app talks to. Two implementations: `createTauriSource`
  (`ipc/tauri.ts`, maps the generated `commands`; `forwardLog` stringifies non-finite numbers) and
  the fixture source (`ipc/fixture.ts`, valibot over `fixtures/{golden,showcase}/*.json`, the only
  runtime parse, decision 19). `import.meta.env.VITE_CHUNK_SOURCE === "tauri"` (set by the app's
  dev/build commands) is read only in `main.ts` (source) and `ipc/index.ts` (log forward).
- [IPC8] `ipc/log.ts` exports `createLog(forward?: (entry: LogEntry) => Promise<unknown> | void)`;
  the logger's `debug/info/warn/error(event, fields)` print a structured console line always and
  call `forward` if given (`debug` only in DEV). The one app logger is created by its first consumer,
  the `ipc/` interface slice (Tauri: `commands.log`). Never throws or blocks, even on a rejected forward. Detector: `log.test.ts`.
- [IPC9] A new command is a decision-record-free change only if it is a pure addition and its
  DTOs are existing types; otherwise report in `deviations_from_brief`.
