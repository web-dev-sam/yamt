# GitOpsRunAppR1 — notes (rust-impl, 3.J row 5 fix round 1)

Output fields verbatim.

All blocks and promoted findings from the brief are fixed. The tests for items 3–6 and 8–10 fail on round 1's code, applied by hand as described below, and pass now. Every check the acceptance names passed, and nothing was committed.

**summary**
- `Merge::has_ended()` (true only for `Finished` and `Aborted`, every state listed). `continue_operation` and `abort_operation` close the window only when it is true.
- `merge.rs` is down to 194 lines; its tests moved to the new `src-tauri/src/merge/tests.rs`, which has six new tests.
- Test helpers now compute the ending the way the real close does, through `lock_when_git_is_done`. The new helper lives in `mock_window.rs` and both test modules use it.
- In fixture mode, after a Continue finishes, `listStop`, `listFiles`, Continue and Abort all answer `MergeFinished`; after an abort they answer `MergeAborted`, as the app does.
- `write()` now lives once in `git-sandbox.sh` and is used by `conflict-repo.sh` and `operations-repo.sh`. The sandbox header names `operations-repo.sh`.

**files_changed**
- `src-tauri/src/merge.rs`, `src-tauri/src/merge/tests.rs` (new), `src-tauri/src/commands.rs`, `src-tauri/src/mock_window.rs`, `src-tauri/AGENTS.md`
- `frontend/src/ipc/fixtureOperations.ts`, `frontend/src/ipc/fixtureOperations.test.ts`, `frontend/src/ipc/fixture.ts` (granted by Main: one hunk)
- `scripts/git-sandbox.sh`, `scripts/conflict-repo.sh`, `scripts/operations-repo.sh`

**tests_added**

| Test | What it proves |
|---|---|
| `a_close_while_git_continues_waits_for_git_and_counts_the_stop_git_moved_on_to` (#1359) | A Continue is held on the `prepare-commit-msg` hook while a second thread computes the ending. The ending does not finish within 300 ms; once git is released it equals the moved-on stop's count, `(Unresolved, "1 of 1 files still unresolved")`. |
| `a_rebase_continued_stops_at_step_two_where_an_old_save_writes_nothing_then_finishes` (#1358, #1362; the old "after a continue stops again" test, extended) | After `Stopped`, `has_ended` is false. Step 2 is then resolved and continued: the reply is `Finished`, `has_ended` is true, and the ending is `(Success, "rebase finished")`. |
| `a_continue_git_refuses_answers_git_s_text_and_keeps_the_stop_open` (#1360) | A rebase continued with nothing resolved answers `Git` with git's text (contains "git add"), and `has_ended` stays false. Then `save_file` answers `Written` and `list_stop` lists step 1 of 3. |
| `a_worker_that_panics_leaves_moved_on_and_answers_a_git_error` (#1361) | Calls `on_worker` with a panicking closure on a held rebase session. The answer is a `Git` error starting "yamt's worker stopped while git ran", and the state is `MovedOn` at the same root. |
| `a_continue_that_moves_on_to_a_stop_without_conflicts_lists_no_files_under_the_rebase` (#1363) | A cherry-pick at the edit stop of `edit_stop_repo` is resolved and continued: the reply is `Stopped` and the merge moves on. `list_stop` then answers `Files` with `files: []` and operation `Rebase`, twice. |
| `a_rebase_aborted…`, `a_merge_continued_is_finished…` (#1358, existing tests extended) | `has_ended` is true after the abort and after the merge's `Finished`. |
| Fixture tests (#1355, #1364) | The rebase 1 → 2 → 3 test, the merge and squash first-Continue test, and the abort test now assert that all four commands answer `MergeFinished` (or `MergeAborted` after the abort). |

**smoke_evidence**
- Round 1's code, applied by hand in `merge.rs` (each change undone afterwards; the file's hash came back to `#0165`, the pre-mutant value):
  - `has_ended` with its answers swapped: 5 tests fail — `a_rebase_aborted…`, `a_continue_that_moves_on…`, `a_merge_continued…`, `a_continue_git_refuses…`, `a_rebase_continued…`.
  - Survivor "delete `!`" in `lock_when_git_is_done`: `a_close_while_git_continues… FAILED … panicked at src-tauri/src/merge/tests.rs:213:9: the ending did not wait for git`.
  - A refusal leaving `MovedOn`, the panic arm leaving `Running(Rebase)`, and `Finished(OperationKind::Merge)`, applied together because they touch separate code paths: `a_worker_that_panics… FAILED` (tests.rs:285), `a_continue_git_refuses… FAILED` (264:49), `a_rebase_continued… FAILED  left: Ending { exit: Success, message: Some("merge finished") } right: … Some("rebase finished")`.
  - `list_stop` no longer opening the new stop: `a_continue_that_moves_on… FAILED … Err value: Object {"kind": String("StopMovedOn")}`.
- Survivor `==` → `!=` (old `commands.rs:172`): that comparison no longer exists, because the decision moved into `has_ended()`. Applying its equivalent, `has_ended` inverted, fails the 5 tests listed above.
- Round 1's `fixtureOperations.ts` and `fixture.ts` copied in from HEAD, then put back: `Tests 4 failed | 17 passed (21)` — the rebase 1 → 2 → 3 test, `""` and `"?operation=squash"` finishing at the first Continue, and the abort test.
- `cargo test -p yamt-app` → `test result: ok. 69 passed; 0 failed`, plus `5 passed` in `tests/cli.rs`.
- `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings` → `Finished`, no warnings.
- `cargo fmt --all --check` → OK.
- `just bindings-check` → `diff -u …` prints nothing, exit 0.
- `pnpm -C frontend typecheck` → exit 0. `pnpm -C frontend test` → `Test Files 121 passed (121)`, `Tests 1655 passed (1655)`. `pnpm -C frontend lint` → exit 0. `fmt:check` → all files formatted.
- `bash scripts/conflict-repo.sh /tmp/r1-conflict` → "is mid-merge; conflicted files:" and 7 paths, exit 0. `bash scripts/operations-repo.sh rebase /tmp/r1-ops` → "stopped in rebase; conflicted files: assets/logo.bin docs/notes.md src/board.ts", exit 0.
- `wc -l`: `merge.rs` 194, `merge/tests.rs` 395, `commands.rs` 398, `outcome.rs` 341 (not changed), `mock_window.rs` 97, `fixtureOperations.ts` 172, `fixtureOperations.test.ts` 181, `fixture.ts` 268, `operations-repo.sh` 172, `conflict-repo.sh` 66, `git-sandbox.sh` 58.

**deviations_from_brief**
1. **#1352:** I used the exhaustive destructure, not `Listing::Files(StopList)`. The newtype variant changed `bindings.ts` (`{ kind: "Files" } & StopList` plus a new `StopList` export), which breaks byte-equal bindings. `list_stop` now matches `Refreshed::Files(StopList { files, disk_changes, operation, sides })` with no `..`, so a new `StopList` field does not compile until it is listed.
2. **#1358:** the tests check `has_ended()` on the state, not that the window was destroyed. Tauri 2.12.4's mock runtime removes a destroyed window only from its own private map (`mock_runtime.rs:91-93`), so `app.get_webview_window` still finds it and a test cannot see the close. The decision now lives entirely in `has_ended`, which those tests kill. The `if` in `close_window_if_ended` stays untested; nothing a mutation tool generates replaces that condition.
3. **#1356:** the fallback in `hand_to_worker` puts the state back and calls `hand_to_worker` again, whose `session()?` then returns `session()`'s own refusal. That leaves one state → error mapping. It always ends, because the state it puts back is never `Held`.
4. **`fixture.ts` (granted by Main):** `listFiles` is now `stops.listFiles`, so `FixtureStops` gains `listFiles` and loses `merging`. To stay under the 40-line function lint, `createFixtureStops` is split into `stopListings` and `stopActions`.
5. **`mock_window.rs`** gains `ending_when_git_is_done` and `Window::ending`, replacing the separate helpers in the `commands.rs` and merge tests. `commands.rs` lost an unused `use super::*` in its tests.
6. **#1357:** the map's sourced-by line for `git-sandbox.sh` is not mine to edit; per the triage the orchestrator adds `operations-repo.sh` there.

**open_risks**
- `src-tauri/src/merge/tests.rs` (the close-wait test) relies on a 300 ms window (`CLOSE_WAIT`) to see that the ending is still waiting. The hook holds git for up to 10 s, so a false pass would need git to finish in under 300 ms on a slow machine; a false failure is not possible.
- `scripts/lsp-repo.sh:60` still defines its own `write()` (content from stdin), which replaces the shared one after sourcing. It works, but two functions share one name.
- `merge/tests.rs` is at 395 lines and `commands.rs` at 398, so the next test added to either must start a new file.
- The #1363 test reaches the empty stop through a cherry-pick at a rebase's edit stop, which relies on git's behaviour there (as `gitio/tests/edit_stop.rs` also does).

Checks for Main to run on the merged tree: `just check`, `just map-check` (after its sourced-by line is updated), and `just mutants` on `merge.rs`, `commands.rs` and `fixtureOperations.ts`.

## Mutants (`just mutants 1dba43c`)

Rust 7 — 3 caught, 3 unviable, 1 missed (`close_window_if_ended` → (), dropped #1384). TS changed lines 38 killed, 2 survived (fixture `NO_OPERATION` literal, dropped).

## Boundary re-check: fail — #1352–#1357 fixed; new block #1385 (a test copy of the close decision).
Correctness re-check: pass, no findings (#1384 drop stands; the final desktop smoke should see the window close after a Finished continue and after an abort).
