# MrThreadsBoxR2Correctness

Agent output (`agent://MrThreadsBoxR2Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBoxR2Correctness.md), collected 2026-11-04T17:18:15.295Z.

{
  "verdict": "fail",
  "checked": [
    "#2400/#2403 fixed: page leaves Escape alone while `thread` is set (View:111); panel's window listener closes it. Page listener registered first, so filter menu still wins. Smoke: Refresh+Escape closes panel, page stays.",
    "#2401/#2398 fixed: retry() (Thread.vue:119) focuses the panel before void `retryThread()`, so no BODY focus drop. #2399 fixed: `asking` uses the exported `mentionsIn`.",
    "Open risk 2 accepted: thread !== null means a panel is mounted. Only Discussions:100 calls showThread; boxClosedHere runs on box close and onBeforeUnmount (:117).",
    "d13 test fails if the failure is deleted, or the iid guard (636), discussion guard (d12 first), once flag (2nd read) or per-source flag (fresh rig) is wrong.",
    "Survivors: none on an R2-changed line. Rendering.ts:49 `\"\"` is equivalent only for fixture text ('@bo`x`b' differs); unchanged line, below the RV8 bar.",
    "Asking risk is real: RangeApp with AI asks keepAiChanges on a close request (WM/Alt+F4) over the pinned panel; CompareApp closeTab by keyboard too. Description has the guard (Description.vue:69)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 107,
      "severity": "block",
      "rule_id": "R2-regression",
      "problem": "Regression, no `asking` guard: a keepAiChanges question (range window close request with AI changes) opens over the shown panel. Escape closes the panel and calls preventDefault, which per ui/AGENTS.md:73 suppresses the modal dialog's cancel, so the question stays. Description.vue:69 guards this; the thread's copy of the rule does not.",
      "fix": "Pass `asking` (View → Row → Discussions → Thread, as the description gets it) and return early in keyPressed when it is true. Add 'question over the panel, Escape → question dismissed, panel stays' to verify step 10."
    },
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 107,
      "severity": "block",
      "rule_id": "R2-regression",
      "problem": "With the panel pinned, Tab to the row's description opener and press Enter: both panels are open. The thread's earlier-registered window listener takes an Escape inside the description, closes the thread and moves focus to the box. Before R2 that Escape closed the description.",
      "fix": "In keyPressed, also return while `description.value !== null` (from useMergeRequests), so the description's listener takes that Escape and the next one closes the thread."
    }
  ]
}
