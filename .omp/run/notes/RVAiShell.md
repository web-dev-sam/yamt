I've added `--ai` to the shell and the seven agent commands. A range window started with `--ai` opens with `<html data-ai="on">`; without the flag every agent command answers `AiOff`. `cargo fmt --check`, workspace clippy (with and without `yamt-app/bindings`), `cargo test -p yamt-app` and `just arch-check` all pass, and the real-app check passed for all four cases.

```
summary
  - `--ai` is accepted with every mode and never stored. Only `Invocation::Range { spec, repo, ai: Ai }` keeps it; merge, compare, help and version drop it.
  - The start script adds `document.documentElement.dataset.ai = "on";` only for a range window with `Ai::On`.
  - New `src-tauri/src/ai.rs`: every range window manages `Mutex<AiState>`. `AiState::workspace()` is the one place that answers `AiOff`. `manage` builds the `Workspace` only in the `Ai::On` arm and sweeps leftovers on a background thread. A page reload stops the agent (using `try_lock`, so a prepare in progress is skipped). After the window closes, `end_at_exit` calls `Workspace::end`.
  - The seven commands are registered: `prepare_checkout`, `start_agent`, `send_to_agent`, `stop_agent`, `checkout_changes`, `discard_checkout`, `diff_texts`. `IpcError` gains `AiOff` and `RemoveFailed { folder, message }`. `yamt-compare` now re-exports `Difference`.

files_changed
  src-tauri/src/ai.rs (new), src-tauri/src/args.rs, src-tauri/src/window.rs, src-tauri/src/lib.rs, src-tauri/src/range.rs,
  src-tauri/src/commands.rs, src-tauri/src/ipc_error.rs, src-tauri/AGENTS.md, crates/compare/src/lib.rs (scope widened by Main)

tests_added
  - args::ai_is_accepted_with_every_mode_and_reaches_only_the_range_window: the flag with merge, compare, help and version is dropped; a range keeps On; without the flag it is Off; the usage text names --ai.
  - window::the_start_script_marks_ai_only_when_on: the exact script for Range+On; no `dataset.ai` for Merge or Compare with On, or for Range with Off.
  - ai::every_agent_command_answers_ai_off_without_the_flag: prepare, checkout_changes and discard (invoked by name), stop and send (invoked by name), and start_agent (called directly) all answer AiOff.
  - ai::page_load::a_page_load_stops_the_agent_and_keeps_the_checkout (unix): `sh … exec cat` runs in a real checkout. While the state is held, Started is skipped (the agent still echoes). Finished does nothing. Started stops it: Exited, the pid is gone, the checkout folder stays.
  - ai::the_exit_removes_a_clean_checkout_and_leaves_the_ai_off: after prepare the checkout is Clean; end_at_exit removes it; the state is Off afterwards.
  - ai::discard_removes_a_changed_checkout: an untracked file shows as Changed; discard removes the folder.
  - ai::diff_texts_refuses_a_side_over_the_limit: either side over MAX_COLUMN_BYTES gives ColumnTooLarge { limit }; a small pair gives one difference.
  - ipc_error::ai_off_and_a_failed_removal_serialise_with_their_kinds: AiOff, and Remove/Rename → RemoveFailed { folder, message }.

smoke_evidence
  - `cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings` → "Finished `dev` profile …", no warnings. The same with `--features yamt-app/bindings` → Finished.
  - `cargo test -p yamt-app` → "test result: ok. 124 passed; 0 failed" (lib), plus 5 passed (bins).
  - `cargo test -p yamt-app --lib -- ai` → all 8 new tests ok, including "ai::tests::page_load::a_page_load_stops_the_agent_and_keeps_the_checkout ... ok".
  - `just arch-check` → "arch-check: ok".
  - Bindings export to target/bindings-check.ts, diffed against the committed file: adds prepareCheckout, startAgent(command, events: Channel<HostEvent>), sendToAgent, stopAgent, checkoutChanges, discardCheckout, diffTexts → Difference[], the types AgentCommand/AgentRun/AgentStartReply/CheckoutLook/CheckoutReply, and the two IpcError kinds. This matches AgentDesign §9. bindings.ts itself was not written.
  - Real app (debug build, `app-session` on Xvfb, repo from scripts/range-repo.sh):
      `yamt --ai --diff=main...feature --repo <dir>` → {"ai":"on","window":"range","aiAttr":"on"}; no `omp acp` process; only `lock` in the pair folder (no checkout).
      `--diff=main...feature` without --ai → {"ai":null,"window":"range"}
      `yamt --ai --diff` → {"ai":null,"window":"compare"}
      `yamt --ai --repo <fresh conflict repo>` → {"ai":null,"window":"merge"}

deviations_from_brief
  - crates/compare/src/lib.rs: Main widened Owned for this. Added `pub use yamt_merge_core::Difference;`. The private `use` on the line above had to drop `Difference` (`use yamt_merge_core::compare;`), or the name would be defined twice. Without this, src-tauri cannot name `Difference` (PM1).
  - `open_with_data_folder` now takes `(title, kind, ai, manage, at_exit)`; the compare window passes `Ai::Off` and `|_| {}`. `open_and_wait` takes `ai`.
  - The page-load hook for the agent is in `with_commands` (the builder for compare and range). It uses `try_state`, so the compare window, which manages no `AiState`, does nothing. `with_session` keeps the merge window's hook.
  - The sweep thread holds `Mutex<AiState>` while it sweeps, and `manage` waits (one mpsc handshake) until the thread holds it. Without that, the sweep's removal of the pair's own `checkout.partial` could race the first prepare.
  - `start_agent` has its own 6-line `forward`, a copy of the private `servers::forward`: servers.rs is not in Owned.
  - The real-app runs passed `--ai` through a throwaway wrapper given as `--binary` (`exec target/debug/yamt --ai "$@"`, since removed), because app-session's start-app cannot pass extra arguments. For `cargo tauri build` I ran `vite build --mode tauri` and passed an empty `beforeBuildCommand`: the frontend `vue-tsc` fails on this tree because `frontend/src/ui/store.test.ts` misses the new `agent` settings field (from C2, not my files).
  - The usage text gains one line: `  --ai              with --diff=<range>: an AI agent answers review comments in its own checkout`. The synopsis lines are unchanged.

open_risks
  - src-tauri/src/ipc_error.rs: the `yamt_agent::Error::Git` → `Git` arm is untested, because a `yamt_gitio::Error` cannot be built without a gitio dependency.
  - src-tauri/src/ai.rs `sweep_while_held`: no test shows that a prepare waits for the sweep, so a mutant removing `wait.recv()` would survive. Also, a slow sweep (many pairs, big repos) delays the first Ask AI and a close's `checkout_changes` until it ends.
  - src-tauri/src/ai.rs `start_agent`: a sync command, so it runs on the main thread while stopping and reaping an earlier agent (up to the 2 s kill). `start_server` does the same.
  - The frontend typecheck failure in `ui/store.test.ts` (missing `agent`) will fail `just check` until C2's web side or C5b fixes it.

Checks for Main: `just bindings` (regenerates `ipc/bindings.ts`), then `just check`.
```