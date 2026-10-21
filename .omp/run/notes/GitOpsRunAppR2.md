# GitOpsRunAppR2 — notes (rust-impl, 3.J row 5 fix round 2)

summary
The close decision now lives in one place: a single `ending_when_git_is_done(state: &MergeState) -> Ending` in `src-tauri/src/outcome.rs`, next to `ending_on_close`. `window.rs` calls it, and so do `mock_window::Window::ending` and the close-wait test. The copy that was in `mock_window.rs` is deleted, so if the real function goes back to `lock`, the test now fails. Behaviour is unchanged.

files_changed
- `src-tauri/src/outcome.rs`: adds `ending_when_git_is_done` and imports `MergeState` and `lock_when_git_is_done`.
- `src-tauri/src/window.rs`: `open_and_wait` returns `Ok(ending_when_git_is_done(&handle.state::<MergeState>()))`; imports updated.
- `src-tauri/src/mock_window.rs`: the copied function is removed; `Window::ending` now calls the one in `outcome`.
- `src-tauri/src/merge/tests.rs`: imports `ending_when_git_is_done` from `crate::outcome` instead of `crate::mock_window`.

tests_added
- None. The existing `merge::tests::a_close_while_git_continues_waits_for_git_and_counts_the_stop_git_moved_on_to` now calls the production function.

smoke_evidence
- **Bug put back by hand** (`ending_on_close(&mut lock(state))` in `outcome.rs`), then `cargo test -p yamt-app a_close_while_git_continues`:
  ```
  test merge::tests::a_close_while_git_continues_waits_for_git_and_counts_the_stop_git_moved_on_to ... FAILED
  panicked at src-tauri/src/merge/tests.rs:211:9:
  the ending did not wait for git
  test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 68 filtered out
  ```
  The build also warned that `lock_when_git_is_done` and `GIT_RUNNING_POLL` were no longer used. That shows the production function was the only caller left.
- **Bug removed again**, then `cargo test -p yamt-app`:
  ```
  test result: ok. 69 passed; 0 failed; ...
  test result: ok. 5 passed; 0 failed; ...
  ```
  (The other two result lines were 0 passed, 0 failed.)
- `cargo clippy --workspace --all-targets -- -D warnings`: `Finished`, with no warnings or errors.

deviations_from_brief
- None. `merge.rs` is unchanged: `lock_when_git_is_done` stays there, and `outcome.rs` imports it.
- A tool hook reformatted the `mock_window` import in `merge/tests.rs` onto one line.

open_risks
- None found.

## Boundary re-check: pass (#1391 AGENTS.md text → row 9).
