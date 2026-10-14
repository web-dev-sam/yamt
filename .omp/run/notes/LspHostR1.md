# LspHostR1 (3.Y-host fix round 1)

Fix round 1 of 3.Y-host is finished: all eight findings are fixed, every acceptance check passes, `commands.rs` is down to 342 lines and `bindings.ts` is unchanged. I ran mutation testing on four of the six touched files rather than over the original diff, because the ownership hook blocked writing the diff file.

```
summary                 Fix round 1 of 3.Y-host (#905, #906, #909–#914). The mock-window test harness now has its own file,
                        `src-tauri/src/mock_window.rs`. `servers::manage` builds the host's state (`HostState`) and stops
                        every run when a page starts loading, using the new `Host::stop_every`. When a server's stderr ends,
                        the run no longer stops. `lsp-echo` gained `burst`, `orphan` and `close-stderr` (unix only), and new
                        tests now cover the parts that had no test: idle runs, the output drain and its 1 s cap, the frame
                        size limits, and the app's path between a run and the page.

files_changed           crates/lsp-host/src/run.rs, crates/lsp-host/src/lib.rs, crates/lsp-host/src/frame.rs,
                        crates/lsp-host/src/bin/lsp-echo.rs, crates/lsp-host/tests/run.rs, crates/lsp-host/AGENTS.md,
                        src-tauri/src/mock_window.rs (new), src-tauri/src/commands.rs, src-tauri/src/servers.rs,
                        src-tauri/src/lib.rs, src-tauri/AGENTS.md

tests_added             lsp-host tests/run.rs:
                        - an_idle_server_keeps_running_and_answers_later (#909): after 300 ms of silence the pid is still
                          alive and a later message is still echoed.
                        - stderr_lines_written_after_the_server_exited_all_come_before_its_exited (#910): 1000 stderr lines
                          (about 60 KB), written by a copy of the server 200 ms after the server itself exited, all arrive
                          in order before the single `Exited{Some(0)}`.
                        - a_server_whose_child_holds_its_output_exits_after_at_most_the_drain (#910, unix): a child that
                          keeps stdout/stderr open for 5 s still gets `Exited{Some(3)}` in under 2 s.
                        - a_server_that_closes_its_stderr_keeps_serving (#914, unix): the server keeps echoing after its
                          stderr is closed.
                        - stop_every_signals_each_run_and_returns_before_they_exit (#913): `stop_every` returns while a
                          server that ignores stop is still alive; both runs then exit once and leave no process.
                        lsp-host frame.rs:
                        - a_length_above_64_mib_is_too_large_and_64_mib_is_read now uses the literals 67108864 and
                          67108865 (#911).
                        - a_header_line_of_8_kib_is_read_and_a_longer_one_is_broken (renamed): an 8192-byte header line is
                          read, an 8193-byte one is refused (#911).
                        src-tauri servers.rs `run_tests` (unix; calls `start_server` directly with `Channel::new`; the
                        server is `sh -c 'echo $$ >&2; exec cat'`):
                        - a_run_s_messages_reach_its_channel_and_stop_ends_it_with_one_exited (#912): send → Message,
                          stop → one `Exited{0}`, then the channel closes and the pid is gone.
                        - a_run_whose_page_refuses_its_events_stops_at_its_next_output (#912): a channel that returns
                          `Err` ends the run after its next output.
                        - a_page_that_starts_loading_stops_the_runs_of_the_page_before (#913): `Finished` leaves the run
                          alone, `Started` ends it with `Exited{0}`.

smoke_evidence          Acceptance 1 — each new test failing before its fix (temporary edits, each reverted):
                        - #909, `!` deleted in wait_for_stop: `FAIL yamt-lsp-host::run an_idle_server_keeps_running_and_answers_later`
                          … `panicked at crates/lsp-host/tests/run.rs:202:5: assertion failed: is_alive(echo.pid)`
                        - #914, old behaviour (stderr EOF sends OutputClosed): `FAIL … a_server_that_closes_its_stderr_keeps_serving`
                          … `panicked at crates/lsp-host/tests/run.rs:72:43: exited with Some(0) before a message`
                        - #910, `drained = now - OUTPUT_DRAIN`: `FAIL … stderr_lines_written_after_the_server_exited_all_come_before_its_exited`
                          `left: Ok(Log { line: "lsp-echo burst 0 ----------------------------------------" }) right: Err(Disconnected)`
                        - #910, `&&`→`||`: `FAIL [5.021s] … a_server_whose_child_holds_its_output_exits_after_at_most_the_drain`
                          `panicked at crates/lsp-host/tests/run.rs:241:5`
                        - #913, `Started => {}`: `FAIL [10.152s] yamt-app servers::run_tests::a_page_that_starts_loading_stops_the_runs_of_the_page_before`
                          `panicked at src-tauri/src/servers.rs:205:35`
                        - #912, `forward` emptied: all three `servers::run_tests::*` FAIL,
                          `Summary 3 tests run: 0 passed, 3 failed`
                        Acceptance 2:
                        - `cargo nextest run -p yamt-lsp-host -p yamt-settings -p yamt-app` →
                          `Summary [2.266s] 131 tests run: 131 passed, 0 skipped`
                        - `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings` →
                          `Finished dev profile` with no warnings
                        - `cargo fmt --all --check` → `FMT_OK`
                        - `just arch-check` → `arch-check: ok`
                        - `just bindings-check` → no diff output, exit 0 (`BINDINGS_OK`)
                        - `wc -l src-tauri/src/commands.rs` → `342`
                        Acceptance 3 — `cargo mutants -f crates/lsp-host/src/{run,frame,lib}.rs -f src-tauri/src/servers.rs
                          --test-workspace=false -j 3` →
                          `115 mutants tested in 4m: 3 missed, 74 caught, 36 unviable, 2 timeouts`
                        Caught (line numbers are in the current files):
                          run.rs:217:20 `delete ! in wait_for_stop` (was 204:20); run.rs:204:34 `+`→`-`; 205:11 `delete !`;
                          205:56 `&&`→`||`; 205:74 `<`→`==` and `<`→`>`;
                          frame.rs:3:46 and 3:53 `*`→`+` and `*`→`/`; 5:40 `*`→`+` and `*`→`/`;
                          servers.rs:61:5 `forward`→(); 72:5 `send_to_server`→(); 79:5 `stop_server`→();
                          29:5 `stop_runs_on_page_start`→().
                        Timeouts (tests hang waiting for `Exited`): lib.rs:133 `stop_every`→(), run.rs:86 `Running::stop`→().
                        Missed: run.rs:205:74 `<`→`<=` and run.rs:228:26 `<`→`<=` (exact-instant boundaries that
                          change nothing); run.rs:90 `is_finished`→false (see open_risks).

deviations_from_brief   - #910 `burst N`: the lines are written by a copy of lsp-echo 200 ms after the server exits (stdout
                          null, stderr inherited), not by the server just before it exits. Written before the exit, the
                          lines drain from the pipe in about 1 ms while the exit is polled every 20 ms, so a test without
                          the drain would usually still pass. With the delay, the test fails every time without the drain.
                        - #910 `orphan`: the copy that holds the pipes sleeps 5 s, so a test process leaves it behind for
                          up to 5 s after the test.
                        - #911: renamed `a_header_line_without_end_is_broken_after_8_kib` to
                          `a_header_line_of_8_kib_is_read_and_a_longer_one_is_broken`, because the line now has an end. The
                          8192 bytes include the `\r`, i.e. everything before the `\n`.
                        - #906: took the second option, `servers::manage(builder, root)`, which builds `HostState` and
                          `with_session` calls. The #913 `on_page_load` registration is inside `servers::manage`, not
                          written out in `with_session`.
                        - #913: the mock runtime never fires page loads (tauri 2.12.1 test/mock_runtime.rs:644 `reload` is
                          `Ok(())`), so the test calls `stop_runs_on_page_start(&HostState, PageLoadEvent)` directly. The
                          one-line `.on_page_load(…)` wiring has no test.
                        - The app's unix-only run tests sit in a second module, `#[cfg(test)] #[cfg(unix)] mod run_tests`,
                          because clippy does not treat `#[cfg(all(test, unix))]` as test code and denied its
                          `unwrap`/`panic`.
                        - #914 is unix-only: `close-stderr` uses `CommandExt::exec` with stderr set to null (safe Rust; std
                          cannot close fd 2 without `unsafe`). On other platforms the command returns an error.
                        - Added a crate-level test for `Host::stop_every`, so a mutation of it fails a lsp-host test too.
                        - Acceptance 3: ran `cargo mutants -f` on the four touched files of the original patch instead of
                          `just mutants 347d6b3`. The ownership hook blocked writing the diff file (both `target/` and
                          `/var/tmp`). These four files are new in the patch, so mutating the whole files equals the diff.
                          `commands.rs` and `window.rs` were not mutated: there I only moved test code and changed one
                          call.

open_risks              - crates/lsp-host/src/run.rs:90: the `Running::is_finished`→false mutant survives. It only stops
                          `Host::start` from pruning finished runs from the map (memory, nothing visible), was not among
                          the named survivors, and is left as is.
                        - src-tauri/src/servers.rs:25: [INFERENCE] `PageLoadEvent::Started` fires only for full page
                          loads, not for same-page hash navigation. If a platform fires it for those too, the page's
                          servers would stop. The window has no router today.
                        - crates/lsp-host/tests/run.rs and src-tauri/src/servers.rs: the close-stderr, orphan and app run
                          tests are unix-only, so Windows CI does not cover those paths.
```