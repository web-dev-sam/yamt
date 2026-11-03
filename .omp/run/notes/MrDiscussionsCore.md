# MrDiscussionsCore

Agent output (`agent://MrDiscussionsCore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsCore.md), collected 2026-11-03T14:16:11.556Z.

{
  "summary": "New `mergeRequests/internal/discussions.ts`: the discussion types, the turn rule, `discussionTurns` (viewer's turn first, newest first, stable ties), `turnCounts`, and the box's words (`turnText`, `turnSummaryText`, `placeText`, `noteAuthorName`, `noteExcerpt`, the two constants). `relativeTime.ts` gains `agoText`, with `createdAgo` built on it. Both are exported from index.ts and documented in AGENTS.md.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/discussions.ts",
    "frontend/src/mergeRequests/internal/discussions.test.ts",
    "frontend/src/mergeRequests/internal/relativeTime.ts",
    "frontend/src/mergeRequests/internal/relativeTime.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "the_viewers_own_last_comment_is_waiting_any_other_is_the_viewers_turn",
      "proves": "viewer sam: sam's last comment is waiting; anna's and an unknown author's are sam's turn"
    },
    {
      "name": "a_reviewer_other_than_me_gets_the_turns_from_their_side",
      "proves": "the same discussions for anna flip: anna's waits, sam's is her turn"
    },
    {
      "name": "a_null_viewer_has_every_turn",
      "proves": "viewer null: every discussion is the viewer's turn, also when the author is unknown; counts 3/0"
    },
    {
      "name": "the_viewers_turn_comes_first_then_newest_first_within_each",
      "proves": "group order, then createdAt descending within each group"
    },
    {
      "name": "equal_times_keep_gitlabs_order",
      "proves": "ties keep the input order, in both directions (stable sort)"
    },
    {
      "name": "the_counts_add_up_to_the_open_discussions",
      "proves": "viewersTurn + waiting = open.length, for two viewers and for an empty list"
    },
    {
      "name": "the_summary_counts_words_singular_and_plural",
      "proves": "the Contract's five cases, including waits/wait and No open discussions"
    },
    {
      "name": "the_turn_words_are_not_swapped",
      "proves": "Your turn / Waiting for an answer map to the right Turn; the label text"
    },
    {
      "name": "a_file_place_reads_path_and_line_or_path_alone",
      "proves": "Overview, path:line, path alone"
    },
    {
      "name": "the_excerpt_keeps_three_lines_and_cuts_with_an_ellipsis",
      "proves": "four lines, \\r\\n, leading blank lines, 280/300 characters, end-trim at the cut, an emoji kept whole at the cut, 280 emoji not cut"
    },
    {
      "name": "markup_and_capitals_stay_as_typed",
      "proves": "**x**, <b>X</b>, &amp; and capitals stay as typed"
    },
    {
      "name": "an_unknown_author_is_someone",
      "proves": "null → Someone; display name; a blank name falls back to the username"
    },
    {
      "name": "ago_text_uses_the_largest_whole_unit_and_just_now",
      "proves": "the unit table at every boundary, just now under a minute and for a time ahead of the clock"
    },
    {
      "name": "created_ago_keeps_its_words",
      "proves": "createdAgo still reads 'created just now' / 'created 3 hours ago'"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run --project node src/mergeRequests/internal/discussions.test.ts src/mergeRequests/internal/relativeTime.test.ts --reporter=verbose",
      "observed": "every named acceptance test ✓; Test Files 2 passed (2), Tests 34 passed (34)"
    },
    {
      "command": "pnpm -C frontend test -- src/mergeRequests",
      "observed": "Test Files 269 passed (269), Tests 4029 passed (4029) (the `--` filter is not applied, so this is the whole node project)"
    },
    {
      "command": "pnpm -C frontend exec vitest run --project node scripts/fences.test.ts src/mergeRequests",
      "observed": "Test Files 20 passed (20), Tests 435 passed (435)"
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — no diagnostics, exit 0"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b — no output, exit 0"
    },
    {
      "command": "pnpm -C frontend unused; oxfmt on the owned files",
      "observed": "knip --include exports,types: no findings. oxfmt rewrote discussions.ts's layout; tests were re-run green afterwards"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: discussions.ts 76 killed / 6 survived / 2 no-cov; relativeTime.ts 17 killed / 14 survived (all on unchanged lines 7-15: UNITS/FORMAT)",
    "survivors": [
      "discussions.ts:20 DISCUSSIONS_LABEL \"\" — gate-covered: module-level const not re-evaluated under vitest (justfile:153, #732); asserted by the_turn_words_are_not_swapped",
      "discussions.ts:21 UNKNOWN_AUTHOR \"\" — gate-covered: module-level const (#732); asserted by an_unknown_author_is_someone",
      "discussions.ts:26 TURN_RANK {} — gate-covered: module-level const (#732); the order tests would fail (NaN comparator)",
      "discussions.ts:28-30 TURN_TEXTS {} / \"\" ×2 — gate-covered: module-level const (#732); asserted by the_turn_words_are_not_swapped",
      "discussions.ts:77 default exhaustive branch (NoCoverage ×2) — equivalent: unreachable, `place` is `never` there"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Existing createdAgo table tests moved to agoText (same cases without the 'created ' prefix); createdAgo keeps three word checks in created_ago_keeps_its_words.",
    "Added `the_turn_words_are_not_swapped` beyond the named list. It pins turnText and DISCUSSIONS_LABEL.",
    "The excerpt joins kept lines with \\n, so a \\r\\n body comes out with \\n breaks. The brief does not say which break the output uses."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/discussions.ts:94",
      "risk": "The 280 limit counts code points, as the Contract says. A ZWJ emoji sequence or a flag can still be cut between its code points, though never inside a surrogate pair."
    },
    {
      "location": "frontend/src/mergeRequests/internal/discussions.ts:35",
      "risk": "Usernames are compared exactly (case-sensitive). That assumes GitLab sends the same case for currentUser and note authors."
    }
  ]
}
