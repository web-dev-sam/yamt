# MrRowDetailsPageR1Boundary

Agent output (`agent://MrRowDetailsPageR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsPageR1Boundary.md), collected 2026-11-02T21:45:42.590Z.

{
  "verdict": "pass",
  "checked": [
    "#2128 fixed: people.ts:24 makes peopleStack generic over P extends Person. MergeRequestPeople.vue:61 uses stack.shown directly (no Map, flatMap or ?? []). people.test.ts:54 checks that the caller's objects come back.",
    "#2129 fixed: useHoverBox.ts:101 adds useScrollOutside (capture, passive) as the one copy of the rule, used by useHoverBox:122 and MergeRequestDueDate.vue:36. A scroll on a closed box writes false over false.",
    "useHoverBox behaviour unchanged: the open guard moved into the callback. The isInside to contains(area, target) rename covers both focus handlers. Its other users (CiStatusBox, Labels, People) are unaffected.",
    "Ownership: the brief makes people.ts and useHoverBox.ts read-only (line 20), but these edits are what #2128 and #2129 asked for, and they are accepted. peopleStack's only other callers are its tests. Reviewer stays exported and used.",
    "Docs: ui/AGENTS.md:49 and :51 describe useScrollOutside and the generic peopleStack. mergeRequests/AGENTS.md:11 is still accurate. No new file (so no PM6 row owed) and no new import edge outside ui/.",
    "The other R1 edits are fine: escapePressed calls useHoverMenu's dismiss, which returns a Promise. Tooltip wrappers on Row:220 and the CI li follow the AGENTS rule. keepFocusInBox stays local to People. Picture's attribute order is fine."
  ],
  "findings": []
}
