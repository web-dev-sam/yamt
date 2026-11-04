# MrFastPreviewPanelBoundary

Agent output (`agent://MrFastPreviewPanelBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewPanelBoundary.md), collected 2026-11-04T22:29:41.184Z.

{
  "verdict": "fail",
  "checked": [
    "One preview state: previewHere returns the same {kind:'read'} as readPreview (mergeRequestPreview.ts:25-32); preview() does blank → EMPTY, local read, then loading/readPreview, guard untouched (mergeRequestThread.ts:205-217)",
    "One owner of the ask-again rule: askGitLabAgain( is called only by mergeRequestsRefresh.ts:14; Refresh and Retry both bind requests.refresh (MergeRequestsView.vue:164,251); show() and the submit reload never ask",
    "mergeRequestsRefresh.ts does one job (the explicit refresh buttons) and holds no state; edges mergeRequests→Refresh→mergeRequestsList, no cycle; PM10 prefix covered; projectCalls() matches the threadCalls() pattern",
    "ui→editor edge (`localPreview` via editor/index.ts) is what design §1.3 calls for; oxlint and markdownFence forbid only internal/ and MarkdownView; the vue component change is the reload click only (Owned)",
    "Deviations accepted: new mergeRequestsRefresh.ts and mergeRequestReload.test.ts (approved); 'plan §2 row N' citation matches MergeRequestSource.ts; tree.md/architecture/ipc-contract rows left to the docs keeper (OR §6)",
    "Docs: ui/AGENTS.md:61,65 and ipc/AGENTS.md:9 are accurate. Orchestrator: plan.md §2 does not yet record rows 186–188 that the code cites (DR5)"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequests.ts",
      "line": 292,
      "severity": "block",
      "rule_id": "PM-growth",
      "problem": "Next to `refreshDiscussions`, the window-facing slice still exposes `reloadDiscussions` through `Discussions &` (line 54) and `...state.rowDiscussions`. That reload does not ask GitLab again, and only tests call it now. A future reload button can therefore skip the owner #2423 rule through the slice's public API, so the rule has a bypass entry right beside its one owner.",
      "fix": "Expose `Omit<Discussions, \"reloadDiscussions\">` on `MergeRequests` (spread `discussionsOf`). Keep the wrapper on `state.rowDiscussions` for createRefreshes. Narrow `useRowDiscussions` to `Pick<Discussions,'discussions'|'askDiscussions'>`. Tests call `refreshDiscussions`."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequests.ts",
      "line": 240,
      "severity": "should",
      "problem": "The fixture's `askGitLabAgain` sits in `pageScript`, whose other members open pages and job logs. Tauri groups it with `findGitLabProject` in `projectCalls()`, so the two sources split the project calls differently. What gets harder as the app grows: someone looking for the fixture's project/login answers has to check two places, and the name `pageScript` no longer describes the helper.",
      "fix": "Add a `projectScript(log, script)` with `findGitLabProject` (absorbing the 3-line `fixtureProject`) and `askGitLabAgain`, mirroring `projectCalls()`. Spread it in place of the inline method."
    },
    {
      "file": "frontend/src/ui/mergeRequestsRefresh.ts",
      "line": 21,
      "severity": "nit",
      "rule_id": "CP2",
      "problem": "The `createRefreshes` doc repeats the `Refreshes` members' docs and ends with a double negative, 'Loads no button starts never ask again.' A Rust-beginner owner has to read it twice. Nothing else gets harder as the app grows.",
      "fix": "Keep only the rule's source and reword the last sentence: '`show` and a submit's reload do not ask again: no button was pressed.'"
    }
  ]
}
