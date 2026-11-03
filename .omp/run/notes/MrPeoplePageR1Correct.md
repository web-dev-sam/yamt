# MrPeoplePageR1Correct

Agent output (`agent://MrPeoplePageR1Correct`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeoplePageR1Correct.md), collected 2026-11-03T23:37:17.517Z.

{
  "verdict": "pass",
  "checked": [
    "#2270 fixed: MergeRequestPeopleSearch.vue:83-89 still clears the field (text=\"\", searchPeople(\"\")), and calls focus() only when document.activeElement is document.body, so it never takes focus from another control.",
    "Traced: Remove returns focus to its ellipsis (brief:113); a reply that removes the focused control focuses the box (keepFocusInBox, MergeRequestPeople.vue:180). Neither leaves body focused. If the box closed, field===null skips.",
    "The body-only check matches the existing pattern in KeymapList.vue:118 and MergeToolbar.vue:150; it is not a second convention.",
    "Smoke (brief:180): after a real click the field is empty and keeps focus. In #2265's case the menuitem still has focus about 4 s after the pick and the field is cleared. The .vue has no unit test; that open risk is accepted.",
    "Survivors: none kept. mergeRequestPeople.ts:111 (calls += 1 -> -= 1) is equivalent (VF7 a): the counter is only compared with ===. The other survivors are on lines this round did not change.",
    "No regression in the search file: rowPeopleAsks at :34 gives the same value as the old `?? NO_PEOPLE_ASKS`; the Enter/click/Escape paths are unchanged."
  ],
  "findings": []
}
