# LocalConflictsPageR1

Agent output (`agent://LocalConflictsPageR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsPageR1.md), collected 2026-11-02T18:51:42.398Z.

{
  "summary": "Fixed #2096: `Load.buffered` is readonly again, so the mutable `buffering` flag is gone. `checked` now checks `state.shown === load` first and writes `rows`; otherwise it writes the load's own buffer. When a failed first load clears `rows`, `state.shown` is set to `null` beside it. Fixed #2097: the generic `rechecked` now lives in `mergeRequests/internal/readiness.ts`, is exported from `index.ts` and has two node tests. ui/mergeRequests.ts is down to 294 lines. The checked-row behaviour is unchanged: every existing ui test passes as before.",
  "files_changed": [
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/mergeRequests/internal/readiness.ts",
    "frontend/src/mergeRequests/internal/readiness.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "a checked row replaces only its own row's readiness and keeps the row and the order (catches another row or field changed)",
      "proves": "rechecked changes only the readiness of the row whose iid matches; other fields, other rows and the order stay as they were"
    },
    {
      "name": "a checked row whose iid is not listed changes nothing",
      "proves": "a check for an unknown iid returns rows equal to the input"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — no diagnostics; under set -o pipefail the chain went on to the next command"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b — no errors (the first run caught a too-narrow test literal type, which I fixed)"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  246 passed (246); Tests  3498 passed (3498)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 202 killed, 1 survived, 2 no-cov, 0 errors (98.54%); readiness.ts 37 killed; ui/mergeRequests.ts 165 killed, 1 survived",
    "survivors": [
      "frontend/src/ui/mergeRequests.ts:165 `listing.kind === \"done\"` → true — not a changed line (show's stale check, pre-existing). Equivalent: a listing that is not `done` has no `at`, so the comparison is NaN >= … and false",
      "frontend/src/mergeRequests/internal/readiness.ts:89-92 the exhaustive default (2 no-cov) — not changed lines; it cannot be reached by type"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "checked's second branch is a plain `else` (the load's own buffer), not `else if (load.buffered)`. A load that is not buffered and not shown always has an empty buffer, so the condition could never change anything: its mutant (→ true) survived as equivalent. Dropping it removed that dead check.",
    "rechecked went into readiness.ts, not order.ts: it is a readiness update, and order.ts holds only the list order. It is generic: `R extends { iid: number; readiness: Readiness }`, and the checked row is a `Pick<R, \"iid\" | \"readiness\">`.",
    "The docs keeper should add `rechecked` to the mergeRequests readiness entry in .omp/skills/project-map/tree.md. That file is not in my Owned list."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequests.ts:155",
      "risk": "No test can observe `state.shown = null`: once a failed first load leaves rows empty, the next load is again a first load and replaces `shown` at its start. It is there so the state stays correct; Stryker generates no mutant for that assignment."
    }
  ]
}
