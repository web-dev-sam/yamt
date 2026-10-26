All four fixes are in. The language-server log texts and timings are unchanged, and `fmt`, `clippy`, the tests for the three crates and `arch-check` all pass. Nothing is committed.

```
summary                 The run's lifecycle is now tested only in crates/pipe/tests/lines.rs. lsp-host's tests/run.rs keeps
                        only what Host adds, and lsp-echo shrank to an echo plus `--ignore-stop`. Frame::Dropped now carries
                        DropReason::{TooLong, NotUtf8}. run.rs builds the drop log line from MAX_MESSAGE_BYTES / BYTES_PER_MIB,
                        so the text is still exactly "…more than 64 MiB", and line-echo's HUGE_LINE_BYTES is
                        yamt_pipe::MAX_MESSAGE_BYTES + 1. Line::into_message(mut self) pops a trailing `\r` when the line
                        was not cut; String::from_utf8 then takes that Vec without a to_vec() copy. The 8 KiB stderr cut is
                        pinned by literals in yamt-pipe's own unit test.

files_changed           crates/pipe/src/frame.rs
                        crates/pipe/src/run.rs
                        crates/pipe/src/bin/line-echo.rs
                        crates/pipe/AGENTS.md
                        crates/lsp-host/tests/run.rs
                        crates/lsp-host/src/bin/lsp-echo.rs
                        crates/lsp-host/AGENTS.md

tests_added             No new tests. Changed tests:
                        - frame.rs `log_lines_lose_their_line_break_and_a_long_one_is_cut_at_8_kib`: now uses
                          "y".repeat(8 * 1024 + 5) and expects it cut to "y".repeat(8192). Breaking MAX_LOG_LINE_BYTES to
                          8 + 1024 by hand made it FAILED; the constant was put back.
                        - frame.rs `a_line_that_is_not_utf8_is_dropped_and_the_next_one_is_read` and
                          `a_line_of_64_mib_is_read_also_with_a_carriage_return_and_a_longer_one_is_dropped`: expect
                          Frame::Dropped(DropReason::…).
                        - The literal TOO_LONG text in lines.rs ties the log line to the constant. Breaking BYTES_PER_MIB
                          to 1024 + 1024 by hand made
                          `a_line_over_the_cap_is_dropped_with_a_log_line_and_the_next_one_arrives` FAIL
                          (left "…more than 32768 MiB", right "…more than 64 MiB"); the constant was put back.
                        - lsp-host tests/run.rs keeps 8 tests: one Content-Length round trip, the 8 KiB stderr cut,
                          stop_all, stop_every, the two project refusals, missing folder/program, bare-name lookup.
                          Removed there, because lines.rs already covers them: split, twice, the cooperative stop,
                          ignore-stop kill, exit code, idle run, burst, orphan drain, close-stderr, dropped receiver.

smoke_evidence          cargo fmt --check → FMT-OK (no diff)
                        cargo clippy --workspace --all-targets -- -D warnings
                          → Finished `dev` profile [unoptimized + debuginfo] target(s) in 41.40s (no warnings)
                        cargo test -p yamt-pipe -p yamt-lsp-host -p yamt-agent
                          → agent checkout 12 passed; process 8 passed; sweep 4 passed
                          → lsp-host files 3 passed; run 8 passed (finished in 2.01s)
                          → pipe lib 25 passed; lines 19 passed; all others 0 tests, 0 failed
                        just arch-check → arch-check: ok
                        After putting both hand-made faults back: cargo test -p yamt-pipe → 25 passed, 19 passed

deviations_from_brief   - crates/lsp-host/AGENTS.md and crates/pipe/AGENTS.md were edited. The brief limits lsp-host to
                          "its tests, lsp-echo.rs and imports", but the old AGENTS.md text listed the removed lsp-echo
                          commands (burst, orphan, close-stderr). Both files now say the lifecycle is tested once, in
                          yamt-pipe's lines.rs; pipe's also names DropReason.
                        - lsp-echo also lost `exit`, `twice` and `split`. No remaining test used them; the frame-level
                          split and two-in-one-write cases are covered by frame.rs `frames_read_back_whole_also_one_byte_at_a_time`.
                        - The `huge` command in line-echo's header now says "over `MAX_MESSAGE_BYTES`" instead of
                          "over 64 MiB".
                        - The correctness review's third nit (the `split é→x` text in lines.rs:129) is not among the
                          brief's four items and was not done.
                        - `.omp/run/slices.json` was already modified in the tree before I started; it is not mine.

open_risks              - crates/lsp-host/tests/run.rs:39: start_echo calls pid_of on the first log line only to check
                          the "lsp-echo pid " prefix and throws the pid away. It reads a little oddly.
                        - The lsp-host suite no longer runs a lifecycle test through Host. That rests on Host::start
                          passing straight to Running::start (lsp-host/src/lib.rs, unchanged), which lines.rs covers.
```