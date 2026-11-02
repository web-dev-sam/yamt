# MrRowDetailsCore

Agent output (`agent://MrRowDetailsCore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsCore.md), collected 2026-11-02T19:56:57.981Z.

{
  "summary": "The page's core in `mergeRequests/` now has three-state filters (`Held`/`Mode`/`ChoiceState`). `clicked` follows rule 7 and replaces `toggled`. `passes` reads included and excluded values, and \"None\" excluded means \"has at least one\". `filterLabel` reads \"not …\". Choices carry `state` and sort by count. Stored words gain a `not:` form, and old words still read. `byDueDate` is added. New modules: `dueDate.ts` (calendar-day arithmetic in English text), `people.ts` (stack, names, initials, hue, review states) and `labels.ts`. Every one has its test.",
  "files_changed": [
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md",
    "frontend/src/mergeRequests/internal/filters.ts",
    "frontend/src/mergeRequests/internal/filters.test.ts",
    "frontend/src/mergeRequests/internal/choices.ts",
    "frontend/src/mergeRequests/internal/choices.test.ts",
    "frontend/src/mergeRequests/internal/stored.ts",
    "frontend/src/mergeRequests/internal/stored.test.ts",
    "frontend/src/mergeRequests/internal/order.ts",
    "frontend/src/mergeRequests/internal/order.test.ts",
    "frontend/src/mergeRequests/internal/dueDate.ts",
    "frontend/src/mergeRequests/internal/dueDate.test.ts",
    "frontend/src/mergeRequests/internal/people.ts",
    "frontend/src/mergeRequests/internal/people.test.ts",
    "frontend/src/mergeRequests/internal/labels.ts",
    "frontend/src/mergeRequests/internal/labels.test.ts"
  ],
  "tests_added": [
    {
      "name": "filters.test.ts rule 7: six transitions (test.each)",
      "proves": "off→included/excluded, included→off/excluded, excluded→off for both click and Shift+click"
    },
    {
      "name": "the_owners_example_not_me_and_label_x_keeps_only_those_rows",
      "proves": "Assignee not Me with Label bug keeps only row 2"
    },
    {
      "name": "none_excluded_means_at_least_one",
      "proves": "excluded None keeps rows with at least one assignee, reviewer or label"
    },
    {
      "name": "an_included_and_an_excluded_value_in_one_filter",
      "proves": "inside one filter: any included matches AND no excluded matches"
    },
    {
      "name": "filterLabel … \"Assignee: not Me, anna\" (test.each)",
      "proves": "excluded values read \"not <word>\", in held order"
    },
    {
      "name": "a new value goes last, a changed one keeps its place",
      "proves": "clicked appends new values; a mode change keeps the position"
    },
    {
      "name": "values_follow_their_count_then_their_name / me_and_none_stay_first_whatever_their_count",
      "proves": "rule 9 order; insertion order differs from name order so ties really sort by label"
    },
    {
      "name": "a_held_value_no_longer_listed_comes_last_with_count_0 / an_excluded_value_reads_excluded",
      "proves": "missing held values come last with count 0, by label; `state` reads excluded"
    },
    {
      "name": "old_words_read_as_included_and_unknown_words_are_dropped / an_excluded_word_round_trips / a_value_stored_twice_reads_once",
      "proves": "RK55: today's exact JSON reads as included; not: words round-trip; first word wins; junk is dropped"
    },
    {
      "name": "days_left_changes_at_local_midnight / days_left_across_month_and_year_ends / a_daylight_saving_day_counts_once",
      "proves": "RK56 under TZ=Europe/Berlin (asserts the 23 h and 25 h days, so TZ is really honoured); leap and non-leap Feb, Dec 31 → Jan 1"
    },
    {
      "name": "daysLeftText five forms; calendarDayFrom refuses 2026-02-30, 2026-13-01, 26-1-1, empty (and more)",
      "proves": "word forms and the overdue flag; only real YYYY-MM-DD days parse"
    },
    {
      "name": "dated_rows_come_first_soonest_on_top_overdue_first / equal_days_newest_first / undated_rows_keep_their_order",
      "proves": "byDueDate order"
    },
    {
      "name": "people.test.ts stack, initials, blank name, hues, approversText, authorText, only_a_done_review_can_be_re_requested",
      "proves": "peopleStack dedupes assigned reviewers, 3 shown + more; hue is stable, in 0–359 and differs between users; reviewDone is false only for requested"
    },
    {
      "name": "labels.test.ts none/one/three, moreText(2) === \"+2\"",
      "proves": "labelsShown split and the +N text"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run --project node src/mergeRequests scripts/palette.test.ts scripts/fences.test.ts",
      "observed": "Test Files  15 passed (15)  Tests  279 passed (279)"
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — no findings, exit 0"
    },
    {
      "command": "pnpm -C frontend typecheck | grep -oE '^src/[^(]+' | sort | uniq -c",
      "observed": "3 src/ui/mergeRequestFilters.test.ts; 2 src/ui/MergeRequestFilter.vue; 1 src/ui/mergeRequests.test.ts; 10 src/ui/mergeRequests.ts (16 errors: toggled gone, checked→state, Held shape, reviewers Person[]→Reviewer[]). All are in files the brief lists; none in mergeRequests/."
    },
    {
      "command": "pnpm -C frontend unused; pnpm -C frontend exec oxfmt --check src/mergeRequests; just map-check",
      "observed": "knip clean; \"All matched files use the correct format.\"; \"map-check: ok\""
    },
    {
      "command": "pnpm -C frontend test (whole node project)",
      "observed": "14 failed, all in src/ui/mergeRequestFilters.test.ts and src/ui/mergeRequests.test.ts (expected callers, e.g. \"toggled is not a function\"); palette.test.ts passes after the fix below"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD stops in the dry run on the expected ui failures; same stryker run with tests limited to src/mergeRequests: 8 files, 577 killed, 3 survived, 8 no-cov",
    "survivors": [
      "filters.ts:121 stateAfterClick default {} / default: (NoCoverage) — gate-covered: the `never` exhaustive default is unreachable while the switch covers ChoiceState (tsc + tsgolint)",
      "filters.ts:47,49 sameValue `b.kind === … &&` → true — equivalent, and the line is unchanged: a username/title of a different kind is undefined, never equal to a string",
      "filters.ts:50,65,190 exhaustive defaults (NoCoverage) — gate-covered and unchanged lines",
      "stored.ts:49 wordsOf `return []` → [\"Stryker was here\"] — equivalent, unchanged line: the junk word is dropped as unknown"
    ]
  },
  "acceptance_not_run": [
    "`just mutants HEAD` as written: its Stryker dry run runs the whole node project and stops on the expected ui caller failures (\"toggled is not a function\"). I ran the same mutation with tests limited to src/mergeRequests instead; rerun the recipe once the state/page slices land."
  ],
  "deviations_from_brief": [
    "people.ts reviewDone doc comment reads \"(owner answer 2104)\", not the contract's \"(owner #2104)\": scripts/palette.test.ts rejects \"#2104\" as a hex colour literal.",
    "New export `rowPeople(row, field)` in internal/filters.ts (not exported from index). It is the one place that turns a row's reviewers into persons, used by both `passes` and `choices.ts` counting.",
    "byDueDate's type parameter is written as a local alias `Created` = { readonly iid: number; readonly createdAt: number }, identical to the contract's bound. `merged` shares its `newestFirst` comparator; its behaviour is unchanged.",
    "Choices: a held person who is the logged-in user keeps today's username label and real count. It sorts by count with the listed values; only count-0 values go last.",
    "dueDate tests set TZ with `vi.stubEnv(\"TZ\", \"Europe/Berlin\")` (no existing test did this), build `now` from local parts, and assert the 23 h and 25 h day lengths.",
    "For the mutation run I briefly created frontend/src/mergeRequests/stryker.scratch.json and vitest.scratch.ts (target/ is outside my files) and deleted them after the run.",
    "Old tests in filters/choices/stored were rewritten to the new shape (`toggled` → `clicked`, `checked` → `state`). Choices tests whose order changed now expect count order (e.g. 'bob' 0 last)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/dueDate.ts:25",
      "risk": "Validity is checked only by the month staying the same after Date's day rollover. That is enough for 2-digit days (any day outside 1–31 changes the month) but is not spelled out in code."
    },
    {
      "location": "frontend/src/mergeRequests/internal/people.ts:49-55",
      "risk": "pictureHue is a simple base-31 hash mod 360, and tests pin its values (anna 144, sam 231). Changing the formula shifts every user's colour."
    },
    {
      "location": "frontend/src/mergeRequests/internal/dueDate.test.ts:13",
      "risk": "Relies on Node applying a runtime process.env.TZ change. The test asserts the DST day lengths, so it fails loudly if a runner ignores it."
    }
  ]
}
