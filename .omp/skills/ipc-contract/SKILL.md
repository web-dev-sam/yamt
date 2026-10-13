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
3. Update `ipc/domain.ts` (`toDomain`) if a DTO shape changed.
4. Commit Rust + `bindings.ts` + `domain.ts` together.

- [IPC1] `bindings.ts` is never hand-edited. Detector: hook `generated.ts`; `just bindings-check`
  diffs a fresh export against the committed file.
- [IPC2] Nothing outside `ipc/` imports `bindings.ts` or sees a DTO; consumers get domain
  types from `ipc/index.ts`. Detector: oxlint `no-restricted-imports`.
- [IPC3] Rust newtypes (`MiddleLine`, `LocalLine`, `RemoteLine`, `ChunkId`, `DiskVersion`) arrive as `number`;
  `ipc/domain.ts` is the only place that applies the TS brands, by type guard (`n is MiddleLine`), never `as` (TS4).
- [IPC4] Errors cross as one `#[serde(tag = "kind")] enum IpcError` with structured fields
  (plan §2 #41: `Git`, `UnknownPath`, `Unsupported { path, reason }`, `WriteFailed`; #53:
  `NotAFile { path }`, `ReadFailed { path, message }`; #57: `SettingsBroken { path, message }`,
  `NotAbsolute { path }`, `NoConfigFolder`); never a string. The frontend `switch`es on
  `kind` exhaustively. A disk change is a reply (`WriteReply::ChangedOnDisk`, `FileList.disk_changes`), never an error.
- [IPC5] Commands are thin (≤ 15 lines): lock the `Mutex<MergeSession>`, call one `session`
  method, map the error — or, for settings, compute `Places` and call one `yamt_settings`
  function. No logic in `src-tauri`.
- [IPC6] Strings are UTF-8 text already validated by `session`; binary/non-UTF-8 never
  reaches the webview (`FileEntry.unsupported` carries the reason instead).

## Commands (v0)

```
list_files()                      -> FileList { files, disk_changes }   settles disk changes, then re-reads `git ls-files -u`: marks are git's view, plan §2 #49/#53
load_file(path)                   -> FileMergeData   `middle: Stages{text} | Disk{text} | DiskNotText{found}`, chunks with their middle range and words, `disk_version`; `deleted: Side | null` (#47)
finish_file(path, text, disk_version)   -> WriteReply   Written{files} | ChangedOnDisk{files, change} (old version or unseen disk change: nothing written, #53)
reset_file(path, disk_version)    -> WriteReply
describe_file(path)               -> FileSides   what each side holds (Missing/Text/Binary/NonUtf8/TooLarge/Link/Commit), `disk_version`
take_side(path, side: Side, disk_version) -> WriteReply   resolve with one side (deleted side = git rm), plan §2 #36
remote_name()                     -> Option<RemoteName>   Branch{name} | Commit{short_id, subject, message}, read once at open, #50
log(entry: LogEntry)              -> ()          fire-and-forget; frontend never awaits it
load_settings(current: StoredSettings)          -> SettingsRead   the file in use, created from `current` when missing, never rewritten by a read, #57
set_theme(current, theme: Theme)                -> SettingsRead   re-reads, replaces `theme`, writes; each settings command recolours the native window
set_keys(current, changes: Vec<KeysChange>)     -> SettingsRead   re-reads, sets (`Some`) or removes (`None`) each action's entry, writes
move_settings(current, path)                   -> SettingsRead   absolute or `~/`; an existing file is used, a missing one created from `current`
```

Plan §2 #37/#41. No `quit_if_done`: after the last file the app stays open, and closing the window
exits 0 only when every file is resolved. The generated `commands` (`just bindings-check`) are the
authority. `SideContent.bytes` is `u64` exported as `number` (`#[specta(type = u32)]`).

## Frontend side

- [IPC7] `ChunkSource` (`ipc/ChunkSource.ts`; list/load/finish/reset/describe/take return `SourceResult`, failure =
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
