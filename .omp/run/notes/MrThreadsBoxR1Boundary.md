# MrThreadsBoxR1Boundary

Agent output (`agent://MrThreadsBoxR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsBoxR1Boundary.md), collected 2026-11-04T16:59:28.304Z.

{
  "verdict": "fail",
  "checked": [
    "#2378 fixed: script order is now state (useHoverBox, bounding, rows, refs), computed (`shownId = computed(shownHere)`), watch, onBeforeUnmount, functions (VU2). `pinned` reads the hoisted `shownHere()`; sfc-order exit 0 per note.",
    "#2379/#2384 fixed, no copy: one `boxClosedHere()` for watch(open) and onBeforeUnmount-if-open (MergeRequestPeople.vue:120's pattern). It runs closeThread only for this row's thread, then boxClosed. No second writer.",
    "#2380 fixed: `isUser(...): boolean` with no predicate; every caller narrows `starter` through `=== null ||`. No `isPerson` is left in frontend/, docs/ or the skills.",
    "Added behaviour, another row's thread: the watch on `thread.shown.iid` calls the existing HoverBox.close() (no contract change), and watch(open) runs boxClosed only. Same-row switches and closeThread are skipped. Correct.",
    "`[data-refreshes-list]` ok: verify step 10 asks for it, it reuses AGENTS.md:73's attribute, only when pinned; the test fails without it. Docs keeper: also plan #183/#185, architecture:2314, tree:241, RK73.",
    "Open risk 'Escape on the focused Refresh is the page's' accepted: plan #183 scopes Escape to the panel, and Tab out already behaves this way. Escape from anywhere (the description panel's route) would be a product question."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 194,
      "severity": "block",
      "rule_id": "RK73",
      "problem": "Retry calls `retryThread` directly. The load turns `loading` and removes the focused Retry button, so focus falls to BODY with no focusout (#2383's mechanism, the implementer's open risk 1). The next Escape then leaves the merge-request page instead of closing the panel (plan #183).",
      "fix": "Route it through `function retry(): void { focusPanel(); void retryThread(); }` (as `publish` does) and bind `@click=\"retry\"`."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestDiscussions.ts",
      "line": 92,
      "severity": "block",
      "rule_id": "growth-copy",
      "problem": "`asking` builds its mentions by hand from `personNamed`. That copies fixtureMergeRequestRendering.ts `mentionsIn` (the fixture's one text-to-mentions rule, with its code-span exclusion), so the next change to mentions must be made twice; the dead `person === null` branch is the NoCoverage survivor.",
      "fix": "Export `mentionsIn` from fixtureMergeRequestRendering.ts, write `mentions: mentionsIn(said)` in `asking`, and drop the `personNamed` lookup."
    }
  ]
}
