---
name: ipc-contract
description: How the Rust↔frontend contract of yamt is defined, generated, changed and consumed — tauri-specta bindings, domain brands, error enum, logging channel, ChunkSource. Read before touching any type that crosses the IPC.
---

# IPC contract

One source of truth: the Rust types in `session` and `src-tauri` annotated with
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
  `ipc/domain.ts` is the only place that applies the TS brands.
- [IPC4] Errors cross as one `#[serde(tag = "kind")] enum IpcError` with structured fields
  (`GitFailed { args, stderr }`, `Unsupported { path, reason }`, …); never a string. The
  frontend `switch`es on `kind` exhaustively.
- [IPC5] Commands are thin (≤ 15 lines): lock the `Mutex<MergeSession>`, call one `session`
  method, map the error. No logic in `src-tauri`.
- [IPC6] Strings are UTF-8 text already validated by `session`; binary/non-UTF-8 never
  reaches the webview (`FileEntry.supported = false` with a reason instead).

## Commands (v0)

```
list_files()                      -> Vec<FileEntry>
load_file(path)                   -> FileMergeData
finish_file(path, text: String)   -> Vec<FileEntry>
reset_file(path)                  -> FileMergeData
quit_if_done()                    -> bool
log(entry: LogEntry)              -> ()          fire-and-forget; frontend never awaits it
```

## Frontend side

- [IPC7] `ChunkSource` (`ipc/ChunkSource.ts`) is the interface the app talks to; two
  implementations: `TauriChunkSource` (wraps `commands`) and `FixtureChunkSource` (reads
  `fixtures/*.json`, parsed with valibot — the only runtime parse, decision 19).
  `main.ts` picks by `import.meta.env.VITE_CHUNK_SOURCE`.
- [IPC8] `ipc/log.ts`: `log.{debug,info,warn,error}(event, fields)` → structured console line
  always; forwarded via `commands.log` when the source is Tauri; `debug` forwarded only in
  `import.meta.env.DEV`. Must never throw or block the caller.
- [IPC9] A new command is a decision-record-free change only if it is a pure addition and its
  DTOs are existing types; otherwise report in `deviations_from_brief`.
