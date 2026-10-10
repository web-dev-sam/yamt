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
2. `just bindings` (runs `cargo run -p yamt-app --bin export-bindings`).
3. Update `ipc/domain.ts` (`toDomain`) if a DTO shape changed.
4. Commit Rust + `bindings.ts` + `domain.ts` together.

- [IPC1] `bindings.ts` is never hand-edited. Detector: hook `generated.ts`; `just bindings-check`
  diffs a fresh export against the committed file.
- [IPC2] Nothing outside `ipc/` imports `bindings.ts` or sees a DTO; consumers get domain
  types from `ipc/index.ts`. Detector: oxlint `no-restricted-imports`.
- [IPC3] Rust newtypes (`BaseLine`, `LocalLine`, `RemoteLine`, `ChunkId`) arrive as `number`;
  `ipc/domain.ts` is the only place that applies the TS brands, by type guard (`n is BaseLine`), never `as` (TS4).
- [IPC4] Errors cross as one `#[serde(tag = "kind")] enum IpcError` with structured fields
  (plan §2 #41: `Git`, `UnknownPath`, `Unsupported { path, reason }`, `WriteFailed`); never a
  string. The frontend `switch`es on `kind` exhaustively.
- [IPC5] Commands are thin (≤ 15 lines): lock the `Mutex<MergeSession>`, call one `session`
  method, map the error. No logic in `src-tauri`.
- [IPC6] Strings are UTF-8 text already validated by `session`; binary/non-UTF-8 never
  reaches the webview (`FileEntry.unsupported` carries the reason instead).

## Commands (v0)

```
list_files()                      -> Vec<FileEntry>
load_file(path)                   -> FileMergeData
finish_file(path, text: String)   -> Vec<FileEntry>
reset_file(path)                  -> Vec<FileEntry>
log(entry: LogEntry)              -> ()          fire-and-forget; frontend never awaits it
```

Plan §2 #37/#41. No `quit_if_done`: after the last file the app stays open, and closing the window
exits 0 only when every file is resolved. The #36 take-left/take-right command is named by its
wave-3 brief. Once 2.0 lands, the generated `commands` (`just bindings-check`) are the authority.

## Frontend side

- [IPC7] `ChunkSource` (`ipc/ChunkSource.ts`; load/finish/reset return `SourceResult`, failure =
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
