# MacSedFix - release 0.4.2 macOS sed fix (rust-impl)

Commit `90361db`. Output verbatim.

Done: the two rebase tests that fail on macOS now build their sed command in a form BSD sed reads correctly. The checks pass here with GNU sed; macOS itself could not be run.

```
summary
  New yamt_conflict_repo::sed_sequence_editor(scripts: &[&str]) -> String in crates/conflict-repo/src/operation.rs,
  re-exported from lib.rs next to edit_stop_repo. It returns `sequence.editor=sed -i.orig -e '<s1>' -e '<s2>' …`.
  Every Rust sequence editor now goes through it: RebaseInteractive, RebaseSquash, edit_stop_repo,
  edit_stop.rs (reword-drop, chain_sequence_editor) and operations.rs (drop_the_reword).
  scripts/operations-repo.sh uses `sed -i.orig -e`. No product code changed.

files_changed
  crates/conflict-repo/src/operation.rs
  crates/conflict-repo/src/lib.rs
  crates/conflict-repo/AGENTS.md
  crates/gitio/tests/edit_stop.rs
  crates/gitio/tests/operations.rs
  scripts/operations-repo.sh

tests_added
  none. The brief names no new test. The existing rebase tests (edit_stop.rs, operations.rs, the RebaseInteractive/
  RebaseSquash fixtures) catch a broken sed_sequence_editor: a wrong value means the rebase never starts.

smoke_evidence
  rg -n 'sed -i( |")' crates scripts; echo "rg exit $?"
    → (no matches)
    → rg exit 1
  env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-gitio -p yamt-conflict-repo
    → Starting 109 tests across 9 binaries (9 tests skipped)
    → Summary [   1.239s] 109 tests run: 109 passed, 9 skipped
  scripts/operations-repo.sh rebase-interactive /tmp/yamt-sed-ri; echo "exit $?"
    → operations-repo: /tmp/yamt-sed-ri stopped in rebase-interactive; conflicted files:
      assets/logo.bin / docs/notes.md / src/board.ts
    → exit 0
    → .git/rebase-merge holds git-rebase-todo, git-rebase-todo.backup, git-rebase-todo.orig; `rg -c '^reword'` on the todo → 1
  rm -rf /tmp/yamt-sed-ri → afterwards `test -e` says it is gone (exists=1)

deviations_from_brief
  - edit_stop.rs: the constant REWORD_STEP_TWO_DROP_THREE is now a local `let reword_step_two_drop_three` in
    a_conflicted_reword_stop_with_an_empty_todo_has_an_editor_step_ahead, its only user. A `const` cannot call a non-const fn.
  - The same goes for EDIT_STEP_ONE in operation.rs: it is now a local in edit_stop_repo. REWORD_STEP_THREE and
    SQUASH_STEP_TWO are now calls inline at their match arms.
  - Not run: cargo clippy and rustfmt over the whole workspace, as instructed (acceptance commands only).
    Only `rustfmt --edition 2024 --check` was run, on the three changed Rust files, and it was clean.

open_risks
  - crates/conflict-repo/src/operation.rs:103 uses `value.push_str(&format!(…))`. The workspace Cargo.toml does not enable
    clippy::format_push_string, so pedantic should not flag it. Not confirmed by a clippy run.
  - Each fixture rebase now leaves a backup file `git-rebase-todo.orig` in rebase-merge/, and the --edit-todo test does the
    same. git ignores unknown files there. No test reads that directory's listing, as far as the grep showed.

residual_risk
  macOS (BSD sed) itself could not run here. Only GNU sed on Linux was exercised. The proof is the `rust (macos-14)` CI
  job after the owner's push.
```

Checks for Main to run on the merged tree: `just test`, plus `just check` (clippy) and `just mutants`.