# PasteCrashDesign (3.F design, board Paste crash row 1)

I recommend Option B: on Linux the page takes every paste and reads the text through GTK, so WebKit never asks GTK for the list of formats. Nothing was launched or edited; all claims come from reading yamt, WebKitGTK `webkitgtk-2.54.1` and GTK `gtk-3-24`. Points I could not confirm from the code are marked [INFERENCE].

## Changes to the brief

1. **Hung owner timeout:** the brief's 1-second GTK timeout is a 1-second tick. GTK gives up after 30 of them (`IDLE_ABORT_TIME 30`, `gtk_selection_retrieval_timeout`), then reports -1. So a hung X owner crashes yamt after about 30 seconds, not 1.
2. **Middle click into an editor reads the clipboard, not the selection.** `Editor::paste(PRIMARY pasteboard)` still builds the DOM paste event's data from `Pasteboard::createForCopyAndPaste` ("CLIPBOARD"). CodeMirror reads that, so a middle click in an editor reads the clipboard (Ctrl+C content) and crashes when the clipboard's owner has quit. Into a text field, WebKit pastes the selection (PRIMARY) [INFERENCE]. This is what open question 1 is about.
3. **Text fields crash too.** The find bar, tab rename, settings path and server fields have no paste handler. WebKit then runs `pasteAsPlainTextWithPasteboard`, which calls `canSmartReplace` → `types()` → `formats`. Smart insert/delete is on by default.
4. **Read-only side panes probably never crash.** CodeMirror's paste handler returns early on `readOnly` without reading the clipboard data [INFERENCE]. The side-pane acceptance item will pass even unfixed; keep it as a regression check.
5. **Ctrl+Shift+V into an editor probably doesn't reach `formats`.** Its event data is read with `readText` into an in-memory pasteboard. Into a text field it still does [INFERENCE].
6. **WebDriver input skips GTK's key and button signals.** `webkitWebViewBaseSynthesizeKeyEvent` and `SynthesizeMouseEvent` call the page directly, though with the same paste commands. A guard on GTK signals can only be tested with xdotool, and so not at all on Wayland.
7. **The repro's `pkill -x xclip` also kills xclip on the owner's desktop.** Use `xclip -loops 0 -quiet & … kill $!`. Any `--raw` check needs a private `XDG_DATA_HOME`, because the tab store's lock refuses a second window.

## 1. Every way yamt reaches `Clipboard::formats`

In the shell process, `formats` is called from `WebPasteboardProxyGtk.cpp`: `getTypes`, `typesSafeForDOMToReadAndWrite`, `allPasteboardItemInfo`, `informationForItemAtIndex` and `getPasteboardItemsCount`. On the page side, `Pasteboard::types` is called by `read(WebContentReader)`, `hasData`, `canSmartReplace` and `fileContentState` (`PasteboardGLib.cpp`, `PasteboardGtk.cpp`). `DataTransfer::getData` reaches `fileContentState` because custom pasteboard data is on for GTK (`UnifiedWebPreferences.yaml`).

| Path | Reaches the crash? |
|---|---|
| Ctrl+V, Shift+Insert, Shift+KP_Insert (`gtktextview.c:1656-1671` via `KeyBindingTranslator`, which also honours `gtk-key-theme-name`), in the Result or a compare column | **Yes**: paste event → CodeMirror `getData` → `fileContentState` → `formats` |
| Same keys in a read-only side pane | Probably not (CodeMirror stops on `readOnly`) [INFERENCE] |
| Same keys in an `<input>` | **Yes**, via `canSmartReplace` |
| Ctrl+Shift+V (`PasteAsPlainText`) | Editors no (`readText` + in-memory data) [INFERENCE]; inputs **yes** |
| Middle button: WebKit 2.54 pastes on **release**, only when the DOM `mouseup` was not prevented (`EventHandler.cpp:1325-1340, 2636-2638`) | **Yes**: editors via the clipboard; inputs via the selection |
| WebKit's right-click menu. yamt never prevents it in the editors: `modClick.ts` acts only on Ctrl+right-click, and wry/tauri add nothing | **Yes**: Paste and Paste As Plain Text run the same commands (`ContextMenuController.cpp:447-452`). Building the menu asks nothing (`:1618-1626`, `WebContextMenuProxyGtk.cpp` has no clipboard calls) |
| `navigator.clipboard` | Only `writeText` (`ServerMenu.vue`), which writes. No |
| "Can paste" or editor-state queries | `enabledPaste` = `canDHTMLPaste() \|\| canEdit()`. No |
| Drag and drop | Uses the drag's own data, not the clipboard. No |

## 2. When the format list cannot be read

The -1 is confirmed: `gtk_selection_data_get_targets` sets `*n_atoms = -1` unless `length >= 0 && format == 32 && type == ATOM` (`gtkselection.c:2119-2148`). `request_targets_received_func` passes it straight on (`gtkclipboard.c:1315-1336`).

- **Dead owner, or never owned (X11):** there is no owner, so the X server answers with no property → -1 → crash.
- **Hung owner (X11):** about 30 seconds of ticks, then `retrieval_report(…, -1)` → the same crash.
- **Wayland, GTK 3:** with no offer, `emit_empty_selection_notify` → -1 → crash (`gdkselection-wayland.c:1495-1523`). When an offer exists, the format list is answered locally from it, so a hung source does not matter for that step. A clipboard manager (Klipper) usually keeps an owner alive.
- **GTK's format cache:** on X11 it answers instantly, but only `wait_for_targets` fills it (`gtkclipboard.c:1895`), and every owner change clears it.

## 3. Options

### A — the shell swallows a paste that would crash (Linux only)
- **Data:** `Selection { Clipboard, Primary }`; `fn lets_through(formats: Option<usize>) -> bool` (no list, or an empty one, blocks); a fixed key table (v+Ctrl, V+Ctrl+Shift, Insert+Shift, KP_Insert+Shift, plus the hardware key of `v` for non-Latin layouts); a `Cell<bool>` saying "swallow this middle press's release".
- **Visions:** 5 (no IPC, one module).
- **Where:** a handler on the webview's `key-press-event`. That signal is RUN_LAST with `_gtk_boolean_handled_accumulator`, so a normal handler runs before `webkitWebViewBaseKeyPressEvent`, and returning Stop skips the input method, key-binding translation and the event to the page. The same on `button-press`/`button-release` for button 2 (wry already does this for back/forward in `synthetic_mouse_events.rs`). The `context-menu` signal (crate `webkit2gtk`) replaces the Paste items with GAction items that check, then call `execute_editing_command`.
- **What the user sees:** with an unreadable clipboard the key or click does nothing. With a live one, WebKit pastes exactly as today, so the 8 MiB notice and undo are unchanged.
- **Cost of the check:** a blocking `wait_for_targets` runs a nested main loop for up to 30 s and dispatches other events re-entrantly. An asynchronous check would have to swallow every paste and replay it, reordering keys typed meanwhile.
- **Race:** after the check WebKit asks again. On X11 the filled cache answers, unless GTK has already handled the owner-change event (milliseconds later). An owner that serves a fixed number of requests (`xclip -l 1`) would go from "pastes nothing" to a crash [INFERENCE]. The context menu stays open for seconds, so its check has a longer window.
- **Not covered:** GTK key themes, unless we copy WebKit's hidden-`GtkTextView` trick, which has popover side effects. Middle clicks are over-blocked (both selections must be readable). Wayland keys cannot be tested.
- **Files:** new `src-tauri/src/paste_guard.rs`; `lib.rs`; `window.rs` (`open_and_wait` keeps the built window and calls `with_webview(|w| paste_guard::install(&w.inner()))`); `Cargo.toml` + `src-tauri/Cargo.toml` (Linux-only `webkit2gtk = "2.0.2"`, the version already in `Cargo.lock`, no new crate); docs.
- **Build:** one `rust-impl`.

### B — on Linux the page takes every paste (recommended)
**Data:**

```rust
#[derive(Clone, Copy, Debug, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum ClipboardSelection { Clipboard, Primary }

#[tauri::command] #[specta::specta]
pub async fn read_clipboard<R: Runtime>(app: AppHandle<R>, selection: ClipboardSelection) -> Option<String>
```

- **Generated TS:** `commands.readClipboard(selection: "clipboard" | "primary"): Promise<string | null>`.
- **Command, Linux:** `run_on_main_thread` → `gtk::Clipboard::get(&gdk::SELECTION_CLIPBOARD | SELECTION_PRIMARY).request_text(…)` → mpsc → `spawn_blocking`, as `on_worker` does. GTK's text request never asks for the format list (`gtkclipboard.c:1021-1060`), and the safe wrapper turns NULL into `None`. `None` means unreadable or no text.
- **Command, other systems:** answers `None`. The window never calls it there.
- **Window:** `takeLinuxPastes(window, read)` installs a capture-phase `paste` listener on `window`. For a trusted event it calls `preventDefault` + `stopImmediatePropagation`. Every WebKit paste fires this DOM event before touching the pasteboard and stops if it is prevented (`Editor.cpp:1660-1666, 1676-1681`). This covers every key, key themes, both menu items, the middle button, inputs and both windows.
- **Delivery:** it reads the text, then, only if the target still has focus, dispatches `new ClipboardEvent("paste", { clipboardData: dt })`. Both constructors exist at the tag (`DataTransfer.idl:33`, `ClipboardEvent.idl:31-38`), and the data is in memory. CodeMirror's own `doPaste` then runs, so the multi-cursor and whole-line paste rules, `input.paste` undo and the 8 MiB `transactionFilter` notice stay as today. If nothing took the event, `document.execCommand("insertText", false, text)` types it into a field with native undo.
- **Which selection:** depends on open question 1. If we read the selection on middle click, a `mousedown`/`mouseup` with button 1 marks the paste in the same task as the selection paste.
- **Visions:** 1 (no `unsafe`, no GTK signal ordering), 2 (one Linux rule: `isLinux` moves beside `isMac`, and `showsAntialiasing` uses it), 3 (a fence forbids `navigator.clipboard.read*` and `clipboardData` reads elsewhere), 4 (the selection is an enum).
- **Race:** none. WebKit never asks GTK for formats during a paste.
- **Differences from today [INFERENCE]:**
  - Keys typed within the read's round trip can land before the pasted text.
  - A clipboard holding only copied files pastes nothing.
  - An image-only clipboard no longer deletes the selected text.
- **Files, `rust-impl`:** new `src-tauri/src/clipboard.rs`; `commands.rs` (register `clipboard::read_clipboard::<tauri::Wry>`); `lib.rs`; regenerated `bindings.ts`; architecture §3.5/§4, the `ipc-contract` skill (`map-check` requires both), project-map, `src-tauri/AGENTS.md`.
- **Files, `web-impl`:** new `ui/linuxPaste.ts` + test; `ipc/tauri.ts` (`readClipboard`); `ipc/index.ts`; `ipc/keys.ts` (`isLinux`) + test; `ui/settings.ts` + test; `main.ts` (both roots, Tauri source on Linux only); `scripts/fences.ts` + test; the AGENTS files, architecture §5.4, project-map, CHANGELOG.
- **Contract between builds:** the command signature above. Rust first, then `just bindings`.

### C — repair GTK's failed answer (rejected)
- **How:** an emission hook on `selection-received` (`G_SIGNAL_TYPE_STATIC_SCOPE`, `gtkwidget.c:2731-2741`) rewrites a failed format-list reply into an empty list with `gtk_selection_data_set(ATOM, 32, NULL, 0)`.
- **Strength:** it covers every path, with no race and no page code.
- **Why rejected:** raw GObject FFI means a second `unsafe` site, against arch-check and plan #43. It depends on GTK internals (the shared stack struct, a NULL buffer on failure) and leaks one byte per failure. That breaks vision 1, and B covers every path that crashes without it.
- **Also rejected:** `LD_PRELOAD` or symbol interposition (vision 1, and every bundle would need it). There is no GTK or WebKit setting that turns paste off. A WebKit version check has no fixed release to name yet, and the guard does no harm on a fixed WebKit.

## 4. Cost and rules
- **Rust dependencies:** `gtk` 0.18.2 is already a Linux dependency (`src-tauri/Cargo.toml`). B adds no crate. A adds `webkit2gtk` 2.0.2 as a direct dependency (already in `Cargo.lock`), which needs a plan row (DR3).
- **`unsafe`:** none in A or B; C needs it.
- **macOS and Windows:** untouched. A is `cfg(target_os = "linux")`; B installs only on Linux with the Tauri source.
- **Caps and boundaries:** commands stay ≤15 lines (IPC5), functions stay under 40 lines, and every new file is named in the project map (PM6).

## 5. Tests and checks
- **Unit tests (no display):**
  - B: `selectionFor(middleRelease, inEditor)` and "an untrusted paste passes".
  - A: `lets_through(None | Some(0))` blocks; the key table.
- **Real-app check:** first on the **unfixed** build to record today's middle-click source.
  1. Private Xvfb through `just app-session`, with `env -u WAYLAND_DISPLAY GDK_BACKEND=x11`. Owner: `xclip -loops 0 -quiet &`, then `kill $!` (never `pkill`).
  2. With `xdotool key`: ctrl+v, shift+Insert, shift+KP_Insert, ctrl+shift+v into the Result, a side pane, a compare column (`--raw` with a private `XDG_DATA_HOME`), the find field, tab rename and the settings path. The process must stay alive and the text unchanged.
  3. Right-click → Paste and Paste As Plain Text.
  4. Middle button with only the selection's owner dead, then only the clipboard's owner dead, into an editor and into a field.
  5. A fresh display (clipboard never owned).
  6. A hung owner (`kill -STOP`): A takes about 30 s, B about 2 min (four text requests), then nothing is pasted.
  7. Live pastes: 3 lines, `seq 300`, more than 8 MiB into a compare column (expect the notice), Ctrl+Z after. Ctrl+C with an empty selection, then Ctrl+V, must insert the whole line.
- **Wayland:** `/usr/bin/kwin_wayland --virtual --socket <private>` is installed, along with `wl-copy`/`wl-paste`. Keys go through WebDriver, which tests B's path but bypasses A's guard. Never `ydotool`: it injects into the owner's real input. Never `xdotool` there. Whether wl-copy works and the selection reaches yamt on a virtual KWin is [INFERENCE]; if not, report "not tested" with that reason.

## Recommendation
**B** serves vision 1 first, then visions 3, 4 and 5. It is the only option without `unsafe` that leaves no crash path: A's check-then-let-WebKit-paste race breaks rule 1's "no paste crashes".

It costs:
- two builds and one new IPC command;
- the small differences listed above (a key typed right after Ctrl+V can land first; a files-only clipboard pastes nothing);
- a page rule that nothing else in yamt reads the clipboard, held by a fence.

**Proposed plan row (DR5):** "On Linux the window takes every paste and reads its text through GTK (`read_clipboard`); WebKitGTK 2.54.0/2.54.1 crash in `Clipboard::formats` on an unreadable clipboard (bug 324466). Rejected: a shell guard (check-then-paste race, key themes, menu surgery); an emission hook (`unsafe` on GTK internals); LD_PRELOAD (vision 1). Visions 1, 3, 5."

## Open questions (for the owner)
1. **Middle click.** From WebKit's code, a middle click today pastes the **clipboard** (what Ctrl+C copied) into editors, and the **selected text** into text fields; the unfixed-build check will confirm this. With B the window chooses:
   - (a) keep this mix;
   - (b) always the selected text, as other Linux programs do; someone who relied on middle-click giving the clipboard in the Result would get their selection instead;
   - (c) always the clipboard.

   I'd pick (b).

## Risks
- B relies on WebKit firing the DOM paste event before any pasteboard read. That is the clipboard spec's order and holds at the tag, but a future WebKit could change it.
- The hung-owner wait in B is up to about 2 min, with no feedback.
- `navigator.platform` must keep reporting "Linux" in WebKitGTK (#60 already relies on this).