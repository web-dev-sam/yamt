```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": null,
      "file": "crates/pipe/src/frame.rs",
      "line": 111,
      "problem": "Every `Framing::Lines` message is copied once more than it needs to be. `String::from_utf8(bytes.to_vec())` copies the bytes `bounded_line` has already gathered, so each agent JSON line is allocated twice, and a 64 MiB line briefly needs about 128 MiB of capacity plus a 64 MiB copy. The house rule says compiled code has no avoidable copies. As agent traffic grows this costs one extra allocation per message and nothing else.",
      "fix": "Take the line by value: add `Line::into_message(mut self) -> Vec<u8>`, which pops a trailing `\\r` when `!self.cut`, then call `String::from_utf8(line_bytes)` with no `to_vec()`. Keep the `cut || len > MAX_MESSAGE_BYTES` check before it."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "crates/pipe/src/frame.rs",
      "line": 288,
      "problem": "Inside yamt-pipe, nothing pins the 8 KiB stderr cut to a number: `log_lines_lose_their_line_break_and_a_long_one_is_cut_at_8_kib` uses `MAX_LOG_LINE_BYTES` itself, so survivor `frame.rs:5:37` (`8 * 1024` → `8 + 1024`) passes. Only lsp-host's `tests/run.rs:153` kills it. If that suite is cut down later (the boundary review proposes it), the agent's log cut becomes unguarded.",
      "fix": "Write the test with the literal: `let long = \"y\".repeat(8 * 1024 + 5)` and `assert_eq!(cut, \"y\".repeat(8192))`."
    },
    {
      "severity": "nit",
      "rule_id": null,
      "file": "crates/pipe/tests/lines.rs",
      "line": 129,
      "problem": "`split ü→世界 split` is 17 bytes, and line-echo splits it at `len / 2` = byte 8, which falls between 世 and 界. So the pipe test never splits inside a character, although the implementer notes claim it does. A reader that decodes each chunk separately is still caught, but only by the unit test `lines_read_back_one_byte_at_a_time_without_their_line_ends`.",
      "fix": "Pick a text whose midpoint falls inside a character, e.g. `split é→x` (6 bytes, split at byte 3, inside →), and expect `é→x`."
    }
  ],
  "survivors": [
    {"mutant": "crates/pipe/src/bin/line-echo.rs:90:67 replace / with % in answer", "verdict": "drop", "why": "(a) equivalent: this is a mutant in the test program. `17 % 2 = 1` still answers in two writes (the split lands inside ü), and the reader puts any split point back together. The test cannot see where its input was split."},
    {"mutant": "crates/pipe/src/bin/line-echo.rs:138:5 replace replace_with with Ok(())", "verdict": "drop", "why": "Windows-only: this is the `#[cfg(not(unix))]` `replace_with`, compiled out on Linux. On Windows no test sends `close-stderr`/`close-stdout`, because those tests are `#[cfg(unix)]`, so it is equivalent there too."},
    {"mutant": "crates/pipe/src/frame.rs:5:37 replace * with +", "verdict": "drop", "why": "(b) gate-covered. Line 5 col 37 is `MAX_LOG_LINE_BYTES = 8 * 1024`, not the 64 MiB cap the boundary review linked it to. `just test` kills it through `crates/lsp-host/tests/run.rs:153` `stderr_lines_arrive_as_log_lines_and_a_long_one_is_cut_at_8_kib`, which uses the literal `LOG_LINE_BYTES = 8 * 1024`. The crate-local kill is nit 2."},
    {"mutant": "crates/pipe/src/program.rs:94:30 replace || with && in find_with", "verdict": "drop", "why": "(a) equivalent on unix, where `MAIN_SEPARATOR == '/'` and `a || a == a && a`. On Windows, `a_program_with_a_separator_is_taken_relative_to_the_project_only` (`bin/tool.cmd` has no `\\`) kills it in the CI windows job."},
    {"mutant": "crates/pipe/src/program.rs:172:5 replace runnable with None", "verdict": "drop", "why": "Windows-only: the `#[cfg(windows)]` `runnable`, not compiled on Linux. On Windows every lookup test that expects `Ok` kills it, e.g. `windows_skips_a_file_without_an_extension`."},
    {"mutant": "crates/pipe/src/program.rs:172:5 replace runnable with Some(Default::default())", "verdict": "drop", "why": "Windows-only, as above. On Windows, `a_program_with_a_separator_is_taken_relative_to_the_project_only` expects a real path and kills it."},
    {"mutant": "crates/pipe/src/program.rs:182:5 replace windows_candidates with vec![]", "verdict": "drop", "why": "Windows-only (`#[cfg(windows)]`). Killed on Windows by `windows_tries_each_pathext_extension_unless_the_name_has_one`."},
    {"mutant": "crates/pipe/src/program.rs:182:5 replace windows_candidates with vec![Default::default()]", "verdict": "drop", "why": "Windows-only. Killed on Windows by `windows_tries_each_pathext_extension_unless_the_name_has_one`, which compares the exact candidate list."},
    {"mutant": "crates/pipe/src/program.rs:183:65 delete ! in windows_candidates", "verdict": "drop", "why": "Windows-only. Killed on Windows by `windows_tries_each_pathext_extension_unless_the_name_has_one`: `.COM;.CMD;;` would give the empty extensions and lose `.com`/`.cmd`."},
    {"mutant": "crates/pipe/src/run.rs:220:74 replace < with <= in supervise", "verdict": "drop", "why": "(a) equivalent: `Instant::now() <= drained` differs from `<` only when now equals the deadline to the nanosecond. At most one extra 20 ms poll happens before `Exited`, and order and content stay the same."},
    {"mutant": "crates/pipe/src/run.rs:243:26 replace < with <= in exit_code", "verdict": "drop", "why": "(a) equivalent: at most one more `try_wait` at exactly the 2 s deadline, then the same kill. No observable change in code or timing."}
  ],
  "checked": [
    "Language servers behave as before the move. `Host::start` passes `Framing::ContentLength` (lsp-host/src/lib.rs:101). The bytes written are the same: `format!(\"Content-Length: {}\\r\\n\\r\\n{message}\", message.len())` matches the old header plus body. `read_frame`'s `!usize::try_from(length).is_ok_and(|l| l <= MAX)` equals the old `length > MAX` on 64-bit, and `TooLarge` still carries the u64. Header lines go through `Line::text()` (strip `\\r` when not cut, lossy), the same as the old `line_of`. The TooLarge/Broken log texts are unchanged (run.rs:164-172). `Frame::Dropped` is produced only by `read_line_message`. `git show --stat 7b820f8` lists no change under `crates/lsp-host/tests` or `lsp-echo.rs`.",
    "The 64 MiB value is pinned by literals in `a_length_above_64_mib_is_too_large_and_64_mib_is_read` (frame.rs:248: 67108865 is TooLarge, 67108864 is read). That kills mutants of `MAX_MESSAGE_BYTES` (line 4; none survived). The boundary review's finding 2 cites `frame.rs:5:37` as the 64 MiB constant, but that line is `MAX_LOG_LINE_BYTES`. Its point that the log text and the constant are separate still holds on its own.",
    "Lines cap, traced by hand: `bounded_line(…, MAX+1)`. A line of exactly MAX bytes plus `\\r` stores MAX+1 bytes, is not cut, and is MAX after the strip, so it becomes a Message. MAX+1 bytes with no `\\r` is not cut but longer than MAX, so it is Dropped. MAX+2 bytes or more is cut and Dropped. A cut line ending in `\\r` is Dropped anyway. `room = max - bytes.len()` never underflows (`bytes.len() <= max`). `a_line_of_64_mib_is_read_also_with_a_carriage_return_and_a_longer_one_is_dropped` covers all three and would fail for `>=` at line 105, for `max` without the `+ 1` at line 99, and for a dropped `!self.cut`.",
    "Lines CRLF: only a trailing `\\r` is removed. `a_carriage_return_inside_a_line_stays` (`a\\rb\\r\\r\\n` gives `a\\rb\\r`) catches a `trim_end_matches('\\r')`. Through the pipe, `a_crlf_line_end_is_not_part_of_the_message` catches a reader that keeps the `\\r`.",
    "Lines multi-byte body: `a_line_message_comes_back_whole_with_a_multi_byte_body` fails if Lines is replaced by Content-Length framing on either side, since line-echo would echo the header line. A split inside a character is covered by `lines_read_back_one_byte_at_a_time_without_their_line_ends` (one byte per read over `世界`).",
    "Last line without a newline: `bounded_line` returns `Some` at EOF when `read_any`, then `End`. Unit test `lines_read_back_one_byte_at_a_time_without_their_line_ends` covers `last without an end` followed by `Frame::End`. Empty lines `\\n` and `\\r\\n` are skipped (same test).",
    "Non-UTF-8: `a_line_that_is_not_utf8_is_dropped_with_a_log_line` fails for a lossy reader (a Message where a Log is expected), for a silent drop (`after` arrives as the first event, so `next_log` panics) and for a stop (`after` never arrives). The unit test checks that the next line is read.",
    "A line over the cap: `a_line_over_the_cap_is_dropped_with_a_log_line_and_the_next_one_arrives` fails if there is no cap (a 64 MiB+1 Message), if the program is stopped (no `after`, no `still here`) or if the next line is lost.",
    "Lines writer: `a_written_line_is_the_message_and_one_line_feed` pins `\\n`, not `\\r\\n`. line-echo's `lines()` would accept `\\r\\n`, so the unit test is the one that catches that.",
    "`Exited` once and last: `events_until_exited` asserts `Disconnected` after `Exited` (catches a second Exited). `stderr_lines_written_after_the_program_exited_all_come_before_its_exited` (1000 burst lines before Exited) catches an Exited sent before the drain. `exited_comes_once_and_last_with_the_code` pins code 7. `wait_returns_after_exited_was_sent` pins Exited as the last event after `wait`.",
    "Stop/kill timing: in `supervise`, Close goes to the writer, then `exit_code` (2 s grace), kill, reap, then the readers drain for up to 1 s, then Exited. `stop_closes_stdin_and_a_cooperative_program_exits_once_within_the_grace` (under 2 s, code 0, a second stop and a send after the end are harmless, pid gone). `stop_kills_a_program_that_ignores_it_after_the_grace` (at least 2 s, `None` on unix, pid gone). `a_program_whose_child_holds_its_output_exits_after_at_most_the_drain` (under 2 s with the orphan holding the pipes). `a_program_that_closes_its_stdout_is_stopped_through_its_stdin` (the OutputClosed stop).",
    "The Dropped path reaches the window as `HostEvent::Log { line: \"yamt: dropped …\" }`. A failed send there returns `EventsGone`, like a Message (run.rs:157-177). `a_dropped_event_receiver_stops_the_run_at_its_next_output` covers the EventsGone stop.",
    "Dropping a `Running` without `stop` leaves the program running: reader threads hold `stop` clones, and the supervisor holds a `writes` clone. This behaviour predates the move. The second user, `crates/agent/src/workspace.rs:83,89,120-121`, always calls `stop()` and `wait()`, so this is not a finding.",
    "The implementer's open risk about a `\\n` inside a Lines message was accepted, as in the boundary review: the caller sends serialized JSON. Their memory and CI-time risk for the 64 MiB tests was accepted: the bound is roughly 400 MiB, below the 4 G cap per test binary from RK27.",
    "The risk register lists no row owned by `lsp-host` or `pipe` (RK1–RK27), so none needs a proving test from this slice.",
    "Read-only review: I ran no tests. No `block` depended on a run."
  ]
}
```