# PasteCrashClipboardCorrectness

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "VF7",
      "file": "src-tauri/src/clipboard.rs",
      "line": 26,
      "problem": "`text_from` never calls GTK, yet it has no test. That leaves the three `:27` survivors standing (→ None / Some(\"\") / Some(\"xyzzy\")). It owns two branches the window relies on so that `null` means 'paste nothing' and every call answers: (1) a request dropped on the main thread before GTK runs (the sender is dropped, `recv` fails → None, the contract's 'main thread gone'), and (2) the `.flatten()` of GTK's NULL. The smoke never exercised the dropped-request branch. The brief's Acceptance says 'A pure piece you add (if any) gets its test', and the claim in `open_risks` that these lines need a display is wrong.",
      "fix": "Add a test outside the Linux-only module (`#[cfg(test)]`; `text_from` is built on every system) that runs `tauri::async_runtime::block_on(text_from(answer))` three times and checks: a sent `Some(\"one\\ntwo\\n\")` comes back as that text, a sent `None` gives `None`, and a dropped sender gives `None`."
    },
    {
      "severity": "should",
      "rule_id": "PM6",
      "file": "docs/architecture.md",
      "line": 447,
      "problem": "`scripts/map-check.sh:24-28` needs every `#[tauri::command]` to appear in `docs/architecture.md` and `.omp/skills/ipc-contract/SKILL.md`. `read_clipboard` appears in neither, so `just map-check`, and with it `just check`, fails at `80e0f3b`. The implementer could not fix this because `docs/**` and `.omp/**` were read-only for the slice, and said so in the notes. As it grows: nothing beyond a red gate.",
      "fix": "The orchestrator adds `read_clipboard(selection) -> Option<String>` and `ClipboardSelection` to architecture's command list (next to `show_tab`, line 447) and to the ipc-contract command block (line 70), citing plan §2 #99."
    },
    {
      "severity": "should",
      "file": "docs/slices/briefs/3.F-paste.md",
      "line": 94,
      "problem": "The most common paste has no evidence in either half's smoke: text copied inside yamt (Ctrl+C in an editor), or text selected in yamt and then middle-clicked. In that case yamt's own process owns the selection, and GTK's `gtk_selection_convert` serves the request through its local-owner path, calling our callback synchronously inside the `run_on_main_thread` closure. Every owner in this smoke was an `xclip`, and the window brief's cases 1–5 also use `xclip` only. It works only `[INFERENCE]` from the GTK 3 source; request rule 3 ('pasting keeps working as today') has no observation for it. As it grows: nothing.",
      "fix": "Add a case to row 3's real-app smoke: Ctrl+C three lines in the Result, then Ctrl+V into a compare column or a side pane → that text; select a word in yamt, then middle-click → that word."
    }
  ],
  "checked": [
    "Contract matches the brief: `pub(crate) enum ClipboardSelection { Clipboard, Primary }` with Clone, Copy, Debug, Deserialize, specta::Type and camelCase, and `async fn read_clipboard<R: Runtime>(AppHandle<R>, ClipboardSelection) -> Option<String>` (clipboard.rs:5-24). The committed bindings.ts has `ClipboardSelection = \"clipboard\" | \"primary\"` and `readClipboard(...) => __TAURI_INVOKE<string | null>`.",
    "GTK runs only on the main thread. `gtk::Clipboard::get(...).request_text(...)` is inside the `run_on_main_thread` closure (clipboard.rs:40-44). tauri-runtime-wry 2.12.2 `send_user_message` (lib.rs:263) forwards the task to the event loop when called off the main thread, and an async command always runs off it.",
    "The wait blocks neither the main thread nor an async worker. The main-thread closure only starts the request. `recv` runs on `spawn_blocking`, and the async command just awaits the JoinHandle. Smoke case 5 confirms it: with a stopped owner, a `primary` read and `log` answered in 4 ms while the clipboard read was still waiting.",
    "gtk 0.18.2 `request_text<P: FnOnce(&Clipboard, Option<&str>) + 'static>` (auto/clipboard.rs:142): the callback runs once, the sender moves into it, and only the outer closure has to be Send (Sender and a Copy enum).",
    "Only `request_text` is called: no `request_targets`, `wait_for_targets`, `wait_is_*`, `wait_for_contents` or `request_contents`. The brief's GTK fact (gtkclipboard.c:1021-1060) says the text request falls back through text targets and never asks for TARGETS.",
    "Every None path ends with None and no hang: no owner or no text (GTK NULL → `text.map` → None, smoke cases 2, 3 and 4); the event loop gone at send (`run_on_main_thread` Err → warn → None, clipboard.rs:45-51); the task queued and then dropped without running (Sender dropped → `recv` Err → None); a failed join (error log → None). Some(\"\") also pastes nothing under the window brief's rule 3 (`null` or `\"\"` → nothing), so the window can treat `null` as 'paste nothing'.",
    "Concurrent requests: GTK 3 `gtk_clipboard_request_contents` builds a fresh clipboard widget when the shared one already has a request in flight (`[INFERENCE]` from the GTK 3 source). Smoke case 5's parallel read answered at once.",
    "A hung owner never delays the close: `lock_when_git_is_done` (merge.rs:62) waits only on `Merge::Running`, not on blocking-pool threads. Each waiting call holds one `spawn_blocking` thread until GTK gives up (tokio's default blocking-pool limit is 512, `[INFERENCE]`); accepted as the implementer's `open_risks` row, and it follows the brief's `on_worker` pattern.",
    "Registration: `clipboard::read_clipboard::<tauri::Wry>` is in `specta_builder` (commands.rs:45), which both `with_session`'s and `with_compare`'s `invoke_handler` use (commands.rs:55, 65) and which `export_bindings` exports (lib.rs:61). No managed state, so it works in both windows.",
    "The non-Linux `requested_text` returns None; on Linux, `text_from` and `TextAnswer` stay referenced, so there is no dead-code warning.",
    "Test `each_selection_reads_its_own_gdk_selection`: it compares static `gdk::SELECTION_*` atoms without initialising GTK and fails if the arms are swapped, which users would see as a middle-click pasting the clipboard. It is a real test, not a wiring pin.",
    "Survivor `:22` `read_clipboard` → None / Some(\"\") / Some(\"xyzzy\"): drop (c) wiring. The body is composition only (the `?` passes on `requested_text`'s answer), it reaches GTK on Linux, and tauri's MockRuntime `run_on_main_thread` (mock_runtime.rs:226) would run the GTK call without `gtk::init` → panic, so no display-free test can reach it. The smoke kills all three: case 1 answered \"one\\ntwo\\n\" and cases 2 and 3 answered null.",
    "Survivor `:39` Linux `requested_text` → None: covered by the smoke, as the brief's Acceptance assigns. This is the GTK call itself; a None mutant would have answered null where cases 1 and 4 saw \"one\\ntwo\\n\" and \"sel\".",
    "Survivor `:67` non-Linux `requested_text` → `Some(Default::default())`: drop (a). It is not compiled on the Linux mutants host, and `std::sync::mpsc::Receiver` has no `Default` impl (no match in std's sync/mpsc.rs), so the mutant cannot build on any system.",
    "Survivors `:27` `text_from` ×3: a real gap, see the block finding. The smoke observes these mutants indirectly, but it is not a committed test and never reaches the dropped-request branch.",
    "Risk register: no row has a `src-tauri/src/clipboard.rs` owner; RK22's window close path is untouched.",
    "Ran no tests; the block rests on reading the code plus the survivor list."
  ]
}
```