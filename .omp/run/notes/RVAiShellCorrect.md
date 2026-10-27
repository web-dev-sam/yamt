**Verdict: fail.** I found two `block` findings and two `should` findings.

The two blocks:
- **The sweep slows the close and the first "Ask AI".** The start sweep holds the AI lock while it runs `git status` on every kept checkout of every other pair, across all repositories. Until it ends, the close question's look and the first "Ask AI" both wait.
- **Nothing tests the checkout's commit or folder.** The tests would still pass if the shell checked out the left commit instead of the right one.

I ran nothing; every finding comes from reading the code. The timing in the first block is inferred from how the code works, not measured.

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "growth: lock held over unrelated work (implementer open_risk 'slow sweep', never graded)",
      "file": "src-tauri/src/ai.rs",
      "line": 68,
      "problem": "The sweep thread holds `Mutex<AiState>` for the whole `sweep_leftovers`. That includes `sweep_other_pairs`, which runs `set_aside_when_clean` (`git status --untracked-files=all` plus a HEAD read) on every kept checkout in every pair of every repository under `<data>/yamt/range`, and `remove_dir_all`s clean ones. Kept checkouts come from Keep Changes, the preferred close answer, and they are never removed by yamt. So every later `--ai` start re-looks at all of them. The window's first `prepare_checkout` and the close guard's `checkout_changes` (design §5: called on every `--ai` close) wait on that lock: right after opening, Ask AI and closing the window stall for the sum of those looks. Only the own pair's `checkout.partial`/`.removing` removal has to come before a prepare; other pairs are guarded by their own `PairLock`, not by this window's AI state. [INFERENCE: the duration grows with how many checkouts were kept and how big their repositories are; I measured nothing.]",
      "fix": "Split the crate call: under the lock run only the own pair's leftovers (e.g. `Workspace::remove_own_leftovers(&mut self)`, which is `checkout::remove_leftovers(&self.pair.folder)`). Let the thread release the guard (after the `held.send`), then call a free `yamt_agent::sweep_other_pairs(&range_dir, &pair_folder)` with no AI lock. Keep the handshake so a prepare still comes after the own-pair removal."
    },
    {
      "severity": "block",
      "rule_id": "untested rule others rely on (#110 'checkout --detach <right commit>'; First message 'The current folder is a checkout of {{ NEW_COMMIT }}')",
      "file": "src-tauri/src/ai.rs",
      "line": 53,
      "problem": "The shell's `Pair` is the only place that picks which commit the AI's checkout holds and where it lives. No test notices a wrong choice. With `new_commit: range.compared().left` the checkout and the `Clean` look agree with each other, so `the_exit_removes_a_clean_checkout_and_leaves_the_ai_off` and `discard_removes_a_changed_checkout` still pass while the agent edits the old side (the merge base for `main...remote`). The same holds for `folder: range_dir` instead of the pair folder, which would also put the checkout outside the pair lock. cargo-mutants never swaps field accesses, so no survivor shows this.",
      "fix": "In `prepared_checkout` (ai.rs:250) or the exit test, assert `std::fs::read_to_string(checkout.join(\"a.txt\")) == \"two\\n\"` (remote's text; the base and main hold \"one\"). Also assert that `checkout.parent()` holds the pair's `lock` file."
    },
    {
      "severity": "should",
      "rule_id": "#111 / test strength",
      "file": "src-tauri/src/ai.rs",
      "line": 257,
      "problem": "The acceptance says the exit removes a clean checkout and never a changed one. The shell's only test covers a clean checkout, so it would pass if `end_at_exit` called `discard()` instead of `end()` and silently deleted kept AI work at every exit. The rule itself is proven only in the crate (`end_removes_a_clean_checkout_and_keeps_a_changed_one`), so the danger is a refactor of this delegating call. As the app grows, nothing gets harder beyond that.",
      "fix": "Add a case: prepare, write `new.txt` in the checkout, call `end_at_exit(&ai_state(&window))`, then assert `checkout.join(\"new.txt\").exists()` and that the state answers `AiOff`."
    },
    {
      "severity": "should",
      "rule_id": "VF (acceptance evidence: 'a page reload stops the agent')",
      "file": "src-tauri/src/commands.rs",
      "line": 91,
      "problem": "`a_page_load_stops_the_agent_and_keeps_the_checkout` calls `stop_agent_on_page_start` directly. Removing the `on_page_load` hook from `with_commands`, or limiting it to the compare-only path, passes every test. No real-app run reloaded a page with an agent running (the smoke checked only `data-ai`). `with_session`'s server hook has the same gap, so a second window kind built on this pattern inherits unproven wiring.",
      "fix": "Add to the real-app smoke of the slice that first starts an agent from the window (C5b/C7): Ask AI, reload the page, then check the agent's pid is gone and `<pair>/checkout` stays. Record it as the proof of this acceptance line."
    }
  ],
  "survivors": [
    {
      "mutant": "src-tauri/src/ai.rs:66:5 replace sweep_while_held with () (RVAiShell, 3d746d5)",
      "verdict": "real gap, already reported (RVAgentCrateR1Check finding 2); not repeated",
      "reason": "Only caller of `sweep_leftovers`. No ai.rs test sees a leftover removed. The fix for finding 1 changes this function, so the sweep test asked for there should also assert the other-pair sweep runs without the AI lock held."
    },
    {
      "mutant": "src-tauri/src/ai.rs:65:5 replace sweep_while_held with () (RVAgentCrateR1, 8acdd72)",
      "verdict": "same survivor as above, at the shifted line; already reported",
      "reason": "Same mutant, survived on both runs."
    }
  ],
  "checked": [
    "OR11: I read the brief, the implementer notes, both survivor files, RVAiShellBoundary.md, RVAgentCrateR1Check.md, AgentDesign §1/§4/§5/§9/R-AI1/R-AI3, and plan rows #108, #111 and #114 in full. I then read ai.rs (whole), window.rs:56-192, range.rs:1-200, commands.rs:69-96, args.rs's `--ai` lines, ipc_error.rs's agent arms, and crates/agent workspace.rs, sweep.rs and checkout.rs's outline, plus crates/pipe `Running::stop`/`wait`.",
    "AI state only for `--ai` range windows: `ai::manage` is called only from `manage_range_in` (range.rs:57), after the lock, the list and the threads, which are the only fallible steps. So a refused start never sweeps. `Workspace::new` is built only in the `Ai::On` arm (ai.rs:50). The compare window's hook uses `try_state` and does nothing; merge uses `with_session` and its own hook. The start script's `(Range, On)` is the only arm that writes `dataset.ai` (window.rs:183-187), pinned by an exact-string test.",
    "Every command answers `AiOff` without the flag: `every_agent_command_answers_ai_off_without_the_flag` covers all six state commands through `workspace()` (the five invokable ones by name, `start_agent` directly because a Channel cannot be built from JSON). An unmanaged state would give `WorkerStopped` or tauri's string, not `AiOff`, so the test would catch a missing manage. `diff_texts` needs no state by design (#114).",
    "Page reload: `stop_agent_on_page_start` uses `try_lock` (it never waits on the main thread). `WouldBlock` skips; a poisoned lock is recovered. `Running::stop` returns at once (pipe run.rs:111). The checkout is kept because `stop_agent` does not touch `checkout`. The test pins held-skip, Finished no-op, then Started → `Exited`, pid gone, folder kept. A mutant making the skip block would hang, which counts as caught. The 'start in flight is skipped' gap is the boundary review's `should` 2 and is not repeated. Under this lens the effect is an idle `omp acp` with no prompt, reaped by the next start or the exit, so I did not escalate it.",
    "Exit vs close question (#111): `at_exit` runs after `run_return` returns (window.rs:114-115), so after any page-side close question. `RangeState._lock` (the PairLock) lives in the still-alive handle while `Workspace::end` runs, so no other window or sweep touches the pair. `end_at_exit` releases the AI guard before `end` (a temporary in `mem::replace`) and leaves the state `Off`, so a queued worker afterwards answers `AiOff` and starts nothing (pinned by the exit test's final `AiOff`). Exit is `Exit::Success` either way. A `?` error from `open_and_wait` skips `at_exit`; no checkout can exist then.",
    "Lock holds, main thread vs workers: the main thread takes `Mutex<AiState>` in `manage` (no: the handshake waits only for an uncontended first lock), in `on_page_load` (`try_lock` only), in sync `send_to_agent`/`stop_agent` (these can wait for a start's reap of ≤ ~3 s or a discard's removal; already in the boundary review's AGENTS.md `should`), and in `end_at_exit` after the window is gone. `prepare_checkout`, `start_agent`, `checkout_changes`, `discard_checkout` and `diff_texts` run on `spawn_blocking` through `blocking_reply`. `checkout_changes` releases the lock before `look()`. No AI path takes a second Mutex (R-AI8). Finding 1 is the one hold that reaches past its need.",
    "Error mapping: `From<yamt_agent::Error>` maps Remove and Rename to `RemoveFailed { folder, message }` (for Rename, the `from` folder) and Git to `Git`, pinned in ipc_error/tests.rs:269-290. `AiOff` serialises as `{kind:\"AiOff\"}`. A worker panic becomes `WorkerStopped`, and a poisoned AI lock is recovered by `lock`. `prepare`'s failure is `CheckoutReply::Failed`, not an IpcError, per §9.",
    "`start_agent`: on `AiOff`, `?` returns before the forward thread is spawned. On `NoCheckout`/`NotFound`/`SpawnFailed` the Sender is dropped inside `start`, so `forward` ends at once. Run ids keep counting across reloads, so a stale page's `send`/`stop` for an earlier run is dropped by `Workspace::running`.",
    "`diff_texts_refuses_a_side_over_the_limit`: either side at MAX+1 gives `ColumnTooLarge { limit: MAX_COLUMN_BYTES }`, and a small pair gives one difference. The exact-limit boundary belongs to yamt-compare's own test, not to this shell's.",
    "args: `--ai` is kept only in the Range arm (args.rs:105-108) and dropped for merge, compare, help and version, all asserted. The parse is order-independent by construction (a flag set in the loop). lib.rs:60-63 passes `ai` through to `run_range`.",
    "Implementer open risks: the untested `Error::Git` arm is accepted (PM1). `sweep_while_held`'s wait is the already-found gap. The slow sweep is graded as finding 1. `start_agent` on the main thread was resolved by 8acdd72. The frontend typecheck failure belongs to another slice.",
    "I ran nothing: no cargo, no tests. Finding 1's duration is marked [INFERENCE]; its mechanism comes from reading sweep.rs:11-27, checkout.rs `set_aside_when_clean` and range lock.rs:73-76 (`pair_folders` walks every repository's pairs)."
  ]
}
```