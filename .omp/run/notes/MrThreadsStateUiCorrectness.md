# MrThreadsStateUiCorrectness

Agent output (`agent://MrThreadsStateUiCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsStateUiCorrectness.md), collected 2026-11-04T15:46:14.007Z.

{
  "verdict": "fail",
  "checked": [
    "Reload (D1/D2/RK72): entry kept, reload `running`; only an open answer sets read and counted; a late answer after a refresh is dropped. The queue tests fail if any of this is removed.",
    "Marks (C10): threadRead replaces in place and adds or drops the mark; boxClosed counts the rest only with marks. Covered by a_resolved_row_stays… and closing_a_box_without_marks…",
    "Thread (C5/RK33/C9): the generation keeps old reads out (close-and-reshow test). A non-refused failure re-reads and blocks sends; a refusal reads nothing. Submit reloads the row only when sent.",
    "Slice (D3/C2): the reload hook and threadsRefreshed(null) are each pinned by a slice test (a reload of !636 does not re-read). Submit uses the queue's reload, so the thread is not read twice.",
    "Survivors: thread.ts:84 →true, :123, :213 and discussions.ts:96/157/148 are equivalent; mergeRequests.ts:138/208 are unchanged lines. Open risks #2 and #3 accepted; #1 is finding 1.",
    "Problem steps: all 7 words are tested. Preview: blank → empty with no call; a stale answer is dropped. I ran no tests: the blocks come from reading the code."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestThread.ts",
      "line": 136,
      "severity": "block",
      "rule_id": "RK33",
      "problem": "The window-wide `writing` flag is not in the state the panel reads, and `show()` resets `sending` to idle. A thread shown while another write runs looks ready, so its buttons are enabled, but a press silently does nothing. This breaks C8.3, and the panel slice cannot see the flag to fix it (open risk 1).",
      "fix": "Keep the running write as `{ shown, what } | null` and have `show` set `sending` from it, or expose it as a readonly ref in `Threads` for the button rule. Test that a thread shown during another thread's write reports it."
    },
    {
      "file": "frontend/src/ui/mergeRequestThread.ts",
      "line": 84,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "The `&&` → `||` survivor is not equivalent. With `||`, a write answered after the panel moved on puts its `sending: failed` and failure sentence on the thread now shown. No test fails, because the only switch-during-write test answers `sent` onto an idle thread; the reason given covers only the `→ true` mutant.",
      "fix": "Start a write on D1, show and read D2, answer the write `{ kind: \"failed\" }`, then assert D2's `sending` is still idle."
    },
    {
      "file": "frontend/src/ui/mergeRequestDiscussions.ts",
      "line": 240,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The `discussionsOf` threadRead forwarder (NoCoverage) is kept as \"(c) wiring\", but (c) needs a named smoke and this slice has none. Emptying it would make the slice's threadRead do nothing. Nothing calls it today, so nothing gets harder as the app grows.",
      "fix": "Add one `live.slice.threadRead(...)` assertion in mergeRequestReload.test.ts so the mutant is killed."
    }
  ]
}
