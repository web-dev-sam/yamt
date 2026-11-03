# CiJobLogCoreR1Correctness

Agent output (`agent://CiJobLogCoreR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogCoreR1Correctness.md), collected 2026-11-03T10:47:16.526Z.

{
  "verdict": "pass",
  "checked": [
    "#2165 fixed: viewOf asserts the text/run invariant on every view (jobLog.test.ts:30-42); the named test uses its own 6 inputs, no count guard, no shared state (:365-375)",
    "#2166 fixed: ESC[1m/41m/4m/9m each give [a,PLAIN],[b,styled] (:313-325); sameStyle mutants (.some, predicate true or false) fail these or the merge case; none survived",
    "shownStyle spreads the same 6 keys from every Pen (all are PLAIN_PEN spreads), so Object.entries(left) and Reflect.get(right) compare the same key set; bold/whenBold choice unchanged",
    "sameStyle allocation (open risk) accepted: ~2 calls per line, ~18k in the 500 KB test, still under its 300 ms bound; not a correctness or growth block under RV8",
    "Survivors per VF7: kind→\"\" (:72,79,82,105,154), :92 minus, :52, :211, sgr.ts:89 equivalent; module-level regex/table survivors are #732 artefacts, killed by named section/timestamp/code tests",
    "Survivor line numbers match the current file; ce1b8569 touches only jobLog.ts, sgr.ts (comment), jobLog.test.ts and run artefacts. No test file was run"
  ],
  "findings": []
}
