# MrPersonDiscussionsIpcBoundary

Agent output (`agent://MrPersonDiscussionsIpcBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsIpcBoundary.md), collected 2026-11-05T14:04:02.571Z.

{
  "verdict": "fail",
  "checked": [
    "Contract kept: FirstComment and OpenDiscussion.first match the brief (discussionDomain.ts:30-39). toDiscussion:110-113 converts with .first.* field paths, tested by the_first_comment_converts_its_time_and_brands_its_links.",
    "Ownership: every file is Owned or the granted PersonCases file; the ui tests add only `first`. Imports PersonCases->TurnCases->Data have no cycle and no new module edge (PM2, PM3, PM5).",
    "Approved deviations accepted: rows !624/!628/!609/!607 (no smoke names them except !607 in a filter smoke, unaffected); reviewers left as they are; FirstComment export moves to state; tree.md row goes to the docs keeper (PM6).",
    "Fixture: openDiscussion fills first from comments[0] and throws when empty. The scripted() generalisation keeps !637/!636 as before. Serials 17-23 put last comments 17-23 h ago, no tie with !637/!636 (1-13 h).",
    "Mutation survivors accepted: the || in openDiscussion and the - in inOrder are equivalent; the turnCases null survivor too (only caller is `turnCases ?? personCases`); statics fall under #732. discussionDomain.ts: 74/74 killed.",
    "ipc/AGENTS.md:23 names the person cases, their rows, ids and what each proves. The test-local plainText repeats no existing helper (grep found none)."
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/fixtureMergeRequestDiscussions.test.ts",
      "line": 432,
      "severity": "block",
      "rule_id": "growth: copied decision",
      "problem": "groupOf re-implements request C2 (turn, then started by the first writer, then wrote, then the rest), which core personGroupOf(discussion, person, row) already exports from ../mergeRequests. If C2 changes, these fixture tests keep proving the old rule. reviewerGroup (:468-474) also rebuilds 'reviewer' by hand, with a null author.",
      "fix": "Import personGroupOf, pass each case row as its PersonRow (author, reviewers) and assert the core's five groups, 'reviewer' for sam !638 and anna !632. Delete Group, groupOf and the hand-written filters."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestPersonCases.ts",
      "line": 136,
      "severity": "should",
      "problem": "p1's formatted body is attached by position (at === 0), away from p1's PERSON_CASES entry. Reordering or adding a case silently moves the rich body; that gets harder to see with every new case.",
      "fix": "Add `changes` to PersonCase (FORMATTED_FIRST on p1's entry, [] elsewhere) and pass it through in personCases, dropping the index check."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestData.ts",
      "line": 22,
      "severity": "should",
      "rule_id": "CP1",
      "problem": "The doc comment says PERSON_CASES is in fixtureMergeRequestTurnCases.ts, but it is in fixtureMergeRequestPersonCases.ts, so a reader lands in the wrong file. Nothing else gets harder.",
      "fix": "Point the comment at fixtureMergeRequestPersonCases.ts PERSON_CASES."
    }
  ]
}
