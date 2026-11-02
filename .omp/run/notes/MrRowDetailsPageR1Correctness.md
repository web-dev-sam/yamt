# MrRowDetailsPageR1Correctness

Agent output (`agent://MrRowDetailsPageR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsPageR1Correctness.md), collected 2026-11-02T21:47:45.041Z.

{
  "verdict": "pass",
  "checked": [
    "#2131 fixed: escapePressed (MergeRequestsView.vue:84-93) dismisses when openFor≠null; a focused menu still preventDefaults first (menuKey); dismiss closes a kept-focus menu (useDropdownMenu.ts:47-53).",
    "#2132 fixed: due box closes via shared useScrollOutside (useHoverBox.ts:100, capture+passive), tested for inside/outside/null area; focus falling to body matches useHoverBox's scroll close.",
    "#2133 fixed: tips on the CI li and the row-action wrappers, buttons disabled:pointer-events-none. The enabled job's aria-description moves to the li; rule 11 keeps only aria-label names. Accepted.",
    "#2135/#2137 fixed: aria-disabled accepted over brief's disabled: focus stays on the button; running guard (mergeRequestRerequests.ts:49) drops a 2nd press; keepFocusInBox (pre-flush) moves focus to the box.",
    "#2136 explanation holds: script 'list' drops label 'backend' on every load after the first (fixtureMergeRequests.ts:110). A re-request only replaces one row's reviewers, so labels change only on a reload.",
    "#2134 fixed (referrerpolicy before :src). Survivors: useHoverBox.ts:117 'at' is (a) equivalent (show writes at first; placement only read in v-if box); people.ts 4,10-21 are unchanged lines, outside SP11."
  ],
  "findings": []
}
