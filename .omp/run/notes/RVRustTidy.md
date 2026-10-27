All four items are fixed and tested. All four acceptance commands passed. For item 4 I moved the call back under the guard once: the new test failed and the window test still passed.

**summary**
- The settings file's `agent` entry is now written through serde, as `languageServers` is: null fields are dropped and the entry is written only when something is left. The two field-name constants are deleted.
- An empty command never reaches the disk from any writer. `Loaded::from_settings` clears it, so the no-file paths of `read`, `relocate`, `set_theme` and `change` all store and return no command.
- The tests of `review.rs` now live in `review/tests.rs` (`review.rs` is 149 lines). With your OK, the tests of `ai.rs` moved to `ai/tests.rs` (`ai.rs` is 195 lines).
- New `sweep_own_then_others(state, held, others)`: `manage` passes `|| yamt_agent::sweep_other_pairs(…)`, and a new test checks the AI lock is free when `others` runs.

**files_changed**
- `crates/settings/src/file.rs`
- `crates/settings/tests/agent.rs`
- `src-tauri/src/review.rs`
- `src-tauri/src/review/tests.rs` (new)
- `src-tauri/src/ai.rs`
- `src-tauri/src/ai/tests.rs` (new; granted by you)
- `src-tauri/AGENTS.md`

**tests_added**
- `an_empty_command_list_is_written_as_the_default` has two new cases, each starting with no file and a `current` holding `Some([])`:
  - `set_theme` stores no command and writes no `agent` key.
  - `read` creates the file, returns no command and writes no `agent` key.
- `ai::tests::the_other_pairs_are_swept_with_the_state_released`: inside `others`, `held` has already been sent and `state.try_lock().is_ok()`; a flag proves `others` actually ran.
- The serde writer reuses the existing tests that compare file contents exactly (`set_agent_writes_only_the_fields_given_and_keeps_unknown_entries` and its siblings), and they all pass unchanged.

**smoke_evidence**
- `cargo fmt --check` → no output, exit 0.
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 32.92s`, no warnings.
- `cargo test -p yamt-settings -p yamt-app`:
  - yamt-app lib: `test result: ok. 130 passed; 0 failed; 2 ignored`
  - yamt-app `tests/cli.rs`: `5 passed`
  - yamt-settings: lib `4 passed`, agent `6 passed`, antialiasing `5 passed`, language_servers `10 passed`, relocate `10 passed`, settings `18 passed`, themes `3 passed`
- `just arch-check` → `arch-check: ok`
- Item 4, with `others();` moved inside the guard block by hand (`cargo test -p yamt-app --lib ai::tests`):
  ```
  test ai::tests::the_other_pairs_are_swept_with_the_state_released ... FAILED
  test ai::tests::an_ai_start_sweeps_its_own_pair_under_the_state_and_other_pairs_without_it ... ok
  panicked at src-tauri/src/ai/tests.rs:165:9:
  the state is still held
  test result: FAILED. 7 passed; 1 failed
  ```
  The older window test still passed with the call under the guard, so it alone did not detect the problem. The code is restored and passes.
- Item 2, with the `without_empty_command` line in `from_settings` removed by hand (`cargo test -p yamt-settings --test agent`):
  ```
  test an_empty_command_list_is_written_as_the_default ... FAILED
  panicked at crates/settings/tests/agent.rs:149:5
    left: AgentSettings { command: Some([]), first_message: None }
   right: AgentSettings { command: None, first_message: None }
  ```
  The line is restored and the file passes (`6 passed`).
- Line counts: `ai.rs` 195, `review.rs` 149, `file.rs` 191.

**deviations_from_brief**
- `src-tauri/src/ai/tests.rs` is outside Owned; you granted it. Item 4 would have taken `ai.rs` from 399 to about 416 lines, and moving its tests out follows the `review/tests.rs` shape.
- I removed `sweep_while_held` and put its spawn-and-wait body in `manage`'s `Ai::On` arm, so `manage` passes the closure as the brief words it. The "returns once the thread holds the state" note moved into `manage`'s doc.
- I added a small helper, `written<T: Serialize>(path, value)`, for the serde-to-`WriteFailed` mapping. It has two users (`languageServers` and `agent`), which RS2 asks for.
- `agent_entry` returns `Ok(None)` if serde gives back something other than an object. `AgentSettings` is a struct, so that case cannot occur.
- I added a `read` case to the empty-command test besides the `set_theme` case the brief named. It covers `read_or_create` now returning the stored value.
- `src-tauri/AGENTS.md`: three insertions only (`sweep_own_then_others` and its test, "its tests in `ai/tests.rs`", "its tests in `review/tests.rs`"); a word diff confirms nothing else changed. `crates/settings/AGENTS.md` mentions none of this, so it is unchanged.

**open_risks**
- `src-tauri/src/ai/tests.rs:165`: the new test uses `try_lock` on a std `Mutex` from the thread that already holds it. Std only promises a `WouldBlock` error here, which is what the hand-moved run showed on Linux.
- `src-tauri/AGENTS.md:1`: the file is one 14.9 KB line and was rewritten whole. Only the word diff above checked it.