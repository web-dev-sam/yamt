# MrDescriptionStateCorrect

Agent output (`agent://MrDescriptionStateCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionStateCorrect.md), collected 2026-11-04T00:39:15.857Z.

{
  "verdict": "fail",
  "checked": [
    "RK67: ask() writes a new entry and settles only while it is still shown (mergeRequestDescriptions.ts:58-72). Late answers after close, replace or newer Retry are dropped, unlogged (an_answer_for_a_closed…; retry_asks_again…)",
    "Fresh per open, no cache: open/close/open asks twice (each_open_asks_gitlab_again). A second toggle closes, loading or shown. Retry with no panel asks nothing",
    "Refresh keeps the panel: loadList never writes `description`. a_refresh_keeps_the_open_description checks it during the ask and after the row left the list (toBe identity)",
    "Image addresses: upload → source.uploadedImage, web → its own, refused → null. The app uses convertFileSrc(key, PICTURE_SCHEME), pinned at test :264. CSP allows data:, so fixture images load",
    "Log: iid, kind, blocks (shown only), rounded ms, refusal text never logged. Fixture: !640/639/637/636/635 and !638/631/624 hasDescription false, each literal pinned by its test",
    "Deviations accepted (script args, TIMED_OUT, constants, descriptionCalls, pageOpenerOf, knip aliases). Survivor :82 equivalent (a); the rest on unchanged lines (mergeRequests.ts 130/182 outside hunks)"
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/mergeRequestDomain.ts",
      "line": 100,
      "severity": "block",
      "rule_id": "IPC3",
      "problem": "`DescriptionLink` is a bare alias, so `link.page` reaches the window as `string`, while every other reply's page is branded here. ui/ cannot brand (`isWebPage` is unexported; IPC3). The page slice's `openPage(\"link\", page)` cannot compile without `as`. Rust's `linked` also sends http links, which the https-only guard refuses.",
      "fix": "The orchestrator amends the Contract: convert `DescriptionReply` in mergeRequestDomain.ts so each `page` link is the domain `WebPage` brand, under an http-or-https guard. Do this before mr-description-page."
    },
    {
      "file": ".omp/run/mutants/MrDescriptionState.survivors.txt",
      "line": 2,
      "severity": "nit",
      "rule_id": "VF7",
      "problem": "The module-level literal survivors are labelled 'gate-covered' but name no `just check` recipe, as VF7 (b) requires. They are Stryker false survivors (#732) whose literals the test does pin. Only the curator's reason category suffers; nothing else gets harder.",
      "fix": "Relabel them as Stryker static false survivors (#732), and name the fixture test that pins each literal."
    }
  ]
}
