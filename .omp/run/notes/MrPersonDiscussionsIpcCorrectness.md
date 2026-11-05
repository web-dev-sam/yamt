# MrPersonDiscussionsIpcCorrectness

Agent output (`agent://MrPersonDiscussionsIpcCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsIpcCorrectness.md), collected 2026-11-05T14:04:25.630Z.

{
  "verdict": "pass",
  "checked": [
    "toDiscussion converts first (toTime/toDescription, field paths) for rows and threads; the_first_comment_converts… fails if the conversion is dropped or a path is wrong; discussionDomain.ts 74/74 mutants killed",
    "openDiscussion takes first from comments[0]: every_discussion_starts_with_its_first_comment covers multi-comment rows, so first=last fails; tauri tests compare ms with raw ISO, so they fail without conversion",
    "Person cases p1–p7: writers, ids …0017–…0023, last at 17–23 h, groups via the real turnOf all pinned; rows !624/!628/!609/!607 approved; counts pinned in both data tests; the_review_orders_the_smoke_expects is unchanged",
    "scripted/inOrder refactor keeps behaviour: changes go to OPTIONS_SERIAL(1) only (14+at never 1); mayResolve compares serials as the old ids did; generated rows use fixed Oct dates, so no hour ties with the cases",
    "Survivors: :154 ||/&& variants and :205/:216 equivalent (a); static constants (PERSON_FIRST_SERIAL, OPEN_DISCUSSIONS, FORMATTED_*) asserted by named tests (#732 class, brief's 'wiring and data' label). No gap",
    "Accepted handovers: FirstComment in ipc/index.ts → state slice (SLICES row 5); tree.md row for fixtureMergeRequestPersonCases.ts → docs keeper (§6); reviewers unchanged (option 2); FORMATTED_TEXT risk is fixture-only"
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
      "line": 432,
      "severity": "should",
      "problem": "groupOf rewrites request C2 (turn → started → wrote → reviewer/other) in the test even though the core already exports personGroupOf (personDiscussions.ts:69). If C2 changes, this test still checks the fixture against the old copy and still passes, while the view groups the cases differently.",
      "fix": "Import personGroupOf from ../mergeRequests and call it with the listed row (author, reviewers). Expect \"reviewer\"/\"other\" in place of \"reviewer or other\", and remove groupOf and the Group type.",
      "rule_id": "promote"
    }
  ]
}
