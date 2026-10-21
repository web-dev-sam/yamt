# Release 0.4.2 fix — the rebase tests' sequence editor fails on macOS

Board "Release 0.4.2" row 4. Owner report #1458: CI is red on `v0.4.2` (`fb0d4ea`) and on `main`, job `rust (macos-14)`
only (Linux and Windows green, 580 of 582 tests pass on macOS). Two tests fail:

- `yamt-gitio::edit_stop a_conflicted_reword_stop_with_an_empty_todo_has_an_editor_step_ahead` — panics at
  `crates/gitio/tests/edit_stop.rs:63` "step 2 did not conflict".
- `yamt-gitio::edit_stop a_conflicted_fixup_has_an_editor_step_ahead_only_in_a_chain_with_a_squash` — panics at
  `edit_stop.rs:183:76`, `NotFound` reading `rebase-merge/done`.

Cause (diagnosed, given): both pass `git -c "sequence.editor=sed -i -e A -e B"`. macOS sed is BSD sed: `-i` takes the
next argument as the backup suffix, so `-i -e A -e B file` is suffix `-e`, script `A`, and the files `-e`, `B`, `file`.
sed fails on the file `-e`, git never starts the rebase, and step 2 never conflicts / `done` never exists. A single
`-e` works on macOS only by that accident (backup file `git-rebase-todo-e`). `sed -i.orig` (suffix attached) edits in
place on GNU sed (Linux, Git for Windows) and BSD sed alike. The product never runs sed; no product code changes.

## Target

Owned: `crates/conflict-repo/src/operation.rs`, `crates/conflict-repo/src/lib.rs`, `crates/conflict-repo/AGENTS.md`,
`crates/gitio/tests/edit_stop.rs`, `crates/gitio/tests/operations.rs`, `scripts/operations-repo.sh`.

Read-only: everything else.

Non-goals: splitting `crates/gitio/tests/operations.rs` (469 lines; carried), any test's meaning, any other file.

## Contract (fixed)

`yamt_conflict_repo::sed_sequence_editor(scripts: &[&str]) -> String` (in `operation.rs`, re-exported from `lib.rs` next
to `edit_stop_repo`): the `git -c` value `sequence.editor=sed -i.orig -e '<script 1>' -e '<script 2>' …`, each script
single-quoted for the shell git runs the editor through (a script never holds a `'`). One doc comment on it says why
the suffix is attached (the BSD sed reading above, one or two lines).

## Change

1. Add the function. `REWORD_STEP_THREE`, `SQUASH_STEP_TWO`, `EDIT_STEP_ONE` in `operation.rs` become calls to it (the
   scripts stay `3s/^pick/reword/`, `2s/^pick/squash/`, `1s/^pick/edit/`).
2. `edit_stop.rs`: `REWORD_STEP_TWO_DROP_THREE` and `chain_sequence_editor` build their values with it (scripts
   `2s/^pick/reword/` + `3d`; `2s/^pick/{chain_step}/` + `3s/^pick [0-9a-f]*/fixup {local}/`).
3. `operations.rs:421` `drop_the_reword` uses it (script `/^reword/d`).
4. `scripts/operations-repo.sh:118`: `sed -i -e` → `sed -i.orig -e`.
5. `crates/conflict-repo/AGENTS.md`: name the function in the fixture's list.

## Acceptance

- No in-place sed without an attached suffix is left: `rg -n 'sed -i( |")' crates scripts` finds nothing.
- `cargo nextest run -p yamt-gitio -p yamt-conflict-repo` passes here (GNU sed), with the justfile's hermetic prefix
  as `just test` uses it.
- `scripts/operations-repo.sh rebase-interactive /tmp/yamt-sed-ri` still stops at step 1 with the reword at step 3
  (the script's own check passes); remove the directory after.
- macOS itself cannot run here; CI after the owner's push is the proof. Say so in `residual_risk`.

## Skills

`skill://rust-conventions`.
