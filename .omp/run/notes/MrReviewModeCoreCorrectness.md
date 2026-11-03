# MrReviewModeCoreCorrectness

Agent output (`agent://MrReviewModeCoreCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModeCoreCorrectness.md), collected 2026-11-03T18:31:48.599Z.

{
  "verdict": "pass",
  "checked": [
    "reviewOrdered traced by hand on every reviewOrder.test.ts case: byDueDate first, first failed row in normal order (after a loading row), firsts stay in normal order, rest sorted by waiting (stable), loading counts loading rows only.",
    "Tests catch removal: waiting-sorted firsts fail tests 1/2, unknown author as waiting fails test 7, counting none rows fails loading:2, and deleting the gate or watch fails the mergeRequestFilters RK62 tests.",
    "Rules 2/3/5/6/7: reviewing keeps search, edits keep review, NO_FILTERS ends it, review gated to null unless full, the watch writes once via set, one viewer drives box and order, refused/failed map to failed.",
    "RK55/RK62: review key only when set, key order tested; reviewFrom safe on none, user:, not:me, numbers, arrays, null. The queue marks every counted row loading, so the loading count is right.",
    "Kept survivors (VF7): NO_FILTERS, WAITING_TEXT, NO_TURNS are (b), killed by web-test (NO_TURNS {} gives NaN ties: [1,3,2,5,4] fails). Shown:56 is (a), the core ignores other kinds. rowReply defaults unreachable.",
    "Accepted: rowReplyText moved unchanged (comm shows only imports differ); watch has no immediate (design §1.7); WebKit step 4 matches the turn rule (sam=me wrote both); ui/AGENTS.md deferred. No test run."
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrReviewModeCore.survivors.txt",
      "line": 1,
      "severity": "nit",
      "rule_id": "VF7",
      "problem": "The header reports 32 survivors, but only about 9 are listed, with no 'others not on changed lines' note like earlier slices have. [INFERENCE] The new REVIEW_MODE constant (mergeRequestsText.ts:59) is a module-level survivor on a changed line that is not listed. Nothing grows harder; the orchestrator just cannot audit the rest.",
      "fix": "List REVIEW_MODE as gate-covered (asserted by \"review mode's button is named as the request names it\") and add 'others on unchanged lines' to the header."
    }
  ]
}
