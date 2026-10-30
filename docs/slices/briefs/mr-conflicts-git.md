# Slice MrConflictsGit — the git runs a merge in your own checkout needs (gitio)

Feature: merge-request conflicts (request `docs/slices/request-mr-conflicts.md`, design
`docs/slices/briefs/mr-conflicts-design.md` option A — §1 "git and the tools", §4.2, §4.3, §4.4, §4.7 "gitio").
Runs first, beside `MrConflictsGitlab`. `MrConflictsLocal` builds on every method below.

## Target

Owned: `crates/gitio/src/{repo.rs,fetch.rs,lib.rs}`, `crates/gitio/src/branch.rs` (new), `crates/gitio/src/push.rs`
(new), `crates/gitio/tests/{branch.rs,push.rs}` (new), `crates/gitio/tests/fetch.rs`, `crates/gitio/AGENTS.md`.

Read-only: everything else. `docs/architecture.md`, the project map and the risk register are the docs keeper's: put
the lines §3.2 needs in `deviations_from_brief`.

Non-goals: the record, the order of the steps, refusals, anything GitLab (all `MrConflictsLocal`/`MrConflictsGitlab`);
changing `fetch_without_refs`'s behaviour (#132, RK40).

## Contract

Fixed (add-only), on `yamt_gitio::Repo`:

```rust
pub fn git_path(&self, name: &str) -> Result<PathBuf>;   // was pub(crate) (repo.rs:92-95); unchanged behaviour
/// `git status --porcelain=v1 -z --untracked-files=no`: any staged, unstaged or unmerged entry.
pub fn has_tracked_changes(&self) -> Result<bool>;
/// `git merge-base --is-ancestor <ancestor> <of>`: exit 0 → true, 1 → false, anything else → Error::GitFailed.
pub fn is_ancestor(&self, ancestor: &Oid, of: &Oid) -> Result<bool>;
/// `git fetch --no-tags --no-write-fetch-head --no-recurse-submodules --no-auto-maintenance --refmap= --quiet
/// --end-of-options <remote> +refs/heads/<b>:refs/remotes/<remote>/<b> …` (one refspec per branch), with
/// fetch_without_refs's no-prompt environment, killed at `timeout`; Err = git's first stderr line (as fetch_without_refs).
/// Precondition (documented, the caller checks): no branch name holds ':'.
pub fn fetch_branches(&self, remote: &str, branches: &[&str], timeout: Duration) -> Result<(), String>;
/// `git checkout --quiet -B <branch> <commit>`; no deadline (a large tree).
pub fn checkout_branch_at(&self, branch: &str, commit: &Oid) -> Result<()>;
/// `git checkout --quiet <branch> --`; no deadline.
pub fn checkout_branch(&self, branch: &str) -> Result<()>;
/// `git config branch.<branch>.remote <remote>` then `git config branch.<branch>.merge refs/heads/<branch>`.
pub fn set_upstream(&self, branch: &str, remote: &str) -> Result<()>;
/// `git branch --quiet -D <branch>` (git refuses a branch checked out in any worktree).
pub fn delete_branch(&self, branch: &str) -> Result<()>;
/// `git branch --quiet --force <branch> <commit>` (git refuses a branch checked out in any worktree).
pub fn move_branch(&self, branch: &str, commit: &Oid) -> Result<()>;
/// `git reset --quiet --keep <commit>`; no deadline.
pub fn reset_keep(&self, commit: &Oid) -> Result<()>;
/// `git merge --no-ff --no-commit <rev>`; no deadline; a non-zero exit is not an Err (the caller re-reads the stop),
/// as `continue_operation` (abort_continue.rs:22-34).
pub fn merge_no_commit(&self, rev: &str) -> Result<GitRun>;
/// `git push --porcelain --no-follow-tags --recurse-submodules=no --end-of-options <remote>
/// refs/heads/<branch>:refs/heads/<branch>`: never `+`, never `--force`; fetch's no-prompt environment; killed at
/// `timeout`. Err = the ref's porcelain summary and reason ("[rejected] (fetch first)") when its flag is `!`, else
/// git's first stderr line starting `fatal:` or `error:`, else git's exit words.
pub fn push_branch(&self, remote: &str, branch: &str, timeout: Duration) -> Result<(), String>;
```

`pub const PUSH_TIMEOUT: Duration = Duration::from_secs(120);` in `push.rs`, re-exported beside `FETCH_TIMEOUT`.
The no-prompt environment (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, Unix `SSH_ASKPASS_REQUIRE=force` +
`SSH_ASKPASS=false`, `fetch.rs:33-41`) becomes one `pub(crate)` helper in `fetch.rs` that `fetch_without_refs`,
`fetch_branches` and `push_branch` all call: one copy (vision 2).

Writes go through `self.command(Access::Write, …)` (`LC_ALL=C`, cwd = root, `repo.rs:215-218`); deadline-free runs
through `run_to_success`/`run_to_end` as `checkout_detached` and `continue_operation` do.

## Change

1. `repo.rs`: `git_path` public. `is_ancestor`, `has_tracked_changes` beside the other reads.
2. `branch.rs`: the branch and merge writes above.
3. `fetch.rs`: the shared no-prompt helper; `fetch_branches`.
4. `push.rs`: `push_branch`, `PUSH_TIMEOUT`, the porcelain reading (a small pure function with unit tests: `!` line →
   summary + reason; `=`/` ` lines → ok; no line for the ref → the stderr rule).
5. `lib.rs`: re-exports. `AGENTS.md`: one sentence per new method with its git command.

## Acceptance

- Integration tests with real tempdir repositories (a bare "remote" made by `git init --bare` + `git clone`, hermetic
  git config as the other gitio tests, RK19), each named for the bug it catches:
  - `fetch_branches_writes_only_the_two_remote_tracking_refs` (no `FETCH_HEAD`, no other ref: `for-each-ref` before
    and after, a remote with a configured `+refs/heads/*:refs/remotes/origin/*` refspec and a third branch);
  - `fetch_branches_never_prompts` (the logged environment, as `the_fetch_runs_with_no_prompt_of_git_ssh_or_a_credential_manager`);
  - `checkout_branch_at_creates_fast_forwards_and_keeps_upstream` (an existing branch's `branch.*` config survives `-B`);
  - `branch_force_keeps_the_upstream_config` (design §4.3's `[INFERENCE]`, measured here; if git drops it, report in
    `deviations_from_brief` and keep the test pinning what git does);
  - `delete_and_move_refuse_a_branch_checked_out_in_another_worktree`;
  - `is_ancestor_answers_both_ways_and_fails_on_an_unknown_commit`;
  - `has_tracked_changes_ignores_untracked_files_and_sees_staged_unstaged_and_unmerged`;
  - `merge_no_commit_stops_with_merge_head_on_conflicts_and_on_a_clean_merge` (exit 1 with unmerged entries; exit 0
    with `MERGE_HEAD` and no commit made);
  - `a_rejected_push_names_the_ref_and_reason` (the remote moved: Err contains "[rejected]"), `a_push_never_forces`
    (the diverged remote's branch unchanged), `a_push_to_a_missing_remote_gives_gits_fatal_line`.
- `cargo nextest run -p yamt-gitio` (with the justfile's hermetic prefix), `cargo clippy -p yamt-gitio --all-targets
  -- -D warnings`, `cargo fmt --check`: paste the summary lines.
- `just mutants HEAD` in your workspace (SP11); survivors kept only with a reason.

## Skills

`skill://rust-conventions`, `skill://risk-register` (rows RK15, RK19, RK40), `skill://verification`.
