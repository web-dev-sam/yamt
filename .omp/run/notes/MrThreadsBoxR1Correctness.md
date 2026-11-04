# MrThreadsBoxR1Correctness

Agent output (`agent://MrThreadsBoxR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBoxR1Correctness.md), collected 2026-11-04T17:00:25.202Z.

{
  "verdict": "fail",
  "checked": [
    "#2383/#2389/#2395/#2396 fixed: keepFocus (field, or panel in Preview) runs before send/resolve; publish() focuses the panel before submitReview, so Escape reaches the panel. Smoke: d02, d03 Preview, Submit.",
    "#2379/#2384/#2390 fixed: onBeforeUnmount runs boxClosedHere when open (closeThread if shown, boxClosed); watchers stop at unmount, so no double call. Off-return smoke: no box. Open risk 3 (fixture count) accepted.",
    "#2385 fixed: pre-flush watch(thread iid) calls close(held) while A's panel has focus, so focusInside goes false; watch(open) runs boxClosed(637) only. A switch within one iid does not close the box.",
    "#2392/#2397: a_press_on_a_list_refresh_keeps_a_pinned_box fails without the closest() exemption and still checks an outside press closes. #2378 script order fixed. #2380 isUser is plain boolean.",
    "#2387: the Me and Anna review orders equal design table rows 203-204; the asking test fails if ASKED is emptied. The Draft All !606 shift is accepted (B5; doc is the keeper's). Open risk 4 accepted.",
    "Survivors per VF7: :54 static, (b) per #732 with pinning tests; :92 and discussions.ts:58 equivalent; useHoverBox:134/136 are the earlier round's 131/133. .vue not mutated. No test run."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestsView.vue",
      "line": 111,
      "severity": "block",
      "rule_id": "RK73",
      "problem": "With the #2392 fix, a list Refresh leaves the panel open but moves focus to the page's Refresh button, or to BODY once `:disabled=\"loading\"` applies. The next Escape reaches the page's window escapePressed → goBack, which leaves the page. Request C2 says Escape closes the panel first (the implementer's open risk 2).",
      "fix": "While `thread` is set, have escapePressed leave Escape alone, as it does for `description`. Have MergeRequestThread close on an Escape nothing else handled, via a window listener like MergeRequestDescription. Add 'Refresh, then Escape → panel closes' to verify step 10."
    },
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 194,
      "severity": "block",
      "rule_id": "RK73",
      "problem": "Retry is removed when the thread switches to loading. Its focus drops to BODY with no focusout, which also leaves the hover box's focusInside stale. The next Escape then reaches the page and leaves it instead of closing the panel. This is the #2383 defect class, left as open risk 1.",
      "fix": "Route the Retry click through a `retry()` that calls focusPanel() before retryThread(), as publish() does (the window-level Escape from the first finding would cover it too). Add Retry to verify step 10's focus list."
    }
  ]
}
