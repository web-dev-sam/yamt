# CiJobLogStateCorrectness

Agent output (`agent://CiJobLogStateCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogStateCorrectness.md), collected 2026-11-03T10:58:06.455Z.

{
  "verdict": "pass",
  "checked": [
    "State rules 1-4 checked by hand (mergeRequestJobLogs.ts:53-75): same page loading/shown returns; refused/failed asks again; reply written only for the identical entry; ms taken after the parse; \"\" removes.",
    "Tests: ask A, ask B, A answers (B stays loading, no parse); the {...LINT} copy catches comparing job objects; parse-once spy; exact stored JSON; RK57 text absent from info calls; no warn/error on a failure.",
    "Deviations accepted: a dropped reply not parsed or logged; `...createJobLogs(deps)` (Deps has source+storage); `row 158` wording; pageScript split. OSC open risk accepted: escapeAt ends at 't' like GitLab.",
    "Fixture by hand: failed rows 0/8/16 = !640/!632/!624; jobs 9080/9081 and 9160/9161 match REFUSALS; unit log ~436 KB, first line whole; /raw, other origin and other project are notOffered (tested).",
    "Survivors: :145 equivalent (NaN/0 < 9000, VF7 a). Consts 11-38 hold under #732 (STREAM, CONTINUED, MICROSECONDS, E, NOT_OFFERED, REFUSALS each break a test). tauri 52/1, mergeRequests 175/2: changed lines killed.",
    "Read the tauri pass-through, its failure-table row and the fixture 399/400 ms pause test (timers reset in afterEach). Ran no tests: no block depends on one."
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/fixtureMergeRequestLogs.test.ts",
      "line": 81,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "Lines 81-83 use `runStyle(...)?.x).not.toBeNull()`, which passes on a missing run. `38;2;255;0;0` reads as a reset, so \"Error\" merges into the plain run \"Error: markdownlint…\" and :83 checks nothing, while claiming a coloured \"Error\". So the kept LINT_LINES survivor reason is wrong: the 38;5;208, 48;5;196, truecolor and OSC lines can be emptied with tests green.",
      "fix": "Assert the exact colours: `warning` foreground and ` BLOCKER ` background equal their expected AnsiColour, the truecolor line is one plain run, and the OSC line's shown text. Then rewrite the survivor entry."
    },
    {
      "file": "frontend/src/ui/mergeRequestJobLogs.test.ts",
      "line": 147,
      "severity": "should",
      "problem": "Rule 1's identity check (mergeRequestJobLogs.ts:65) is not pinned: a check by page passes every test. With it, show A, close, show A writes the first reply into the new entry, then replaces the view under the open box (two parses, two log lines). Nothing else builds on it today.",
      "fix": "Add a case: show LINT, closeJobLog, show LINT again, answer ask 0, expect `{ job: LINT, load: LOADING }` and no info call; then answer ask 1 and expect shown."
    }
  ]
}
