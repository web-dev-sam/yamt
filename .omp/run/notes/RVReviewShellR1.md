All four fixes from the brief are in, and `cargo fmt --check`, clippy with `-D warnings`, `cargo test -p yamt-app` and `just arch-check` all pass.

```
summary
  ipc_error.rs's tests now live in src-tauri/src/ipc_error/tests.rs, with the three review mapping tests beside range_json; ipc_error.rs is 216 lines (was 468).
  Two Unix-only tests run send_queue and check_gitlab in a child test process whose PATH starts with the committed scripts/fake-glab, on scripts/range-repo.sh's main...feature (new scenario tests/glab/slow-post: post 1 waits 2 s).
  The poison rule is tested by a thread that takes send_guard and panics.
  The always-true exit-2 assert in range.rs is gone and the test is renamed.
  review.rs is 397 lines.

files_changed
  src-tauri/src/ipc_error.rs
  src-tauri/src/ipc_error/tests.rs (new)
  src-tauri/src/review.rs
  src-tauri/src/range.rs
  tests/glab/slow-post/{draft-notes.json,merge-request.json,merge-requests.json,post-1.json,post-1.sleep} (new)
  tests/glab/README.md
  src-tauri/AGENTS.md

tests_added
  review::tests::through_glab::a_send_holds_off_a_second_send_until_its_post_ends (parent) + ..::a_send_on_path_s_glab (ignored child):
    one queued message is sent through Glab::find() on PATH. Once the fake's log shows the POST, a second send_queue answers SendRunning.
    The first answers Sent{sent:1, refused:0}, and its Channel received exactly {"done":1,"of":1}. A third send answers Sent, not SendRunning.
    Checked against a broken shell: with `drop(send_guard(..)?)` (guard released early), this test fails.
  review::tests::through_glab::check_gitlab_answers_lined_up_on_the_lined_up_merge_request (parent) + ..::check_gitlab_on_path_s_glab (ignored child):
    check_gitlab through the glab on PATH, lined-up scenario, answers kind "linedUp".
  review::tests::a_send_guard_whose_holder_panicked_is_taken_again: a scoped thread holds send_guard and panics; the join is Err; sending.is_poisoned(); send_guard(&sending).is_ok(). Replaces a_send_guard_let_go_is_taken_again.
  Moved, not new: ipc_error::tests::{review_json, each_review_error_has_its_kind_and_a_write_failure_names_the_file, a_start_only_review_error_is_its_line}.
  Renamed: range::tests::a_broken_threads_file_is_refused_before_the_range_state_and_left_unchanged. The Ending::failure assert is deleted; the comment says exit 2 rests on window.rs:111-113 and the real-app smoke.

smoke_evidence
  cargo fmt --check → FMT_OK
  cargo clippy --workspace --all-targets -- -D warnings → "Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.43s" (no warnings)
  cargo test -p yamt-app →
    test review::tests::a_send_guard_whose_holder_panicked_is_taken_again ... ok
    test review::tests::through_glab::check_gitlab_answers_lined_up_on_the_lined_up_merge_request ... ok
    test review::tests::through_glab::a_send_holds_off_a_second_send_until_its_post_ends ... ok
    test ipc_error::tests::each_review_error_has_its_kind_and_a_write_failure_names_the_file ... ok
    test ipc_error::tests::a_start_only_review_error_is_its_line ... ok
    test range::tests::a_broken_threads_file_is_refused_before_the_range_state_and_left_unchanged ... ok
    test result: ok. 126 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 3.00s
    test result: ok. 5 passed; 0 failed; 0 ignored (tests/cli.rs)
  just arch-check → arch-check: ok
  Broken-shell check (temporary edit, then restored): with `drop(send_guard(&state.sending)?)` the send test failed with
    "Ok(Stopped { … reason: \"fake glab: the scenario has no answer for post 2\" })".
  No test runs a file it just wrote: the child's PATH starts with the committed scripts/fake-glab, and the scenarios are committed folders.

deviations_from_brief
  - PATH starts with the committed folder scripts/fake-glab, not a temporary folder holding a glab symlink and its glab.env. This is the crates/gitio/tests/glab.rs:270 pattern. The YAMT_FAKE_GLAB* variables are set on the child, and the child reads YAMT_FAKE_GLAB_LOG to find the log. Still no exec of a file written by the test, and fewer moving parts.
  - New scenario tests/glab/slow-post (lined-up's files, only post 1, post-1.sleep = 2): `timeout` sleeps 25 s on post 2 and `runner` has no merge request lists, so neither could serve. One line added to tests/glab/README.md.
  - The glab tests sit in a nested `#[cfg(unix)] mod through_glab`, so their helpers are not dead code on Windows. For the same reason, range.rs's new shared helper `open_range_window_on(repo, range)` is `#[cfg(unix)]`. The helper `collecting_channel()` is shared by the progress test and the send test.
  - range.rs tests: the RANGE-only `resolved` now goes through `resolved_on(root, range)`, and window building goes through `open_resolved_window`. The now-unused `use crate::outcome::Exit` is removed.
  - src-tauri/AGENTS.md: the review mapping tests now live in `ipc_error/tests.rs`; the poison rule, the through_glab tests and `open_range_window_on` are described.
  - The boundary review's nits (`locked`→`lock`, the `unnecessary_wraps` reason) were not promoted to the brief and are left unchanged.

open_risks
  - src-tauri/src/review.rs:342-353: the send test relies on the fake logging the POST argv before it sleeps (scripts/fake-glab/glab:46 logs first, :100 sleeps). The second send must arrive within those 2 s. It fails before any glab call, so the margin is large; the log wait gives up after 10 s.
  - src-tauri/src/review.rs:379: the progress check compares the Channel's JSON text to `{"done":1,"of":1}`. It depends on serde_json writing compact JSON with fields in declaration order, which it does today.
  - The child tests run scripts/range-repo.sh, which needs bash and git ≥ 2.32. They are Unix-only, like crates/review/tests.
```