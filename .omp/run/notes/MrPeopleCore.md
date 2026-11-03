# MrPeopleCore

Agent output (`agent://MrPeopleCore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleCore.md), collected 2026-11-03T22:38:51.472Z.

{
  "summary": "`mergeRequests/internal/suggestions.ts` now has `SUGGESTED_PEOPLE` (20), the generic types `KnownPeople`/`Suggestion`, `peopleSuggestions` (rule 2) and `searchedText` (one leading @ dropped). `ME_WORD` in `filters.ts` is the only \"Me\" literal; `valueWord` and `meChoice` use it. `choices.ts` exports `peopleOf` and `byCountThenLabel`, and the suggestions reuse both. `index.ts` exports the new surface; `AGENTS.md` has a paragraph on it citing rule 2 and plan #169.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/suggestions.ts",
    "frontend/src/mergeRequests/internal/suggestions.test.ts",
    "frontend/src/mergeRequests/internal/filters.ts",
    "frontend/src/mergeRequests/internal/choices.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "me_comes_first_with_their_picture_from_any_loaded_row",
      "proves": "Me is line 1 and its person comes from another loaded row, or from the row itself when `rows` is empty."
    },
    {
      "name": "me_unknown_on_every_row_has_no_person",
      "proves": "A viewer on no row gets `person: null`; the other lines have kind \"known\"."
    },
    {
      "name": "no_me_entry_without_a_viewer",
      "proves": "When `me` is null there is no Me line; an empty row gives []."
    },
    {
      "name": "the_rows_own_people_follow_me_author_assignees_reviewers_approvers",
      "proves": "The row's own people come right after Me, in role order (not by name), ahead of people on more rows."
    },
    {
      "name": "others_are_ordered_by_rows_holding_them_in_the_group_then_by_name",
      "proves": "The same people order differently for assignees and reviewers; ties sort by displayName, so a person with a blank name sorts by username."
    },
    {
      "name": "each_username_appears_once",
      "proves": "Me on the row appears only as Me; a person in two groups or on several rows appears once."
    },
    {
      "name": "at_most_twenty_lines_me_included",
      "proves": "The list is capped at 20 lines with Me counted; the last line is user18."
    },
    {
      "name": "people_already_in_the_group_stay_listed",
      "proves": "People already in the group stay in the list for both groups."
    },
    {
      "name": "searched_text_trims_and_drops_one_leading_at",
      "proves": "\"  @ben \"→\"ben\", \"@\"→\"\", \"@@x\"→\"@x\", \"a b\" unchanged, \" @ ben\"→\"ben\", \"b@n\" unchanged, blank→\"\"."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — exit 0, nothing reported"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b — exit 0, nothing reported"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  277 passed (277) / Tests  4174 passed (4174); choices.test.ts and filters.test.ts unchanged and green"
    },
    {
      "command": "pnpm -C frontend unused && pnpm -C frontend fmt:check",
      "observed": "knip: nothing reported; oxfmt: All matched files use the correct format."
    },
    {
      "command": "grep '\"Me\"' frontend/src/mergeRequests (excluding *.test.ts and *.md)",
      "observed": "one hit: internal/filters.ts:43 export const ME_WORD = \"Me\";"
    },
    {
      "command": "pnpm -C frontend exec vitest run src/mergeRequests",
      "observed": "Test Files 21 passed (21), Tests 431 passed (431)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → choices.ts 120 killed/6 survived, filters.ts 228/12 (+8 no cov), suggestions.ts 52/0 (100%); total 400 killed, 18 survived",
    "survivors": [
      "frontend/src/mergeRequests/internal/filters.ts:43 ME_WORD \"Me\"→\"\" — gate-covered: static mutant the vitest runner never re-evaluates (#732); choices.test.ts asserts \"Me\". The other survivors are on unchanged lines."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "filters.ts gains `export type GroupedPeople = { assignees: readonly Person[]; reviewers: readonly { person: Person }[] }`, and `rowPeople`/`peopleOf` take it instead of `ListedRequest` so `KnownPeople<P>` rows fit (ListedRequest still fits).",
    "`byCountThenLabel` now takes a private `Counted = { label; count }` instead of `Choice<V>`. Choices still fit, and suggestions sort `{ person, label: displayName, count }`.",
    "When a row and a loaded row hold different data for the same username, the row's entry wins; among loaded rows the last copy wins, and order stays first-seen. The brief left this open.",
    "Docs keeper: `skill://project-map/tree.md` needs a row for `mergeRequests/internal/suggestions.ts`. That file is outside Owned."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/suggestions.ts:44-46",
      "risk": "If the page passes `rows` without the open `row`, the row's own people still appear but count only through `rows`. That is harmless for the order but depends on the page's call."
    }
  ]
}
