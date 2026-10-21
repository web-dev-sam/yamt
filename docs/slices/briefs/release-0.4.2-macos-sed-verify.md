# Release 0.4.2 fix — final run after the macOS sed fix

Board "Release 0.4.2" row 5. Row 4 (`90361db`, brief `release-0.4.2-macos-sed.md`, notes
`.omp/run/notes/MacSedFix.md`) changed test code only: one `yamt_conflict_repo::sed_sequence_editor` helper builds
`sequence.editor=sed -i.orig -e '…'` for every rebase fixture and test, and `scripts/operations-repo.sh` uses
`sed -i.orig`. No product code, no dependency changed; no mutation run (nothing in product code to mutate). macOS
cannot run here; CI after the owner's push is that proof. Read-only recipes only (VF6); you fix nothing (VF1); alone.

Scratch under `/tmp/yamt-macsed/`; throwaway repositories `/tmp/yamt-macsed-*`, removed after.

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status.
2. **The fixed tests by name:** `cargo nextest run -p yamt-gitio --test edit_stop` with the justfile's hermetic prefix
   (as `just test` runs it). Pass: 6 tests, 0 failed, both
   `a_conflicted_reword_stop_with_an_empty_todo_has_an_editor_step_ahead` and
   `a_conflicted_fixup_has_an_editor_step_ahead_only_in_a_chain_with_a_squash` listed as passed.
3. **The test-repository script:** `scripts/operations-repo.sh rebase-interactive /tmp/yamt-macsed-ri`. Pass: exit 0,
   it reports the stop and its conflicted files; `.git/rebase-merge/git-rebase-todo` holds one `reword` line.

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5).
