# MrRowDetailsCoreR1Correctness

Agent output (`agent://MrRowDetailsCoreR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsCoreR1Correctness.md), collected 2026-11-02T20:20:02.673Z.

{
  "verdict": "pass",
  "checked": [
    "#2107 fixed: dueDate.test.ts:115-124 reloads ../index under TZ=America/Los_Angeles. Intl.DateTimeFormat fixes its zone when built, so dropping timeZone:'UTC' gives 'Nov 8, 2026'; the notes' tamper-and-revert run saw it fail.",
    "#2106 fixed: compareDays (dueDate.ts:38) divides by DAY_MS. UTC midnights differ by exact DAY_MS multiples, so the result is an integer. daysLeft:48 calls it directly; AGENTS.md:9 updated; no other docs say ms.",
    "compareDays test :107-113 would catch both a ms return and a sign-only return (toBe -1/1/0/29/2). Hand-checked: Jan 31→Mar 1 2026 = 29 days, Feb 28→Mar 1 2028 = 2 days.",
    "RV8: order.ts:36-37 is the only other caller and reads only the sign and 0, which dividing by a positive constant keeps. Tie-break unchanged; no ui/ callers.",
    "Test hygiene: TZ is re-stubbed to Berlin after the import; afterAll unstubAllEnvs (:14) restores it. resetModules runs in the last test; top-level imports keep their own instances; the index has no side effects.",
    "Survivors: 8 DAY_TEXT (:4) mutants. [INFERENCE] The reload ties them to the one test, which never calls west.calendarDayFrom. :84-102 pins ^/$/\\d/quantifiers: #732 (b) invalid, accepted. 'Unchanged line' alone is no reason."
  ],
  "findings": []
}
