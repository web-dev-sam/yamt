# FlakyServerStopTest — notes (session 36)

Owner #1763: Ubuntu ci failed once at `0244397` (run 41027971763) on
`servers::run_tests::a_run_whose_page_refuses_its_events_stops_at_its_next_output`; untouched since 0.6.0-beta.1, ~29
of 30 earlier Ubuntu runs green. Branch `fix/flaky-server-stop-test` off `main` (the pre-release is tagged on `main`).

- Cause (proved): the echo of the test's one message could reach the run's event sender before the refusing page's
  forwarder dropped its receiver; the send landed in the buffer and no further output came. A 300 ms delay in
  `forward` makes the old test fail every time.
- Round 1 `a582381` (`FlakyServerStopTest`): send on every poll. Review #1764 (promoted): passes even if yamt ignored
  `EventsGone` (SIGPIPE kills cat).
- Round 2 `a990621` (`FlakyServerStopTestR1`): the refusing `channel_into` keeps a clone of the test's `Sender` in a
  thread-local until the forwarder thread exits (capture drop order is unspecified); the test waits for
  `Disconnected`, sends once, polls. Proofs: delay → pass; supervisor ignoring `EventsGone` → new body fails, round-1
  body passes; 50/50 runs; clippy, fmt clean. Re-check pass. Test-only; product unchanged.
