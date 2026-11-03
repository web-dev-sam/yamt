# MrPeoplePageBoundary

Agent output (`agent://MrPeoplePageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeoplePageBoundary.md), collected 2026-11-03T23:25:07.833Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: only Owned files are touched. MergeRequestRow/View, the state slice, core and ipc are unchanged.",
    "PM10: the new MergeRequest* files import only mergeRequestsStore, PeopleLines, mergeRequestsText, menuKeys, useDropdownMenu, useMenuPlacement, tooltip and ipc types. No window root, no lsp.",
    "Contract: props and emits match the brief. Words and functions match; the placeholder is add-only. peopleSearchText/peopleChangeText follow the rerequestReplyText glabRefusalText pattern.",
    "Lifecycle: watch(open) calls Opened on every row, and Closed plus emit on close. Unmount while open calls boxClosed. endPeopleSearch runs only if a field was open. Field Escape is prevented before useHoverBox.keyPressed runs.",
    "State: adding, text and highlight are local. Only slice actions are called, so there is no second writer (VU9). GROUP_WORDS is a Record (TS17). VU15 reasons are given. tree.md/state.md lines go to the docs keeper.",
    "Accepted deviations: Light theme via Settings (no --settings flag); 28 px non-editable line markup; the add button toggles; open risks 2 to 4."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestPeopleSearch.vue",
      "line": 86,
      "severity": "block",
      "problem": "After an add is answered (which can be seconds later behind a queue), the field takes focus unconditionally. A user who opened another person's ellipsis menu in the meantime (toggle focuses its menuitem) loses focus to the field. The menu stays open, and the next Escape closes the field instead of the menu.",
      "fix": "Clear the text and refocus only while `document.activeElement === field.value`, or clear at the pick per design §1.6:178 and show the add's spinner elsewhere."
    },
    {
      "file": "frontend/src/ui/MergeRequestPeopleSearch.vue",
      "line": 73,
      "severity": "should",
      "rule_id": "DR5",
      "problem": "The field now clears once the add is answered, and only if the text is unchanged. Proposed plan row #170 and design §1.6:178 say it clears at the pick (clearAndFocusSearch). If #170 is recorded as written, the decision record contradicts the code.",
      "fix": "The orchestrator amends proposed row #170 to the implemented rule, with its reason (the result line's spinner, design §1.6:199), before recording it, or has the code follow #170."
    },
    {
      "file": "frontend/src/ui/MergeRequestPeople.vue",
      "line": 169,
      "severity": "should",
      "problem": "The data-control keys (`rerequest:<u>`, `more:<group>:<u>`) and their show conditions are built twice: in controlsOf and again as template literals at :310 and :336. If one copy drifts, the focus rule silently stops moving focus to the box.",
      "fix": "Have boxGroup compute each line's control keys once (e.g. `controls: { rerequest: string | null; more: string | null }` on BoxLine). Bind them in the template and derive `controls` from them."
    },
    {
      "file": "frontend/src/ui/mergeRequestPeopleLines.ts",
      "line": 49,
      "severity": "should",
      "problem": "NO_PEOPLE_ASKS copies the state slice's private NO_ASKS (mergeRequestPeople.ts). The fallback `peopleAsks.value.get(iid) ?? NO_PEOPLE_ASKS` is also repeated in MergeRequestPeople.vue:146 and MergeRequestPeopleSearch.vue:34, so 'a row with no asks' has two definitions.",
      "fix": "Export the slice's NO_ASKS (or a `rowPeopleAsks(iid)` reader) from mergeRequestPeople.ts as a state-slice follow-up, then delete NO_PEOPLE_ASKS and use it in both components."
    },
    {
      "file": "frontend/src/ui/mergeRequestPeopleLines.ts",
      "line": 51,
      "severity": "nit",
      "problem": "usernamesIn repeats the core's group-to-people projection `rowPeople` (mergeRequests/internal/filters.ts:98). Nothing gets harder for now.",
      "fix": "Export rowPeople from mergeRequests/index.ts (core follow-up) and map its usernames here."
    }
  ]
}
