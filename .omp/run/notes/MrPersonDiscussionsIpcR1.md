# MrPersonDiscussionsIpcR1

Agent output (`agent://MrPersonDiscussionsIpcR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsIpcR1.md), collected 2026-11-05T14:09:16.821Z.

{
  "summary": "Fixed #2506–#2509. Tests now call core personGroupOf with each listed row; the copied C2 rule (Group, groupOf) and hand-written filters are gone. p1's formatted body sits on p1's own PERSON_CASES entry (changes: FORMATTED_FIRST, [] elsewhere), not by position. The fixtureMergeRequestData.ts comment now names fixtureMergeRequestPersonCases.ts. Fixture rows, ids, bodies and times unchanged. just mutants HEAD left 8 survivors on changed lines, all import-time values (#732); none killed.",
  "files_changed": [
    "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
    "frontend/src/ipc/fixtureMergeRequestPersonCases.ts",
    "frontend/src/ipc/fixtureMergeRequestData.ts"
  ],
  "tests_added": [
    {
      "name": "the_person_cases_fall_in_the_groups_the_design_names_for_sam_and_anna (rewritten)",
      "proves": "The core personGroupOf, given each case's listed row, puts p1–p7 in the design §2.7 groups for sam and anna. Where the design says \"reviewer or other\" the core now gives \"other\"."
    },
    {
      "name": "the_listed_rows_give_sam_and_anna_each_a_reviewer_group_discussion (rewritten)",
      "proves": "With the real row, personGroupOf gives \"reviewer\" for sam on !638 and for anna on !632. The hand-written reviewer/not-author filters are no longer needed."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  308 passed (308); Tests  4606 passed (4606). The existing p1_starts_with_a_formatted_six_line_comment_and_p2_with_a_plain_one still passes, so the fixture output did not change."
    },
    {
      "command": "pnpm -C frontend lint && pnpm -C frontend typecheck && pnpm -C frontend fmt:check && pnpm -C frontend unused",
      "observed": "lint: clean after removing the now-unused `Said` import; vue-tsc -b: no errors; oxfmt: \"All matched files use the correct format.\"; knip: no output"
    },
    {
      "command": "pnpm -C frontend exec vitest run src/ipc/",
      "observed": "Test Files  38 passed (38); Tests  718 passed (718)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Stryker on fixtureMergeRequestData.ts and fixtureMergeRequestPersonCases.ts: 203 killed, 263 survived, 2 no coverage (whole files)",
    "survivors": [
      "PersonCases.ts:33 FORMATTED_FIRST → []/[() => undefined] — gate-covered: set once at import, mutant never runs (#732); the p1 formatted-comment test asserts the body; asserted line 44 survives the same way",
      "PersonCases.ts:54,63,72,81,101,109 changes: [] → [\"Stryker was here\"] — gate-covered: same import-time PERSON_CASES array (#732); the plain-p2-body and group tests check these cases"
    ]
  },
  "acceptance_not_run": [
    "WebKit/app smoke not run: this round changes only fixture test code and how the fixture's data is laid out, not its output or the UI."
  ],
  "deviations_from_brief": [
    "Removed the `Said` import from fixtureMergeRequestPersonCases.ts: PersonCase now takes `said` from `Pick<Script, \"said\" | \"changes\">`, so the import was unused.",
    "The person-case test keeps PERSON_CASE_ROWS order by looking up each listed row and throwing if one is missing. Filtering LISTED would put the rows in list order instead."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/fixtureMergeRequestPersonCases.ts:33-111",
      "risk": "The rows' changes are set once at import, so the mutation runner cannot test them (#732). Only the existing body and group tests in fixtureMergeRequestDiscussions.test.ts check them."
    }
  ]
}
