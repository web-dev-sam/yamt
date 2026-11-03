# MrDescriptionLookR1

Agent output (`agent://MrDescriptionLookR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionLookR1.md), collected 2026-11-03T23:37:46.927Z.

{
  "summary": "Block #2273 is fixed. The lifecycle rule now lives once, in a private `useView<T>(host, source, render)` in `frontend/src/ui/useMarkdown.ts`: one view per host, flush \"post\", destroy on a host swap and when the scope ends. `useMarkdown` passes `view.show(value)` and `useMarkdownCode` passes `view.showCode(language, text)`. The exported signatures did not change. A new test pins the flush \"post\" timing, which a mutant used to survive at two places.",
  "files_changed": [
    "frontend/src/ui/useMarkdown.ts",
    "frontend/src/ui/useMarkdown.test.ts"
  ],
  "tests_added": [
    {
      "name": "a host swap waits for the post flush: a text change in the same tick reaches the old view first",
      "proves": "The host watch runs at flush \"post\", after the pre-flush text watch: show 1 b, destroy 1, build 2, show 2 b. With pre the order differs. This kills the flush mutant."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; echo \"lint exit $?\"",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" / lint exit 0"
    },
    {
      "command": "pnpm -C frontend typecheck; echo \"typecheck exit $?\"",
      "observed": "$ vue-tsc -b / typecheck exit 0"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  281 passed (281) / Tests  4238 passed (4238)"
    },
    {
      "command": "pnpm -C frontend exec vitest run src/ui/useMarkdown.test.ts",
      "observed": "Test Files 1 passed (1), Tests 7 passed (7). The 6 existing useMarkdown/useMarkdownCode tests are unedited and pass."
    },
    {
      "command": "pnpm -C frontend exec oxfmt --check src/ui/useMarkdown.ts src/ui/useMarkdown.test.ts",
      "observed": "All matched files use the correct format. fmt exit 0"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: no Rust changes; Stryker on useMarkdown.ts found 26 mutants: 26 killed, 0 survived, 0 no coverage, score 100.00",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Added one test to useMarkdown.test.ts that pins the flush \"post\" ordering, to kill the flush survivor the finding cited. It is inside Owned."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/useMarkdown.test.ts:93",
      "risk": "The new test pins a side effect of flush \"post\" (the old view shows the new text before the swap), not the real reason for it (a template ref is set after render). Proving the real reason would need a DOM component test, and this suite runs in the node project."
    }
  ]
}
