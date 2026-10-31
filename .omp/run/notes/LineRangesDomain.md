# LineRangesDomain

Agent output (`agent://LineRangesDomain`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesDomain.md), collected 2026-10-31T12:05:04.405Z.

{
  "summary": "The ipc layer now carries a thread's `ThreadPlace` (a `start` DiffLine plus an `end` ThreadLine) in place of its single line. `threadLine.ts` has the new types and functions `diffLineOf`, `onePlace`, `sameDiffLine`, `isOneLine`, `toThreadPlace` and `fromThreadPlace`; `fromThreadLine` is removed and `toThreadLine` is private. `ReviewSource`, `reviewDomain`, `tauriReview`, `fixtureReview` and `index.ts` all use the place. The `?threads=seeded` fixture adds two range threads (4 and 5) on board.ts. `ipc/AGENTS.md` is updated.",
  "files_changed": [
    "frontend/src/ipc/threadLine.ts",
    "frontend/src/ipc/ReviewSource.ts",
    "frontend/src/ipc/reviewDomain.ts",
    "frontend/src/ipc/reviewDomain.test.ts",
    "frontend/src/ipc/tauriReview.ts",
    "frontend/src/ipc/tauriReview.test.ts",
    "frontend/src/ipc/fixtureReview.ts",
    "frontend/src/ipc/fixtureReview.test.ts",
    "frontend/src/ipc/fixtureThreads.ts",
    "frontend/src/ipc/fixtureRange.test.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "reviewDomain.test: a thread keeps its session and its place's start and end of every kind",
      "proves": "toThreadList carries both ends of every DiffLine and ThreadLine kind unchanged"
    },
    {
      "name": "reviewDomain.test: a bad left/right line is refused, naming the field",
      "proves": "errors name threads[0].place.start.left and threads[0].place.end.right"
    },
    {
      "name": "reviewDomain.test: toThreadPlace refuses %j, naming %s (8 cases) + names the field it is given",
      "proves": "every number at each end of each kind is branded, and the field prefix is used (default \"place\")"
    },
    {
      "name": "reviewDomain.test: fromThreadPlace hands the app the same place",
      "proves": "the place goes back to the generated shape unchanged"
    },
    {
      "name": "reviewDomain.test: diffLineOf drops the column only / a line builder keeps the column / onePlace",
      "proves": "unchangedOnLeft and unchangedOnRight become unchanged; removed and added pass through; onePlace = {diffLineOf(line), line}"
    },
    {
      "name": "reviewDomain.test: sameDiffLine of %s is %s (12 cases)",
      "proves": "a match is true for each kind; every mismatch is false: another left, another right, and each pair of different kinds"
    },
    {
      "name": "reviewDomain.test: isOneLine (each one-line kind; an unchanged start with both unchanged ends; removed→added)",
      "proves": "one line only when start is end's own line"
    },
    {
      "name": "tauriReview.test: addThread hands the file, the place's start and end as they are, and the text",
      "proves": "commands.addThread gets {start,end} unchanged"
    },
    {
      "name": "fixtureReview.test: ?threads=seeded … two range threads; addThread stores … a two-line place",
      "proves": "threads 0–5 with their places, messages and postings; the stored two-line place; new ids continue after the seed (6/7)"
    },
    {
      "name": "fixtureRange.test: ?threads=seeded sits on board.ts's lines as their kinds say",
      "proves": "every seeded start and end lies inside a difference (removed/added), or outside both and paired (unchanged*)"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test src/ipc",
      "observed": "Test Files  29 passed (29)\n      Tests  546 passed (546)"
    },
    {
      "command": "pnpm -C frontend typecheck | grep 'error TS' | grep -oE '^src/[a-z]+/' | sort | uniq -c",
      "observed": "     26 src/editor/\n     10 src/ui/   (36 errors in total, none under src/ipc/)"
    },
    {
      "command": "pnpm -C frontend exec oxlint --type-aware src/ipc; echo $?",
      "observed": "no diagnostics; oxlint_exit=0"
    },
    {
      "command": "pnpm -C frontend exec oxfmt --check src/ipc",
      "observed": "All matched files use the correct format."
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "Unused exports: diffLineOf, isOneLine, onePlace, sameDiffLine (index.ts:141-144); unused types: DiffLine, ThreadPlace (index.ts:148,151). These are exports the Contract requires; the editor and window builds import them."
    }
  ],
  "mutation": {
    "command": "recipe's stryker cmd + --testFiles src/ipc/**/*.test.ts (just mutants HEAD stops: ui tests fail in dry run): 601 killed, 5 survived, 25 no coverage",
    "survivors": [
      "src/ipc/threadLine.ts:82 `b.kind === \"unchanged\"` → `true` — equivalent: a removed or added b has no left or no right, so `a.left === b.left && a.right === b.right` is already false",
      "src/ipc/threadLine.ts sameDiffLine/toThreadLine/toDiffLine `default: never` blocks (NoCoverage) — equivalent: these branches cannot be reached",
      "fixtureReview.ts:106, reviewDomain.ts:161-163, index.ts:161 survivors/no coverage — not on lines I changed (they were there before)"
    ]
  },
  "acceptance_not_run": [
    "`just mutants HEAD` exactly as written did not finish: its Stryker dry run runs the ui tests, which fail until the window build. I ran the recipe's own Stryker command limited to src/ipc tests instead (see mutation)."
  ],
  "deviations_from_brief": [
    "diffLineOf is a ternary, not a switch with a `never` default: with the default, a mutant on the removed/added case label returned the same value and survived.",
    "fixtureThreads.ts: seeds() is split into lineSeeds() (threads 0–3) and rangeSeeds() (4–5) to stay under the 40-line function limit (max-lines-per-function).",
    "Mutation run used `--testFiles src/ipc/**` (see acceptance_not_run). I could not add a Stryker config file under target/ because it is outside Owned."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ipc/index.ts:141-151",
      "risk": "knip (`pnpm unused`) fails until the editor and window builds import diffLineOf, isOneLine, onePlace, sameDiffLine, DiffLine and ThreadPlace."
    },
    {
      "location": "frontend/src/ipc/fixtureThreads.ts:57-73",
      "risk": "The range threads depend on review.json files[7] differences d3/d5. fixtureRange.test guards this through sitsOn, but a fixture regeneration would move them."
    }
  ]
}
