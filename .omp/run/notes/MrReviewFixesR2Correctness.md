# MrReviewFixesR2Correctness

Agent output (`agent://MrReviewFixesR2Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesR2Correctness.md), collected 2026-11-05T00:30:57.188Z.

{
  "verdict": "fail",
  "checked": [
    "keptInPlace: held rows go back at their old index in ascending order. An index past the end appends (accepted risk). Rows match by identity from next. With nothing held the result is next, so release applies the new order.",
    "Filters: passing = matching ∪ held, so a held row stays shown (rule 9). Vue 3.5.43 computed(previous) is undefined on the first run, then the last Ordered.",
    "Tests: test 1 (:323) fails without the box hold (still first after closeThread) and without keptInPlace. Test 2 (:342) pins index 1 against next's 3. Neither passes with the feature deleted.",
    "Survivor {kind:\"none\"}→{}/{kind:\"\"} is VF7(a) equivalent: reviewOrder.ts:71-80 maps non-read kinds to NO_TURNS, and loading counts only kind==='loading'.",
    "Releases: a dropped row or page leave unmounts the row, and onBeforeUnmount runs boxClosedHere. A refresh keeps rows mounted (MergeRequestsView.vue:84). The thread hold is derived from threads.thread.",
    "Accepted: the people hold now keeps its index (one rule, heldOf). The .vue wiring is checked by WebKit smoke only (box=1→0), like the people tests. No bash test was run."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestDiscussions.vue",
      "line": 119,
      "severity": "block",
      "problem": "Resolving a row's last discussion in the panel, then pressing Reload (count→0, mergeRequestDiscussions.ts:84), then closing the panel makes `boxed` false. The span is removed but `open` stays true: removal fires no pointerleave or focusout (useHoverBox.ts:67). `discussionsBoxClosed` never runs, so the row stays at its index and past filters until a scroll.",
      "fix": "Close the box when it can no longer render, e.g. `watch(boxed, (now) => { if (!now && open.value) close(); })`. `open` then turns false and `boxClosedHere` calls `discussionsBoxClosed`.",
      "rule_id": "R2 #2476 stuck hold"
    }
  ]
}
