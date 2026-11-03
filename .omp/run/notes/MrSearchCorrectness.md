# MrSearchCorrectness

Agent output (`agent://MrSearchCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T08-37-08-403Z_01a1a08e-14b3-70d2-9e68-44d830b6bbca/MrSearchCorrectness.md), collected 2026-11-03T08:58:11.382Z.

{
  "verdict": "pass",
  "checked": [
    "Rule 3 (search.ts:3-7): runs of [\\p{L}\\d]+ kept if all digits, Set.has(Number). Tests kill /\\d+/ (v2,abc123,12ab,x34 hit real iids), substring-iid (!12), first-number-only, 0042.",
    "Rules 2/4: trim+lower-case includes; blank returns rows (toBe). shownRows=datedFirst(searched(filtered)); choices unsearched, '1 of 40' (test :1020); AND + clearAll keep (:1039); dated order (:1060) kills dropped datedFirst.",
    "Rule 5: the field's keydown runs before the page's window bubble listener (View:66,86), which skips defaultPrevented. preventDefault only when text≠''. Covered by the WebKit smoke only, as for MergeRequestDueDate.vue.",
    "Rule 6: show() empties search (mergeRequests.ts:165); load/refresh never write it; only show sets screen to mergeRequests. Test :1066 kills both a dropped reset and a Refresh that clears.",
    "VF7 (a): search.ts:4 `?? []` (the word fails /^\\d+$/) and mergeRequests.ts:218 initial '' (read only after show). Unlisted :168 survivor is untouched and equivalent (NaN>=x); 14 NoCov are old never-arms.",
    "Deviations accepted: mergeRequestsShown.ts split (approved option A), #12345 instead of #1234 (palette fence), type=text. No test run: no block depends on one."
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/search.test.ts",
      "line": 61,
      "severity": "should",
      "problem": "The test named 'a number matching no iid still lets a title match through' searches 'build 630' and 'fix build'. 630 is a fixture iid and 'fix build' names no number, so the acceptance case (a number naming no MR plus a title match) is never exercised; the '630' test still catches the plausible bug classes. Nothing gets harder as the app grows.",
      "fix": "Give a fixture title a number that is no iid (e.g. iid 42 'Fix build 777 on CI') and assert iids('build 777') equals [42], keeping the '630' case in its own test.",
      "rule_id": "VF7"
    },
    {
      "file": "frontend/src/mergeRequests/internal/search.ts",
      "line": 17,
      "severity": "nit",
      "problem": "namedNumbers reads the lower-cased text. 'İ1234'.toLowerCase() leaves a combining mark (not \\p{L}) before the digits, so 1234 is named although a letter precedes it (rule 3). Nothing gets harder as the app grows.",
      "fix": "Pass text.trim() (not `wanted`) to namedNumbers."
    }
  ]
}
