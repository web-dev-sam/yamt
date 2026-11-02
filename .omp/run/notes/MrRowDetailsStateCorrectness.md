# MrRowDetailsStateCorrectness

Agent output (`agent://MrRowDetailsStateCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsStateCorrectness.md), collected 2026-11-02T21:03:56.211Z.

{
  "verdict": "pass",
  "checked": [
    "Due dates dropped only on a `loaded` end, after the swap. Cut, failed and IPC ends never write. Tests: a_complete_load_drops… and a_cut_or_failed_load… (5 ends; a `listed` guard would fail the cut case).",
    "A re-request reply during a buffering refresh writes `rows` and `running.buffer`. A_rerequest_reply_replaces… fails if either write is deleted (the swap would restore 638's old reviewers). A refusal writes no rows.",
    "Old stored filters read as included: STORED_FILTERS is today's exact JSON. not:me / not:none are pinned and round-trip (mergeRequestFilters.test.ts:61-89).",
    "DueDates: exact JSON, reload, keepOnly keeps other repos and removes an emptied one, no write when all kept, bad entries dropped. Rerequests: running guard, requested/refused/dismiss/failure paths.",
    "RK53, window side: uploaded→convertFileSrc, gravatar as sent, none→null for every person kind plus the reply's reviewers. Fixture rules checked by hand: authors, stack rows, dmitri on !638, !635 size 0, six iids, data: only.",
    "Survivors per VF7: fixture literals → asserted by tests or typecheck (#732, b); REFUSED_REREQUEST and PICTURE_SCHEME → asserted (b). `never` arm and rerequests:69 `?? []` → equivalent (a), verified by hand. Deviations accepted; no test run."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequests.test.ts",
      "line": 991,
      "severity": "nit",
      "problem": "This test says it '(catches a finished load's buffer kept)', but it still passes with `state.running = null` deleted: a stale `running` is never read once its load has ended. The name claims coverage that does not exist. Nothing gets harder as the app grows.",
      "fix": "Drop the parenthesised claim from the test name, or rename the test to what it checks: a later refresh's rows replace a re-requested row's reviewers."
    }
  ]
}
