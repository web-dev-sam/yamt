# RawCompareShellR1 (3.C-shell rework 1, board Raw compare row 6)

All three findings are fixed, in `compare.rs`, `mock_window.rs` and `window.rs` only. One doc line is now stale: `src-tauri/AGENTS.md` still names `open_store`, and it is outside my Owned files, so the edit it needs is under deviations.

**summary**
- **#1494:** `start_failure` now writes its own sentence only for `ReadFailed`. `Broken` uses the error's own message (`to_string()`), like `Locked` and `NewerFormat`.
- **#1495:** a new function, `compare::manage_store_in<R: Runtime>(app: &App<R>, data_dir: &Path) -> Result<(), String>`, opens the store in `<data_dir>/yamt/compare/` and hands it to the app. The real start-up path (`window::open_compare`, after resolving `data_dir()`) and the test window (`mock_window::open_compare_window`, with its temp dir) both call it. It is used with two runtimes: Wry in the app and the mock in tests. `open_store` and `open_store_in` are gone.
- **#1498:** a new test reaches `on_worker`'s branch for a worker that stopped.

**files_changed**
- `src-tauri/src/compare.rs`
- `src-tauri/src/mock_window.rs`
- `src-tauri/src/window.rs`

**tests_added**
- `compare::tests::a_worker_that_panics_answers_worker_stopped_and_the_store_still_answers`: `on_worker` with work that panics answers `Err(IpcError::WorkerStopped)`. Afterwards `load_tab` for tab 1 still answers `Ok`, so the store's lock recovers after the panic.
- Three existing tests now open the store through `manage_store_in` on a test app (new helper `mock_window::compare_app()`), so they exercise the real path:
  - `a_second_open_of_the_same_data_folder_says_another_window_is_open`: the open compare window now holds the lock.
  - `a_broken_tabs_file_says_where_and_that_nothing_was_changed`: its expected text is unchanged, so `Broken`'s own message reads the same as before.
  - `a_newer_tabs_file_names_its_format`

**smoke_evidence**
- `cargo fmt --check && cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings` → fmt printed nothing; clippy ended `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 31.91s` with no warnings.
- `cargo test -p yamt-app` → `test result: ok. 88 passed; 0 failed`, then `ok. 5 passed`, plus two empty runs (`0 passed`). All 9 `compare::tests::*` passed, including the new panic test. The run also printed four `kill: sending signal to … failed: No such process` lines; every result is ok.
- Mutant check: I changed the arm to `Err(IpcError::GitRunning)` and ran `cargo test -p yamt-app --lib a_worker_that_panics_answers` → `... FAILED`, `Some(GitRunning)`, `test result: FAILED. 0 passed; 1 failed`. After reverting → `test result: ok. 1 passed`.
- `just bindings-check` → `diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts` printed no differences, so the bindings are unchanged.

**deviations_from_brief**
- `src-tauri/AGENTS.md` (not Owned) still says "`open_store` opens `TabStore` in `<data_dir>/yamt/compare/` before any window". Needed edit: replace `` `open_store` opens `TabStore` `` with `` `manage_store_in` opens `TabStore` and manages it as `CompareState` ``.
- I added `mock_window::compare_app()`, which builds the compare test app. Both `open_compare_window` and the three start-failure tests use it.
- In `window::open_compare`, the "no data folder" sentence (moved there from the removed `open_store`) is joined to `manage_store_in` with `.and_then`; one `if let Err` turns either failure into `Ending::failure`.

**open_risks**
- `src-tauri/src/compare.rs:294`: the panic test only checks that `load_tab` answers `Ok`, not its full reply. The full reply is already pinned by `a_fresh_tab_loads_two_empty_texts_without_differences`.