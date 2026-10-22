# PasteCrashClipboard (3.F-clipboard, board Paste crash row 2)

The shell's half is in place: `read_clipboard` exists and the brief's real smoke passed all five cases on a private Xvfb. One rule wasn't fully followed: `just bindings` rewrote `frontend/src/ipc/bindings.ts` in my working tree, and I left it there (details under deviations).

**summary**
- New `src-tauri/src/clipboard.rs`: the `ClipboardSelection` enum and the async command, both written exactly as the contract gives them.
- On Linux the command starts GTK's text request on the main thread. The callback sends its answer down a std `mpsc` channel, and the wait for it runs on a `spawn_blocking` thread. If that join fails, it is logged with `tracing::error!` and the answer is `None`.
- The code only calls `request_text`, so GTK is never asked for the format list. On other systems the command answers `None`.
- It is registered in `specta_builder`, so both windows have it, and the module is declared in `lib.rs`. `src-tauri/AGENTS.md` names `clipboard.rs` and its one rule.

**files_changed**
- `src-tauri/src/clipboard.rs` (new)
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/AGENTS.md`

**tests_added**
- `clipboard::tests::each_selection_reads_its_own_gdk_selection` (Linux only): `Clipboard` maps to `gdk::SELECTION_CLIPBOARD` and `Primary` to `gdk::SELECTION_PRIMARY`. This is the one part that runs without GTK.

**smoke_evidence**
- `cargo clippy -p yamt-app --all-targets -- -D warnings`:
  `Checking yamt-app v0.4.2 … Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.04s`
- `cargo test -p yamt-app`:
  `test clipboard::tests::each_selection_reads_its_own_gdk_selection ... ok`
  `test result: ok. 89 passed; 0 failed` and `test result: ok. 5 passed; 0 failed` (the other two suites have 0 tests).
- `just bindings`, the diff in `bindings.ts`:
  `+	readClipboard: (selection: ClipboardSelection) => __TAURI_INVOKE<string | null>("read_clipboard", { selection }),`
  `+export type ClipboardSelection = "clipboard" | "primary";`
  The command's `///` doc lines also land in the file as a JSDoc comment.
- Real smoke:
  - Setup: `cargo tauri build --debug --no-bundle`, then `just app-session start-app --name clip --fresh-repo`, which reported `"display":":2"`. Every call was `just app-session read --name clip 'window.__TAURI_INTERNALS__.invoke("read_clipboard", { selection })'`.
  - Clipboard owners: I started each with `xclip … -loops 0 -quiet &` and ended it with `kill <pid>`, never `pkill`. Before reading, I confirmed each owner's `/proc/<pid>/environ` held `DISPLAY=:2`.
  - **Case 3**, fresh display that nobody ever owned: `{"value":null}` for `"clipboard"` and `{"value":null}` for `"primary"`.
  - **Case 1**, `printf 'one\ntwo\n' | … xclip -selection clipboard -loops 0 -quiet` (pid 1965923): `{"value":"one\ntwo\n"}`.
  - **Case 2**, after `kill 1965923`:
    - the call answered `{"value":null}`;
    - `pgrep` still showed `1965190 …/target/debug/yamt --repo …`;
    - a second call answered `{"value":null}`.
  - **Case 4**, `printf 'sel' | … xclip -selection primary …`: `{"value":"sel"}`. After `kill 1966893`: `{"value":null}`.
  - **Case 5**, hung owner, started with `setsid -f` (pid 1968792), then `kill -STOP`, then `State: T (stopped)`:
    - I started a `"clipboard"` read without waiting for it, recording into `window.__hung`;
    - 3 s later a `"primary"` read and a `log` call returned `{"waitedMs":3204,"primary":null,"log":"ok","hungStillWaiting":true,"answeredMs":4}`, so the main thread was free while the first read waited;
    - after `kill -CONT`, `window.__hung` was `{"ms":9260,"value":"hung\n"}`. I then ran `kill 1968792`; the app was still running.
  - `just app-session stop --name clip` stopped tauri-driver and Xvfb and removed the temp folder. No xclip or Xvfb was left.

**deviations_from_brief**
- **`bindings.ts` left modified.** Running `just bindings` writes `frontend/src/ipc/bindings.ts`, so it now shows as modified in my tree. Undoing that would need a git write command, which SP9 forbids, and the file is read-only for me. Its content is exactly what a fresh export gives; please drop it from the patch or regenerate it.
- **Command doc comment.** I added a `///` line on `read_clipboard` (the external fact: no format list, WebKitGTK 2.54, plan §2 #99). tauri-specta copies it into the generated bindings as a JSDoc comment.
- **Visibility.** The enum and command are `pub(crate)`, as the items in `compare.rs` are.
- **Wait and fallback shape.** On Linux the request is answered through a `Receiver<Option<String>>` (`requested_text`), which `text_from` waits on. If `run_on_main_thread` fails, a warning is logged and the answer is `None`. If the main thread drops the closure without calling it, the sender goes with it and the answer is also `None`.
- **Frontend dependencies.** `pnpm -C frontend install --frozen-lockfile --offline` was needed in this worktree so the debug build could run its before-build command. It changed no tracked file.
- **Smoke method.** In case 5 the owner had to be started with `setsid -f`: a background `xclip` started from the tool's shell was gone as soon as it was stopped (seen twice; I'm assuming it is the orphaned process-group SIGHUP).
- **Not mine.** `.omp/run/slices.json` is modified in the tree; I didn't touch it.

**open_risks**
- **Mutants with no unit test.** `just mutants` will report survivors in `src-tauri/src/clipboard.rs` that no unit test can reach without a display:
  - the body of `read_clipboard` (`:22-23`), for example replaced with `None`;
  - `text_from` (`:27-31`), including its `.flatten()`;
  - the closure and send in `requested_text` (`:39-51`);
  - the non-Linux `requested_text` (`:63-67`), which isn't built here.

  The real smoke above is their evidence: cases 1 and 4 return real text, and cases 2, 3 and 5 cover `None` and the free main thread.
- **Long wait with a hung owner.** GTK may need up to about 30 s for each target it asks for, so a call can wait minutes. Each waiting call holds one `spawn_blocking` thread until GTK answers; nothing in the command limits how many can wait at once.

The checks for the merged tree are `just bindings-check`, `just map-check` (the architecture doc and the `ipc-contract` skill still have to name `read_clipboard`, which is outside what I own) and `just check`.