# MrDescriptionStateBoundary

Agent output (`agent://MrDescriptionStateBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionStateBoundary.md), collected 2026-11-04T00:38:53.129Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all 20 changed files are in Owned; only 3 row literals needed hasDescription. bindings.ts, *.vue, editor/** and docs/** are untouched.",
    "Boundaries: mergeRequestDescriptions.ts imports only vue, ../ipc, ./problem (PM2, PM10). The fixture imports only ipc siblings. createDescriptions(deps) is spread like createJobLogs.",
    "RK67: description is written only by ask/toggleDescription/closeDescription. An answer settles only into its own entry (shown.value !== entry). loadList/refresh never write it.",
    "Deviations accepted: descriptionScript(log, LISTED_ROWS) as siblings; TIMED_OUT; NO_DESCRIPTION_*; uploadedImage = uploadedPicture; pageOpenerOf keeps pageProblem's writers (state.md:69); 21 knip aliases.",
    "Copying the job log's shape (mergeRequestJobLogs.ts:34-75) is the brief's Contract. fixtureUploadedImage next to fixtureUploadedPicture follows the fixture spec. Both accepted.",
    "PageKind 'link' is also a MergeRequestStep, so `step: clicked` typechecks (mergeRequests.ts:162). Record literals (TS17). Comments: only brief-required docs and the data: note."
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/mergeRequestDomain.ts",
      "line": 100,
      "severity": "block",
      "rule_id": "TS1",
      "problem": "`DescriptionLink` is a plain alias, so `link.page` reaches ui as an unbranded string. Every other WebPage crossing IPC is branded by `toWebPage` here. The page slice cannot call `openPage(\"link\", page: WebPage)` without branding in ui, and `isWebPage` accepts https only (mergeRequestDomain.test.ts:246), so the http links that plan #172 opens would be refused.",
      "fix": "Convert the reply in ipc (`toDescriptionReply`, called by tauriMergeRequests and the fixture) so `page` becomes the domain `WebPage`, using an http/https guard for linked pages. Ask the orchestrator to amend the 'aliases' Contract line before mr-description-page starts."
    },
    {
      "file": "frontend/src/ui/mergeRequestsText.ts",
      "line": 17,
      "severity": "nit",
      "problem": "tree.md:280 still lists `PageKind` as (job, mergeRequest, discussion), and the keeper's list in the design does not cover this line. The map goes stale, which only costs a reader a lookup.",
      "fix": "Add 'tree.md:280 PageKind gains link' to deviations_from_brief so the docs keeper updates it."
    }
  ]
}
