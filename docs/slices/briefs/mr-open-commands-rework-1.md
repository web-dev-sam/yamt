# Slice MrOpenCommandsR1 — fix round 1 of the merge-request commands, opening and opener

Board "Merge requests" row 4. Round 1: `MrOpenCommands` (commit `03800ff`, brief `docs/slices/briefs/mr-open-commands.md`,
notes `.omp/run/notes/MrOpenCommands.md`). Fix exactly these (`just findings 1944 1945 1946 1949 1950 1951 1952 1953`):

1. **#1944** The second window's argv built by one pure function, unit-tested through `crate::args::parse` back to the
   range invocation (spec, absolute repo, no AI).
2. **#1945** One fake-glab helper module for the crate's integration tests (`tests/list.rs` and `tests/open.rs` share it).
3. **#1946** The compare window's start folder resolved where merge and range resolve theirs (`lib.rs` dispatch), passed
   to the compare window; `window.rs`'s own start-folder decision deleted.
4. **#1949** `remote_for` considers only remotes detection counts as GitLab's (same host rule as `detect.rs`, not a
   copy); unit test with a github.com mirror of the same path first in config order.
5. **#1950** `running_appimage` and the program choice proven under a set `APPIMAGE` (child-process test as
   `merge_requests/tests.rs` does).
6. **#1951** The macOS/Windows opener program and arguments and the Windows detach flags as named values with
   `cfg`-gated unit tests (CI runs macOS and Windows tests).
7. **#1952** A scenario whose target branch holds `:` → `Failed`, refs unchanged (test).
8. **#1953** The opener runs in its own process group on Unix, like the second window, pinned by a test.

## Target

Owned: `crates/merge-requests/**`, `src-tauri/src/{range_window.rs,appimage.rs,window.rs,lib.rs,merge_requests.rs}`,
`src-tauri/src/merge_requests/**`, `tests/glab/merge-requests/**`, `tests/glab/README.md`. Read-only: everything else
(`args.rs` included). No contract change: the bindings stay byte-identical (`just bindings-check`).

## Acceptance

- Each item's test fails on round 1's code (say how you checked).
- `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`,
  `scripts/arch-check.sh`, `just bindings-check` pass.
- `just mutants HEAD` in your workspace (SP11); platform-only survivors named as such, with the CI job that runs them.

## Skills

`skill://rust-conventions`, `skill://risk-register`, `skill://verification`.
