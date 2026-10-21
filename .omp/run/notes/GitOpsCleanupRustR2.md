# GitOpsCleanupRustR2 - notes (rust-impl, 3.J row 11a fix round 2)

Output fields verbatim.

Fixed #1440. When git moves on outside yamt and Abort or Continue then answers `StopMovedOn`, the merge is now left `MovedOn`, so the next `list_stop` opens the stop git is at. Before, the session went back to `Held`, and that list only answered `MovedOn` again. The two new tests failed on the old code and pass now, and all requested checks are green.

**summary**
- `on_worker` in `src-tauri/src/merge.rs` sets `moved_on(&session)` when the worker's error is `yamt_session::Error::StopMovedOn`, and `Merge::Held(session)` for any other refusal, as before. Its doc comment says so.
- Two new tests cover Abort and Continue after a rebase was continued outside yamt.
- `src-tauri/AGENTS.md` now lists this outcome among the hand-back cases (#1440).

**files_changed**
- `src-tauri/src/merge.rs`
- `src-tauri/src/merge/tests.rs`
- `src-tauri/AGENTS.md`

**tests_added**
- `an_abort_after_git_moved_on_outside_answers_stop_moved_on_and_the_next_list_opens_the_new_stop`: after an outside `git rebase --continue`, Abort answers `StopMovedOn`, the window has not ended, and the next `list_stop` lists step 2's files with progress 2/3.
- `a_continue_after_git_moved_on_outside_answers_stop_moved_on_and_the_next_list_opens_the_new_stop`: the same for Continue.
- The outside move now lives in one helper, `continued_outside(root)`, also used by the existing test `a_list_after_a_terminal_rebase_continue_is_moved_on_and_the_next_one_lists_the_new_stop`.

**smoke_evidence**
- **Old behaviour (fix temporarily set back to `Merge::Held(session)`):** `cargo test -p yamt-app after_git_moved_on_outside`
  ```
  test merge::tests::a_continue_after_git_moved_on_outside_... ... FAILED
  test merge::tests::an_abort_after_git_moved_on_outside_... ... FAILED
  panicked at src-tauri/src/merge/tests.rs:142:5:  left: String("MovedOn")
  test result: FAILED. 0 passed; 2 failed
  ```
- **With the fix:** `cargo test -p yamt-app`
  ```
  test merge::tests::a_continue_after_git_moved_on_outside_answers_stop_moved_on_and_the_next_list_opens_the_new_stop ... ok
  test merge::tests::an_abort_after_git_moved_on_outside_answers_stop_moved_on_and_the_next_list_opens_the_new_stop ... ok
  test merge::tests::a_list_after_a_terminal_rebase_continue_is_moved_on_and_the_next_one_lists_the_new_stop ... ok
  test result: ok. 73 passed; 0 failed
  test result: ok. 5 passed; 0 failed
  ```
- **Formatting and lints:** `cargo fmt --all --check && cargo clippy --workspace --all-targets --all-features -- -D warnings` printed nothing from fmt; clippy ended with `Finished \`dev\` profile`.
- **Bindings:** `just bindings-check` ran `diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts`, and the diff was empty, so the files are byte-equal.
- **Line counts:** `wc -l`
  ```
    204 src-tauri/src/merge.rs
    457 src-tauri/src/merge/tests.rs
      1 src-tauri/AGENTS.md
  ```

**deviations_from_brief**
- `docs/slices/briefs/3.J-cleanup-rust-rework-1.md` does not exist in this tree, so I worked from the Change and Acceptance lines in the task.
- While editing `src-tauri/AGENTS.md`, a bad edit deleted its single line. I rewrote the file from `git show HEAD:src-tauri/AGENTS.md` plus the one intended clause. `git diff --word-diff` shows only that addition.
- I moved the existing test's outside-move steps into the shared helper `continued_outside`; that test's behaviour is unchanged.

**open_risks**
- `src-tauri/src/merge/tests.rs` is 457 lines, over the 400-line limit in RS6. It was already 427 before this change.
- `merge.rs:164` uses `matches!` on `yamt_session::Error`. Clippy `-D warnings` accepted it, and the same macro is already used on `Merge` at line 65.

## Mutants (`just mutants de5f41f`, both round-2 commits)

Rust 1 - 1 unviable. TS (continuing.ts, summaryLabel.ts): 130 killed, 2 survived on unchanged lines continuing.ts:65 (`operation.kind === "Rebase"` -> true) and :113 (`operation === null` -> false), both dropped in row 8's review as VF7 (a) (notes GitOpsContinue-mutants.md).


## Correctness re-check (GitOpsCleanupR2Correctness, both commits): pass, no findings

```json
{
  "verdict": "pass",
  "round": "3.J-cleanup fix round 2 re-check (d851002 + ca74e42), correctness lens, RV8 scope",
  "blocks_rechecked": [
    {
      "id": "#1440",
      "status": "fixed",
      "evidence": "src-tauri/src/merge.rs:163-169: when the worker returns `Err(StopMovedOn)`, the state becomes `moved_on(&session)`, using the same constructor as the panic arm (:173) and Continue's `Stopped` (:195). On the next `list_stop` the `MovedOn` arm (:88-95) runs `open_after`, then `refresh_stop`, and answers `Files`. The window's single `nextStop` (stops.ts:51-66) sets the moved-on notice and then calls `loadFiles` once. That list now answers `Files`, so `listing.ts:27` never reaches a second `nextStop`, and `clearStop` does not run again to wipe the notice."
    },
    {
      "id": "#1438",
      "status": "fixed",
      "evidence": "continuing.ts:69-78: every refusal now goes through `reportFailure` (problem.ts:106-116). `StopMovedOn` logs and makes one call to `nextStop({kind:\"outside\"})`. A refusal of kind `Git` calls `report` and then `refreshFiles()`. Continue's own `StopMovedOn` branch is gone."
    }
  ],
  "findings": [],
  "checked": [
    "Every StopMovedOn raiser traced to the window's one list: (1) operation_still_here (session/operation.rs:146-152), used by both abort_operation:120 and continue_operation:128. on_worker now leaves `MovedOn`, so the next list_stop answers Files.",
    "(2) The worker panic (merge.rs:171-175). `after_a_panic` is built before the hand-over and is unchanged; the next list opens the new stop. Pinned by tests.rs:302-318.",
    "(3) `session()` while in `MovedOn` (merge.rs:78). The state stays `MovedOn`, and `hand_to_worker` returns this error before its `mem::replace` (merge.rs:111-114), so the state is not touched. The next list opens the new stop (tests.rs:335-345).",
    "(4) A write below `first_disk_version` (session/writes.rs:139). This can only fire in a session opened by `open_after`, i.e. the stop git is at now. The state stays `Held`, and the next list's `refresh_stop` finds the same stop and answers Files (tests.rs:237-241).",
    "In all four cases the window takes one path: `reportFailure` → `nextStop(outside)` → one `loadFiles` → `Listing::Files`. The notice set at stops.ts:57-59 survives because `clearStop` runs only once.",
    "Rust's two meanings of 'moved on' now match. `refresh_stop`'s `Refreshed::MovedOn` (merge.rs:93) and `operation_still_here`'s `StopMovedOn` both come from `has_moved_on_to`, and both now end in `moved_on(session)`.",
    "Other worker errors still return `Held(session)`: GitRefused, NoOperation, and gitio errors. `a_continue_git_refuses_answers_git_s_text_and_keeps_the_stop_open` (tests.rs:287-299) would fail if every error became `MovedOn`, because its `save_file` would answer StopMovedOn instead of Written. That test kills the over-broad mutant.",
    "Both new Rust tests (tests.rs:347-372) would fail with the fix deleted. On `Held`, list_stop runs refresh_stop, which answers `Listing::MovedOn`, and `assert_step_listed` requires kind Files. The implementer's red run on the old arm matches this ('left: String(\"MovedOn\")').",
    "The new tests catch the off-by-one in progress: they assert step 2 of 3, and the root is preserved implicitly because open_after succeeds on the same repo.",
    "Moving the existing test into the `continued_outside` helper leaves it unchanged: it still writes and adds STEP_TWO_FILE and runs a `rebase --continue` that stops (tests.rs:320-328).",
    "The close ending in `MovedOn` is unchanged and correct: outcome.rs:62 `moved_on_ending(root)` counts the new stop, as before the fix through the `Held` path at outcome.rs:93.",
    "continuing.test.ts:294-305 would fail on b56f16e: no log line (the implementer's red run is shown). It asserts exactly one end `{kind:\"outside\"}`, no problem, no re-list, and Continue `ready` afterwards.",
    "continuing.test.ts:276-290 checks that a `Git` refusal re-lists (`lists` = [\"list\"]). Removing the `cause.kind === \"Git\"` guard would fail the StopMovedOn test and the GitRunning test (:292, `lists` []). Inverting the guard would fail the Git test.",
    "gitRun.ts:21-31: `landing` runs only while `landed`. For failures, `running` is cleared after `nextStop`. Abort uses the same `reportFailure` (aborting.ts:51-57), and aborting.test.ts:146 still covers its StopMovedOn.",
    "Not a block, noted for the orchestrator: docs/architecture.md:361-363 still says only a worker panic leaves `MovedOn`. architecture.md was outside the Rust brief's owned files; src-tauri/AGENTS.md:1 has the new rule (#1440). Below the RV8 block bar.",
    "Not a block, noted for the orchestrator: src-tauri/src/merge/tests.rs is 457 lines, over the brief's ~440 and RS6's 400. The implementer listed it in open_risks; #1437 tracks the split. The two new tests are identical apart from the command name and could become one loop over [\"abort_operation\", \"continue_operation\"]. Below the RV8 block bar.",
    "No mutants survivor list was attached to this re-check, so no VF7 triage was done. No test was run: no block depended on one."
  ]
}
```
