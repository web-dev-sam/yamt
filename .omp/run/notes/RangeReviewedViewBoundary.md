# RangeReviewedViewBoundary

Agent output (`agent://RangeReviewedViewBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedViewBoundary.md), collected 2026-11-19T10:10:31.750Z.

{
  "verdict": "fail",
  "checked": [
    "Owned: all touched files in scope except ipc/index.ts (ReviewMark export, granted). Accepted deviations: drag test in rangeThreads.browser.test.ts, viewParts/viewKind exports, disabled classes, role=img span.",
    "Contract kept: startsThreads, RangeViewKind, RangeShown, wholeShown/sinceShown, the view option, words and reviewedCount match the brief. Both RangeOptions callers updated; no stale opened(probe, bool) call.",
    "range.ts #pressed: a badge still toggles; a drag starts only when startsThreads. No vue/tauri in editor/ (PM3); ui/ reaches editor/ only via useRangeController (VU11).",
    "One writer for marks (rangeReviewed.ts); view kind derived from marks, never stored; the id:view key remounts, so reading props.view once is safe; no new state row needed.",
    "Rule 3: RangeFileRow fills #file, which FileTree.vue:85 also renders, so tree shows marks. A dropped left-pane hit in the since view still calls took(), so the file opens without moving.",
    "Disabled classes match KeyRecorder.vue:188; count matches MergeToolbar.vue:204; useRangeController.ts 297 lines (<300); viewParts switch has no default (TS3 allows)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/useRangeController.test.ts",
      "line": 577,
      "severity": "block",
      "rule_id": "slice-protocol",
      "problem": "viewWindow builds createRangeReviewed with the old window shape ({start, show, forget, problems}). af6d8193, which landed first, changed it to {start, show, problems, loadView}. Typecheck fails, and at runtime loadSince calls an undefined loadView, so every viewWindow test fails, including all four acceptance tests.",
      "fix": "Replace `forget` with a `loadView(entry, call, problem)` like rangeReviewed.test.ts:58: on failure report problem(cause) and return null, else return the value. Then rerun typecheck and this file."
    },
    {
      "file": "frontend/src/ui/RangeFileRow.vue",
      "line": 58,
      "severity": "should",
      "problem": "The name-muting rule is an inline `review === 'reviewed'` check, separate from REVIEW_LOOKS. A third mark kind, or a change to which marks mute the name, needs two edits that can drift. FileMark.vue keeps mutesName in its table.",
      "fix": "Add `mutesName` to ReviewLook and REVIEW_LOOKS, and bind the label's class to `reviewShown?.mutesName === true`."
    }
  ]
}
