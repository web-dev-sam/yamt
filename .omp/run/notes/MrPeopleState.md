# MrPeopleState

Agent output (`agent://MrPeopleState`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleState.md), collected 2026-11-03T22:58:51.554Z.

{
  "summary": "Adding and removing assignees and reviewers now works in the window's state. New `searchPeople`/`changePeople` on `MergeRequestSource` (app and fixture). `ui/mergeRequestPeople.ts`: 250 ms search pause, newest answer only, one change at a time per merge request, GitLab's lists written to the row, notices until the box closes. Rule 9: an open box keeps its row shown. List loading moved to `ui/mergeRequestsList.ts` (Main approved). Lint, typecheck and tests pass; `pnpm unused` fails on 10 contracted type exports not imported yet.",
  "files_changed": [
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/mergeRequestDomain.ts",
    "frontend/src/ipc/mergeRequestDomain.test.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequestPeople.ts",
    "frontend/src/ipc/fixtureMergeRequestPeople.test.ts",
    "frontend/src/ipc/fixtureMergeRequestData.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/mergeRequestPeople.ts",
    "frontend/src/ui/mergeRequestPeople.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestsList.ts",
    "frontend/src/ui/mergeRequestsShown.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts"
  ],
  "tests_added": [
    {
      "name": "mergeRequestPeople.test.ts: the 16 tests the brief names",
      "proves": "Search: 250 ms pause, newest answer (RK65), empty text, end, kept people, refused/thrown. Changes: per-row queue, rows in parallel, no duplicates, changed/unchanged lists (RK64), notices, box close, open set."
    },
    {
      "name": "mergeRequests.test.ts: a_people_change_rewrites_both_lists_in_rows_and_in_a_buffering_refresh, a_rerequest_still_rewrites_only_the_reviewers",
      "proves": "`withPeople` is the one writer: rows plus a buffering refresh; a re-request leaves the assignees as they were."
    },
    {
      "name": "mergeRequests.test.ts: the_filters_count_a_person_added_by_a_change",
      "proves": "The reviewer choices count erik after `changed` replies (1, then 2)."
    },
    {
      "name": "mergeRequests.test.ts: the three a_row_whose_people_box_is_open… / an_open_box_does_not_bring_back… tests",
      "proves": "Rule 9: an open box keeps its row past the filters and the search, the summary counts it, closing releases it; a row a refresh dropped stays gone."
    },
    {
      "name": "mergeRequestDomain.test.ts: found_and_changed_replies_get_pictures_like_a_rows_and_others_pass_unchanged",
      "proves": "`found`, `changed` and `unchanged` convert pictures (uploaded, gravatar, none); refused and failed replies pass through as the same object."
    },
    {
      "name": "tauriMergeRequests.test.ts: searchPeople_and_changePeople_call_their_commands_with_the_arguments + 2 failure-table rows",
      "proves": "The commands get the text and (iid, change), replies are converted, and IPC failures come back unchanged."
    },
    {
      "name": "fixtureMergeRequestPeople.test.ts: the 5 tests the brief names",
      "proves": "Search after 300 ms by username or name, any case; the script's own lists per iid; olga unchanged on add, changed on remove; rita refused; unlisted iid fails; new reviewers requested; calls logged."
    },
    {
      "name": "problemText.test.ts: searchPeople / changePeople rows",
      "proves": "The two new step sentences."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; pnpm -C frontend typecheck; pnpm -C frontend fmt:check",
      "observed": "oxlint plus eslint: no output; `vue-tsc -b`: no errors; 'All matched files use the correct format.'"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  279 passed (279); Tests  4207 passed (4207)"
    },
    {
      "command": "vitest run --reporter=verbose on the 6 touched test files",
      "observed": "Test Files 6 passed; Tests 252 passed; every test name the brief lists shows ✓"
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "FAILS: 10 unused exported types. PeopleGroup (index.ts, mergeRequestDomain.ts); PeopleSearch, PeopleChangeFailure, NotDone, RowPeopleAsks (mergeRequestPeople.ts and their re-exports in mergeRequests.ts). All are contract-fixed exports for the page slice."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 1314 killed, 178 survived (140 in the untouched part of fixtureMergeRequestData.ts), 13 no coverage; after the kill tests, people files: 241 killed, 6 survived",
    "survivors": [
      "ui/mergeRequestPeople.ts:102 immediate:false→true / {} — wiring: vueuse starts an immediate timer only when a window exists; node tests have none. The new no-call check passes either way.",
      "ui/mergeRequestPeople.ts:106 calls+=1→-=1 — equivalent: every search or end call still gives a new, never-reused counter value",
      "ipc/fixtureMergeRequestPeople.ts:24 username toLowerCase→toUpperCase — equivalent on the fixed data: every username is its name's first word",
      "ipc/fixtureMergeRequestPeople.ts:22 .slice(0, 20) dropped — equivalent: the fixture knows 8 people",
      "ipc/fixtureMergeRequestPeople.ts:18 KNOWN_PEOPLE=[] — static: module level, not re-run under --ignoreStatic (#732); the search tests depend on it",
      "ipc/fixtureMergeRequestPeople.ts:60 exhaustive default — no coverage: unreachable over the closed PeopleGroup union",
      "ui/mergeRequestsList.ts:106 replaced([])→['…'] — equivalent: code moved unchanged; a row without openDiscussions is never queued"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "New file ui/mergeRequestsList.ts (Main approved): ListLoad, Load, ListState, received/ended/checked and `loadList` (was `load`) moved out of mergeRequests.ts, behaviour unchanged. With people wired in, mergeRequests.ts was 324 lines (cap 300); it is 240 now. mergeRequests.ts re-exports ListLoad.",
    "tree.md: add `mergeRequestsList.ts` (the list load: `loadList`, buffered refresh, checked rows; `ListLoad`) and `mergeRequestPeople.ts` (`createPeopleChanges`: search pause, per-row change queue, notDone, openPeopleBoxes).",
    "state.md: rows held state goes to mergeRequestsList.ts `loadList`. New rows: peopleSearch, peopleAsks, openPeopleBoxes (createPeopleChanges, held by the slice). The rows' people writer is `withPeople`.",
    "ui/AGENTS.md (page slice's) line: `useMergeRequests()` now carries peopleSearch/searchPeople/endPeopleSearch, peopleAsks/changePeople, and openPeopleBoxes/peopleBoxOpened/peopleBoxClosed (a box must call Closed on unmount). shownRows keeps open-box rows.",
    "Fixture: an unknown username's add or remove answers `unchanged` (as Rust treats an unknown user). Refused and failed replies never overwrite the kept lists.",
    "Wording changes in comments: 'plan #169' → 'plan §2 row 169', and 'owner #2246' → 'board item 2246'. The palette test treats '#169' and '#2246' as hex colours.",
    "createTauriMergeRequests went over 40 lines, so the two people calls live in a local `peopleCalls()` that the source spreads in.",
    "Order inside the fixture: an unlisted iid is checked before rita, so it always answers `failed`."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestPeople.ts:179",
      "risk": "`lastTurns` keeps one settled promise per changed iid for the window's life. It is small, but nothing clears it."
    },
    {
      "location": "frontend/src/ui/mergeRequestPeople.ts:180",
      "risk": "If `replaced` throws, that row's chain rejects and its later changes never run. Today `replaced` is `withPeople`, which cannot throw."
    },
    {
      "location": "frontend/package.json unused (knip)",
      "risk": "`pnpm unused` stays red until the page slice imports PeopleGroup, PeopleSearch, RowPeopleAsks, NotDone and PeopleChangeFailure."
    }
  ]
}
