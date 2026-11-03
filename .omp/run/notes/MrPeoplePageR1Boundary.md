# MrPeoplePageR1Boundary

Agent output (`agent://MrPeoplePageR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeoplePageR1Boundary.md), collected 2026-11-03T23:37:14.272Z.

{
  "verdict": "pass",
  "checked": [
    "#2265 fixed: SearchPeople.vue:86-88 refocuses only from document.body, so a menuitem, re-request button or the box keeps focus. Click (mousedown.prevent) and Enter leave the field focused.",
    "#2267 fixed: rerequest.control (People.vue:134) and menuControl (:158) are built once. The template binds them (:312, :337-338) and lineControls (:173-177) builds the focus set from them.",
    "#2268 fixed: NO_PEOPLE_ASKS is gone. rowPeopleAsks (mergeRequestPeople.ts:75) is the one empty-row definition, used by the slice (:162, :173), both components and the test. tree.md:280 is updated.",
    "No regression or growth harm: no new state, writer or import edge. The components import ./mergeRequests (in-fence, PM10). A new test pins the empty and stored reads.",
    "Docs: AGENTS.md:69 matches the code. Plan #170 and architecture:1894 ('keeps focus only if it still has it') omit the body case; the docs keeper has it (SLICES row 5).",
    "Survivors accepted: none are on changed lines. The generation counter += to -= mutant is equivalent, the lines.ts survivors are round 1's equivalents, and the no-coverage ones sit on the exhaustive default."
  ],
  "findings": []
}
