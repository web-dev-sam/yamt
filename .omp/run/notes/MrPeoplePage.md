# MrPeoplePage

Agent output (`agent://MrPeoplePage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeoplePage.md), collected 2026-11-03T23:20:22.586Z.

{
  "summary": "The merge-request people box can now add and remove people when `row.mayRerequest` is true. Each group header has a `user-plus` button that opens `MergeRequestPeopleSearch.vue`: a combobox listing suggestions (empty field) or search results, with arrow keys, Enter, click and Escape. Every person's line ends with `MergeRequestPersonMenu.vue` (ellipsis → Remove), which spins while that change is queued. Changes GitLab did not make show as sentences. The box calls `peopleBoxOpened`/`peopleBoxClosed`. The pure rules live in `mergeRequestPeopleLines.ts`; the words are in `mergeRequestsText.ts`.",
  "files_changed": [
    "frontend/src/ui/MergeRequestPeople.vue",
    "frontend/src/ui/MergeRequestPeopleSearch.vue",
    "frontend/src/ui/MergeRequestPersonMenu.vue",
    "frontend/src/ui/mergeRequestPeopleLines.ts",
    "frontend/src/ui/mergeRequestPeopleLines.test.ts",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "already_in_the_group_is_not_addable_and_working_shows_for_a_queued_add",
      "proves": "pickList: Me first, then the row's people; people already in the group read already; a queued add of this group reads working, while another group's add or a remove does not."
    },
    {
      "name": "arrows_skip_people_already_there_and_wrap",
      "proves": "steppedHighlight moves only over addable lines, wraps both ways, starts from null and returns null when no line is addable."
    },
    {
      "name": "the_highlight_returns_to_the_first_addable_line_when_the_list_changes",
      "proves": "keptHighlight keeps the index while usernames and states are the same. A changed state, order or length gives firstAddable."
    },
    {
      "name": "a_remove_notice_sits_under_its_listed_person_else_under_the_group",
      "proves": "A remove of a listed person sits under that person. Adds (even of a listed person), removes of someone no longer listed and other groups' notices go elsewhere. Names use displayName or @username."
    },
    {
      "name": "searching_keeps_the_last_people_and_found_nobody_is_no_one_found",
      "proves": "While searching, the last people stay with the note 'Searching…'. found [] reads 'No one found'. refused and failed show their sentence with failed: true."
    },
    {
      "name": "the viewer on no loaded row… / a notice names a person… without an author / a person's remove queued or running is working…",
      "proves": "Me with no person gets initials from the username. A row with author null names @olga. `removing` counts only this group's remove."
    },
    {
      "name": "mergeRequestsText.test.ts: people words, moreLabel/alreadyText, peopleSearchText ×4, peopleChangeText ×9",
      "proves": "Every new word and sentence: Free add (both groups), still-lists remove, glab refusals, refused/failed reply.message, and a thrown cause in the problem bar's words."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt:check; typecheck; lint; sfc-order; unused; test",
      "observed": "'All matched files use the correct format.'; vue-tsc -b no errors; oxlint+eslint no output; sfc-order no output; knip no output (clean); 'Test Files 280 passed (280) / Tests 4230 passed (4230)'."
    },
    {
      "command": "just app-session start-fixture --name mp --diff --mr list --size 1600x1000; steps 1–2 on !640",
      "observed": "Box: 'Assignees SW Sam Weller Reviewers None'; buttons 'Add assignee,More for Sam Weller,Add reviewer'. Add reviewer → focus 'Search people', first line 'SW Me @sam'. Typed erik: 'Searching…', then 'EL Erik Lund @erik' with img. Click: spin:1 busy:true; then Erik under Reviewers ('Review requested'), field '' and focused, stack 'SW EL'. Reviewer filter: 'Erik Lund 1'. Keyboard: Me 'Already an assignee'; highlight Anna, Erik, Ben, Chiara, Dmitri, Anna, Dmitri, Chiara. Enter added Chiara. Escape: focus Add assignee. Escape again: box closed."
    },
    {
      "command": "fixture steps 3–5 (!638, !636), console.info captured in the page via app-session read",
      "observed": "Step 3: clicked 'SW Me @sam' on !638 and sam was added as assignee. Step 4: the menu shows 'Remove reviewer' and no fixture_people_change line was logged. Choosing it: spinner on 'More for Chiara Rossi', aria-busy true, then the remove line was logged. Chiara is gone, focus is on the box DIV, and approvals stay '2'. Step 5: Enter Enter → spinners 'Me @sam, Dmitri Volkov' at once; logs at 117656 and 118661 (1005 ms apart)."
    },
    {
      "command": "fixture steps 6–8",
      "observed": "Status lines 'GitLab did not add @olga as assignee (GitLab Free allows one assignee per merge request).' and 'Cannot assign @rita to !640'; assignees unchanged. After closing and reopening, status count is 0. With the field focused and the pointer away, typing keeps the box (boxes:1). Menu open with the pointer away: boxes:1 menus:1. Escape: menus:0, box stays. A click elsewhere: boxes:0. !632: no buttons. !637: 'Assignees None Reviewers None' with both add buttons."
    },
    {
      "command": "just app-session start-fixture --name mp --range-case review --mr list --open-mr; steps 1 and 4; shots",
      "observed": "Step 1 in the range window: first line 'SW Me @sam', spin:1, then Erik under Reviewers, field '' and focused, stack SWEL. Step 4: menu 'Remove reviewer', 0 log lines before choosing, one remove line after, approvals '2 approvals'. Shots in /tmp/mp-shots: 9-range-field-dark, 9-range-menu-dark and the -light pair (data-theme 'light'). Session stopped."
    },
    {
      "command": "scripts/local-conflicts-repo.sh /tmp/mp-scratch/mp; cargo tauri build --debug --no-bundle; just app-session start-app --name mp --diff --dir /tmp/mp-scratch/mp --glab mr-people",
      "observed": "Built target/debug/yamt. On !52, 'er' gives one argv line '…PeopleSearch… -f search=er'. Erik's img 'yamt-picture://localhost/erik', complete with naturalWidth 4. Free: 'GitLab did not add Anna Berg as assignee (GitLab Free allows one assignee per merge request).' Ghost: 'Reviewers not able to be set: ghost'."
    },
    {
      "command": "grep '^stdin:' <session>/glab/calls.log; !50",
      "observed": "Six bodies in order: SetAssignees APPEND erik; SetReviewers APPEND erik; SetAssignees REMOVE sam; SetReviewers REMOVE chiara; SetAssignees APPEND anna; SetReviewers APPEND ghost. Each has one username and iid 52. The !50 box has no buttons, adds:0, menus:0; shot real-50.png. Session stopped."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (StrykerJS: mergeRequestPeopleLines.ts and mergeRequestsText.ts; .vue not mutated): 306 killed, 3 survived, 10 no coverage",
    "survivors": [
      "ui/mergeRequestPeopleLines.ts:136 step > 0 → >= 0 — equivalent: the step is always ±1 (ARROW_STEPS), never 0.",
      "ui/mergeRequestPeopleLines.ts:141 join(\"\\n\") → join(\"\") — equivalent: usernames have no spaces and the three states are not prefixes of each other, so the key stays injective.",
      "ui/mergeRequestPeopleLines.ts:157 [] → [\"Stryker was here\"] — equivalent: a non-person entry never matches the username in find.",
      "ui/mergeRequestPeopleLines.ts:93 and mergeRequestsText.ts:209 exhaustive default (no coverage) — gate-covered: unreachable over closed unions; vue-tsc checks the never branch."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "VU15: MergeRequestPeopleSearch.vue exists because the add field has its own focus, keys and list. MergeRequestPersonMenu.vue exists because each person needs their own dropdown (one useDropdownMenu<true>).",
    "Decision: after an add the field clears to \"\" and refocuses once changePeople settles, not at the click, and only if the text is unchanged and the field still mounted. This lets a searched person's result line show its spinner, as acceptance step 1 asks. Design §1.6 says it clears at the pick.",
    "Decision: the add button toggles its field. Escape or a toggle that closes the field calls endPeopleSearch too, as box close does.",
    "Added beyond Contract (add-only): SEARCH_PEOPLE_PLACEHOLDER (\"Search people…\"); NO_PEOPLE_ASKS in mergeRequestPeopleLines.ts. A list note is {text, failed}: refusal and failure use the error colour, Searching/No one found are muted.",
    "Non-editable box: lines are now li py-0.5 with an inner min-h-6, the same 28 px height as before. Group headers are a flex div holding today's p.",
    "Evidence method: start-fixture has no --settings, so light theme came from Settings → Theme 'Light' in the session. Fixture log lines came from wrapping console.info in the page through app-session read (page only, no code). Scratch dir: /tmp/mp-scratch/mp.",
    "Docs keeper, tree.md: add MergeRequestPeopleSearch.vue (add field: combobox and list), MergeRequestPersonMenu.vue (per-person ellipsis menu, Remove), mergeRequestPeopleLines.ts (pickList, steppedHighlight/keptHighlight, personState/groupNotices, NO_PEOPLE_ASKS).",
    "Docs keeper, state.md: the box's `adding: PeopleGroup | null` is local to MergeRequestPeople.vue. The field's `text` and `highlight` are local to MergeRequestPeopleSearch.vue. No new slice state.",
    "ui/AGENTS.md: added one paragraph covering the people box and the state slice's useMergeRequests() surface handed on."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestPeopleSearch.vue:72-87",
      "risk": "The field clears only after the add is answered. Typing during the wait keeps the text, which is intended, but a slow GitLab leaves the picked query shown for that long."
    },
    {
      "location": "frontend/src/ui/MergeRequestPeopleSearch.vue:41-47",
      "risk": "The highlight resets whenever usernames or states change. A refresh or readiness update that reorders suggestions while the user is arrowing moves the highlight back to the first addable line."
    },
    {
      "location": "frontend/src/ui/MergeRequestPeople.vue:243-250",
      "risk": "On an editable row with nobody, the opener button has no aria-label of its own. Its name comes from the inner img's NO_PEOPLE_TEXT label, which app-session's name finder reports as empty."
    },
    {
      "location": "frontend/src/ui/mergeRequestPeople.ts (state slice) peopleSearch",
      "risk": "The search is one per window. Two boxes each with a field open at once (one held by focus, one by pointer) would share it. Opening an add field moves focus, which closes the other box, so this is not reached in practice."
    }
  ]
}
