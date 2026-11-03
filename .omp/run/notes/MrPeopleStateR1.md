# MrPeopleStateR1

Agent output (`agent://MrPeopleStateR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrPeopleStateR1.md), collected 2026-11-03T23:09:40.534Z.

{
  "summary": "All three blocks are fixed. #2264: the search pause now uses a plain setTimeout/clearTimeout handle, so nothing starts when the slice is created and the useTimeoutFn `immediate` option is gone. #2261: in the fixture, removing anyone (except refused rita) answers `changed`, and only adding an unknown username or olga answers `unchanged`. #2262: `failureOf(outcome)` is now a pure mapping, and `answer` calls `deps.replaced` itself on a changed or unchanged reply. No exported name or type changed.",
  "files_changed": [
    "frontend/src/ui/mergeRequestPeople.ts",
    "frontend/src/ipc/fixtureMergeRequestPeople.ts",
    "frontend/src/ipc/fixtureMergeRequestPeople.test.ts"
  ],
  "tests_added": [
    {
      "name": "fixtureMergeRequestPeople.test.ts: adding_then_removing_follows_the_scripts_own_lists (updated)",
      "proves": "Removing 'nobody' from !639 answers `changed` with the lists as they were (as Rust's is_shown does); adding 'nobody' answers `unchanged`."
    },
    {
      "name": "fixtureMergeRequestPeople.test.ts: a_listed_reviewer_added_again_stays_once_and_a_removed_one_leaves_the_others",
      "proves": "Adding a listed reviewer again keeps them once; removing one reviewer keeps the others. Kills the survivors of peopleWith/peopleWithout at lines 41 and 61."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — no findings"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b — no errors"
    },
    {
      "command": "pnpm -C frontend fmt:check",
      "observed": "All matched files use the correct format."
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  279 passed (279); Tests  4208 passed (4208)"
    },
    {
      "command": "vitest run src/ui/mergeRequestPeople.test.ts src/ipc/fixtureMergeRequestPeople.test.ts",
      "observed": "16 + 6 tests passed. typing_waits_250_ms_then_asks_once_with_the_last_text advances 1000 ms right after creation and asserts searches == []."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 264 killed, 0 timeout, 4 survived, 4 no coverage; score 97.06 (98.51 covered). No timer mutant exists any more.",
    "survivors": [
      "src/ui/mergeRequestPeople.ts:103 `calls += 1` → `-= 1` — equivalent: `calls` is only compared for equality with the value seen when the search was sent, and any step makes it differ",
      "fixtureMergeRequestPeople.ts:43,64 NoCoverage on the `never` default arms — equivalent: unreachable, the type checker enforces it",
      "fixtureMergeRequestPeople.ts:18,22,24 (KNOWN_PEOPLE, found()) — lines this round did not change, left alone"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "frontend/src/ipc/AGENTS.md is unchanged: its sentence ('an add of FREE_TIER_PERSON olga or anyone unknown `unchanged`, … a remove drops → changed') already matches the new behaviour, as #2261 says.",
    "VU12 prefers vueuse to a hand-rolled timer. #2264 chose plain setTimeout/clearTimeout, which ui/searchRun.ts already uses, so the handle is typed `number | undefined` like there.",
    "The fixture's listAfter/peopleAfter became peopleWithout(people, change) and peopleWith(people, group, person). A remove needs no known person, and this way no placeholder person is passed."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/mergeRequestPeople.ts:100",
      "risk": "The plain timer is not cleared when an effect scope is disposed, as useTimeoutFn would do. The slice belongs to the window's store singleton, so it lives as long as the page [INFERENCE]."
    }
  ]
}
