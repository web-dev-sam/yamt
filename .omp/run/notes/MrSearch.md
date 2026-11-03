# MrSearch

Agent output (`agent://MrSearch`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T08-37-08-403Z_01a1a08e-14b3-70d2-9e68-44d830b6bbca/MrSearch.md), collected 2026-11-03T08:54:35.582Z.

{
  "summary": "The merge-request list now has a search field. The framework-free `searched()` in `mergeRequests/internal/search.ts` keeps rows whose title contains the trimmed text (case ignored), or whose iid is any standalone number in the text. The slice gained `search` and `setSearch`; `shownRows` is `datedFirst(searched(filtered(…)))`, and `show` empties the search. The new `MergeRequestSearch.vue` is the first item in the filter bar. The shown-rows derivation moved to the new `ui/mergeRequestsShown.ts` (Main approved, option A).",
  "files_changed": [
    "frontend/src/mergeRequests/internal/search.ts",
    "frontend/src/mergeRequests/internal/search.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestsShown.ts",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/MergeRequestSearch.vue",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "search.test: the title matches in any case, also its Draft prefix (catches a case-sensitive match)",
      "proves": "rule 2: case-insensitive title match, \"Draft: \" prefix included"
    },
    {
      "name": "search.test: the text is trimmed before it is matched",
      "proves": "surrounding whitespace does not stop a title match"
    },
    {
      "name": "search.test: empty or whitespace-only text matches every row and returns the rows themselves",
      "proves": "blank text returns `rows` itself (identity)"
    },
    {
      "name": "search.test: %s names merge request 12345 (catches a number form missed)",
      "proves": "the !N, #N, N, `MR N fix`, `see !N,` and merge_requests URL forms each name their number"
    },
    {
      "name": "search.test: %s names no number (catches digits inside a word taken as an iid)",
      "proves": "v2, abc123, 12ab, x34, 34é, 1e3 and 0x12 name nothing, with rows 2/123/12/34/1000/18 present so a wrong parse would show"
    },
    {
      "name": "search.test: two numbers show both / a number shows its MR and titles containing it / a number matching no iid lets a title through / 0042 is 42",
      "proves": "rule 3: several numbers, number OR title, 0042 names 42"
    },
    {
      "name": "mergeRequests.test: the search narrows the shown rows and the summary, never the checklist counts",
      "proves": "!630 gives 1 of 40, a title in other case, `choices` unchanged, blank text shows all"
    },
    {
      "name": "mergeRequests.test: a row is shown only when it passes the filters and matches the search; Clear filters keeps the search",
      "proves": "rule 4: search AND Label filter, and clearAll leaves the search text"
    },
    {
      "name": "mergeRequests.test: searched rows keep dated rows first",
      "proves": "datedFirst still orders the searched rows"
    },
    {
      "name": "mergeRequests.test: Refresh keeps the search; show empties it",
      "proves": "rule 6 lifetime"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test; typecheck; lint; fmt:check; sfc-order; unused; just map-check",
      "observed": "Tests 3821 passed (3821); vue-tsc -b, oxlint+eslint, check-sfc-order and knip printed nothing (clean); \"All matched files use the correct format.\"; \"map-check: ok\""
    },
    {
      "command": "just app-session start-fixture --name mrs --diff --mr list --size 1600x1000; click Merge requests; click field; type '!630'; read",
      "observed": "\"1 of 40 merge requests | !630 | field=!630 | focus=Search merge requests | barTops=59.5,59.5,59.5,59.5,59.5 | fieldWidth=288\" (dark screenshot /tmp/mr-search-dark-630.png); [title] inside the MR section: 0"
    },
    {
      "command": "press Escape (text in field); then type 'SHOW OVERDUE'",
      "observed": "\"40 of 40 merge requests | field= | focus=Search merge requests | clearBtn=false\"; then \"4 of 40\": rows !639 !629 !619 !609, all \"Show overdue cards in red\""
    },
    {
      "command": "click 'Clear search' (x button)",
      "observed": "\"40 of 40 merge requests | field= | focus=Search merge requests\""
    },
    {
      "command": "type the …/merge_requests/620 URL, Ctrl+A Ctrl+X, then Ctrl+V (a real WebKit paste)",
      "observed": "after the cut \"40 of 40 | field=\"; after the paste \"1 of 40 merge requests | field=https://gitlab.example.com/taskboard/taskboard/-/merge_requests/620\", row \"Draft: Snooze a reminder !620\""
    },
    {
      "command": "Label filter frontend (8 rows); type 'overdue !635 !640'; then click Clear filters",
      "observed": "\"1 of 40\": only !635 (!640 is not frontend) (/tmp/mr-search-dark-label.png). After Clear filters: \"2 of 40 | field=overdue !635 !640\": !640 and !635"
    },
    {
      "command": "click Refresh, wait 4 s, read",
      "observed": "\"2 of 40 merge requests | field=overdue !635 !640 | refreshDisabled=false\""
    },
    {
      "command": "in the field: Escape (text present), then Escape again",
      "observed": "first: \"page=true | 40 of 40 | field= | focus=Search merge requests\"; second: \"page=false | focus=Merge requests\""
    },
    {
      "command": "reopen; type 'snooze' (4 of 40); Back; reopen; read",
      "observed": "\"40 of 40 merge requests | field=[]\""
    },
    {
      "command": "set <html data-theme=light>; type '!630'; shot. Then Label: frontend with 'SHOW OVERDUE'; shot",
      "observed": "\"1 of 40 merge requests | titles in page=0\" (/tmp/mr-search-light-630.png); \"2 of 40 | Label: frontend | !639 ; !619 | barTops=59.5,59.5,59.5,59.5,60.5,59.5\": filter bar on one line with Clear filters shown (/tmp/mr-search-light-label.png)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → All files 95.76% (384 killed, 0 timeout, 2 survived, 15 no coverage); search.ts 27 killed/1 no-cov; mergeRequestsShown.ts 5/5; mergeRequests.ts 175 killed/2 survived",
    "survivors": [
      "frontend/src/mergeRequests/internal/search.ts:4 `?? []` → `?? [\"Stryker was here\"]` (NoCoverage) — equivalent: that word fails /^\\d+$/, so it names no number either way",
      "frontend/src/ui/mergeRequests.ts:218 shallowRef(\"\") → \"Stryker was here!\" — equivalent: the page is only reached through `show`, which empties the search first; a test would only pin a default (SP5)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "New file frontend/src/ui/mergeRequestsShown.ts (`shownOf`: remembered filters, shownRows, choices, summary, filter actions), moved out of createMergeRequests. mergeRequests.ts was at 299/300 lines and its function at the 40-line cap; Main approved option A.",
    "tree.md rows needed under the merge-request page: `mergeRequestsShown.ts` (`shownOf`: filters, `datedFirst(searched(filtered(…)))`, choices over every loaded row, summary); `MergeRequestSearch.vue` (the filter bar's search field). Under mergeRequests/internal: `search.ts` (`searched`: title or a number named in the text).",
    "state.md row needed: merge-request search text — owner `ui/mergeRequests.ts` State `search`; writers `setSearch` (MergeRequestSearch.vue via the View) and `show` (empties it); never stored.",
    "VU15: MergeRequestSearch.vue is its own component because the field owns its Escape/× focus behaviour and its icon layout, which keeps the View a composition surface.",
    "The search.test #-form case uses #12345, not #1234: palette.test's hex-colour fence flags `#1234` (#rgba) in source. The form tested is the same.",
    "Field background is `bg-panel` as the brief says; SearchPanel's box uses `bg-panel-inline`. Width is w-72 (288 px). type=\"text\", not \"search\", so WebKit's built-in cancel button does not double the ×.",
    "Light-theme shots set <html data-theme=\"light\"> directly via app-session read, not through Settings.",
    "Screenshots are in /tmp (/tmp/mr-search-{dark,light}-{630,label}.png), outside the repo."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/search.ts:4",
      "risk": "A 'letter' is Unicode \\p{L} and a digit is ASCII \\d; `_1234` and `1234²` still name 1234. This follows the brief's wording, but such edge forms are untested."
    },
    {
      "location": "frontend/src/ui/MergeRequestSearch.vue:34",
      "risk": "The 288 px width was checked only at 1600 px, with the filter bar on one line including Clear filters. Long filter labels at narrower windows wrap (flex-wrap) as before."
    }
  ]
}
