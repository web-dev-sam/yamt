# MrRowDetailsCoreCorrectness

Agent output (`agent://MrRowDetailsCoreCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsCoreCorrectness.md), collected 2026-11-02T20:01:41.134Z.

{
  "verdict": "pass",
  "checked": [
    "Rule 7 and passes match the contract: six transitions in filters.test.ts test.each; owner's example keeps [2] (would be [1,2] without exclusion); None excluded = at least one; Me with me null matches nobody both modes.",
    "Rule 9 order: insertion order differs from the expected ties in values_follow_their_count_then_their_name, so a label-only sort fails; Me/None first at count 0; count-0 held values last by label (aardvark, backend).",
    "RK55: stored.test.ts takes today's JSON from ui/mergeRequests.test.ts:557 as input; not: round-trips through JSON; first word wins (not:me then me reads excluded); junk and not:not:me dropped.",
    "RK56: daysLeft compares UTC midnights of calendar days. Under Berlin, 00:00 Nov 9 local = 23:00 UTC Nov 8, so a getUTC* mistake fails; the DST test asserts 23 h/25 h days; leap/non-leap Feb, Dec 31→Jan 1 covered.",
    "byDueDate: ties break by createdAt then higher iid (4 before 2). Undated rows are given out of created order, so sorting them would fail. Stack boundary at exactly 3 gives more 0; reviewDone is tested for all four states.",
    "Survivors meet VF7: never-defaults (tsc TS2366 if emptied); sameValue guard → true equivalent (undefined ≠ string); wordsOf junk word dropped. Recipe swapped for a mergeRequests-scoped run: accepted."
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/dueDate.test.ts",
      "line": 114,
      "severity": "should",
      "problem": "The test name says 'whatever the time zone', but deleting `timeZone: \"UTC\"` from DUE_FORMAT (dueDate.ts:7) still passes. UTC midnight is the same day in UTC and in every zone east of it, and Stryker's --ignoreStatic skips that module-level constant. A later change could show the day before to users west of UTC.",
      "fix": "Add an assertion that formats under a zone west of UTC, e.g. build a formatter check in a test that stubs TZ to America/Los_Angeles before importing, or assert that DUE_FORMAT.resolvedOptions().timeZone is \"UTC\"."
    }
  ]
}
