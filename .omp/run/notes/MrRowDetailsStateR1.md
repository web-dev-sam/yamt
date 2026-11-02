# MrRowDetailsStateR1

Agent output (`agent://MrRowDetailsStateR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsStateR1.md), collected 2026-11-02T21:08:51.210Z.

{
  "summary": "#2125: `tauriMergeRequests.ts` now has a one-line CP1 reference above `PICTURE_SCHEME`, pointing to Rust's `PICTURE_SCHEME` in src-tauri/src/merge_requests/pictures.rs (I checked: it is defined there at line 12). #2127: I renamed the test to \"a later refresh's rows replace a re-requested row's reviewers\", because no test can catch the deleted `state.running = null` (reason under deviations).",
  "files_changed": [
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run src/ui/mergeRequests.test.ts src/ipc/tauriMergeRequests.test.ts",
      "observed": "Test Files  2 passed (2); Tests  77 passed (77)"
    },
    {
      "command": "pnpm -C frontend exec oxlint …; oxfmt --check on both changed files",
      "observed": "oxlint printed no findings; oxfmt: All matched files use the correct format."
    },
    {
      "command": "hand mutant: PICTURE_SCHEME = \"\" then vitest run src/ipc/tauriMergeRequests.test.ts (reverted afterwards)",
      "observed": "× the_uploaded_picture_address_is_convertFileSrc_of_the_username_and_the_scheme…; × rerequestReview calls the command…; Tests 2 failed | 13 passed (15). After the revert: 77 passed."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → tauriMergeRequests.ts: 51 killed, 0 timeout, 1 survived, 0 no-cov, 0 errors (98.08%)",
    "survivors": [
      "tauriMergeRequests.ts:18 PICTURE_SCHEME=\"\" — gate-covered: Stryker does not reload a top-level constant evaluated at import. By hand, this mutant fails 2 tauriMergeRequests tests. The line only moved down one."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2127: I took the rename option, not a stronger test. A `running` left set after its load ends is never read. `checked` writes through the load captured in the closure, not `state.running`. `ended` reads only its own argument. A re-request reply writes only to that load's buffer, and no later code reads it, because each new `load` sets its own `running`. So no test can observe the deleted line.",
    "I did not touch tauriMergeRequests.test.ts: it already pins the literal at line 249."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequests.ts:164",
      "risk": "No test kills `state.running = null` being deleted, and none can, because the stale value is never read. A reviewer could remove the line as dead, or keep it as hygiene."
    }
  ]
}
