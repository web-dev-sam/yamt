# Slice MrConflictsAppR1 — fix round 1 of the app commands

Board "Merge-request conflicts" row 5. Round 1: `MrConflictsApp` (commit `a94e4af`, brief
`docs/slices/briefs/mr-conflicts-app.md`, notes `.omp/run/notes/MrConflictsApp.md`). Fix exactly these
(`just findings 2013 2014 2016 2017 2020`):

1. **#2013** `push_merged_branch` runs its push through `blocking_reply` (`ipc_error.rs`), not a hand-written
   `spawn_blocking` + panic arm: `Finished` on `Ok(Pushed)`, else `Committed { root, offer }`.
2. **#2014** `impl From<yamt_local_merge::Error> for IpcError` in `ipc_error.rs` (exhaustive match, as the other
   crates' mappings) with a test in `ipc_error/tests.rs`; `merge.rs` and `merge_requests.rs` use `?`.
3. **#2016** + **#2017** `outcome.rs`'s inline tests → `outcome/tests.rs`, `commands.rs`'s → `commands/tests.rs`
   (as `ai/`, `review/`, `ipc_error/`); the startup tests of `merge/merge_request_tests.rs` move to `outcome/tests.rs`;
   `merge/merge_request_tests.rs` → `merge/tests/merge_request.rs` (`mod merge_request;` in `merge/tests.rs`), the
   convention `merge_requests/tests/resolve.rs` uses. Both `outcome.rs` and `commands.rs` under RS6's 400 lines.
4. **#2020** Kept survivors: `second_window.rs:66`'s reason names its killing test and the CI job that runs it; `:86`
   (Windows `detach`) killed by a `cfg(windows)` test, or kept with "gap: RK42, Windows detach unpinned" and the line
   named in `deviations_from_brief` for the risk register.

#2015 (the TS aliases' home) is not yours: it moves with the page build, after the merge-window build lands.

## Target

Owned: `src-tauri/src/{merge.rs,merge_requests.rs,commands.rs,outcome.rs,ipc_error.rs,second_window.rs}`,
`src-tauri/src/{merge,merge_requests,commands,outcome,ipc_error}/**`, `src-tauri/AGENTS.md`. Read-only: everything
else. No contract change: `just bindings` leaves `bindings.ts` byte-identical (check in your workspace).

## Acceptance

- Item 1–2: a test fails on round 1's code or the mapping's test pins each variant (say how you checked). Items 3–4:
  `wc -l` of the two files; every moved test still runs (nextest count before = after).
- `cargo nextest run -p yamt-app` (hermetic prefix), `cargo clippy -p yamt-app --all-targets -- -D warnings`,
  `cargo fmt --check`, `scripts/arch-check.sh`: summary lines.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK42, RK45, RK47), `skill://verification`.
