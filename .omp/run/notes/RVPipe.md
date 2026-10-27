**summary**
- There is a new crate `crates/pipe` (`yamt-pipe`). It holds the process core that used to live in `yamt-lsp-host`: `Running` with its four threads, the framing code, and the program lookup `find` with its `plain_name` rule. `Running` and `find` are now public.
- A second framing, `Framing::Lines`, is added beside `Framing::ContentLength`. Outgoing messages are written as `message + "\n"`. Incoming text is read one line per message: a trailing `\r` is removed and empty lines are skipped. A line over 64 MiB or one that is not UTF-8 is dropped with a `Log` line, and reading carries on with the next line.
- `yamt-lsp-host` now uses `yamt-pipe` and always starts with `Framing::ContentLength`. It re-exports `HostEvent`, `ProgramFolders`, `ProgramFound` and `ProgramPlace`. Its own public API is unchanged, and so are `src-tauri` and `bindings.ts`.
- New test program `src/bin/line-echo.rs`, and `scripts/arch-check.sh` gains a rule for each crate's allowed dependencies.

**files_changed**
- `crates/pipe/Cargo.toml`, `crates/pipe/AGENTS.md`, `crates/pipe/src/lib.rs`, `crates/pipe/src/run.rs`, `crates/pipe/src/frame.rs`, `crates/pipe/src/program.rs`, `crates/pipe/src/bin/line-echo.rs`, `crates/pipe/tests/lines.rs` — all new
- `crates/lsp-host/Cargo.toml`, `crates/lsp-host/AGENTS.md`, `crates/lsp-host/src/lib.rs`, `crates/lsp-host/src/files.rs` — changed
- `crates/lsp-host/src/run.rs`, `crates/lsp-host/src/frame.rs`, `crates/lsp-host/src/program.rs` — deleted (moved into `crates/pipe`)
- `scripts/arch-check.sh` — changed
- `Cargo.lock` — cargo regenerated it (outside `Owned`)

**tests_added**

`crates/pipe/tests/lines.rs`, every test going through `line-echo` with `Framing::Lines`:
- **`a_line_message_comes_back_whole_with_a_multi_byte_body`**: no bytes beyond ASCII are lost or re-encoded.
- **`a_line_split_across_two_writes_arrives_as_one_message`**: the split point can land inside a multi-byte character; it still arrives as one message.
- **`two_lines_in_one_write_arrive_as_two_messages`**: one read is not taken as one message.
- **`a_crlf_line_end_is_not_part_of_the_message`**: the `\r` is removed.
- **`a_line_over_the_cap_is_dropped_with_a_log_line_and_the_next_one_arrives`**: there is a cap, the program is not stopped, and the next line is not lost.
- **`a_line_that_is_not_utf8_is_dropped_with_a_log_line`**: no replacement characters are passed on.
- **`a_stderr_line_is_a_log_event`**
- **`exited_comes_once_and_last_with_the_code`**

Added so that mutants on the moved `run.rs` lines are caught by `yamt-pipe`'s own tests (the mutants recipe uses `--test-workspace=false`, so `lsp-host`'s tests don't count for them):
- `stop_closes_stdin_and_a_cooperative_program_exits_once_within_the_grace`
- `stop_kills_a_program_that_ignores_it_after_the_grace`
- `an_idle_program_keeps_running_and_answers_later`
- `is_finished_turns_true_once_the_run_has_ended`
- `wait_returns_after_exited_was_sent`
- `a_dropped_event_receiver_stops_the_run_at_its_next_output`
- `stderr_lines_written_after_the_program_exited_all_come_before_its_exited`
- `a_program_whose_child_holds_its_output_exits_after_at_most_the_drain` (unix only)
- `a_program_that_closes_its_stderr_keeps_serving` (unix only)
- `a_program_that_closes_its_stdout_is_stopped_through_its_stdin` (unix only): catches a lost `OutputClosed` stop
- `a_missing_folder_is_a_start_error`

New unit tests in `frame.rs`:
- `a_written_line_is_the_message_and_one_line_feed`
- `lines_read_back_one_byte_at_a_time_without_their_line_ends`
- `a_carriage_return_inside_a_line_stays`
- `a_line_that_is_not_utf8_is_dropped_and_the_next_one_is_read`
- `a_line_of_64_mib_is_read_also_with_a_carriage_return_and_a_longer_one_is_dropped`: checks the exact limit, with and without `\r`, and the cut path.
- `a_log_line_cut_right_after_a_carriage_return_keeps_it`

All the `Content-Length` and lookup unit tests moved unchanged into `frame.rs` and `program.rs`.

**smoke_evidence**
- `cargo test -p yamt-pipe -p yamt-lsp-host`:
  - `yamt_pipe` unit tests: `test result: ok. 25 passed` (all 7 old `Content-Length`/log-line tests and all 13 lookup tests among them)
  - `tests/lines.rs`: `test result: ok. 19 passed` (all 8 acceptance names listed as `ok`)
  - `crates/lsp-host/tests/files.rs`: `ok. 3 passed`
  - `crates/lsp-host/tests/run.rs`: `ok. 18 passed` (neither file was edited)
- `cargo fmt --all --check` → `FMT_OK`
- `cargo clippy --workspace --all-targets -- -D warnings` → `Finished `dev` profile`, no warnings
- `cargo build -p yamt-app` → `Finished `dev` profile`. `git status --short src-tauri frontend Cargo.toml` printed nothing, so `src-tauri` is unchanged.
- Bindings: `cargo run --quiet -p yamt-app --features bindings --bin export-bindings -- target/bindings-check.ts && diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts && echo IDENTICAL` → `IDENTICAL`. An earlier run with doc comments on the IPC types did produce a diff, which is why those types use `#[expect(missing_docs)]` (see below).
- `just arch-check` → `arch-check: ok`. Failing path checked by hand: fed fake dependency lists through both new filters, and they flagged `yamt-merge-core`, `tauri-utils` (pipe) and `yamt-gitio`, `serde_json` (lsp-host).

**deviations_from_brief**
- **Root `Cargo.toml` lines to add:** `"crates/pipe",` to `[workspace] members` (after `"crates/lsp-host",`) and `yamt-pipe = { path = "crates/pipe" }` to `[workspace.dependencies]`. Until then, `crates/lsp-host/Cargo.toml` uses `yamt-pipe = { path = "../pipe" }`, which makes the crate a workspace member on its own. Once the root lines land, this can become `yamt-pipe.workspace = true`.
- `Cargo.lock` gained a `yamt-pipe` entry; cargo writes it on build.
- `HostEvent`, `ProgramPlace` and `ProgramFound` have `#[expect(missing_docs, reason = …)]` instead of doc comments. specta copies doc comments into `bindings.ts`, which would break the "bindings unchanged" rule. All other public items are documented.
- Added (allowed by the contract):
  - `pub fn plain_name` in `yamt-pipe`, so `lsp-host/src/files.rs` uses the same rule instead of a copy.
  - `MAX_MESSAGE_BYTES` is now `usize` (was a crate-private `u64`); one constant serves both framings.
  - A private `Frame::Dropped { reason }` variant, logged as `yamt: dropped <reason>`. Not-UTF-8 text: `yamt: dropped a message that is not UTF-8`.
- `line-echo` has more commands than step 3 lists: `split`, `twice`, `crlf` (needed by the acceptance tests) and `--ignore-stop`, `burst`, `orphan`, `close-stderr`, `close-stdout` (needed by the extra tests). It also prints `line-echo pid <pid>` on start.
- `arch-check` also bans `serde_json` for `yamt-pipe`, the same as the existing `lsp-host` rule.
- `tracing` was dropped from `lsp-host`'s dependencies (no longer used), and the moved tracing text now says "program" instead of "language server". The window-visible log texts are unchanged.
- Not edited because they are read-only, but now out of date: the `lsp-host` entry in the project map (`.omp/skills/project-map/SKILL.md`), `docs/architecture.md` §3, and probably the `yamt-app` dependency list in `scripts/map-check.sh`. They need the new crate and its files.
- No test copies or execs a file it just wrote; the tests start the built `line-echo` where cargo put it, so the `place_echo` pattern wasn't needed.

**open_risks**
- I did not run `just mutants`. The tests are aimed at the moved `run.rs`, `frame.rs` and `program.rs` lines, but that is not proven.
- `crates/pipe/src/frame.rs` (test `a_line_of_64_mib_is_read_also_with_a_carriage_return_and_a_longer_one_is_dropped`): builds about 192 MiB in memory, plus copies, so peak use during a test run is roughly 400 MiB.
- `crates/pipe/tests/lines.rs` (`a_line_over_the_cap…`): sends a 64 MiB line through a real pipe. It takes under a second here, but could be slow on CI machines.
- `crates/pipe/src/frame.rs` `write_message`: `Lines` does not check for a `\n` inside a message. The brief puts this on the caller (JSON lines contain no raw newline).
- `scripts/arch-check.sh`: there is no committed test of the new rules' failing path; the script has no test harness and the existing rules have none either. I only checked the filters by hand, as above.