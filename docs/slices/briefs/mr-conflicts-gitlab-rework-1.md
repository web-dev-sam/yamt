# Slice MrConflictsGitlabR1 — fix round 1 of size, readiness, fork and `prepare_resolve`

Board "Merge-request conflicts" row 3. Round 1: `MrConflictsGitlab` (commit `c4577bd`, brief
`docs/slices/briefs/mr-conflicts-gitlab.md`, notes `.omp/run/notes/MrConflictsGitlab.md`). Fix exactly these
(`just findings 2005 2006`):

1. **#2005** A scenario file `tests/glab/mr-conflicts/graphql-merge-request-34.json` (opened, target branch
   `main:refs/heads/x`) and a `tests/resolve.rs` case: `Failed { message: "GitLab sent \"main:refs/heads/x\" as a branch
   name" }`, refs unchanged. `tests/glab/README.md` names it.
2. **#2006** `fixtureMergeRequestData.test.ts` asserts all eight readiness cycle positions; the kept survivors relabelled
   (asserted entries: false survivors per #732, not equivalent), or gone.

## Target

Owned: `crates/merge-requests/tests/**`, `tests/glab/mr-conflicts/**`, `tests/glab/README.md`,
`frontend/src/ipc/fixtureMergeRequestData.test.ts`. Read-only: everything else. No contract change.

## Acceptance

- Each item's test fails when the guarded line is removed (say how you checked).
- `cargo nextest run -p yamt-merge-requests` (hermetic prefix), `cargo clippy -p yamt-merge-requests --all-targets --
  -D warnings`, `cargo fmt --check`, `pnpm -C frontend test src/ipc/fixtureMergeRequestData.test.ts`: summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://ts-conventions`, `skill://risk-register` (RK40), `skill://verification`.
