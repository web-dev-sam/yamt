# Slice LocalConflictsGitio — the git runs of the local conflict check (gitio)

Feature: the merge-request list checks conflicts locally (request `docs/slices/request-local-conflict-check.md`
rules 4–8; design `docs/slices/briefs/local-conflicts-design.md` option A, §1 and §2.2). Runs first, alone.
`LocalConflictsCheck` builds on every item below.

## Target

Owned: `crates/gitio/src/merge_tree.rs` (new), `crates/gitio/src/ls_remote.rs` (new), `crates/gitio/src/objects.rs`
(new), `crates/gitio/src/entry.rs`, `crates/gitio/src/lib.rs`, `crates/gitio/tests/local_check.rs` (new),
`crates/gitio/AGENTS.md`.

Read-only: everything else, notably `crates/gitio/src/{fetch.rs,run.rs,repo.rs,version.rs}` (patterns to reuse),
`crates/gitio/Cargo.toml` (no new dependency is needed), `crates/conflict-repo/**`. `docs/architecture.md` §3.2 and
the project map are the docs keeper's: put the lines §3.2 needs in `deviations_from_brief`.

Non-goals: anything GitLab, the order of the check's steps, memory, parallelism, time limits' values (all
`LocalConflictsCheck`); changing `fetch_without_refs` or `fetch_branches` (plan #132, #139, RK40); `--stdin` merges.

## Contract

Fixed (add-only). Sourced facts, given (do not re-measure): `merge-tree --write-tree` exists since git 2.38.0
(RelNotes 2.38.0:16-18), `--quiet` since 2.50.0 (RelNotes 2.50.0:82-83); `--quiet` exits 0 clean / 1 conflicts and
writes no object, the plain form writes unreferenced objects (facts file `.omp/run/notes/PlanLocalConflictFacts.md`);
`ls-remote` against gitlab.com prints `refs/merge-requests/<iid>/head` and branch refs in one call (same file).

```rust
// merge_tree.rs
/// Whether git's merge of two commits is clean.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum MergeOutcome { Clean, Conflicts }

/// How `merge_tree` runs git, by what the installed git can do.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MergeTreeRun {
    /// `--write-tree --quiet` (git 2.50+): no object is written, and git stops at the first conflict.
    Quiet,
    /// `--write-tree` (git 2.38–2.49): the merge's objects are left unreferenced in the object store.
    Writing,
}

impl MergeTreeRun {
    /// The run `version` can do; `None` before 2.38, which has no `--write-tree`.
    #[must_use]
    pub fn for_version(version: GitVersion) -> Option<MergeTreeRun>;
}

impl Repo {
    /// `git merge-tree --write-tree [--quiet] <first> <second>` (`Quiet` adds `--quiet`): exit 0 → `Clean`,
    /// exit 1 → `Conflicts`, any other exit → `Error::GitFailed`; killed at `timeout` → `Error::Timeout`. Never
    /// reads or writes the index, the working tree or a ref (git-merge-tree(1)).
    pub fn merge_tree(&self, first: &Oid, second: &Oid, run: MergeTreeRun, timeout: Duration) -> Result<MergeOutcome>;
}

// ls_remote.rs
/// One ref a remote advertises: its full name (git's bytes) and the object it names.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemoteRef { pub name: Vec<u8>, pub id: Oid }

impl Repo {
    /// `git ls-remote --refs --end-of-options <remote> <patterns>…`: every ref the remote advertises that matches a
    /// pattern (git-ls-remote(1): a glob matched against the ref's tail), in git's order; no object is fetched and
    /// nothing is written. Runs through `fetch.rs` `run_without_prompts` (the no-prompt environment, RK40), killed at
    /// `timeout`. `Err` = git's first stderr line, else git's exit words (as `fetch_without_refs`).
    pub fn remote_refs(&self, remote: &str, patterns: &[&str], timeout: Duration) -> Result<Vec<RemoteRef>, String>;
}

// objects.rs
impl Repo {
    /// Which of `ids` name no commit in the repository's object store, in the order given: one
    /// `git cat-file --batch-check` reading the ids on stdin (a missing id and one that is not a commit both count).
    pub fn missing_commits(&self, ids: &[Oid]) -> Result<Vec<Oid>>;
}
```

- `Oid` (`entry.rs:8`) gains `Hash` in its derive list (the check keys a `HashMap` by commit pairs).
- `lib.rs` re-exports `MergeOutcome`, `MergeTreeRun`, `RemoteRef`.
- Exit mapping as `is_ancestor` does (`repo.rs:85-96`); `Quiet` runs as `Access::Read`, `Writing` as `Access::Write`
  (`run.rs:15-19`, `git_command`); `merge_tree` and `missing_commits` take the existing `run`/`run_with_deadline`
  helpers, never a second runner; `remote_refs` reads git's `<oid>\t<name>` lines, an unreadable line →
  `Err("git ls-remote printed …")`.

## Change

1. `merge_tree.rs`: the enums, `for_version` (two `GitVersion` constants beside it, 2.38 and 2.50 — the only
   place these numbers live, vision 2), `Repo::merge_tree`.
2. `ls_remote.rs`: `RemoteRef`, `Repo::remote_refs` (a pure line parser with unit tests: tab-separated, a peeled
   `^{}` line never printed thanks to `--refs`, an empty answer → empty list).
3. `objects.rs`: `Repo::missing_commits` (`--batch-check` with a format that tells a missing id and a non-commit
   apart from a commit; a pure parser with unit tests).
4. `entry.rs`: `Hash` on `Oid`. `lib.rs`: modules and re-exports. `AGENTS.md`: one sentence per new item with its
   git command.

## Acceptance

- `crates/gitio/tests/local_check.rs`, real tempdir repositories, hermetic git config as the other gitio tests (RK19);
  each test named for the bug it catches:
  - `merge_tree_is_clean_for_disjoint_changes_and_conflicts_for_the_same_line` (both `MergeTreeRun` values the
    installed git supports, from `for_version(repo.version())`);
  - `a_quiet_merge_writes_no_object_and_leaves_refs_index_and_worktree_alone` (`git count-objects -v` before and
    after equal when the run is `Quiet`; for `Writing`, the refs, `git status --porcelain` and `HEAD` unchanged);
  - `a_merge_of_a_missing_commit_or_unrelated_histories_is_an_error_not_a_conflict`;
  - `a_merge_past_its_deadline_is_a_timeout` (a deadline of zero or one millisecond);
  - `remote_refs_lists_the_branch_and_merge_request_heads_of_a_bare_remote_and_writes_nothing` (a bare repository
    with `refs/heads/main` and `refs/merge-requests/7/head` reached by a remote name; patterns `refs/heads/main`
    and `refs/merge-requests/*/head`; `for-each-ref` of the local repository and `.git/FETCH_HEAD`'s absence before
    and after);
  - `remote_refs_of_an_unreachable_remote_gives_gits_first_line`;
  - `missing_commits_names_unknown_ids_and_non_commits_in_order`.
- Unit tests: `for_version` at 2.37 → `None`, 2.38 and 2.49 → `Writing`, 2.50 and 3.0 → `Quiet`; the two parsers.
- `cargo nextest run -p yamt-gitio` (with the justfile's hermetic prefix), `cargo clippy -p yamt-gitio --all-targets
  -- -D warnings`, `cargo fmt --check`: paste the summary lines.
- `just mutants HEAD` in your workspace (SP11); survivors kept only with a reason.

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK19, RK40, RK52), `skill://verification`.
