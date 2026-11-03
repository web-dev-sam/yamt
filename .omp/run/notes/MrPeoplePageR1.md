# MrPeoplePageR1

Agent output (`agent://MrPeoplePageR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeoplePageR1.md), collected 2026-11-03T23:35:14.318Z.

{
  "summary": "All four blocks are fixed and every acceptance line was checked. After an add is answered, the people field still clears (only if its text has not changed since the pick), but it takes focus back only from `document.body`. Each box line now builds its control keys once (`review.rerequest.control`, `menuControl`); the template binds them and `lineControls` uses the same values for `keepFocusInBox`. The empty-row definition now lives only in the state slice, as `rowPeopleAsks`, used by both components; `NO_PEOPLE_ASKS` is deleted.",
  "files_changed": [
    "frontend/src/ui/MergeRequestPeople.vue",
    "frontend/src/ui/MergeRequestPeopleSearch.vue",
    "frontend/src/ui/mergeRequestPeople.ts",
    "frontend/src/ui/mergeRequestPeople.test.ts",
    "frontend/src/ui/mergeRequestPeopleLines.ts",
    "frontend/src/ui/mergeRequestPeopleLines.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "mergeRequestPeople.test.ts: a_row_with_no_asks_reads_an_empty_queue_and_no_notice",
      "proves": "rowPeopleAsks gives { queue: [], notDone: [] } for an iid with no asks, and the stored asks for an iid with a queued change."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt; fmt:check; typecheck; lint; sfc-order; unused",
      "observed": "'All matched files use the correct format.'; vue-tsc -b, oxlint --type-aware + eslint, check-sfc-order and knip printed nothing (clean)."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  281 passed (281) / Tests  4237 passed (4237)"
    },
    {
      "command": "just app-session start-fixture --name mpr --diff --mr list --open-mr --size 1600x1000; !640 box → Add reviewer → type erik; one read: click the @erik option, then click 'More for Sam Weller'",
      "observed": "Right after: 'spin:1 active:menuitem Remove assignee'. About 4 s later: 'ms since pick:3984 active:menuitem Remove assignee field:\"\"'; Erik Lund is now under Reviewers and his line reads 'Already a reviewer'. Focus stayed on the menu and the field cleared."
    },
    {
      "command": "same session: Escape, click the 'Search people' combobox, click the option 'Anna Berg@anna' (a real click)",
      "observed": "After the answer: 'combobox \"\"'; Anna is listed under Reviewers. Focus stays on the field and the field is cleared."
    },
    {
      "command": "rule 9: Reviewer filter → 'None12'; open the !637 box → Add reviewer → click Dmitri Volkov",
      "observed": "While the box is open: '12 of 40 merge requests :: !637,!634,…' and the box shows 'Reviewers … DV Dmitri Volkov'. After Escape Escape: 'boxes:0 :: 11 of 40 merge requests :: !634,!631,…' (!637 has left). Session stopped."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (StrykerJS: mergeRequestPeople.ts, mergeRequestPeopleLines.ts, mergeRequests.ts; .vue not mutated): 420 killed, 6 survived, 2 no coverage",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2268: the reader is `rowPeopleAsks(asks, iid)` in mergeRequestPeople.ts, re-exported (value export) from ui/mergeRequests.ts next to the slice's people types. The components import it from there; the slice itself also uses it in place of its two `?? NO_ASKS` fallbacks.",
    "#2265/#2270: the field is focused only when `document.activeElement === document.body`. When the field already has focus, focusing it again would change nothing, so that half of the brief's rule holds without a check.",
    "WebKit focus case: the pick and the More-menu open ran in one `app-session read` (element.click() on the option, then on 'More for Sam Weller'), so both land before the fixture's answer. The non-regressed path used real clicks. I used --open-mr and --size on start-fixture to open the page directly.",
    "Docs keeper: in .omp/skills/project-map/tree.md:280, replace `NO_PEOPLE_ASKS` (deleted) with `rowPeopleAsks` under mergeRequestPeople.ts. In state.md row 80 (the field's `text`), add: focus comes back to the field after an answered add only from document.body.",
    "No survivor is on a changed line. People.ts:111 calls += 1 → -= 1 is equivalent: a generation counter that is only compared for equality. Lines.ts:133/138/154 are round 1's equivalent survivors at shifted lines; mergeRequests.ts:128/180 are outside this slice. The 2 no-coverage mutants sit on the exhaustive default at lines.ts:93 (gate-covered)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestPeopleSearch.vue:78-84",
      "risk": "The .vue rule has no unit test, because these components have no component tests and .vue is not mutated. Only the WebKit session above shows it."
    }
  ]
}
