# MrHeadingWebR1

Agent output (`agent://MrHeadingWebR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/MrHeadingWebR1.md), collected 2026-11-25T10:13:07.620Z.

{
  "summary": "#2593: the chip classes are written once, as `CHIP_CLASS` in RangeHeadingLine.vue, and bound on all four chips. #2594: the fixture's heading table is keyed by `HeadingName` and read through an `isHeadingName` guard, the same way fixtureGitLab.ts does it. #2595: the new reviewArgs.ts holds `Review = {of, names|null}`, `parseReview` and `reviewArgs`. The three `--mr-*` app arguments are spelled out. A range opening has a single `review` field, so names without a review can't be represented. startArgs.ts is now 280 lines.",
  "files_changed": [
    "frontend/src/ui/RangeHeadingLine.vue",
    "frontend/src/ipc/fixtureRange.ts",
    "frontend/scripts/app-session/startArgs.ts",
    "frontend/scripts/app-session/reviewArgs.ts",
    "frontend/scripts/app-session/startArgs.test.ts",
    "frontend/scripts/app-session/args.test.ts"
  ],
  "tests_added": [
    {
      "name": "startArgs.test: --review-of / --mr-* tests changed to the new `review: {of, names}` shape",
      "proves": "Parsing gives a single review field with its names. appArgs still emits --review-of=…, --mr-title=…, --mr-source=…, --mr-target=… in the same order. These tests kill all 51 reviewArgs.ts mutants."
    },
    {
      "name": "args.test: range openings in the tests use `review: null`",
      "proves": "With no review, the app arguments are unchanged: --diff=<range>, --repo, then --ai and --mr."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; sfc-order; unused; test",
      "observed": "vue-tsc exit 0. LINT=0 (oxlint + eslint). 'All matched files use the correct format.' sfc-order and knip: no output. Test Files 316 passed (316); Tests 4790 passed (4790)."
    },
    {
      "command": "wc -l frontend/scripts/app-session/startArgs.ts",
      "observed": "280"
    },
    {
      "command": "just app-session start-fixture --name mrh --range-case review --heading mergeRequest; read: each [role=group] code's className and computed styles (dark)",
      "observed": "Both chips: 'max-w-64 min-w-0 truncate rounded border border-control-border bg-panel-inline px-1.5 font-mono text-code' | feature / main, both 'rgb(67, 64, 77) rgb(33, 31, 39) JetBrains Mono'. Screenshot /tmp/mrh-dark.png: !12 Reminders before a card is due, then [feature] → [main] +64 −67, the two chips look the same."
    },
    {
      "command": "read 'document.documentElement.dataset.theme = \"light\"'; computed border/bg/color of the chips; shot /tmp/mrh-light.png",
      "observed": "Both chips: 'rgb(209, 211, 217) rgb(247, 248, 249) rgb(8, 8, 8)'. The light screenshot shows the same two identical chips."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → reviewArgs.ts 100% (51 killed), startArgs.ts 316 killed / 8 survived, fixtureRange.ts 100 killed / 91 survived",
    "survivors": [
      "frontend/src/ipc/fixtureRange.ts:121:73 HEADINGS literal → {} — gate-covered: a static module-level mutant, not re-evaluated under vitest (#732). The ?heading=%s test asserts every entry. All other survivors are on unchanged lines."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Main's decision (a): new file frontend/scripts/app-session/reviewArgs.ts, which I created. Without it startArgs.ts was 303 lines or more and failed max-lines 300. For the docs keeper, tree.md row: `reviewArgs.ts` — the range window's review and its merge-request names: parses --review-of and --mr-title/--mr-source/--mr-target into one `Review`, and spells out the app arguments.",
    "I added no reviewArgs.test.ts. The existing startArgs.test.ts and args.test.ts already cover the module: 51/51 mutants killed.",
    "CHIP_CLASS is placed after defineProps to follow the VU2 order (macros → state)."
  ],
  "open_risks": [
    {
      "location": "frontend/scripts/app-session/startArgs.ts:66-74",
      "risk": "The review is still checked for --range in opening(), not in parseReview. When several errors are present they are reported in the same order as before. This is intentional, so behaviour doesn't change."
    }
  ]
}
