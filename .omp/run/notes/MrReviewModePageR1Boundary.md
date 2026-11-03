# MrReviewModePageR1Boundary

Agent output (`agent://MrReviewModePageR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModePageR1Boundary.md), collected 2026-11-03T19:05:41.768Z.

{
  "verdict": "fail",
  "checked": [
    "#2224 fixed: `typed`, its reset on opening, `narrows`/`shown`, the input and the container classes live only in MenuNarrowing.vue:16-55. Neither menu holds `typed`/`NARROW_FROM`/`narrowed` any more.",
    "Contract kept: both menus still expose opener/menu/narrowBox (MergeRequestFilter.vue:59-61, MergeRequestReviewMode.vue:30-32). MergeRequestsView.vue:69,120 reads them unchanged.",
    "Ownership: every changed file is in slices.json R1 owned. The VU15 sixth-component reason is given. MenuNarrowing has no comments, one job, and its `typed` is component-local (no new state row).",
    "Edges: MenuNarrowing imports only vue, ../mergeRequests (index) and ./mergeRequestsText. No root, lsp/ or internal/ import today.",
    "The SSR tests at MergeRequestFilter.test.ts:56-86 compare both menus' rendered markup. They test behaviour and are accepted. AGENTS.md wording matches the code."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestFilter.test.ts",
      "line": 89,
      "severity": "block",
      "rule_id": "house testing rule (#1492/#1493)",
      "problem": "The test 'both menus leave typing, narrowing and its reset… to MenuNarrowing' reads both components' source through `import.meta.glob(?raw)` and checks it with regexes. Tests must never assert source text (#1492/#1493 were blocks for the same pattern), and this test detects no named rule.",
      "fix": "Delete this test and `MENU_SOURCES` (lines 15-18). The SSR tests at lines 56-86 stay as the behavioural evidence that both menus render the same box."
    },
    {
      "file": "frontend/src/ui/MenuNarrowing.vue",
      "line": 1,
      "severity": "block",
      "rule_id": "PM10",
      "problem": "This page-only file imports mergeRequests/ and mergeRequestsText.ts but lacks the page prefix, so windowFence.ts SHARED_PAGE_FILE and mergeRequestTitles.test.ts both skip it. A later root or lsp/ import here would reach both windows through MergeRequestFilter without any fence firing.",
      "fix": "Rename it to `MergeRequestMenu.vue` (the orchestrator widens Owned) and update the two imports, the test name and ui/AGENTS.md. The PM10 fence and the titles test then cover it with no script change."
    }
  ]
}
