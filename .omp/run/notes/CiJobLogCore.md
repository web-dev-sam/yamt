# CiJobLogCore

Agent output (`agent://CiJobLogCore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogCore.md), collected 2026-11-03T10:25:06.923Z.

{
  "summary": "I added the pure core for the CI job log in `frontend/src/mergeRequests/`. `jobLogView` turns a raw GitLab trace into styled lines in one scan, following GitLab's job-page rules. `hitPlaces` maps search hits onto runs. `basicColour` maps a 256-colour index to one of the 16 colours. `firstHit`, `steppedHit`, `hitCountText` and `NO_RESULTS` drive the search steps. `index.ts` exports exactly the contract names, and `AGENTS.md` has a job-log paragraph. Lint, typecheck, knip and the format check are clean, and all tests pass.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/jobLog.ts",
    "frontend/src/mergeRequests/internal/sgr.ts",
    "frontend/src/mergeRequests/internal/ansiColours.ts",
    "frontend/src/mergeRequests/internal/jobLogSearch.ts",
    "frontend/src/mergeRequests/internal/jobLog.test.ts",
    "frontend/src/mergeRequests/internal/ansiColours.test.ts",
    "frontend/src/mergeRequests/internal/jobLogSearch.test.ts",
    "frontend/src/mergeRequests/index.ts",
    "frontend/src/mergeRequests/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "ansiColours.test: the_first_sixteen_are_themselves / a_256_colour_is_its_nearest_basic_one / a_tie_goes_to_the_lower_index / anything_else_is_no_colour",
      "proves": "0–15 map to themselves; every index the brief names, plus one per colour, gives its nearest basic colour; the tie at 249 goes to white; -1, 256, 1.5 and NaN give null"
    },
    {
      "name": "jobLog.test: timestamps_are_stripped_and_plus_lines_join, a_log_whose_first_line_has_no_timestamp_keeps_text_that_looks_like_one",
      "proves": "rule 2: the first line decides; the 32-character prefix is stripped; + lines join; a timestamp in mid-line or an unstamped line is kept whole (also a_first_line_whose_prefix_breaks_the_pattern_keeps_it)"
    },
    {
      "name": "jobLog.test: section_markers_vanish_and_their_header_is_a_plain_line, a_section_marker_ends_a_line_that_has_text",
      "proves": "rule 3: markers with options are dropped and a marker ends a line that has text; text_that_is_almost_a_section_marker_stays_text keeps near-markers as text"
    },
    {
      "name": "jobLog.test: a_lone_carriage_return_clears_the_line_and_crlf_is_a_break, a_joined_line_keeps_the_carriage_return_before_its_join",
      "proves": "rules 1, 2, 5: a line break is \\r*\\n; a lone \\r clears the line but keeps the style; at a + join the \\r before it stays and clears"
    },
    {
      "name": "jobLog.test: only_sgr_styles_and_every_other_escape_vanishes, an_escape_cut_off_at_the_line_end_drops_the_rest",
      "proves": "rule 4: the introducer and final-character ranges (@ _ ~, non-ASCII, DEL); only ESC[…m is applied; a cut-off escape drops the rest of the line"
    },
    {
      "name": "jobLog.test: codes_follow_gitlabs_exact_table (37 cases), bold_shows_basic_foregrounds_bright_but_not_indexed_or_bright_ones",
      "proves": "rules 6–7: codes are read by exact text (01, +1, 031, 5, 8, 28); every on/off code; empty and trailing-; parameters; 30–37 show bright while bold, 90–97 and 38;5 never do"
    },
    {
      "name": "jobLog.test: a_256_colour_goes_through_basic_colour, truecolor_is_ignored_and_its_numbers_read_as_codes",
      "proves": "38;5 / 48;5: what they consume, out-of-range values, NaN read as 0, parseInt; 38;2;… reads its numbers as codes"
    },
    {
      "name": "jobLog.test: the_style_carries_across_lines, empty_lines_are_not_shown, control_characters_but_tab_vanish, markup_in_a_log_stays_text",
      "proves": "rules 5, 8, 9 and RK57: <script> and &amp; stay as run text exactly as written"
    },
    {
      "name": "jobLog.test: equal_styles_merge_into_one_run_and_no_run_is_empty, the_text_is_the_lines_joined_by_line_breaks",
      "proves": "rule 10: equal shown styles merge into one run; over all 60+ test inputs, text equals the lines joined by \\n and no line or run is empty"
    },
    {
      "name": "jobLog.test: hit_places_at_run_boundaries, a_whole_log_of_500_kb_parses_in_linear_time",
      "proves": "hitPlaces' boundary rule, a hit across three runs, and hits outside the view left out; a 511,889-character stamped, coloured log gives 9,000 lines in under 300 ms"
    },
    {
      "name": "jobLogSearch.test: the_first_current_match_is_the_last, steps_wrap_both_ways, the_count_reads_one_based",
      "proves": "firstHit gives count-1 or null; steps wrap at both ends, also with count 1; the count reads \"3 of 17\"; NO_RESULTS is \"No results\""
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test -- src/mergeRequests",
      "observed": "Test Files  263 passed (263); Tests  3912 passed (3912); Duration 8.61s (the recipe runs the whole node project)"
    },
    {
      "command": "pnpm -C frontend exec vitest run --project node src/mergeRequests --reporter=verbose",
      "observed": "✓ jobLog.test.ts > a_whole_log_of_500_kb_parses_in_linear_time 42ms; Test Files 18 passed (18); Tests 364 passed (364)"
    },
    {
      "command": "pnpm -C frontend exec tsx -e '<jobLogView over the same 9,000-line stamped coloured log, 5 runs, performance.now()>'",
      "observed": "511889 chars, 9000 lines, 27.8 ms / 27.1 / 23.7 / 19.4 / 16.6 ms (parse only; the budget is 300 ms)"
    },
    {
      "command": "pnpm -C frontend lint; pnpm -C frontend typecheck; pnpm -C frontend unused; pnpm -C frontend fmt:check",
      "observed": "lint exit 0 (oxlint --type-aware && eslint); typecheck exit 0 (vue-tsc -b); unused exit 0 (knip); \"All matched files use the correct format.\""
    },
    {
      "command": "spot check of the module-level survivors: TIMESTAMP without ^, SECTION's * removed, SGR \"22\" → (pen)=>pen and XTERM red → (0,0,0) applied by hand, then restored",
      "observed": "7 tests failed (124 and 94 is red, the timestamp tests, codes \"1;22\", bold, equal_styles). The SECTION * mutant was not caught; I then added the marker-after-text cases that tell it apart."
    },
    {
      "command": "just mutants HEAD",
      "observed": "5 files, 537 mutants: 395 killed, 22 timeout, 103 survived, 2 no coverage. Score 79.89; ansiColours 64.71, jobLog 86.97, jobLogSearch 92.86, sgr 70.69. Done in 36 s."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 395 killed, 22 timeout, 103 survived, 2 no coverage (79.89 %); only the 3 below sit outside module-level constants",
    "survivors": [
      "jobLog.ts:223 pointAt(runs, to, \"\") — equivalent: any edge other than \"start\" takes the end branch (<=), as \"end\" does",
      "jobLog.ts:57 physical[0] ?? \"…\" (NoCoverage) — equivalent: split always returns at least one element; the fallback exists for noUncheckedIndexedAccess",
      "sgr.ts:89 code = \"…\" default (NoCoverage) — equivalent: slice(at, …) with at < length always has a first element",
      "ansiColours.ts:34-73 (30: BASIC_COLOURS names, BRIGHT_OF, SIXTEEN, XTERM_RGB entries, CUBE_LEVEL, GRAY_LEVEL) — gate-covered: module-level (#732), pinned by ansiColours.test; red was checked by hand",
      "jobLog.ts:36 TIMESTAMP regex (19) — gate-covered: module-level regex (#732); the timestamp tests and the mid-line case kill each one (the missing ^ was checked by hand)",
      "jobLog.ts:38 SECTION regex (16), :39 SECTION_END, :40 CONTROL_OR_SECTION, :41 ESCAPE — gate-covered: module-level (#732), killed by the section tests, the almost-marker tests and the escape tests",
      "jobLogSearch.ts:1 NO_RESULTS \"\" — gate-covered: module-level constant (#732), asserted in the_count_reads_one_based",
      "sgr.ts:20-26 PLAIN_PEN, :36-38 digitCodes, :42-63 every SGR_CODES entry, :66 INDEXED_COLOUR (33) — gate-covered: module-level table (#732); codes_follow_gitlabs_exact_table pins each code (\"22\" was checked by hand)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "I added a fourth file, internal/sgr.ts (Pen, PLAIN_PEN, penAfter: the SGR code table and 38/48;5). With it inside jobLog.ts, that file would pass the 300-line cap (TS11). The docs keeper needs a project-map tree.md row for `mergeRequests/internal/sgr.ts`, otherwise map-check (PM6) fails.",
    "AnsiColour (with BasicColour, BASIC_COLOURS and BRIGHT_OF) is declared in internal/ansiColours.ts, not jobLog.ts. jobLog → sgr → ansiColours would otherwise import jobLog back, a cycle. The type is the same 16-name union, exported from index.ts as the contract asks.",
    "The contract's /** */ comment on jobLogView said \"(rules below)\"; it now points to mergeRequests/AGENTS.md for the rules and their sources. The other contract comments are kept as written.",
    "Rule 5 applied literally: a \\r at the very end of the log (no \\n after it) is a lone \\r, so it clears that last line (\"gone\\r\" shows nothing). Pinned in a test.",
    "The scan finds the next special character with a regex (/[^\\t -~\\u0080-\\uFFFF]|section_/) instead of looking at one character at a time. With the per-character loop, the 500 KB test took 304 ms under Stryker's instrumentation and the dry run failed; plain node now parses in 17–28 ms.",
    "Extra tests beyond the named ones, each for a gap the mutants showed: a_tie_goes_to_the_lower_index, a_first_line_whose_prefix_breaks_the_pattern_keeps_it, text_that_is_almost_a_section_marker_stays_text."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/sgr.ts:42",
      "risk": "SGR_CODES is a plain object, so inherited keys like \"toString\" exist. They are unreachable: an SGR parameter cannot contain letters or \"_\", because those characters end the escape."
    },
    {
      "location": "frontend/src/mergeRequests/internal/jobLog.ts:38",
      "risk": "The section-marker options follow the brief (`\\w+=\\w+` pairs). An empty `[]` or a non-word option value from a newer runner would not match. The text before \\r is still cleared, so only the 'ends a line that has text' rule would be missed."
    },
    {
      "location": "frontend/src/mergeRequests/internal/jobLog.test.ts:330",
      "risk": "The 300 ms timing test measures about 30 ms in node, but it ran at 304 ms under an instrumented Stryker build before the regex scan. A heavily loaded CI machine could make it flaky."
    }
  ]
}
