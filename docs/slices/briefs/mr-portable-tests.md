# Slice MrPortableTests — the merge-request tests on macOS and Windows

Board "Release 0.6.2" row 1 (session 38). Owner #1975: release 0.6.2, "but fix CI before, windows and mac failed".
Finding #1976 holds the evidence: CI run 41104223808 at `0927634` (`main`, = `v0.6.1`), step "Rust tests without the
runner's git config (RK19)" (`just test`). Ubuntu passes. The failing tests are all from the merge-request overview
(merged in `2a4b7af`); they had never run on macOS or Windows before (its implementers only cross-compiled them). The
annotations' full text is in `.omp/run/ci/124229187794-0.txt` (macOS) and `124229187853-0.txt` (Windows): read them.
No macOS or Windows machine here.

## Failures and their causes as far as read

1. **Path forms.** macOS: the temporary folder `/var/folders/…` is a symlink to `/private/var/folders/…`; git prints
   the resolved path. Windows: the temporary folder comes as `C:\Users\RUNNER~1\…` (short name), git prints
   `C:/Users/runneradmin/…`. Failing: `crates/merge-requests/tests/detect.rs:51` (`found.root()` vs `repo.path()`, both
   systems), `crates/merge-requests/tests/list.rs:95`, `crates/merge-requests/tests/open.rs:110` (macOS), and
   `src-tauri/src/merge_requests/tests.rs` `a_repository_with_a_gitlab_remote_is_found_and_one_without_is_none` (macOS;
   its message is cut from the annotation: the `common_dir` string built from the temporary folder vs the command's
   answer is the likely one — confirm by reading). The repository's convention for such asserts: compare
   `fs::canonicalize` of both sides (e.g. `crates/gitio/tests/repo.rs:302`, `crates/agent/tests/process.rs:90`).
   **Product question, answer it in your report:** does product code compare, or use as a key, a path that can come in
   one form from one source and in another form from another (a start folder vs git's answer: e.g. "this merge
   request is already open", the remembered filters per repository, the session sweep)? If yes, that is a real bug on
   macOS/Windows: fix it in the product within your owned files and pin it with a test; if no, the tests alone change.
2. **Windows, os error 193** at `src-tauri/src/merge_requests/tests.rs:56`: `Command::new` on
   `scripts/range-repo.sh` — Windows cannot start a shell script. Follow what the repository already does for tests
   that build their repository with that script (`src-tauri/src/review/tests.rs`, `src-tauri/src/range/…`): gate only
   the tests that need it, never the whole file (decision record #59 rejects whole-file unix gates, #782), one short
   comment per gate naming the reason. Tests that do not need the script keep running on Windows.
3. **macOS, "the opener never ran"** (`src-tauri/src/merge_requests/tests.rs:174`):
   `through_glab::job_pages_on_path_s_opener` and `through_glab::only_a_job_page_a_list_sent_is_handed_to_the_browser`
   wait 10 s for the fake opener's log. `scripts/fake-open/` holds only `xdg-open`; read which program the product
   starts on macOS for a job page and make the fake answer to that name there (if the product starts it by absolute
   path, say so and pin what can be pinned without starting the real browser). Linux must keep using the fake.
4. **Windows warnings** (not failures): unused import `Error` in `crates/agent/tests/checkout.rs:9`, unused import
   `Duration` in `crates/gitio/tests/fetch.rs:4` — imports used only by unix-gated tests. No warning on any target.

## Target

Owned: `crates/merge-requests/**`, `src-tauri/src/merge_requests/**`, `scripts/fake-open/**`,
`crates/agent/tests/checkout.rs`, `crates/gitio/tests/fetch.rs`. Read-only: everything else. A needed edit elsewhere →
`deviations_from_brief`, not done. Every test keeps pinning what it pinned (no weakened assert, no dropped case on
Linux).

## Acceptance

- **macOS path form reproduced on Linux:** with `TMPDIR` pointing at a symlink to a real folder (e.g.
  `ln -s /tmp/mrpt-real /tmp/mrpt-link; TMPDIR=/tmp/mrpt-link`), `cargo nextest run -p yamt-merge-requests` and the
  `merge_requests::` tests of the app fail before your change and pass after (paste both summaries).
- `cargo nextest run -p yamt-merge-requests -p yamt-agent -p yamt-gitio` and the app's `merge_requests::` tests pass on
  Linux with the plain environment; `just clippy` and `cargo fmt --all --check` clean.
- `cargo check --tests` for the touched crates with `--target x86_64-pc-windows-msvc` and with
  `--target aarch64-apple-darwin` (both installed): no error and no warning in the owned files (paste the tails; the
  app crate may not cross-compile — say how far it got, as `.omp/run/notes/MrOpenCommandsR1.md` did).
- The report answers the product question in item 1 with the code read (paths, lines).

## Skills

`skill://rust-conventions`, `skill://risk-register`, `skill://verification` (plus your autoloaded ones).
