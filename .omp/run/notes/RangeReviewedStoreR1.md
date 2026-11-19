# RangeReviewedStoreR1

Agent output (`agent://RangeReviewedStoreR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedStoreR1.md), collected 2026-11-19T10:01:45.209Z.

{
  "summary": "`loadFile` and `reviewed.loadSince` now share one load rule, `loadView(state, entry, call, problem)` in `rangeVisited.ts`. On failure it drops the file's view and reports the problem; on success it clears the problem about that path. The store passes `loadView` to `createRangeReviewed` in place of `forget`, so a since failure followed by a since success clears the bar (#2547/#2549). `Visited` and `forget` are no longer exported (#2550). The public `RangeReviewed` API is unchanged.",
  "files_changed": [
    "frontend/src/ui/rangeReviewed.ts",
    "frontend/src/ui/rangeReviewed.test.ts",
    "frontend/src/ui/rangeStore.ts",
    "frontend/src/ui/rangeStore.test.ts",
    "frontend/src/ui/rangeVisited.ts"
  ],
  "tests_added": [
    {
      "name": "rangeStore.test.ts: a since load that failed and later succeeds for the same file clears its problem",
      "proves": "A since failure drops the view and reports. A since success for another file keeps that problem. A since success for the same file sets store.problem to null and the view mounts again; one error is logged."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused",
      "observed": "vue-tsc -b: no errors. oxlint --type-aware + eslint: no findings. oxfmt: \"All matched files use the correct format.\" knip: no findings."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  314 passed (314); Tests  4698 passed (4698)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → rangeReviewed.ts 72 killed / 1 survived; rangeStore.ts 115 / 6; rangeVisited.ts 46 / 0 (100%); total 97.08%",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The brief put the shared helper in rangeStore.ts; I put `loadView` in rangeVisited.ts beside `forget`. With the helper in the store, rangeStore.ts reached 307 lines and failed the max-lines 300 cap; it is now 290. `forget` is now private to rangeVisited.ts, because its only caller is `loadView`.",
    "In the `ReviewedWindow` type, `forget(file)` is replaced by `loadView<T>(entry, call, problem)`. `problems` stays for the list/mark/unmark failures. The window type is internal to the module, so no caller outside these files changes.",
    "No mutation survivors fall on changed lines. The 7 survivors (rangeReviewed.ts:94; rangeStore.ts:119, 135, 138, 141, 154, 251) are all on lines this round did not touch."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/rangeVisited.ts:37",
      "risk": "rangeVisited.ts now holds the view-load rule (failure unmounts and reports, success clears) as well as the visited/recent bookkeeping. I read that as one concern, the mounted views; a reviewer may call it a second job."
    },
    {
      "location": ".omp/skills/project-map/tree.md",
      "risk": "Not owned here. A grep found no row naming rangeVisited.ts or the window's `loadView`, so the docs keeper may need to add one."
    }
  ]
}
