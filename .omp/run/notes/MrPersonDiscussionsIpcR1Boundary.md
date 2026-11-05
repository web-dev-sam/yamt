# MrPersonDiscussionsIpcR1Boundary

Agent output (`agent://MrPersonDiscussionsIpcR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsIpcR1Boundary.md), collected 2026-11-05T14:10:35.088Z.

{
  "verdict": "pass",
  "checked": [
    "#2506/#2509 fixed: Discussions.test.ts:8 imports core personGroupOf (an existing ../mergeRequests edge); Group and groupOf are gone; :438-439 pass the listed row as PersonRow; a missing row throws.",
    "#2506 reviewerGroup (:455-463) asks the core for \"reviewer\" with the real row. This covers the old hand filters (viewer reviews it, viewer is not the author); the !638/!632 expectations still hold.",
    "Expected groups (:443-451) changed \"reviewer or other\" to \"other\". This matches ipc/AGENTS.md:23 (\"none reviewed by either\") and the design's either-or wording.",
    "#2507 fixed: PersonCase = {iid} & Pick<Script,said|changes>, and changes is required (TurnCases.ts:31). FORMATTED_FIRST (:33) comes before PERSON_CASES, so there is no TDZ. The index check is gone (:142-144).",
    "#2508 fixed: fixtureMergeRequestData.ts:22 names fixtureMergeRequestPersonCases.ts PERSON_CASES; grep finds no other stale reference in frontend/src.",
    "Deviations accepted: dropping the unused `Said` import and the lookup that keeps row order. The open risk (#732 import-time survivors) is covered by the body and group tests. All files are Owned; no new state or edges."
  ],
  "findings": []
}
