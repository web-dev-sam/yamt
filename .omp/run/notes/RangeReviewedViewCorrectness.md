# RangeReviewedViewCorrectness

Agent output (`agent://RangeReviewedViewCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedViewCorrectness.md), collected 2026-11-19T10:12:28.613Z.

{
  "verdict": "fail",
  "checked": [
    "Ran `vitest run src/ui/useRangeController.test.ts` (the block depends on it): 4 failed, 32 passed. Error: `state.window.loadView is not a function` (rangeReviewed.ts:102), from the since tests.",
    "range.ts:161-165: a badge press still toggles; startsThreads false starts no drag. The new test repeats the control's 9→12 drag (:531 expects [ACROSS]), so it fails if the guard goes. Not run here (no WebKit); smoke saw no draft.",
    "viewParts rules are each asserted (listed true, threads [], startsThreads false, left=reviewed, right=current, note null, SINCE_NO_TEXT, viewKind). goTo clamps lines (goTo.ts:15-23), so no throw.",
    "Busy flash (risk 2) accepted: unmark goes filled→muted→outlined; mark goes outlined→muted→next file. Never filled→outlined→filled. busy also covers the first list load.",
    "Key `id:view` remounts only on whole↔since; reviewed↔none keep the key. List/tree mark goes through the #file slot; count = counted.",
    "Survivors: :287-295 no coverage = wiring seen in smoke (VF7 c), accepted. :198 flush and ipc/index.ts:214/218 are on unchanged lines (SP11), accepted."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/useRangeController.test.ts",
      "line": 577,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "The test's ReviewedWindow follows store R0 (`forget`, no `loadView`), not HEAD's R1 (af6d8193). So the three Acceptance since tests and the failed-load test fail at HEAD (4 failed, run here), typecheck breaks, and the reported runs were made against a tree that no longer exists.",
      "fix": "Pass `loadView` built from rangeVisited.ts `loadView` over a local visited/problem state and assert the failure through them. Then rerun typecheck, test and `just mutants`."
    },
    {
      "file": "frontend/src/ui/RangeView.vue",
      "line": 87,
      "severity": "should",
      "problem": "The since view's left-pane search rule (plan #196) is component-only and untested. If it regresses, a left hit silently selects a reviewed-text line using a base-text line number, and the since rules stay split between viewParts and the component.",
      "fix": "Move the rule into a pure function next to viewKind (e.g. `takesSearchMove(view, pane)`). Test since/left, since/right and whole/left, then call it from searchGoTo."
    },
    {
      "file": "frontend/src/ui/RangeApp.vue",
      "line": 141,
      "severity": "should",
      "problem": "[INFERENCE] startUp shows the first file before reviewed.load() answers (rangeStore.ts:270-273). A since first file mounts as whole, calls loadFile, then remounts as since. The user may glimpse the whole header or change, and any view state set up before the marks arrive is lost.",
      "fix": "In startUp, let reviewed.load() settle (ok or failed) before markShown(first), so the first view mounts with its final kind."
    }
  ]
}
