# RangeReviewedStore

Agent output (`agent://RangeReviewedStore`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedStore.md), collected 2026-11-19T09:55:02.226Z.

{
  "summary": "The range window now has a Reviewed store part with no view yet. `ReviewedSource` comes with domain, tauri and fixture sources, and `RangeSource` extends it. `ui/rangeReviewed.ts` is the only owner of the marks: it holds the count and busy state, toggles a mark and opens the next file, offers review-from-start, and loads the since view. `nextOpen` holds #48's next-file rule in one place. The visited list moved to `ui/rangeVisited.ts`. A `reviewed` Problem has its words. `rangeStore` loads the marks at start-up. app-session gains `--reviewed seeded` and `--review-of`.",
  "files_changed": [
    "frontend/src/ipc/ReviewedSource.ts (new)",
    "frontend/src/ipc/reviewedDomain.ts (new)",
    "frontend/src/ipc/reviewedDomain.test.ts (new)",
    "frontend/src/ipc/tauriReviewed.ts (new)",
    "frontend/src/ipc/tauriReviewed.test.ts (new)",
    "frontend/src/ipc/fixtureReviewed.ts (new)",
    "frontend/src/ipc/fixtureReviewed.test.ts (new)",
    "frontend/src/ipc/RangeSource.ts",
    "frontend/src/ipc/tauriRange.ts",
    "frontend/src/ipc/tauriRange.test.ts",
    "frontend/src/ipc/fixtureRange.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ui/rangeReviewed.ts (new)",
    "frontend/src/ui/rangeReviewed.test.ts (new)",
    "frontend/src/ui/rangeVisited.ts (new)",
    "frontend/src/ui/nextFile.ts",
    "frontend/src/ui/nextFile.test.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problem.test.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts",
    "frontend/src/ui/rangeStore.ts",
    "frontend/src/ui/rangeStore.test.ts",
    "frontend/src/ui/rangeThreads.test.ts",
    "frontend/scripts/app-session/args.ts",
    "frontend/scripts/app-session/args.test.ts",
    "frontend/scripts/app-session/startArgs.ts",
    "frontend/scripts/app-session/startArgs.test.ts"
  ],
  "tests_added": [
    {
      "name": "nextFile.test next_open_wraps_skips_done_and_never_answers_the_active_file",
      "proves": "nextOpen wraps, skips done files, never answers the active file, starts from the top for null; the nextUnresolved cases are unchanged and pass"
    },
    {
      "name": "rangeReviewed.test: the 11 tests the brief names",
      "proves": "Rule 2's toggle and next file, rule 6's forget, rule 3's count over listed files only, failed writes keep the marks and report with the path, one write at a time, busy until a list answers ok"
    },
    {
      "name": "rangeReviewed.test a mark before the window knows its files is stored and shows nothing next",
      "proves": "A toggle with start null stores the mark and shows nothing (kills the `?.` mutant on start)"
    },
    {
      "name": "rangeReviewed.test a_failed_since_load_forgets_the_view_and_reports",
      "proves": "A since failure calls forget(id), reports step since with the path and answers null; a success passes the reply through"
    },
    {
      "name": "rangeStore.test start-up order with the Reviewed marks; a failed openRange loads no marks",
      "proves": "Start-up order is openRange, listThreads, listReviewed, checkGitLab; no list when the open fails"
    },
    {
      "name": "rangeStore.test a Reviewed click shows the next file in the window; a failed since load drops its view and reports",
      "proves": "The store wires show to showPath and forget to rangeVisited, and problems reach the problem bar and the log"
    },
    {
      "name": "reviewedDomain.test (5 tests)",
      "proves": "Marks are kept by id; a negative id or a repeated file throws with its index; since texts brand their differences through toDifferences; noText passes as is"
    },
    {
      "name": "tauriReviewed.test (5 tests)",
      "proves": "Each command's call and arguments and its conversion; a failure is passed through unchanged; a list naming a file twice is refused"
    },
    {
      "name": "tauriRange.test the range source answers listReviewed through the app's command",
      "proves": "RangeSource spreads createTauriReviewed"
    },
    {
      "name": "fixtureReviewed.test (9 tests)",
      "proves": "Seeded marks; no marks without the flag; the miss is logged; board.ts's since reply (lines 40–42, one difference); noText for logo, binary and missing replies; mark and unmark; UnknownRangeFile; a list taken earlier is a copy; per-call logs"
    },
    {
      "name": "problem.test a failed Reviewed call logs its step, its file when it has one, and its cause",
      "proves": "failureFields for reviewed: path is present for a write and absent for a list"
    },
    {
      "name": "problemText.test a failed Reviewed call at %s says what failed",
      "proves": "The four sets of words from the brief, plus the null-path fallback"
    },
    {
      "name": "startArgs.test --reviewed seeded …; --review-of passes --review-of=<project!iid> …",
      "proves": "Both flags reach their targets, and each is refused outside --range-case or --range or on the other command"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b (exit 0, no diagnostics)"
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" (exit 0, no findings)"
    },
    {
      "command": "pnpm -C frontend unused && pnpm -C frontend fmt:check",
      "observed": "knip: no output; oxfmt: \"All matched files use the correct format. Finished in 1301ms on 864 files\""
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  314 passed (314) / Tests  4697 passed (4697)"
    },
    {
      "command": "pnpm exec vitest run --project node <the slice's 11 test files> scripts/app-session",
      "observed": "all passed once the two existing refusal regexes in args.test.ts were updated to the new words \"--threads, --gitlab, --reviewed and --ai only with --range-case\""
    },
    {
      "command": "just mutants HEAD (second run, after the survivor-killing tests)",
      "observed": "All files 91.69 %, 1181 killed, 102 survived, 5 no cov; reviewedDomain/tauriReviewed/tauriRange/rangeVisited/problem 100 %, rangeReviewed 98.70 % (1 survivor), fixtureReviewed 87.50 % (12, all module-level consts), rangeStore 95.28 % (6, all on unchanged lines)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 1181 killed, 102 survived, 5 no cov; most survivors sit on unchanged lines of whole-file-mutated files",
    "survivors": [
      "frontend/src/ui/rangeReviewed.ts:90:52 `?? []` → `?? [\"Stryker was here\"]` — equivalent: with start null, nextOpen finds the string, whose `.path` is undefined, so `?? null` still answers null and nothing is shown",
      "frontend/src/ipc/fixtureReviewed.ts:10-13 SEEDED_MARKS literal/values — wiring: a module-level const is evaluated once under the vitest runner (#732). The values are asserted exactly by fixtureReviewed.test's seeded-marks test",
      "frontend/src/ipc/fixtureReviewed.ts:16 SINCE_PATH → \"\" — wiring: a module-level const, as above. Asserted by the board.ts since test, whose expected differences only board.ts gets",
      "frontend/src/ipc/fixtureReviewed.ts:20-22 NO_WORDS object/arrays (7 mutants) — wiring: a module-level const, as above. Asserted by the board.ts since test's `words` (toEqual)",
      "frontend/src/ui/nextFile.ts:9:47 slice(0, at+1) → files — equivalent (and the line's text is unchanged): duplicates after the wrap never come before the first match"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "`ReviewedStep` lives in `ui/problem.ts`, beside `ThreadStep`, not in `rangeReviewed.ts`. Exporting it from rangeReviewed would make problem.ts ↔ rangeReviewed.ts an import cycle (oxlint import/no-cycle counts type imports). rangeReviewed imports it from problem.ts.",
    "`createRangeReviewed`'s window parameter is the named type `ReviewedWindow` (same fields as the contract). `createFixtureReviewed`'s third parameter is the structural `{ start: RangeStart; files: readonly RangeFile[] }` (fixtureRange's private `Case` fits it) rather than an exported Case.",
    "Fixture since rule as built: a non-text file answers noText, which covers logo.png without a path special case; only board.ts is special-cased by path. `listReviewed` logs `range.fixture_reviewed { kind: \"list\" }` with no file. A reply missing for a listed id answers noText.",
    "problemText: for mark/unmark/since, a null path reads \"the file\". The contract types path as `string | null` for every step; only `list` passes null. The thread/ai/mergeRequests/reviewed words moved into `steppedText` to keep `attempted` within 40 lines.",
    "rangeStore.ts: `showFile` moved into `chromeActions` to keep `createRangeStore` within 40 lines. File is 295 lines.",
    "app-session: `start-app --review-of` is refused without --range. The format is left to yamt's own refusal. args.test.ts (owned) got `reviewOf: null` in its range literals and the two refusal regexes updated.",
    "Docs keeper: tree.md must name ipc/{ReviewedSource,reviewedDomain,tauriReviewed,fixtureReviewed}.ts and ui/{rangeReviewed,rangeVisited}.ts. state.md needs rows: marks mirror → ui/rangeReviewed.ts; visited list → ui/rangeVisited.ts. map-check fails today: the app slice's 4 commands are missing from architecture.md and ipc-contract.",
    "Lines for ui/AGENTS.md (owned by `view`): \"Reviewed marks: `rangeReviewed.ts` owns `marks` (written only after Rust answered), `counted`, `busy`, `toggle` (next file via `nextFile.ts` `nextOpen`), `reviewFromStart`, `loadSince` (a failure forgets the view). The mounted list (`MOUNTED_FILES`, `markShown`, `forget`) is in `rangeVisited.ts`.\""
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/rangeReviewed.ts:49-57",
      "risk": "A failed first list leaves `busy` true for the window's life: no toggle works until a reload. This matches the contract (\"true until the first list answers ok\"), but the view slice must show why the button is dead (the problem bar shows \"Could not read the Reviewed marks\")."
    },
    {
      "location": "frontend/src/ui/rangeReviewed.ts:100-114",
      "risk": "`loadSince` does not clear an earlier problem about the path on success, unlike `loadFile`'s `clearProblemAbout`. The view slice may want that when the since view replaces loadFile for a file."
    }
  ]
}
