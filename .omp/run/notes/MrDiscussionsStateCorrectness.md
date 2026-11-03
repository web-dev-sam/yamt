# MrDiscussionsStateCorrectness

Agent output (`agent://MrDiscussionsStateCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsStateCorrectness.md), collected 2026-11-03T15:22:58.057Z.

{
  "verdict": "fail",
  "checked": [
    "Queue rules 1,2,3,5,6 traced by hand: one call at a time, generation drops stale answers (refresh_swap test fails without the check), off drops in-flight (RK61). Log has counts only.",
    "Resend-loop risk accepted: Rust's non-empty prefix is pinned by discussions.rs batch() and its test. listed/replaced on the slice accepted: the brief says 'the spread'.",
    "Survivors vs VF7 accepted: :87, :128, :135, :155 and fixture :42/:75 are (a) equivalent; fixture text literals :33-38 are (b), asserted by the named vitest test.",
    "Wiring: received→listed only for unbuffered loads; ended→replaced only at the buffered swap (tested). windowMergeRequests reads settings; compare and range stores pass it.",
    "settings.ts: discussionDetails is stored, compared and adopted (4 tests). tauri and fixture setters are tested. toRowDiscussions names the bad time, page or iid (tests).",
    "Fixture follows the brief: mixed and sam-only rows, markup, 400-char line, pageless rows, 10-iid prefix after 400 ms. Deviations accepted. No test run: findings come from reading."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestDiscussions.ts",
      "line": 133,
      "severity": "block",
      "rule_id": "R-design-1.6",
      "problem": "Each call sends the whole queue, but Rust answers only 20 rows, so `unsentDropped` treats nearly every queued row as 'sent'. After a switch to \"lazy\" during a full load, the queue keeps calling glab until every unhovered row is read (≈15 calls for 300 rows). Design §1.6 lazy asks only hovered rows, and test :291 pins the resend.",
      "fix": "Under \"lazy\", when a call that began before the switch settles, delete its unanswered iids' loading entries and queue items (hover asks them again). Change test :291 to expect no further call."
    },
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 170,
      "severity": "block",
      "rule_id": "R-design-1.7",
      "problem": "When a first load's list call fails, the rows are cleared but the discussion entries and the running queue stay. The next load is unbuffered, so `replaced` never runs: rows whose details failed (e.g. WorkerStopped) keep 'failed' and are never asked again, and the queue keeps asking for rows no longer shown. This breaks 'details live as long as the rows'.",
      "fix": "Call `state.discussions.replaced([])` where the failed first load clears `state.rows`. Add a mergeRequests.test case: first load fails after a page, then show() again, and the open rows are asked again."
    }
  ]
}
