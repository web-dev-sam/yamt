# MrRowDetailsCoreR1

Agent output (`agent://MrRowDetailsCoreR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsCoreR1.md), collected 2026-11-02T20:17:00.792Z.

{
  "summary": "Fixed #2106 and #2107. `compareDays` now returns whole days (it divides by DAY_MS itself), so `daysLeft` is just `compareDays(day, today)` and DAY_MS has one user. `order.ts` only reads the sign, so it works unchanged. AGENTS.md now describes `compareDays` and `daysLeft` as they are and says `dueDateText` reads in UTC. New test: the dueDate module is reloaded under TZ=America/Los_Angeles and must still show the stored day. It fails when `timeZone: \"UTC\"` is removed.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/dueDate.ts",
    "frontend/src/mergeRequests/internal/dueDate.test.ts",
    "frontend/src/mergeRequests/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "compareDays counts the whole days between two days across months, years and leap days",
      "proves": "compareDays returns a day count (-1, 1, 0, 29, 2 across a leap Feb), not milliseconds or just a sign (#2106)"
    },
    {
      "name": "dueDateText reads the day in English, medium style, whatever the time zone (extended)",
      "proves": "after resetModules under TZ=America/Los_Angeles, 2026-11-09 still reads \"Nov 9, 2026\"; with timeZone removed it reads \"Nov 8, 2026\" and fails (#2107)"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run src/mergeRequests",
      "observed": "Test Files  13 passed (13); Tests  209 passed (209)"
    },
    {
      "command": "temporarily removed timeZone: \"UTC\" from DUE_FORMAT, then pnpm -C frontend exec vitest run src/mergeRequests/internal/dueDate.test.ts (change reverted afterwards)",
      "observed": "× dueDateText reads the day in English, medium style, whatever the time zone; Expected: \"Nov 9, 2026\" Received: \"Nov 8, 2026\"; Tests 1 failed | 20 passed (21)"
    },
    {
      "command": "pnpm -C frontend lint (oxlint --type-aware && eslint .vue); pnpm -C frontend exec oxfmt --check src/mergeRequests; vue-tsc --noEmit",
      "observed": "lint: no diagnostics, exit 0. oxfmt: \"All matched files use the correct format.\" vue-tsc: 0 `error TS` lines"
    },
    {
      "command": "pnpm -C frontend exec vitest run (whole frontend)",
      "observed": "Test Files 2 failed | 250 passed; 13 failed, all in src/ui/mergeRequestFilters.test.ts and src/ui/mergeRequests.test.ts (expected red from the ui callers left to later slices)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: dry run stopped on the expected ui failures. Same stryker run with --ignorePatterns for the 2 ui tests: dueDate.ts 57 killed, 8 survived",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Mutation scoping: the brief suggested limiting the run to the src/mergeRequests tests, but Stryker has no CLI flag for a vitest dir and a config file in target/ is outside Owned (blocked by the ownership hook). Instead I excluded the two failing ui test files with --ignorePatterns; the scope is the same in effect.",
    "The new test uses a dynamic `await import(\"../index\")` after vi.resetModules, with a one-line comment giving the reason: DUE_FORMAT picks up the process time zone when the module loads, so it must load again under the west zone."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/dueDate.ts:4",
      "risk": "All 8 survivors are DAY_TEXT regex mutants on line 4, which this round did not change. It is a module-level constant, so they are likely false survivors (#732 static-mutant pattern). Not on a changed line, so I left them."
    }
  ]
}
