# SideNamesRustR1 — 3.N-rust, rework 1 (#822–#824)

Brief `docs/slices/briefs/3.N-side-names-rust-rework-1.md`. Transcript `history://SideNamesRustR1`.

- `Repo::current_branch` runs `git branch --show-current` (const `BRANCH`); empty output → `None` (detached, rebase);
  unborn → its name; outside a repository → `GitFailed`.
- `without_final_newline(command, output)`: the four rev-parse callers pass `REV_PARSE`, `current_branch` passes
  `BRANCH` (#823/#824). The `symbolic-ref --quiet` line above `is_unresolved_name` removed (no longer applies).
- New test `current_branch_ignores_a_tag_with_the_branch_name`: failed on `d5f9e1d` (`heads/local` vs `local`),
  passes after.
- `an_unreadable_branch_drops_only_the_local_name`: setup check now asserts the new command's failure ("failed to
  resolve HEAD", exit 128 on the symbolic-ref loop); still drops only the local name.
- fmt, clippy `-D warnings`, `cargo test --workspace`, `just arch-check` ok.
- Open risk: the `UnexpectedOutput { command: "branch" }` path is untested (git always ends the name with a newline).
