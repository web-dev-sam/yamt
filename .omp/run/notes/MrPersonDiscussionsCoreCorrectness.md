# MrPersonDiscussionsCoreCorrectness

Agent output (`agent://MrPersonDiscussionsCoreCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsCoreCorrectness.md), collected 2026-11-05T13:54:57.016Z.

{
  "verdict": "pass",
  "checked": [
    "personGroupOf traced vs turnOf (discussions.ts:70-118): all asserted groups hold; turn>started>wrote>reviewer precedence and assignee/approver-only→other pinned; starterOf/wroteIn/isUser imported, not copied",
    "personEntries: group test interleaves groups over two rows, newer turn in row 2, so group-less/oldest-first/input-order sorts fail; equal_times pins stable order; entry turn and PERSON_GROUPS asserted",
    "foldedWriters: fits 6 of 6 kills `<`, fits 0/1 fold all, [1]@0 shown; laterWriters D3 cases incl. repeats, null; Contract's folded array over design's number accepted",
    "personLines: knownMentions(null,[...]) matches 'each username once, nulls dropped' (accepted open risk); Me first, picture or null, Me-as-person and me-kind mark Me, me null→no Me, nothing chosen",
    "keptInPlace matches ui/mergeRequestsShown.ts:102-115 keyed; 4 tests pin index, new version, drop, empty held; narrowed infers Choice<V> at MergeRequestMenu.vue:23",
    "Mutation run present (453 killed/24 survived); PERSON_GROUPS survivors accepted as (b): module-level, killed by test recipe's assertion at personDiscussions.test.ts:194"
  ],
  "findings": [
    {
      "file": ".omp/run/mutants/MrPersonDiscussionsCore.survivors.txt",
      "line": 2,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The second kept line excuses discussions.ts:59:10 and the choices.ts:24-26/discussions.ts:42-53 constants as 'unchanged lines', not a VF7 reason; 59:10 is really (a) equivalent (username is a string) and the rest are module-level, so no gap now, but a later isUser reviewer cannot tell.",
      "fix": "List each survivor as `file:line mutation` with its real reason: 59:10 (a) equivalent, the constant literals (b) module-level with the asserting test named."
    },
    {
      "file": "frontend/src/mergeRequests/internal/personDiscussions.ts",
      "line": 116,
      "severity": "nit",
      "problem": "A fractional `fits` (measured width over picture width) gives a non-integer cut, so slice shows one picture more than fits beside the +N; nothing breaks if the state slice floors, but the rule then lives in the caller.",
      "fix": "Floor once at the top (`const slots = Math.max(Math.floor(fits), 1)`) and add a fits 3.5 assertion."
    }
  ]
}
