# PasteCrashClipboardBoundary

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "file": "src-tauri/src/clipboard.rs",
      "line": 35,
      "rule_id": "RS16",
      "problem": "`requested_text` does not return text. It returns `Option<TextAnswer>`, and `TextAnswer` is an alias for `Receiver<Option<String>>`. A reader of `read_clipboard` sees `requested_text(...)?` followed by `text_from(answer)` and has to open two declarations to learn that the first call only starts a GTK request and hands back a channel. Nothing gets harder as the app grows; the cost is reader load in this one file.",
      "fix": "Rename both cfg variants of `requested_text` to a name for what they return, such as `text_request`. Write `Receiver<Option<String>>` out at its three uses and delete the `TextAnswer` alias."
    }
  ],
  "checked": [
    "Contract: `ClipboardSelection { Clipboard, Primary }` derives `Clone, Copy, Debug, serde::Deserialize, specta::Type` with `rename_all = \"camelCase\"`. It is `pub(crate)`, as compare.rs's items are. `read_clipboard<R: Runtime>(app: AppHandle<R>, selection) -> Option<String>` is async and carries `#[tauri::command] #[specta::specta]` (clipboard.rs:5-24). This matches the brief's fixed contract and plan §2 #99 (`null` = unreadable or no text).",
    "The format list is never requested. The only GTK call is `gtk::Clipboard::get(..).request_text` (clipboard.rs:41). There is no `request_targets`, `wait_for_targets`, `wait_is_*_available`, `wait_for_contents` or `request_contents` anywhere in src-tauri/src (grep for `gtk::`).",
    "Threading: the GTK request starts inside `app.run_on_main_thread` (clipboard.rs:40). The wait is `recv()` inside `tauri::async_runtime::spawn_blocking` (:27), so neither the main thread nor an async worker blocks. A failed join is logged with `tracing::error!` and answers `None`, the same shape as compare.rs:60-68 `on_worker` and merge.rs:157.",
    "Error paths: if `run_on_main_thread` fails, the command logs `warn!` and answers `None` (:45-50). If the closure is dropped without running, the sender is dropped with it, `recv` gets `Err` and `.ok().flatten()` gives `None`. The ignored `send` result covers a receiver that is already gone.",
    "Other systems: the `#[cfg(not(target_os = \"linux\"))]` `requested_text` returns `None` (:62-68). `mod clipboard;` in lib.rs is not cfg-gated, correctly so, since the command exists on every system. `selection_atom` and the test are Linux-only.",
    "Registration: `clipboard::read_clipboard::<tauri::Wry>` is in `specta_builder` (commands.rs:45), the one builder that `with_session`, `with_compare` and `export_bindings` share. It needs no managed state, so both windows can call it.",
    "IPC5: the command body is 2 lines with no logic. IPC9: the new DTO `ClipboardSelection` is recorded by plan §2 #99 and the brief.",
    "PM1 / arch-check: `gtk` was already a Linux-only dependency (src-tauri/Cargo.toml:39-40), and font_rendering.rs already calls `gtk::`. No new crate and no new yamt-* edge.",
    "RS2: the generic `R: Runtime` comes from the fixed contract, and the other generic commands use the same pattern. Accepted.",
    "RS5: no new Mutex, Arc or managed state. The mpsc channel follows the threads-and-channels pattern lsp-host already uses. State-ownership table: nothing new to own.",
    "RS6/RS8/RS9/RS13: the file is 79 lines and every function is under 10 lines. No unwrap/expect. The match on `ClipboardSelection` lists both variants. No numeric literals.",
    "Growth check: clipboard.rs has one job (read a selection's text). commands.rs only gained one registration line. lib.rs only gained the module.",
    "Comments (CP1/CP2): the `///` on `read_clipboard` states an external fact (WebKitGTK 2.54's format-list crash) and cites plan §2 #99. tauri-specta carries it into bindings.ts as JSDoc for the window's implementer. Other commands already carry `///` that shows up in bindings (setServerAnswer, setServerSwitch). Accepted.",
    "src-tauri/AGENTS.md: names `clipboard.rs`, both windows, no managed state, `run_on_main_thread` plus the `spawn_blocking` wait, and the never-ask-the-format-list rule with plan §2 #99. It is placed among the other modules and matches the code.",
    "Deviation accepted: `frontend/src/ipc/bindings.ts` is in the patch although the brief excluded it. It is generated (PM4/IPC1 not violated), and ipc-contract step 4 commits Rust and bindings.ts together. Its lines are the brief's expected `ClipboardSelection = \"clipboard\" | \"primary\"` and `readClipboard(selection) => __TAURI_INVOKE<string | null>`, plus the JSDoc. `just bindings-check` confirms the bytes.",
    "Deviations accepted: `pub(crate)` visibility, the receiver/`text_from` shape, and the `setsid -f` smoke detail (none changes behaviour). Open risk accepted: concurrent hung reads each hold one blocking thread. Row 3 (the window) decides how many it issues, and the brief excludes limits.",
    "Out of scope for this patch per the assignment: docs/architecture.md and the ipc-contract skill naming `read_clipboard` (PM6 map-check), which the orchestrator updates, and `ui/linuxPaste.ts` (row 3).",
    "Test strength and the mutants list in open_risks belong to the correctness lens and were not graded here."
  ]
}
```