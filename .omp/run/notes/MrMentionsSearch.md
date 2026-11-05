# MrMentionsSearch

Agent output (`agent://MrMentionsSearch`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsSearch.md), collected 2026-11-05T09:33:11.197Z.

{
  "summary": "`createPeopleSearch(source)` in `ui/mergeRequestPeople.ts` now returns a `PeopleSearcher` `{state, search, end}`. It is the old `searchOf` lifted out, with one new rule: a search for the same text while the state is `searching`/`found` asks nothing. `PeopleChanges.peopleSearch` is now that searcher, and the three old members are gone. The slice gains a second, separate instance, `mentionSearch`. All callers (both Vue files and the tests) are migrated with no alias. Two new tests were added.",
  "files_changed": [
    "frontend/src/ui/mergeRequestPeople.ts",
    "frontend/src/ui/mergeRequestPeople.test.ts",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/MergeRequestPeople.vue",
    "frontend/src/ui/MergeRequestPeopleSearch.vue"
  ],
  "tests_added": [
    {
      "name": "the_same_text_again_asks_nothing (mergeRequestPeople.test.ts)",
      "proves": "Same text while searching does not restart the pause. After found, \" an \" and \"@an\" keep it and ask nothing after 4 pauses. After a failed answer, and after a refused one, \"an\" asks again."
    },
    {
      "name": "the_people_box_and_mention_searches_never_touch_each_other (mergeRequests.test.ts)",
      "proves": "One pause gives two calls, er and an, each answer in its own state. peopleSearch.end() leaves mentionSearch found an. A held mention answer that arrives after peopleSearch.search(\"b\") lands only in mentionSearch (RK65, request rule 6)."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; unused; sfc-order",
      "observed": "vue-tsc -b, oxlint --type-aware && eslint, knip and check-sfc-order all exit clean. oxfmt: \"All matched files use the correct format.\""
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files 302 passed (302); Tests 4517 passed (4517). This includes the rewritten search tests and the untouched MergeRequestPeople* / mergeRequestPeopleLines tests."
    },
    {
      "command": "just app-session start-fixture --name mms --diff --mr list --open-mr --size 1600x1000",
      "observed": "{\"url\":\"http://localhost:34017/\",\"driverPort\":40601,...}"
    },
    {
      "command": "click opener nth 1 (row !640) → buttons [data-add]; click \"Add assignee\"; read options",
      "observed": "[\"Add assignee\",\"Add reviewer\"]. Focus is on the INPUT. Options: \"SWMe@samAlready an assignee\",\"ABAnna Berg@anna\",\"BOBen Okafor@ben\",\"CRChiara Rossi@chiara\",\"DVDmitri Volkov@dmitri\" (Me first)."
    },
    {
      "command": "hook console.info via read; Ctrl+A Backspace; type er; wait 1.5 s; read the logged people_search lines and the options",
      "observed": "[\"[info] mergeRequests.fixture_people_search {text: \\\"er\\\"}\"] (exactly one call). Options: Sam Weller, Anna Berg, \"ELErik Lund@erik\"."
    },
    {
      "command": "press Escape; read; press Escape; read",
      "observed": "After the first Escape: [2 add buttons, focus \"Add assignee\"], so the field is closed and the box is open. After the second: [0,0], so the box is closed."
    },
    {
      "command": "just app-session stop --name mms",
      "observed": "{\"stopped\":\"mms\",\"session\":\"ended\",...,\"folder\":\"removed /tmp/yamt-app-session-mms-sqNk8g\"}"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 99.32% (293 killed, 2 survived, 0 no-cov) over mergeRequestPeople.ts and mergeRequests.ts",
    "survivors": [
      "src/ui/mergeRequestPeople.ts:115 `calls += 1` → `calls -= 1`: equivalent. `calls` is only compared for equality with a snapshot, so any step that changes it drops stale answers the same way.",
      "src/ui/mergeRequests.ts:146 `listing.kind === \"done\"` → true: not a changed line. It is existing code in show(), mutated only because the file was touched."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The contract doc comment on PeopleSearcher says \"plan §2 rows 169, 191\" instead of \"#169, #191\". scripts/palette.test.ts flags `#169`/`#191` as colour literals in .ts files. The signature is unchanged.",
    "For mr-mentions-list, ui/AGENTS.md:75: replace \"`peopleSearch`/`searchPeople`/`endPeopleSearch` (the window's one search, ...)\" with \"`peopleSearch` and `mentionSearch`, two `PeopleSearcher`s `{ state, search, end }` from `createPeopleSearch` (plan §2 #191): 250 ms after the last call, newest answer only, the same text while searching/found asks nothing; neither touches the other (rule 6)\".",
    "Smoke step 3: fixture mode logs only to the browser console. To observe the log line, console.info was wrapped through `app-session read`, and the line reads `{text: \"er\"}` in WebKit's console form.",
    "The search test in mergeRequests.test.ts calls vi.useFakeTimers() after rig(). rig() fakes only Date, and the pause needs setTimeout faked."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequests.ts:255-296",
      "risk": "createMergeRequests is now at the 40-line max-lines-per-function limit (lint passes). The next member added there must be moved into a helper such as peopleOf."
    },
    {
      "location": "frontend/src/ui/mergeRequestPeople.ts:119-124",
      "risk": "Typing the same searched text again (for example adding a trailing space) after `found` now keeps the shown answer without a fresh call. The brief requires this, but results that are stale at GitLab are not re-fetched until the text changes."
    }
  ]
}
