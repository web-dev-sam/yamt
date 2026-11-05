# MrReviewFixesR2Boundary

Agent output (`agent://MrReviewFixesR2Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrReviewFixesR2Boundary.md), collected 2026-11-05T00:30:46.854Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: brief marks mergeRequestsShown.ts read-only, but #2476 names it. Holding people rows too (deviation 1) follows #2476's 'as people rule 9'; plan #170 only says 'stays shown'.",
    "One writer: `discussionBoxes` written only by `boxesOf` (Shown.ts:117-130), read only by `heldOf`. Called only from Discussions.vue:121 and :153 (box opens; box closes or unmounts open).",
    "Edges: Shown→mergeRequestThread is type-only; Thread's imports never reach Shown, so no cycle. PM10 holds. `Listed.threads` comes from `...state` (mergeRequests.ts:99, :263).",
    "One hold rule (`heldOf`+`keptInPlace`) for people, discussions and panel. People's `boxesOf` repeated in 4 lines is OK (principles §3). Vue 3.5.43 supports `computed(previous => …)`.",
    "Docs: AGENTS.md:59/:75 match the code; architecture.md:1648/1656/2207-2211 already updated. Docs keeper still owes plan #189, a state.md row, and state.md:80's stale 'in list order'.",
    "Accepted risks: kept index after a filter change while the panel is pinned; SSR test calls Opened/Closed by hand. `boxed` dropping while open leaves a row held: unreachable in practice, and older than this round."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestsShown.ts",
      "line": 91,
      "severity": "block",
      "rule_id": "principles §2",
      "problem": "`shownOf` gets the whole `Thread` but reads only `shown.iid`. Every reply keystroke (`setText` writes a new `thread.value`) and every load or sending change re-runs filter, search and review order, so `keptInPlace` returns a new `shownRows` and the page re-renders its list.",
      "fix": "Read only the panel's row, e.g. `const panelRow = computed(() => listed.threads.thread.value?.shown.iid ?? null)` passed to `heldOf`, so `shown` reruns only when that row changes."
    }
  ]
}
