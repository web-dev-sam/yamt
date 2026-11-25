# SidebarNextFileWebBoundary

Agent output (`agent://SidebarNextFileWebBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/SidebarNextFileWebBoundary.md), collected 2026-11-25T11:28:32.701Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all files are in Owned except useRangeController.test.ts (granted). Accepted deviations: slot `total`, `toggleMode`, role=group, `FileListView`, `listMode` in Actions, docs left for the keeper.",
    "Contract kept: sidebarOrder (fileTree.ts:110) reuses treeRows with NOTHING_CLOSED, no second sort. leftToReview (rangeFolderSums.ts:51) and LEFT_TO_REVIEW_WORD (rangeText.ts:76) match the brief.",
    "One mode owner per window: createFileListMode only at store.ts:150 and rangeStore.ts:165. The same instance goes to createRangeReviewed. FileList takes a `mode` prop and emits `toggleMode`. Only writer: toggle.",
    "Next-file callers: nextOpen/nextUnresolved only at rangeReviewed.ts:102 and opening.ts:71, both over sidebarOrder. Window types take Pick<FileListView,\"mode\">. No other code builds an Opening.",
    "Edges: fileTree.ts→fileListMode.ts is type-only, inside ui/. No PM2/PM9 crossing. Vitest uses the node env, so tests' default-storage createFileListMode keeps the mode in memory: no mode leaks between tests.",
    "VU6/VU7/VU16: RangeApp adds one computed, no template logic. App.vue passes no slot (rule 5). RangeCounts shows nothing for notCounted. FileList loses a job. The ui/AGENTS.md paragraph matches the code."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/opening.ts",
      "line": 70,
      "severity": "nit",
      "problem": "sidebarOrder builds the tree order on every write, even when `untouched` is false and the result is dropped. Nothing gets harder as the app grows, but a reader has to work out that `files` is only used on one branch.",
      "fix": "Compute the order inside the branch: `const next = untouched ? nextUnresolved(sidebarOrder(state.files.value, state.listMode.mode.value), path) : null;`."
    }
  ]
}
