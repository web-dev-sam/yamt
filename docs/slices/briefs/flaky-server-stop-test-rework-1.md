# Slice FlakyServerStopTestR1 — wait for the drop instead of sending on every poll

Branch `fix/flaky-server-stop-test`. Round 1 `a582381` (brief `docs/slices/briefs/flaky-server-stop-test.md`, report
`agent://FlakyServerStopTest`) moved `send_to_server` into the poll loop; review `agent://FlakyServerStopTestCorrect`:

**#1764 (should, promoted)** `src-tauri/src/servers.rs:256`. With a send on every poll the test passes for the wrong
reason: if the supervisor ignored `StopReason::EventsGone`, the reader would have returned, the next echo would hit a
closed stdout, `cat` would die of SIGPIPE (std resets SIGPIPE to SIG_DFL in the child) and `try_wait` would reap it as
`ExitedByItself`. So the test no longer proves yamt's own stop "at its next output".

Fix: after `pid_of(&next(&events))`, wait until `events.recv_timeout(WAIT)` returns
`Err(RecvTimeoutError::Disconnected)` — the forwarder thread's closure drops `receiver` and then the `Channel`, whose
closure holds the test's `Sender` (check the capture and drop order in `start_server`/`forward` and say what you found;
if the order does not guarantee the receiver is gone first, find another deterministic signal and say which). Then send
one message and poll without sending, as the original test did.

## Target

Owned: `src-tauri/src/servers.rs` (the `run_tests` module only). Read-only: everything else.

## Acceptance

- Under round 1's temporary 300 ms delay in `forward`, the new body passes; with a temporary change that makes the
  supervisor ignore `EventsGone` (or `read_messages` keep reading after a send error), the new body **fails** and round
  1's body passes (paste all three); remove both temporary changes.
- 50 runs of `cargo nextest run -p yamt-app --retries 0 servers` pass; `just clippy`, `cargo fmt --all --check` clean.

## Skills

`skill://rust-conventions`, `skill://verification` (plus your autoloaded ones).
