# Owner request — pasting must never crash yamt (2026-10-22)

For the orchestrator. Intent captured from the owner's message (#1561). No product question: the behaviour wanted is
the obvious one (no crash; a clipboard that cannot be read pastes nothing). What is left open is the cause and the fix
(designer).

## The owner's words

> "fix that crash"

"That crash" is the one reported at the end of the raw-compare feature (board "Raw compare" rows 12 and 12', findings
#1556, #1559): Ctrl+V segfaults yamt when the program that put text on the X clipboard has quit since. It is older than
the feature (same frames at `8db7609`) and hits the merge window and the compare window alike.

## What is known

- Repro (`.omp/run/notes/RawComparePasteCheck.md`): a private Xvfb, `env -u WAYLAND_DISPLAY GDK_BACKEND=x11`,
  `printf 'x\n' | xclip -selection clipboard`, `pkill -x xclip`, then `xdotool key ctrl+v` into any editor → exit 139.
  A live owner (`xclip -loops 0` still running) never crashes (12 pastes on two builds); a window manager does not
  change it. An empty clipboard that nobody ever owned was not tried.
- Backtrace: `SEGV_MAPERR`, `#0 libwebkit2gtk-4.1.so.0 + 0x17cc385`, `#1–#3 libgtk-3.so.0 (+0x3b8b17, +0x3b81b5,
  +0x75096)`, `#5 g_signal_emit_by_name`, `#12 gtk_main_do_event`, `… tao event loop … yamt_app::window::open_and_wait`.
  That is the window process itself (the main thread), not the web content process.
- Host: WebKitGTK 2.54.1, GTK 3.24.52 (Arch). Cores are kept (`coredumpctl list`, e.g. pid 1345448).
- **Cause (orchestrator, 2026-10-22).** `addr2line` on the distribution's debug files (debuginfod, build ids
  `edba0f0f…` for WebKit, `a5e800bb…` for GTK) names the frames: `#0` is the callback inside
  `WebKit::Clipboard::formats(…)` (`Source/WebKit/UIProcess/gtk/ClipboardGtk3.cpp`), `#1` GTK's
  `request_targets_received_func`, `#2` `selection_received` (`gtkclipboard.c:964`), `#3` the signal marshaller. So:
  WebKit asks GTK for the clipboard's list of formats ("targets"); when that request fails (no live owner) GTK hands the
  callback a null list and a count of -1 [INFERENCE: from `gtk_selection_data_get_targets`, which sets `n_atoms = -1`
  on failure — designer to confirm in the GTK 3.24 source]. WebKitGTK 2.54.0 and 2.54.1 build
  `unsafeMakeSpan<GdkAtom>(atoms, atomsCount)` from it (a span of 2^64−1 entries over a null pointer) and read it;
  2.52.0 looped `for (int i = 0; i < atomsCount; ++i)` and survived. Upstream fixed it on WebKit main on 2026-10-16,
  "REGRESSION(308123@main): [GTK] Crash in Clipboard::formats() when pasting with an empty clipboard",
  https://bugs.webkit.org/show_bug.cgi?id=324466 (`std::max(0, atomsCount)`). No WebKitGTK release carrying the fix
  was found [INFERENCE: tags `webkitgtk-2.54.2`/`2.55.x` were not found or lack it]. So every WebKitGTK 2.54 user
  with the GTK 3 port crashes on a paste whose format list cannot be read — an empty clipboard included, per the
  upstream title.

## Rules (product terms)

1. **No paste crashes yamt**, in either window, however it is started: Ctrl+V, Shift+Insert, and every other way the
   window pastes today (the designer lists them: a context menu, the middle mouse button's selection paste).
2. **A clipboard that cannot be read pastes nothing**: the editor stays as it was, nothing else happens (no notice:
   an empty clipboard pastes nothing today either), and the next paste from a live clipboard works.
3. **Pasting keeps working as today** from a live clipboard: text, many lines, the 8 MiB refusal notice in the compare
   window, undo of a paste.
4. Both the X11 and the Wayland session the owner's Linux desktop offers; macOS and Windows are not affected by a
   change made for Linux.

## Acceptance

- The repro above, in the merge window (Result pane and a side pane) and in a compare column: the process keeps running,
  the editor is unchanged; then a paste from a live `xclip` lands.
- The same with a clipboard nobody ever owned (a fresh Xvfb), and with the selection paste (middle button) after its
  owner quit.
- Pastes from a live owner: 3 lines, 300 lines, a payload over 8 MiB in the compare window (its notice), Ctrl+Z after.
- A Wayland session: Ctrl+V after the copying program quit (if the owner's desktop allows the test; otherwise reported
  as not tested, with why).

## Non-goals

- Other clipboard work (copy formats, a clipboard history, pasting images).
- Asking the owner to update his system's WebKit; the fix lives in yamt. A report upstream may accompany it.
