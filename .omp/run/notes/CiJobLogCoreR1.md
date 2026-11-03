# CiJobLogCoreR1

Agent output (`agent://CiJobLogCoreR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogCoreR1.md), collected 2026-11-03T10:45:19.921Z.

{
  "summary": "jobLog tests no longer depend on run order. `viewOf` checks the invariant (text = lines joined by \\n, every line has a run, no run is empty) on every view, and the_text_is_the_lines_joined_by_line_breaks now runs over its own six inputs. `LogStyle` is now `Omit<Pen, \"foreground\"> & { foreground }`, so its attributes are declared once, in sgr.ts `Pen`. `shownStyle` spreads them, and `sameStyle` compares every field generically. A new pair of tests shows that a change of bold, background, underline or struck alone starts a new run.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/jobLog.ts",
    "frontend/src/mergeRequests/internal/sgr.ts",
    "frontend/src/mergeRequests/internal/jobLog.test.ts"
  ],
  "tests_added": [
    {
      "name": "equal_styles_merge_into_one_run_and_no_run_is_empty (extended: a ESC[1m/41m/4m/9m b)",
      "proves": "a change of bold, background, underline or struck alone splits runs into [\"a\", PLAIN] and [\"b\", styled(…)] (#2166)"
    },
    {
      "name": "the_text_is_the_lines_joined_by_line_breaks (rewritten over a local list)",
      "proves": "the invariant holds for empty, blank-only, CR-cleared, style-only, timestamp-joined and section inputs, with no count guard and no dependence on order (#2156, #2165)"
    },
    {
      "name": "viewOf helper → expectWellFormed",
      "proves": "every view any test builds through viewOf satisfies the text/run invariant"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run src/mergeRequests --sequence.shuffle",
      "observed": "Running tests with seed \"1793702427426\" … Test Files 18 passed (18), Tests 364 passed (364)"
    },
    {
      "command": "pnpm -C frontend exec vitest run src/mergeRequests/internal/jobLog.test.ts -t the_text_is",
      "observed": "Tests 1 passed | 61 skipped (62): the named test passes when run on its own"
    },
    {
      "command": "pnpm -C frontend fmt; typecheck; lint; unused; test",
      "observed": "oxfmt, vue-tsc -b, oxlint --type-aware && eslint, and knip all clean; Test Files 263 passed (263), Tests 3917 passed (3917)"
    },
    {
      "command": "hand mutant sgr.ts:43 \"0\": () => undefined, then vitest run jobLog.test.ts (reverted afterwards)",
      "observed": "Tests 6 failed | 56 passed, incl. codes_follow_gitlabs_exact_table (\"1;3;4;9;31;42;0\"): the static survivor is a #732 artefact"
    },
    {
      "command": "hand mutant jobLog.ts:33 SECTION without ^, then vitest run jobLog.test.ts (reverted afterwards)",
      "observed": "FAIL text_that_is_almost_a_section_marker_stays_text; Tests 1 failed | 61 passed"
    },
    {
      "command": "stryker --mutate ansiColours.ts,jobLogSearch.ts --ignoreStatic (same flags as just mutants)",
      "observed": "68 killed, 31 survived. Every survivor is a module-level table or constant (ansiColours.ts:34-73, jobLogSearch.ts:1 NO_RESULTS); no runtime mutant survived"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: no Rust; Stryker jobLog.ts 228 killed / 14 timeout / 46 survived / 1 no-cov; sgr.ts 74 / 8 / 33 / 1; all 80.00%",
    "survivors": [
      "jobLog.ts:72,79,82,105 kind \"dropped\"→\"\" — equivalent: in applied(), \"\" matches no case and returns, the same as the dropped case",
      "jobLog.ts:154 case \"dropped\" body removed or label \"\" — equivalent: falls off the end of a switch that returns void",
      "jobLog.ts:92 end + SECTION_END.length → minus — equivalent: the marker's last 6 chars hold no ESC or section_, and the \\r that follows clears them",
      "jobLog.ts:52 physical[0] ?? \"\" (no-cov) — equivalent: split always returns ≥1 element",
      "jobLog.ts:211 pointAt edge \"end\"→\"\" — equivalent: pointAt only tests edge === \"start\"",
      "sgr.ts:89 code = \"\" default (no-cov) — equivalent: slice(at,…) with at < length always has a first element",
      "jobLog.ts:31 TIMESTAMP regex ×19 — gate-covered: module-level, #732; each breaks the stamped prefix used by the timestamp and prefix tests",
      "jobLog.ts:33 SECTION ×16, :34 SECTION_END, :35 CONTROL_OR_SECTION, :36 ESCAPE — gate-covered: #732; the ^ mutant was applied by hand and fails text_that_is_almost…",
      "sgr.ts:20-26 PLAIN_PEN, :36-38 digitCodes, :42-63 SGR_CODES entries, :66 INDEXED_COLOUR (33) — gate-covered: #732; \"0\" was applied by hand and fails 6 tests; codes_follow_gitlabs_exact_table pins each code",
      "ansiColours.ts:34-73 (30), jobLogSearch.ts:1 — gate-covered: #732, module-level tables (separate run, file not in the HEAD diff)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2157: on top of the suggested LogStyle = Omit<Pen,\"foreground\"> & {foreground}, `sameStyle` now compares `Object.entries(left)` against `Reflect.get(right, field)`, so a new attribute needs no edit there. `shownStyle` spreads the remaining attributes. The `background` null comment moved onto `Pen`.",
    "I also ran Stryker on ansiColours.ts and jobLogSearch.ts with just mutants' flags, because #2165 says their scores were inflated too and they are not in the HEAD diff."
  ],
  "open_risks": [
    {
      "location": "frontend/src/mergeRequests/internal/jobLog.ts:120",
      "risk": "sameStyle now allocates an entries array on every addText call. The 500 KB test still passes under 300 ms, but on a large log it costs more than the old field-by-field compare."
    }
  ]
}
