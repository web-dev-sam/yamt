# GitOpsRead — notes (rust-impl, 3.J row 2)

Output fields verbatim.

**summary**
- `Repo::stop()` in `crates/gitio/src/operation.rs` is now the one place that reads what git is doing. It returns `Stop { operation, head }`. The types `Operation`, `Rebase`, `Progress` and `StopId` follow the brief's Contract unchanged. The checks run in the order of git's `wt_status_get_state`, with a squash merge checked last.
- The state files are found through one batched `rev-parse --git-path` call (`Repo::git_paths`). Refs go through `commit_named`.
- `crates/gitio/src/todo.rs` (the extra file you granted) reads git's todo files: it skips comments and blank lines, finds the first command, and finds editor steps still ahead.
- `operation_repo(run, files)` and `Run` (all 12 kinds) are in conflict-repo, along with `STEP_TWO_FILE`. Sequences have 3 steps, with conflicts at steps 1 and 2.
- All tests and clippy pass. The smoke test that printed `stop()` for every `Run` was deleted afterwards.

**files_changed**
- `crates/gitio/src/operation.rs` (new, 394 lines)
- `crates/gitio/src/todo.rs` (new)
- `crates/gitio/src/repo.rs` (`git_paths`; `merge_message` now uses the shared `read_if_present`; unused `io` import removed)
- `crates/gitio/src/lib.rs`
- `crates/gitio/tests/operations.rs` (new)
- `crates/gitio/AGENTS.md`
- `crates/conflict-repo/src/operation.rs` (new)
- `crates/conflict-repo/src/lib.rs` (`mod operation`, `Error::DidNotStop { run }`, `git_with_input` taken out of `hash_object`, `GIT_EDITOR=:` and no `GIT_SEQUENCE_EDITOR` in the sandbox)
- `crates/conflict-repo/AGENTS.md`

**tests_added** (`crates/gitio/tests/operations.rs`; each name or comment says the bug it catches)
- **Operation and ids per run:**
  - `merge_reads_merge_head_and_head`
  - `squash_merge_without_merge_head_reads_the_squashed_tip_not_none`
  - `each_rebase_backend_reads_branch_onto_and_the_replayed_commit` (Rebase, RebaseApply, RebaseInteractive)
  - `rebase_apply_without_applying_is_a_rebase_not_am`
  - `rebase_merges_redoing_a_merge_is_a_rebase_with_redoing_merge_not_a_merge`
  - `single_cherry_pick_reads_the_picked_commit_without_progress`
  - `cherry_pick_range_reads_the_picked_commit_and_the_sequence_progress`
  - `single_revert_reads_the_reverted_commit_without_progress`
  - `revert_range_reads_the_reverted_commit_and_the_sequence_progress`
  - `am_reads_the_patch_subject_and_whole_message`
  - `stash_pop_conflicts_and_a_repository_without_conflicts_record_no_operation`
  - `a_sequence_without_its_head_ref_is_read_from_the_sequencer_todo`
- **Progress:**
  - `rebase_progress_moves_from_step_one_to_step_two_of_three_in_both_backends`
  - `cherry_pick_range_progress_moves_from_one_to_two_of_three`
  - `revert_range_progress_moves_from_one_to_two_of_three`
  - `am_progress_moves_from_patch_one_to_two_of_three`
- **Editor steps ahead:** `editor_steps_ahead_only_for_the_interactive_rebase_with_a_reword_left`
- **Identity:**
  - `two_reads_of_one_stop_give_equal_ids`
  - `continue_to_the_next_stop_gives_a_different_id` (5 runs)
  - `a_refused_continue_keeps_the_id` (3 runs)
  - `edit_todo_dropping_a_later_step_keeps_the_id`
- **Worktree:** `a_linked_worktree_reads_its_own_rebase_and_the_main_checkout_none`
- **Unit tests:**
  - `operation::tests::an_id_leaves_out_progress_and_steps_ahead_but_keeps_the_patch_number`
  - `operation::tests::progress_exists_only_from_one_up_to_the_total`
  - `operation::tests::unreadable_numbers_give_no_progress`
  - `todo::tests::editor_steps_are_reword_squash_and_fixup_with_lower_case_c_in_any_spelling`
  - `todo::tests::a_sequence_command_is_the_first_word_of_the_first_line_that_is_not_a_comment`

**smoke_evidence**
- `git --version` → `git version 2.56.0`
- `cargo test -p yamt-gitio` → every suite passes:
  - lib: 16 passed
  - `abort.rs`: 6 passed
  - `merge_heads.rs`: 12 passed
  - `operations.rs`: `test result: ok. 22 passed; 0 failed` (all 22 names above listed `... ok`)
  - `repo.rs`: 19 passed
  - `what_git_wrote.rs`: 10 passed
- `cargo test -p yamt-conflict-repo` → 1 passed, 1 ignored (the ignored one is the child run of the hostile-environment test).
- `cargo test -p yamt-session -p yamt-cli` → every suite `ok`, so the sandbox change broke nothing there.
- `cargo clippy -p yamt-gitio -p yamt-conflict-repo --all-targets -- -D warnings` → `Finished`, no warnings.
- `cargo fmt --check` → ok.
- Throwaway smoke (deleted), `println!("{run:?}: {stop:?}")`:
```
Merge: Stop { operation: Some(Merge { merging: Oid("36514461…") }), head: Some(Oid("f8fb910b…")) }
SquashMerge: Stop { operation: Some(SquashMerge { merging: Some(Oid("36514461…")) }), head: Some(Oid("f8fb910b…")) }
Rebase: … Rebase { branch=remote, onto: Some(Oid("4e2874d5…")), replaying: Some(Oid("92d117d8…")), redoing_merge: None, progress: Some(Progress { step: 1, total: 3 }), editor_steps_ahead: false } head: Some(Oid("4e2874d5…"))
RebaseApply: … same as Rebase (progress 1/3, editor_steps_ahead: false)
RebaseInteractive: … same, editor_steps_ahead: true
RebaseMerges: … Rebase { branch=merged, onto: Some(Oid("ee1b7330…")), replaying: Some(Oid("eeed58ae…")), redoing_merge: Some(Oid("36514461…")), progress: Some(Progress { step: 6, total: 6 }), editor_steps_ahead: false }
CherryPick: Stop { operation: Some(CherryPick { picking: Some(Oid("92d117d8…")), progress: None }), … }
CherryPickRange: Stop { operation: Some(CherryPick { picking: Some(Oid("92d117d8…")), progress: Some(Progress { step: 1, total: 3 }) }), … }
Revert: Stop { operation: Some(Revert { reverting: Some(Oid("ab4699db…")), progress: None }), … }
RevertRange: Stop { operation: Some(Revert { reverting: Some(Oid("d25551b1…")), progress: Some(Progress { step: 1, total: 3 }) }), … }
Am: Stop { operation: Some(Am { subject="step 1" message="step 1\n\nThe first step's body.\n", progress: Some(Progress { step: 1, total: 3 }) }), … }
StashPop: Stop { operation: None, head: Some(Oid("08fdef26…")) }
```
- A repository with no conflict (earlier smoke run): `no conflict: Stop { operation: None, head: Some(Oid("f803cceb…")) }`.

**deviations_from_brief**
1. **One extra owned file.** `crates/gitio/src/todo.rs` was granted by Main mid-slice so that `operation.rs` stays under the 400-line cap.
2. **`StopId` is a private copy of the `Stop` with the changing parts cleared.** It has no separate kind/commit enum. Progress and `editor_steps_ahead` are cleared; `Am` keeps its progress, which carries the patch number. Branch, onto and the `am` message stay in the id; they don't change while git waits at one stop.
3. **`SquashMerge` needs only `SQUASH_MSG`, not a commit line.** Plan §2 #85 can be read as "`SQUASH_MSG` whose first `commit <oid>` line names a commit", but the fixed contract has `merging: Option<Oid>`. So `SQUASH_MSG` without `MERGE_HEAD` is enough. The oid is checked as hex and then through `commit_named`; if either fails, `merging` is `None`. It is checked last, after git's own order.
4. **The `am` subject is the first line of `rebase-apply/final-commit`**, and the message is the whole file.
5. **`RebaseMerges` is one stop, not three steps.** It reuses `rebase_merges_repo` (the merge step is git's step 6 of 6), and the existing session tests already use that fixture.
6. **What git actually does (all matched the design notes; nothing contradicted them):**
   - **Sequencer:** after a conflict, `sequencer/todo` still starts with the stopped `pick` (observed `pick ef1d746 remote 1` first, of 3 lines). There is no `done` file. A single cherry-pick or revert writes no `sequencer/`.
   - **Merge-backend rebase:** the stopped command has already moved from `git-rebase-todo` to `done`.
   - **`am`:** `rebase-apply/applying` is present, and so are `next`/`last` and `final-commit`.
   - **Apply backend:** writes `REBASE_HEAD` and `next`/`last`, with no `applying`.
   - **`git rebase --edit-todo` does not update `rebase-merge/end`.** Progress stays 1/3 after a step is dropped, so that test checks the todo file itself instead of asserting the `Stop` changed.
   - **`--continue` that reaches the next conflict exits non-zero**, so the test helper expects that exit status.
7. **The fixture sandbox now sets `GIT_EDITOR=:` and removes `GIT_SEQUENCE_EDITOR`.** Without this, `rebase --continue` in a test would open the user's editor. `RebaseInteractive` uses `-c sequence.editor=sed -i -e 3s/^pick/reword/`.
8. **`operation_repo(run, files)` returns `Result<TempDir>`.** A run that does not stop is `Error::DidNotStop { run }`. In every run stage 2 is `local`, stage 3 `remote` and stage 1 `base`; for reverts the history is built so this holds.

**open_risks**
- `crates/gitio/src/operation.rs` `sequence_progress`: the cherry-pick/revert count is commits since `sequencer/head`, plus the todo lines left. A step skipped earlier, or a resolution the user committed by hand (which removes `CHERRY_PICK_HEAD` while the stopped line is still in `todo`), makes the total one too high. This is the design's known risk.
- `crates/gitio/src/todo.rs` `commands`: comment lines are recognised only by `#`. A custom `core.commentChar` is ignored.
- `crates/gitio/src/repo.rs` `git_paths`: the output is split on `\n`, so a git directory path containing a newline would be misread.
- `crates/conflict-repo/src/operation.rs` `RebaseInteractive` needs `sed` in git's shell. On Windows CI that relies on the `sed` shipped with Git for Windows `[INFERENCE]`; this slice ran only on Linux.