# GitOpsReadR1 — notes (rust-impl, 3.J row 2 fix round 1; ran as GitOpsReadR1-2 after the restart)

All five review fixes (#1313, #1314, #1319, #1320, #1322) and the `Stop::id` doc line are done. `cargo test -p yamt-gitio`, clippy with `-D warnings` and `cargo fmt --all --check` all pass. The public shapes of `Stop`, `StopId`, `Operation`, `Rebase`, `Progress` and `Repo::stop()` are unchanged.

```
summary
  - #1313: `read_if_present` and `exists` now live in `repo.rs` as `pub(crate)` free functions; `operation.rs` imports them, and `rebase_in_progress` uses `exists`.
  - #1314: `git_path(name)` is now the one-element case of `git_paths(&[name])`.
  - #1319: `sequence_progress` checks `sequencer/head` with `commit_named` first. If it is not a commit, progress is `None` (before, `stop()` failed); otherwise it counts from the checked oid.
  - #1320: progress is attached only when the sequencer's first command is the same kind as the operation (pick/p for `CherryPick`, revert for `Revert`). It is `None` when `sequencer/opts` holds `no-commit = true`.
  - #1322: the edit-todo test runs on `Run::RebaseInteractive` and drops the reword. The `Stop::id` doc now says Continue, Abort and the moved-on check compare `id()`.

files_changed
  crates/gitio/src/repo.rs
  crates/gitio/src/operation.rs
  crates/gitio/tests/operations.rs
  crates/gitio/AGENTS.md

tests_added
  - a_sequence_start_that_is_not_a_commit_gives_no_progress (#1319): a stopped pick range with the zero oid written into `sequencer/head` reads `CherryPick { picking: Some(remote~2), progress: None }`, not `Err(GitFailed)`.
  - a_single_revert_inside_a_stopped_pick_range_has_no_progress (#1320): the range is stopped, step 1 is committed by hand, then `git revert local~1` conflicts. The result is `Revert { reverting, progress: None }`; round 1 gave 2/4 from the range's todo.
  - a_no_commit_pick_range_has_no_progress (#1320): `cherry-pick -n main..remote` from a branch where step 1 applies cleanly and step 2 conflicts. The result is `CherryPick { picking: None, progress: None }`; round 1 gave 1/2.
  - edit_todo_dropping_a_later_step_keeps_the_id (#1322, rewritten): runs on `Run::RebaseInteractive` with `sequence.editor=sed -i -e /^reword/d`. It checks that `editor_steps_ahead` goes from true to false, then that the two ids are equal.
  - only_a_no_commit_option_set_to_true_makes_no_commits (unit test in operation.rs): `makes_no_commits` is true for git's written form and false for other options or an empty file.

smoke_evidence
  - #1319 and #1320, red on round 1's sequence code. Only the helper move (#1313) was applied when this ran:
      cargo test -p yamt-gitio --test operations
      test a_sequence_start_that_is_not_a_commit_gives_no_progress ... FAILED
      test a_single_revert_inside_a_stopped_pick_range_has_no_progress ... FAILED
      test a_no_commit_pick_range_has_no_progress ... FAILED
      ...: GitFailed { args: [..., "rev-list", "--count", "0000000000000000000000000000000000000000..HEAD"], status: Some(128), stderr: "fatal: Invalid revision range 0000000000000000000000000000000000000000..HEAD" }
        left: Revert { reverting: Some(Oid("d52390d5…")), progress: Some(Progress { step: 2, total: 4 }) }
       right: Revert { reverting: Some(Oid("d52390d5…")), progress: None }
        left: CherryPick { picking: None, progress: Some(Progress { step: 1, total: 2 }) }
       right: CherryPick { picking: None, progress: None }
      test result: FAILED. 22 passed; 3 failed
  - #1322: round 1's `id()` is correct, so the old test could not tell a broken one apart. I removed the line `rebase.editor_steps_ahead = false;` from `Stop::id` (the defect the old test missed) and ran the new test:
      cargo test -p yamt-gitio --test operations edit_todo
      test edit_todo_dropping_a_later_step_keeps_the_id ... FAILED
        left: StopId(Stop { … editor_steps_ahead: false … })
       right: StopId(Stop { … editor_steps_ahead: true … })
    Then I put the line back; the file returned to the same snapshot tag as before (#CA4F).
  - After the fixes:
      cargo test -p yamt-gitio
      unittests src/lib.rs        test result: ok. 17 passed; 0 failed
      tests/abort.rs              test result: ok. 6 passed; 0 failed
      tests/merge_heads.rs        test result: ok. 12 passed; 0 failed
      tests/operations.rs         test result: ok. 25 passed; 0 failed
      tests/repo.rs               test result: ok. 19 passed; 0 failed
      tests/what_git_wrote.rs     test result: ok. 10 passed; 0 failed
      cargo clippy -p yamt-gitio --all-targets -- -D warnings
          Checking yamt-gitio v0.4.1 (…/crates/gitio)
          Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.16s
      cargo fmt --all --check  → no output, exit 0

deviations_from_brief
  - Item 4 adds a private `enum SequenceStep { Pick, Revert }` and three private functions: `sequence_step` (command word to kind), `makes_no_commits` (the opts check) and `Repo::applied_step` (CHERRY_PICK_HEAD, then REVERT_HEAD, then the todo's next command). Together they keep `sequence_or_squash` under 40 lines.
  - `no-commit = true` is found by reading the lines of `opts` (sequencer.c `save_opts` writes exactly `\tno-commit = true`), not by running `git config --file`. That keeps it to one file read and no extra subprocess.
  - Test helper `git_path(root, name)` added in tests/operations.rs; the `REBASE_TODO` const is gone because nothing uses it any more.
  - `crates/gitio/src/lib.rs` and `todo.rs` did not need changes.

open_risks
  - crates/gitio/src/operation.rs `makes_no_commits`: it relies on git writing the literal `no-commit = true`. A hand-edited `opts` with another bool spelling (`yes`, `1`) would still get progress.
  - crates/gitio/src/operation.rs `sequence_step`: only `pick`/`p` and `revert` are recognised, as in round 1. Git's sequencer writes full words, so a `revert` abbreviation is not handled.
```

## Re-checks

Boundary: fail — #1313/#1314/#1319/#1320/#1322 fixed; new block #1325 (one-path-per-name rule twice) → fix round 2. Correctness: pass, no findings; mutants `just mutants 26e0ed5`: 28 — 23 caught, 5 unviable, 0 missed.


## Fix round 2 (GitOpsReadR2, `ae295f6`)

`git_paths<const N>` holds the one-path-per-name rule (#1325). Mutants `just mutants 5d8f4c9`: 4 — 2 caught, 2 unviable. Boundary re-check: pass, no findings.
