The seven thread and GitLab commands now exist as Tauri commands in the range window. A broken `threads.json` ends `yamt --diff=<range>` with exit 2 before any window opens, and the file is left as it was. fmt, clippy, the `yamt-app` and `yamt-review` tests and arch-check pass, and both real-app checks behaved as the brief asks. Mutants were not run, and check/send have not run against a real or fake glab.

```
summary
  RangeState now also holds `threads: Mutex<ThreadStore>` and `sending: Mutex<()>`. run_range opens the pair
  folder's threads.json after the lock and before any window (unreadable, broken or newer → one `yamt: …` line,
  exit 2, file untouched), then logs any stored paths the range does not list once with tracing::warn!.
  New src-tauri/src/review.rs has the seven commands; send_queue answers SendRunning while another send runs.
  IpcError gains UnknownThread, UnknownMessage, EmptyMessage, MessagePending and SendRunning, plus an
  exhaustive From<yamt_review::Error>.

files_changed
  src-tauri/src/review.rs (new)
  src-tauri/src/range.rs
  src-tauri/src/commands.rs
  src-tauri/src/ipc_error.rs
  src-tauri/src/lib.rs (`mod review;`; ownership granted by Main)
  crates/review/src/lib.rs (`pub use yamt_gitio::Glab;`; ownership granted by Main)
  src-tauri/AGENTS.md

tests_added
  range::tests::a_broken_threads_file_ends_before_any_window_with_exit_2 — the refusal line names the file,
    Exit::Failure, no RangeState managed, the file bytes unchanged
  range::tests::threads_on_a_path_the_range_does_not_list_are_kept_and_logged_once — exactly one WARN line with
    paths=["gone.txt"]; list_threads answers no threads; the file is not rewritten
  range::tests::a_range_whose_threads_are_all_listed_logs_no_warning — catches an inverted is_empty check
  review::tests::a_thread_added_through_add_thread_comes_back_from_list_threads — list_threads equals
    ThreadAdded.list; id, file, line and note body round-trip
  review::tests::a_note_and_a_queue_change_the_listed_thread_and_unqueue_takes_it_back — add_note, then
    queue_message gives queued{text}, then unqueue_message gives notQueued
  review::tests::thread_commands_answer_the_store_s_refusals_as_their_kinds — EmptyMessage, UnknownThread and
    UnknownMessage reach the window as tagged errors
  review::tests::a_second_send_while_one_runs_answers_send_running — with the guard held, the real send_queue
    command answers SendRunning
  review::tests::a_send_guard_let_go_is_taken_again — a released guard can be taken again
  review::tests::each_progress_reaches_the_window_s_channel — forward_progress sends {"done":2,"of":3} to the
    call's Channel
  review::tests::each_review_error_has_its_kind_and_a_write_failure_names_the_file — the IpcError mapping for
    every new kind (WriteFailed, UnknownRangeFile, UnknownThread, UnknownMessage, EmptyMessage, MessagePending,
    SendRunning)
  review::tests::a_start_only_review_error_is_its_line — NewerFormat maps to Git with its line

smoke_evidence
  cargo fmt --check → fmt-ok
  cargo clippy --workspace --all-targets -- -D warnings → Finished `dev` profile … (no warnings)
  cargo test -p yamt-app → test result: ok. 116 passed; 0 failed (lib), 5 passed (other target)
    (filtered run: all 16 range::/review:: tests ok, the 11 above included)
  cargo test -p yamt-review → 31 / 10 / 15 passed, 0 failed
  just arch-check → arch-check: ok
  Real app (debug build, XDG_DATA_HOME=/tmp/rv-shell/data, repo from scripts/range-repo.sh /tmp/rv-shell/repo):
    timeout 10 xvfb-run -a target/debug/yamt --diff=main...feature --repo /tmp/rv-shell/repo
      → exit=124: the window stayed open until the timeout killed it; pair lock created under yamt/range/…/
      (only that it stays up — the page content was not looked at)
    threads.json in that pair folder written by hand as `{"format":1,"nextThread":`, same command →
      yamt: the review threads /tmp/rv-shell/data/yamt/range/repo-44a6a337eb346d6b/531ea52dfb892e20206010fb6cd6161d9c88964a-9c1ba3fc606a3776061d23006b83e2af2a357112/threads.json cannot be read: EOF while parsing a value at line 1 column 25; nothing was changed
      exit=2
      cmp <threads.json> /tmp/rv-shell/before.json → cmp: identical

deviations_from_brief
  - crates/review/src/lib.rs: added `pub use yamt_gitio::Glab;` (Main granted the file). The file now has it
    after the `crate::` re-exports.
  - src-tauri/src/lib.rs: added `mod review;` (Main granted the file).
  - commands.rs specta_builder went over clippy's 40-line limit with the 7 new entries; added
    #[expect(clippy::too_many_lines, reason = "one line per command of every window")].
  - list_threads keeps the fixed signature Result<ThreadList, IpcError>, although listing cannot fail. It carries
    #[expect(clippy::unnecessary_wraps)], as compare.rs open_compare does.
  - range.rs tests module is now `pub(crate) mod tests`, and RangeWindow/open_range_window are pub(crate), so
    review.rs tests reuse the range mock window. RangeState fields range/threads/sending are pub(crate) for
    review.rs.
  - The new error mappings are tested in review.rs, not ipc_error.rs, to keep ipc_error.rs near the 400-line limit.
  - Glab::find() runs at every check_gitlab/send_queue call, so a glab installed while the window is open is
    picked up.
  - Lock order: plan row #117 says "taken in that order" (threads, then the send guard). As built, a send takes
    the send guard first with try_lock, holds it for the whole send, and yamt_review::send_queue locks threads
    only between glab calls. The guard is never waited for (try_lock), so this cannot deadlock. The RangeState doc
    and AGENTS.md describe this order.

open_risks
  - src-tauri/src/ipc_error.rs is about 417 lines, over RS6's 400 (it was 384 before). Splitting it needs a file
    outside Owned, e.g. src-tauri/src/ipc_error/tests.rs.
  - review.rs check_gitlab and the send_queue path past the guard only run with a real glab on PATH. No test drives
    them through the fake glab, because PATH is process-wide. A mutant replacing the check_gitlab body may survive;
    the progress forwarding is covered through forward_progress. `just mutants` was not run.
  - frontend/src/ipc/bindings.ts is not regenerated (it belongs to the orchestrator); `just bindings` is needed
    before row 19.
```

Checks for you to run: `just bindings` (then `just bindings-check`), `just check`, and `just mutants` on src-tauri/src/{review,range,ipc_error}.rs.