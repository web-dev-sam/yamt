# LspClientR2 (3.Y-client fix round 2)

I fixed all three findings, #917, #919 and #920 (the lsp half of the last two), and every check passed. I didn't touch `editor/**`.

```
summary
  #917: a new test kills the three filter mutants that destroy() could see through the public API.
  #919: `DocProblems` never hands the editor an answer older than the last one it showed for that document on that server.
    One private `#show` does the check for pushed answers, pulled answers and `clear`; a dropped answer is logged.
  #920: `isDocVersion` is now exported from `lsp/index.ts` (it re-exports the rule in `internal/version.ts`).
  `lsp/AGENTS.md` now states the #919 guarantee and names `isDocVersion` in the public surface.

files_changed
  frontend/src/lsp/internal/problems.ts
  frontend/src/lsp/index.ts
  frontend/src/lsp/index.test.ts
  frontend/src/lsp/AGENTS.md

tests_added
  index.test.ts "destroy waits for a removed server still stopping after another removed one stopped"
    Two specs serve a.ts and only tsgo ignores stop. The test calls setSpecs([]), then settle() so oxlint's halt finishes and the filter runs, then destroy().
    destroy stays pending until tsgo's exit(0) and resolves after it (#917).
  index.test.ts "rule 6: a late pull never replaces a newer push, nor a late push a newer pull"
    Push v2, then the pull for v1 arrives late, then a pull for v2, then a late push for v1.
    Only [2,"pushed"] and [2,"pulled"] are shown, and both drops are logged (#919).
  index.test.ts "a document version is a positive safe integer"
    Checks the public isDocVersion on 0, 1, 1.5 and MAX_SAFE_INTEGER+1, expecting [false, true, false, false] (#920).

smoke_evidence
  Acceptance 1, #917 mutants. I edited index.ts:68 by hand for each mutant, ran
  `pnpm -C frontend exec vitest run --project node src/lsp/index.test.ts -t "destroy waits"`, then restored the line.
    `retired === server`:
      × destroy waits for a removed server still stopping after another removed one stopped
      AssertionError: expected true to be false // Object.is equality
      Tests  1 failed | 2 passed | 90 skipped (93)
    `(retired) => false`:
      × destroy waits for a removed server still stopping after another removed one stopped
      AssertionError: expected true to be false // Object.is equality
      Tests  1 failed | 2 passed | 90 skipped (93)
    `() => undefined`:
      × destroy waits for a removed server still stopping after another removed one stopped
      AssertionError: expected true to be false // Object.is equality
      Tests  1 failed | 2 passed | 90 skipped (93)
  Acceptance 1, #919 before the change. I turned the check off (`false && …` at problems.ts:117), ran `-t "late pull"`, then restored it.
    × rule 6: a late pull never replaces a newer push, nor a late push a newer pull
    AssertionError: expected [ [ 2, 'pushed' ], …(3) ] to deeply equal [ [ 2, 'pushed' ], [ 2, 'pulled' ] ]
    Tests  1 failed | 92 skipped (93)
  Acceptance 1, isDocVersion: exported at index.ts:13; the boundary test passes in the full run below.
  After restoring both files: `vitest run --project node src/lsp` → Test Files 9 passed (9), Tests 146 passed (146).
  Acceptance 2 (cd frontend; pnpm <s>; echo exit=$?):
    lint       exit=0  ($ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue")
    typecheck  exit=0  ($ vue-tsc -b)
    test       exit=0  Test Files 85 passed (85), Tests 1049 passed (1049)
    unused     exit=0  ($ knip --include exports,types); it did not flag isDocVersion
    fmt:check  exit=0  All matched files use the correct format.

deviations_from_brief
  - `lsp/AGENTS.md` updated (owned glob); the brief did not ask for it.
  - The brief left the drop log text open. I chose "Dropped problems for version N: version M is shown"; the #919 test pins it.
  - `internal/version.test.ts` already tested the same boundary. I still added the public-surface test in index.test.ts, which the brief asks for.
  - `unused` passes, probably because knip counts the import in index.test.ts as the importer `[INFERENCE]`.

open_risks
  - frontend/src/lsp/internal/problems.ts:117 — two answers with the same version are both shown, and the later one wins.
    The editor's fix round must not start dropping equal versions when it removes its own `version < last` check.
  - frontend/src/lsp/internal/problems.ts:140 — a pull answer dropped as too old still updates `#resultId` and `#items`, so the server's resultId chain stays in step.
    The next "unchanged" report then reuses those items `[INFERENCE: intended, not separately tested]`.
  - I did not run `just mutants`; only the three named mutants were checked by hand.
```