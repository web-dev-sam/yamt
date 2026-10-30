# Slice MrConflictsLocalR1 — fix round 1 of the crate `yamt-local-merge`

Board "Merge-request conflicts" row 4. Round 1: `MrConflictsLocal` (commit `e3bf8ae`, brief
`docs/slices/briefs/mr-conflicts-local.md`, notes `.omp/run/notes/MrConflictsLocal.md`). Fix exactly these
(`just findings 2010 2011 2012`):

1. **#2010** In `start`'s `merged` step, a stop that has an operation but is not live (MERGE_HEAD for another commit
   than the record's, e.g. `origin/<target>` moved by a concurrent fetch between steps 7 and 13) is aborted with
   `repo.abort(&operation)` before the error path's `restore`. Test: a `post-checkout` hook in the fixture checkout that
   moves `refs/remotes/origin/main`; assert the checkout snapshot (HEAD, `refs/heads/*`, `status --porcelain=v1`, no
   record, no `MERGE_HEAD`) before = after.
2. **#2011** A variant of `a_local_branch_named_like_the_remote_target_…` with `git config core.warnAmbiguousRefs false`
   in the checkout first, asserting `MERGE_HEAD` is GitLab's `main`; the kept survivor at `start.rs:209` gone or its
   reason corrected.
3. **#2012** Contract amendment (design §4.3 step 2, §4.5 "Leftovers", §4.6 `Leftover`, already edited): new variant
   `Leftover::BranchCheckedOut { branch }` for a created branch still at `record.head` that is checked out because the
   return was refused or not done; `BranchKept` stays for a branch that moved. Pin it in
   `a_refused_return_is_listed_…` (now `[ReturnRefused, BranchCheckedOut]`) and in a NotReturned case where HEAD is still
   on the created branch, if reachable.

## Target

Owned: `crates/local-merge/**`. Read-only: everything else. Contract: add-only except item 3's variant.

## Acceptance

- Each item's test fails on round 1's code (say how you checked).
- `cargo nextest run -p yamt-local-merge` (hermetic prefix), `cargo clippy -p yamt-local-merge --all-targets -- -D
  warnings`, `cargo fmt --check`, `scripts/arch-check.sh`: summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK15, RK19, RK40; RK43–RK47 of the design), `skill://verification`.
