# Slice MrConflictsGitR1 — fix round 1 of the gitio runs for a local merge

Board "Merge-request conflicts" row 2. Round 1: `MrConflictsGit` (commit `45b9d94`, brief
`docs/slices/briefs/mr-conflicts-git.md`, notes `.omp/run/notes/MrConflictsGit.md`). Fix exactly these
(`just findings 1999 2000 2001 2002`):

1. **#1999** One `pub(crate)` network-run helper in `fetch.rs` beside `refuse_prompts` (env, debug log, deadline run,
   "cannot run git <verb>", "git <verb> got no answer within N s"); `fetch` and `push_branch` handle only the finished
   run. Wording and behaviour of both unchanged.
2. **#2000** `fetch_branches_writes_only_the_two_remote_tracking_refs` starts with `refs/remotes/<remote>/<b>` at a
   commit that is not an ancestor of the bare's new head and expects it replaced (the test fails without `+`).
3. **#2001** `merge_no_commit` on a fast-forwardable merge (HEAD an ancestor of `rev`): succeeded, `MERGE_HEAD`
   present, HEAD unchanged (the test fails without `--no-ff`).
4. **#2002** No GitLab-supplied name can be read as an option: `--end-of-options` before the name in every run where git
   would parse a leading `-` as a flag (`checkout_branch`, `delete_branch`, `move_branch`, `merge_no_commit`; check the
   others), one test per run with a branch-like `-x` argument showing git reads it as a name. Where git rejects
   `--end-of-options` in that position, a documented caller-checked precondition instead, as `fetch_branches`' `:` one,
   and the method named in `deviations_from_brief`. Update the doc comments and `AGENTS.md` to the new argv.

## Target

Owned: `crates/gitio/src/{repo.rs,fetch.rs,lib.rs,branch.rs,push.rs}`, `crates/gitio/tests/{branch.rs,push.rs,fetch.rs}`,
`crates/gitio/AGENTS.md`. Read-only: everything else. No public signature change.

## Acceptance

- Each item's test fails on round 1's code (say how you checked).
- `cargo nextest run -p yamt-gitio` (hermetic prefix), `cargo clippy -p yamt-gitio --all-targets -- -D warnings`,
  `cargo fmt --check`: paste the summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK15, RK19, RK40), `skill://verification`.
