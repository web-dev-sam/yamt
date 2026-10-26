All eight items are fixed and each has a test. Every command the brief names passes, and earlier tests still pass. I had to touch five files outside Owned; Main approved each one (listed under deviations).

**summary**
- **B1:** `servers::forward` is the one event forwarder; `ai::start_agent` now calls it. The test helpers `channel_into` and `is_alive` in `servers::run_tests` are shared with `ai.rs`.
- **B2:** a page reload while something holds the AI lock no longer skips the stop. A thread waits for the lock, then stops the agent. **B3:** `ai::lock` is private.
- **C1:** under the AI lock the start removes only its own pair's leftovers (`Workspace::remove_own_leftovers`). After releasing the lock it runs the new free `yamt_agent::sweep_other_pairs`. The handshake still makes a prepare wait until the own-pair removal is done. `Workspace::sweep_leftovers` is gone.
- **B5:** `start_script` and its two tests moved to the new `src-tauri/src/start_script.rs`; `window.rs` is now 360 lines. **B4:** both AGENTS.md files describe the new lock holders, the deferred stop, the split sweep, the shared `forward` and `start_script.rs`.
- **C2, C3, S1:** new ai.rs tests for the checkout's commit and folder, a changed checkout surviving the exit, and the start sweep.

**files_changed**
- `src-tauri/src/ai.rs`, `src-tauri/src/servers.rs`, `src-tauri/src/window.rs`, `src-tauri/src/start_script.rs` (new), `src-tauri/AGENTS.md`
- `crates/agent/src/{lib,workspace,sweep}.rs`, `crates/agent/tests/sweep.rs`, `crates/agent/AGENTS.md`
- With Main's approval: `src-tauri/src/commands.rs`, `src-tauri/src/range.rs`, `src-tauri/src/lib.rs`, `crates/agent/tests/checkout.rs`

**tests_added**
- **`prepared_checkout` (C2):** this helper is used by every AI test that makes a checkout. It now asserts that the checkout's `a.txt` is `"two\n"` (the right commit; the left side and the base hold "one") and that `checkout.parent()` holds the pair's `lock` file.
- **`ai::tests::the_exit_keeps_a_changed_checkout_and_leaves_the_ai_off` (C3):** after `end_at_exit`, `new.txt` still exists and `checkout_changes` answers `AiOff`. It fails if the exit calls `discard()`.
- **`ai::tests::an_ai_start_sweeps_its_own_pair_under_the_state_and_other_pairs_without_it` (S1 + C1):** an `--ai` window opens with a `checkout.partial` in its own pair and one in `x-0123456789abcdef/a-b`. Once the test takes the AI lock, the own partial is already gone. The other pair's partial then disappears while the test still holds the lock. This kills the `sweep_while_held → ()` survivor, and it fails if the other-pair sweep ever runs under the AI lock.
- **`ai::tests::page_load::a_page_load_stops_the_agent_at_once_or_once_the_state_is_free_and_keeps_the_checkout` (B2):** this replaces the old page-load test.
  - `Finished` does nothing: a message sent afterwards is still echoed.
  - `Started` with the lock free stops the agent at once.
  - A second agent: the test holds the lock, sends `Started`, and the agent stays alive. When the lock is dropped, `Exited` arrives, the pid is gone and the checkout is kept.
- **`yamt-agent` `the_sweep_of_other_pairs_leaves_the_own_pair_alone_even_when_its_lock_is_free`:** pins the `folder == own` skip.
- The existing crate sweep tests now call `sweep_other_pairs` and `remove_own_leftovers`.

**smoke_evidence**
- `cargo fmt --check` → `FMT_OK`
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished `dev` profile …` with no warnings
- `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings` → `Finished `dev` profile …` with no warnings
- `cargo test -p yamt-agent -p yamt-app`:
  - agent checkout: `test result: ok. 17 passed; 0 failed; 1 ignored`
  - agent process: `test result: ok. 9 passed; 0 failed`
  - agent sweep: `test result: ok. 6 passed; 0 failed`
  - app: `test result: ok. 129 passed; 0 failed; 2 ignored`
  - the remaining test binaries: `ok`
- `just arch-check` → `arch-check: ok`
- Line counts: `ai.rs` 399, `window.rs` 360, `start_script.rs` 57.

**deviations_from_brief**
- `src-tauri/src/commands.rs` (approved, page-load hook body only): the hook now calls `ai::stop_agent_on_page_start(webview.app_handle(), page.event())`. The waiting thread needs an owned `AppHandle`, which the borrowed `State` could not give. The function's signature changed from `(&Mutex<AiState>, event)` to `(&AppHandle<R>, event)`, and it does the `try_state` itself.
- `src-tauri/src/range.rs` (approved): `repo()` and `open_range_window_in` are now `pub(crate)`. The S1 test gets its own pair's folder by taking `PairLock::take` with `main...remote` and dropping it. A first mock window would have kept its pair lock after being dropped, so that approach did not work.
- `src-tauri/src/lib.rs` (approved): added `mod start_script;`.
- `crates/agent/tests/checkout.rs` (approved): `sweep_from_another_pair` now calls `sweep_other_pairs`, and `Pair` is no longer imported there.
- B1: `forward` stays in `servers.rs` as `pub(crate)`; I did not add an `events.rs`. `WindowKind::name` became `pub(crate)` so `start_script.rs` can use it.
- To keep `ai.rs` under 400 lines, I merged the two page-load tests into one, added a small `look` helper and inlined `no_events`.
- I fixed the boundary review's nit: the stray blank line in `window.rs`'s `crate::` imports.
- These docs are still yours to update:
  - architecture.md and the project map: the new `start_script.rs`, `sweep_other_pairs` and `remove_own_leftovers`.
  - Plan §2 #108's names (the boundary review's `should`).

**open_risks**
- **Deferred stop can hit the new page's agent** (`src-tauri/src/ai.rs:93-96`). The waiting thread stops whatever agent is running when it gets the lock. If the reloaded page starts an agent and its start gets the lock before the waiting thread does, that new agent is stopped instead. Rust's `Mutex` does not guarantee who goes first. This is unlikely because starting needs a user action, but nothing prevents it.
- **Timing-based assertion** (`src-tauri/src/ai.rs`, S1 test). The other pair's sweep is detected by polling with a 10 s deadline. That is generous, but it is still a timing assertion.
- **Hold-and-release check** (page-load test). "Still alive while the lock is held" is deterministic. The `Exited` after release depends on the waiting thread getting the lock within the 10 s receive timeout.