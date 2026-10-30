# Slice FlakyServerStopTest — a server-run test races its own forwarder

Owner #1763: "now ubuntu CI failed" (run 41027971763 at `0244397`; macOS and Windows green). Side branch
`fix/flaky-server-stop-test` off `main` (the pre-release is tagged on `main`; this lands after it). The Ubuntu job
passed in about 29 of the last 30 runs; nothing in the test, `src-tauri/src/servers.rs` or `crates/pipe` changed since
0.6.0-beta.1.

**#1763** `src-tauri/src/servers.rs:248-260` `a_run_whose_page_refuses_its_events_stops_at_its_next_output` fails at
`assert!(!is_alive(pid))` after its 10 s wait. Race, by reading: `start_cat` runs `sh -c 'echo $$ >&2; exec cat'`; the
pid line arrives as a stderr `Log` event; the test's channel hands it to the test and then refuses it, so `forward`
(`servers.rs:57`) returns and drops the receiver — the product's "a run stops at its next output once the page cannot
take its events" (`crates/pipe/src/run.rs` `read_messages`: `events.send(..).is_err()` → `StopReason::EventsGone`).
The test sends "anyone there" right after it received the pid line. If `cat`'s echo reaches `read_messages`'
`events.send` before the forwarder thread has dropped the receiver, that send succeeds into the channel's buffer, the
run waits for an output that never comes, and `cat` lives on past the deadline.

Fix the test only, keeping what it pins (a run whose page refuses its events ends at its next output, without a stop
request): while waiting for the process to end, keep giving it something to answer (e.g. send a message on each poll
before sleeping), so an output always follows the receiver's drop. Do not change product code; if you find the product
can leave a run alive in a way a user could hit, say so in `open_risks` instead.

## Target

Owned: `src-tauri/src/servers.rs` (the `run_tests` module only). Read-only: everything else.

## Acceptance

- Failing before, passing after, on Linux: widen the window to show the race is the cause (e.g. one run with a short
  `thread::sleep` added in `forward` before it returns, or in the test's channel closure before it answers `Err`) —
  the test fails with the old body and passes with the new one under the same delay; then remove the delay. Paste
  both.
- `cargo nextest run -p yamt-app servers` passes 50 times in a row (`--retries 0`, a loop), `just clippy` and
  `cargo fmt --all --check` clean.

## Skills

`skill://rust-conventions`, `skill://verification` (plus your autoloaded ones).
