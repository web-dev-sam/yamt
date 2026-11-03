# MrPeoplePageCorrect

Agent output (`agent://MrPeoplePageCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeoplePageCorrect.md), collected 2026-11-03T23:25:24.883Z.

{
  "verdict": "fail",
  "checked": [
    "Box wiring: watch(open) calls peopleBoxOpened on every row and boxClosed on close; onBeforeUnmount calls it only while open, so never twice. Rows are keyed by iid (View:257). Fixture step 6 shows Closed works.",
    "Rules 2-3: user-plus buttons have a tooltip and aria-label; add() skips already lines. Remove sits behind a click on the menu and runs after focus returns to the ellipsis. While removing, the spinner shows and the menu stays shut.",
    "Keyboard: the arrows step through steppedHighlight (wrap checked by hand). Field Escape is prevented, so the box stays; a second Escape closes it. menuKey prevents the menu's Escape. mousedown.prevent keeps focus in the field.",
    "keepFocusInBox: data-control falls through to the root span of MergeRequestPersonMenu and closest() finds it. flush 'pre' runs before the line is removed. The field is not a data-control, so it is untouched.",
    "The five named tests and the text tests (9 peopleChangeText, 4 peopleSearchText) fail if the feature is deleted or a boundary moves.",
    "Survivors (VF7): :136, :141 and :157 are equivalent (a), reasons valid. The 10 no-coverage mutants are 5 exhaustive defaults x2, covered by vue-tsc (b). All accepted."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestPeopleSearch.vue",
      "line": 86,
      "severity": "block",
      "rule_id": "RK65",
      "problem": "Because of the deviation, field.value.focus() runs when the add settles, seconds after the pick (longer with a queue). If the user has moved to another control in the box by then (a Remove menu item, a re-request button), focus jumps back into the field and the next key goes into the search. After a click or Enter the field still has focus, so the call only ever takes focus away.",
      "fix": "Keep the clear (text = \"\" and searchPeople(\"\")) and drop field.value.focus(), or call it only when document.activeElement is the field or document.body."
    },
    {
      "file": "frontend/src/ui/MergeRequestPeople.vue",
      "line": 115,
      "severity": "should",
      "rule_id": "VF8",
      "problem": "Nothing runs rule 9 (owner #2246) end to end. Deleting peopleBoxOpened(props.row.iid) passes every vitest (no .vue is mounted) and every recorded fixture step. Only the Closed half is shown, by the notices clearing on reopen. A later change to the open watch could drop the row from under an open box unnoticed.",
      "fix": "Add a fixture step to the verifier's smoke: Reviewer filter \"None\", open !637's box, add a reviewer. The row stays while the box is open and leaves when it closes."
    }
  ]
}
