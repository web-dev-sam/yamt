All five fix-round items are in place and every acceptance line was checked: fmt, clippy, the `yamt-app` tests and arch-check pass. Both windows opened and closed with exit 0 in a real run. Nothing is committed.

```
summary
  1. `--help` and `--version` now win over the range usage errors: args.rs keeps any range error until after the argument loop, as `DIFF_WITH_REPO` already was.
  2. One worker helper, `ipc_error::blocking_reply`: a panicked worker is logged and answers `WorkerStopped`. Compare's `on_worker` and range's `load_range_file` both use it.
  3. One opener for the compare and range windows, `window::open_with_data_folder(title, kind, manage)`, with the only `APP_FOLDER` and `app_folder()`. Compare and range each join only their own sub-folder; `context`/`open_and_wait` are private again.
  4. `commands::with_commands` replaces `with_compare` and `with_range`.
  5. A test checks the range lock's folder, `<data>/yamt/range`, using the literal folder names.

files_changed
  src-tauri/src/args.rs
  src-tauri/src/range.rs
  src-tauri/src/window.rs
  src-tauri/src/compare.rs
  src-tauri/src/commands.rs
  src-tauri/src/ipc_error.rs
  src-tauri/src/mock_window.rs

tests_added
  args::tests::help_wins_over_a_range_error — `--diff --diff=a..b --help` gives Help; `--diff=main --version` gives Version.
  range::tests::the_pair_lock_lives_under_the_data_folder_s_yamt_range — `<data>/yamt/range` (literal names) holds exactly one repo folder, which holds exactly one pair folder with a `lock` file.
  ipc_error::tests::a_worker_that_panics_answers_worker_stopped — the panic test moved onto `blocking_reply`.
  ipc_error::tests::a_worker_s_own_answer_is_the_reply — `blocking_reply` passes back the worker's own Ok and Err.
  compare::tests::a_worker_that_panics_under_the_lock_leaves_the_store_answering — renamed from the old panic test; it now checks only that the store still answers after a panic inside its lock. The WorkerStopped check moved to ipc_error.

smoke_evidence
  cargo fmt --check → no output, exit 0
  cargo clippy --workspace --all-targets -- -D warnings → "Finished `dev` profile", no warnings
  cargo test -p yamt-app → "test result: ok. 105 passed; 0 failed" (lib), "ok. 5 passed" (integration)
    including: help_wins_over_a_range_error ok, the_pair_lock_lives_under_the_data_folder_s_yamt_range ok,
    a_worker_that_panics_answers_worker_stopped ok, a_worker_s_own_answer_is_the_reply ok
  just arch-check → "arch-check: ok"
  Folder join removed by hand, two separate runs:
    range_folder body → `app_folder.to_path_buf()`:
      "test range::tests::the_pair_lock_lives_under_the_data_folder_s_yamt_range ... FAILED" (4 passed; 1 failed)
    app_folder body → `data_dir.to_path_buf()`:
      "compare::tests::set_column_stores_the_text_and_load_tab_gives_it_with_the_differences ... FAILED"
      "range::tests::the_pair_lock_lives_under_the_data_folder_s_yamt_range ... FAILED"
    Both bodies restored; the final run above is green.
  cargo tauri build --debug --no-bundle → "Built application at: …/target/debug/yamt"
  Real run on private Xvfb :87 (GDK_BACKEND=x11, WAYLAND_DISPLAY unset, temp HOME/XDG_*):
    yamt --diff → X window "Compare — yamt"
      second `yamt --diff` → "yamt: another yamt --diff window is open (/tmp/rvshellr1/data/yamt/compare)", exit 2
      WM_DELETE_WINDOW → "compare window closed: exit 0"
    scripts/range-repo.sh /tmp/rvshellr1/proj; yamt --diff=main...feature --repo /tmp/rvshellr1/proj
      → X window "main...feature — proj — yamt"
      lock at data/yamt/range/proj-88c5417a4ea3299e/531ea52…-9c1ba3f…/lock
      same pair again → "yamt: another yamt window shows 531ea52..9c1ba3f of /tmp/rvshellr1/proj", exit 2
      WM_DELETE_WINDOW → "range window closed: exit 0"
      the page still logs "state not managed … list_stop" / "… servers_context", the same as in round 1 (the window's main.ts is row 9)
    Built binary: `yamt --diff --diff=a..b --help` → usage, exit 0; `yamt --diff=main --version` → "yamt 0.5.1", exit 0
  Cleanup: the app, Xvfb and /tmp/rvshellr1 (including the throwaway ctypes close/list scripts) are gone.

deviations_from_brief
  - mock_window.rs edited although Owned lists it "only if a range test helper belongs there": the rename to `with_commands` and the new `app_folder` meaning of `manage_store_in`'s path made it necessary. `compare_app` uses `with_commands`; `open_compare_window` passes `app_folder(data.path())`.
  - `open_with_data_folder` builds the app itself (`with_commands` + `context()`), so its signature is (title, kind, manage) without `app`. Otherwise both callers would repeat the build line. `context` and `open_and_wait` are private again.
  - `app_folder(data_dir)` is `pub(crate)` so the compare and range tests go through the same join as the real opener; that is how a changed constant fails the tests.
  - The range folder test reads the lock file on disk rather than `_lock.folder()`. Reading `_lock` trips clippy `used_underscore_binding`, and renaming the field would leave it unread outside tests.
  - Compare's panic test: the WorkerStopped check moved to ipc_error. The compare test stays, renamed, because it pins the compare store's own rule that its lock still answers after a panic.
  - The log line is now "yamt's worker stopped"; it used to be per window ("compare worker" / "range worker").
  - Docs outside Owned still name the old functions, for the docs pass:
    src-tauri/AGENTS.md: "builds the app with `with_range`" → "opens through `window::open_with_data_folder`"; "(`pub(crate)` with `context()` and `window_title`, for `range.rs`)" → "(`window_title` pub(crate) for `range.rs`; `open_with_data_folder`: `<data_dir>/yamt` (`APP_FOLDER`) handed to the window's manage step)"; "`with_compare` and `with_range` set only the invoke handler" → "`with_commands` sets only the invoke handler".
    project-map SKILL.md line 60: "commands `with_compare`" → "commands `with_commands`"; the compare entry's `<data_dir>/yamt/compare/` stays correct.
  - First smoke attempt: WAYLAND_DISPLAY was inherited, so the compare window briefly opened on the owner's Wayland session, not on Xvfb. I killed it within about a minute; its data was in a temp XDG_DATA_HOME, so no owner files were touched. All later runs were X11 only on :87.

open_risks
  - src-tauri/src/range.rs:150 (`only_entry`): the folder test expects exactly one repo folder with one pair folder. If yamt-range ever writes a second entry under `range/`, it needs a rule there, not here.
  - Line counts after this round: commands.rs is 387 lines and window.rs and ipc_error.rs are 384 each, close to RS6's 400-line limit; the next additions there may need a split.
```