# MrMentionsCore

Agent output (`agent://MrMentionsCore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsCore.md), collected 2026-11-05T09:33:40.961Z.

{
  "summary": "New pure module `mergeRequests/internal/mentions.ts`, exported through `index.ts`. It holds `MENTION_LINES` (10), `MentionWord`, `mentionWordAt` (rule 1, RK76), `knownMentions` (reuses `peopleOnRow`, which `suggestions.ts` now exports), `mentionLines` (known before found, starts-with before contains, each username once, at most 10), and `MentionEdit`/`mentionEdit` (rule 4). `mentions.test.ts` has the 13 tests the brief names. `mergeRequests/AGENTS.md` has a new Mentions paragraph.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/mentions.ts",
    "frontend/src/mergeRequests/internal/mentions.test.ts",
    "frontend/src/mergeRequests/internal/suggestions.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "a_word_starts_at_the_text_start_or_after_a_space_a_line_break_or_an_opening_bracket",
      "proves": "@an at the text start or after a space, \\n, \\t, (, [ or { gives { start, end, typed: \"an\" }"
    },
    {
      "name": "an_at_after_a_letter_starts_no_word",
      "proves": "RK76: a@b.c (caret after b and after c), x@y, see x@y, @@a and )@a give null"
    },
    {
      "name": "a_caret_inside_the_word_searches_the_text_before_it",
      "proves": "RK76: @an|na x gives start 0, end 5, typed \"an\". end runs over letters, digits, _ . - and ë, and stops at a space or the text end"
    },
    {
      "name": "a_space_or_a_caret_outside_ends_the_word",
      "proves": "`@an |`, `@an x`, a caret before the @ and a caret outside the text give null; a bare @ gives typed \"\" and end 1"
    },
    {
      "name": "a_name_with_an_accent_stays_one_word",
      "proves": "@zoë and @an.na-b_1 are each one word; an emoji is not a word character"
    },
    {
      "name": "known_people_come_before_found_people",
      "proves": "known matches come before found matches"
    },
    {
      "name": "starts_with_comes_before_contains_in_each_group",
      "proves": "anna comes before dscott for \"an\" in known, in found and in any case"
    },
    {
      "name": "a_name_matches_without_its_spaces",
      "proves": "annaberg matches Anna Berg; berg matches it only as contains, after a username that starts with berg"
    },
    {
      "name": "each_person_is_listed_once",
      "proves": "a username in both known and found shows once, at its known place, with the known object"
    },
    {
      "name": "at_most_ten_lines",
      "proves": "8 known + 8 found matches give 10 lines: the 8 known, then the first 2 found"
    },
    {
      "name": "a_blank_text_lists_every_known_person_and_no_found_one",
      "proves": "a blank or empty typed gives the known people, each once, and no found one"
    },
    {
      "name": "known_mentions_are_the_row_then_the_writers_each_once",
      "proves": "order is author, assignees, reviewers, approvers, then writers; nulls skipped, repeats removed; a null author or a null row is handled"
    },
    {
      "name": "the_pick_replaces_the_whole_word_and_adds_one_space",
      "proves": "RK76: mentionEdit({4,9,\"an\"},\"anna\") gives { from 4, to 9, insert \"@anna \" }"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt:check && lint && typecheck && test && unused",
      "observed": "oxfmt: All matched files use the correct format. oxlint/eslint: no output. vue-tsc -b: no output. vitest: Test Files 303 passed (303), Tests 4528 passed (4528). knip --include exports,types: no output"
    },
    {
      "command": "pnpm -C frontend exec vitest run --project node src/mergeRequests/internal/mentions.test.ts --reporter verbose",
      "observed": "all 13 named tests ✓, from a_word_starts_at_the_text_start_or_after_a_space_a_line_break_or_an_opening_bracket through the_pick_replaces_the_whole_word_and_adds_one_space"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → no Rust changes; Stryker mutated mentions.ts + suggestions.ts: 152 killed, 2 survived, 0 no-cov (mentions.ts 98.04%, suggestions.ts 100%)",
    "survivors": [
      "frontend/src/mergeRequests/internal/mentions.ts:16 `caret < 0` → `caret <= 0` — equivalent: at caret 0 the text before is empty, so the @ regex finds nothing and the result is null either way",
      "frontend/src/mergeRequests/internal/mentions.ts:52 `/\\s+/gu` → `/\\s/gu` — equivalent: a global replace with \"\" removes the same whitespace either way; `\\s+` is the brief's literal rule"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The brief expected mergeRequests/ unmutated, but the run mutated mentions.ts. Regexes in module-level consts could not be mutated (Stryker builds them once at import), so I moved them into the functions, found the word's end with `search`, and used null for no match. Extra test lines kill the real survivors.",
    "The test file has extra assertions beyond the brief's examples: an emoji is no word character, a caret outside the text, and a null author."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/mentions.ts:19",
      "risk": "A caret placed between the two halves of a surrogate pair (an emoji) is not treated as a word boundary. A textarea never puts selectionStart there in practice."
    }
  ]
}
