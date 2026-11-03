# CiJobLogCoreCorrectness

Agent output (`agent://CiJobLogCoreCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogCoreCorrectness.md), collected 2026-11-03T10:34:39.741Z.

{
  "verdict": "fail",
  "checked": [
    "Rules 1–10 traced by hand against jobLog.ts/sgr.ts: \\r*\\n breaks, first-line timestamp + `+` join keeping \\r, section regex backtracking, escape introducer/final ranges, Ruby split, 38/48;5 consumption, bold→bright only for 30–37",
    "hitPlaces: start uses `<`, end `<=`; hit_places_at_run_boundaries fails if either is off by one; hits outside the view are dropped; matcherOf splits on \\n and view.text has no \\r",
    "Kept survivors: pointAt \"\", physical[0] ??, code = \"\" are VF7 (a) equivalent; module constants asserted by tests (#732, b). Open risks accepted: prototype keys unreachable, \\w+=\\w+ per brief, 300 ms test at ~42 ms",
    "Ran one targeted file: `vitest run --project node jobLog.test.ts -t \"a_section_marker_ends_a_line_that_has_text|the_text_is_the_lines_joined_by_line_breaks\"`. Result: the_text test fails, `expected 1 to be greater than 50`",
    "Stryker vitest-runner mutantRun sets testNamePattern to each mutant's covering tests (node_modules/@stryker-mutator/vitest-runner vitest-test-runner.js:141-153); no stryker config, so perTest coverage",
    "index.ts exports exactly the contract names; ansiColours test covers all 12 brief indices, ties, and every one of the 16 as a nearest; search steps wrap; RK57 markup test checks the run text as written"
  ],
  "findings": [
    {
      "file": "frontend/src/mergeRequests/internal/jobLog.test.ts",
      "line": 346,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "the_text_is_the_lines_joined_by_line_breaks checks `inputs.length > 50`, and inputs come from earlier tests. Stryker runs only a mutant's covering tests, so this test fails whenever fewer than 51 inputs ran. Every jobLog/sgr/ansiColours mutant it covers then counts as killed, so the 395 kills are inflated and the survivors file leaves out real ones.",
      "fix": "Assert the text/run invariant inside `viewOf` for every view, and give the named test its own local list of inputs with no count guard. Then rerun `just mutants HEAD` and kill or list every survivor."
    },
    {
      "file": "frontend/src/mergeRequests/internal/jobLog.ts",
      "line": 127,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "sameStyle's background, bold, underline and struck comparisons can each become `true` and nothing fails: no test has neighbouring runs that differ only in one of these. A regression would merge `a` + `ESC[1mb` into one plain run, so bold, underlined, struck or backgrounded text shows plain. The mutation run hid this because of the guard above.",
      "fix": "In equal_styles_merge_into_one_run_and_no_run_is_empty, add `a${E}[1mb`, `a${E}[41mb`, `a${E}[4mb` and `a${E}[9mb`, each expected as two runs [\"a\", PLAIN] and [\"b\", styled({…})]."
    }
  ]
}
