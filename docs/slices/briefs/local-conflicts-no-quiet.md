# Slice LocalConflictsNoQuiet — the local merge never runs `merge-tree --quiet`

Bug (owner, session 57, board "Conflicts vanish after refresh"): on the owner's Apple git 2.50.1, merge request !3197,
`git merge-tree --write-tree --quiet 649503c6 b4879e78` exits **0**, also with the app's exact environment
(`LC_ALL=C GIT_OPTIONAL_LOCKS=0 GIT_NO_LAZY_FETCH=1 -c core.quotepath=false`), while `git merge-tree --write-tree
--name-only` on the same pair exits **1** with `CONFLICT (content): Merge conflict in
app/Http/Controllers/ProductReleaseController.php`. GitLab agrees with the plain form. The app takes the `Quiet` run on
git ≥ 2.50 (`merge_tree.rs` `MergeTreeRun::for_version`), so it showed a real conflict as clean, and `MergedPairs`
replayed that on every refresh. The cause inside git is not known (merge-ort's early exit reads right in 2.50.1 and
master); no public repository reproduces it. Owner's decision: always the plain form. Its unreferenced objects are
already allowed (request `docs/slices/request-local-conflict-check.md` rule 6, plan §2 #150).

## Target

Owned: `crates/gitio/src/merge_tree.rs`, `crates/gitio/src/lib.rs`, `crates/gitio/tests/local_check.rs`,
`crates/gitio/AGENTS.md`, `crates/merge-requests/src/check.rs`, `crates/merge-requests/src/check/tests.rs`.

Read-only: everything else. `docs/architecture.md` §3.2 (lines ~302, ~321) and `.omp/skills/project-map/tree.md:27`
name `MergeTreeRun`: put the replacement lines in `deviations_from_brief` (the docs keeper's files).

Non-goals: any other git call; `MergedPairs` (keys stay right; a restart clears wrong results); the attributes options
added in `2a5d636d`/`fa441ab7` (keep them exactly); the 60 s phase limit and per-merge timeout values.

## Contract

`MergeTreeRun` is removed (both variants, `for_version`, the re-export). New, fixed:

```rust
// merge_tree.rs
/// Whether `version` has `merge-tree --write-tree` (git 2.38.0 release notes).
#[must_use]
pub fn merge_tree_supported(version: GitVersion) -> bool;

impl Repo {
    /// `git merge-tree --write-tree <first> <second>` (attributes as today): exit 0 → `Clean`, exit 1 with nothing on
    /// stderr → `Conflicts`, any other exit → `Error::GitFailed`; killed at `timeout` → `Error::Timeout`.
    pub fn merge_tree(&self, first: &Oid, second: &Oid, timeout: Duration) -> Result<MergeOutcome>;
}
```

- Runs as `Access::Write` (it writes unreferenced objects). `--quiet` is never passed; the doc comment says why in one
  line (git 2.50.1 measured exiting 0 on a content conflict that the plain form reports; source: this brief).
- `lib.rs` re-exports `merge_tree_supported` beside `MergeOutcome`.
- `check.rs`: `merge_tree_run` becomes a check returning `Result<(), String>` with the same "git X.Y cannot merge
  without a checkout (needs 2.38)" text; `merge_and_send` loses its `run_kind` parameter. Nothing else in the check
  changes.
- `crates/gitio/AGENTS.md`: its local-check paragraph drops `--quiet`/`MergeTreeRun`.

## Change

1. `merge_tree.rs`: remove `MergeTreeRun` and `FIRST_WITH_QUIET`; add `merge_tree_supported`; `merge_tree` per the
   contract; unit tests: 2.37 → false, 2.38 → true.
2. `lib.rs`, `check.rs`, `check/tests.rs` (only if it names the removed items), `AGENTS.md` as above.
3. `tests/local_check.rs`: drop `supported_runs`' two-run loop (one run; skip when `merge_tree_supported` is false);
   the quiet-specific object test becomes: a merge leaves refs, status, index and HEAD as they were (the existing
   `untouched` helper) — no assertion about objects.

## Acceptance

- `cargo test -p yamt-gitio -p yamt-merge-requests` passes; `cargo clippy -p yamt-gitio -p yamt-merge-requests
  --all-targets` clean; `rg -n 'MergeTreeRun|--quiet' crates/gitio/src/merge_tree.rs crates/merge-requests/src` finds
  nothing but the doc comment's one mention.
- Same-line conflict → `Conflicts`, disjoint change → `Clean`, working tree untouched (existing tests, one run each).
- `just mutants HEAD` survivors on changed lines killed or reasoned.
