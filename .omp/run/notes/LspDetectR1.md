# LspDetectR1 (3.Y-detect fix round 1)

All seven findings in round 1 are fixed. The new tests fail against the code they guard, and `lint`, `typecheck`, `test` and `fmt:check` exit 0. `unused` still exits 1, but only on the three exports the setup slice will import.

```
summary
  - The project's workspace URI comes from one exported function, `handshake.ts` `projectUri({ folder, root }: ProjectAt)`. Both `projectFolder` and detection's `specOf` call it, so the two cannot drift. `detect` keeps its `root` parameter; `specOf` and `detectIn` now take one `ProjectAt` object instead of two loose strings.
  - The native preview counts only when `findProgram` finds `tsgo` in the project. This is the same `inProject` check oxfmt and oxlint use. `nativePreview` is now a plain `Command`, and the `@typescript/native-preview` package lookup is gone.
  - TypeScript now uses `fileTypes: SCRIPTS`, and `TS_FIRST` is deleted.
  - `addedSpecs` and `FIRST_REPEAT` moved to `lsp/internal/added.ts`, with their own test file; `index.ts` re-exports `addedSpecs` from there. An entry is skipped when its program has no file name (empty `base`), which covers `[]`, `[""]` and `"bin/"`.
  - New tests pin the `typeof value === "string"` check and the `^\d+` major-version parse.

files_changed
  frontend/src/lsp/internal/detect.ts
  frontend/src/lsp/internal/detect.test.ts
  frontend/src/lsp/internal/added.ts            (new)
  frontend/src/lsp/internal/added.test.ts       (new; the addedSpecs tests moved here from detect.test.ts)
  frontend/src/lsp/internal/presets.ts
  frontend/src/lsp/internal/presets.test.ts
  frontend/src/lsp/internal/handshake.ts
  frontend/src/lsp/index.ts
  frontend/src/lsp/AGENTS.md

tests_added
  - detect.test.ts "TypeScript: the whole leading number is the major version": TypeScript 10.0.0 gives `tsc --lsp --stdio` (#954, kills `^\d`).
  - detect.test.ts "TypeScript: not detected … with no version": new cases `{"version":7}` (#953) and `x7.0.0` (#954, kills `\d+`); both give [].
  - detect.test.ts "package manager: the project's field beats a lock file…": `{"packageManager":["pnpm@9"]}` with `app/yarn.lock` gives "yarn". It replaces the `3` case (#953).
  - added.test.ts "addedSpecs: … an empty command is skipped": adds `[""]` and `["bin/"]` (#955).
  - detect.test.ts "TypeScript 5 with the project's own tsgo: the native preview; tsgo on PATH does not count" (#947): `node_modules/.bin/tsgo` gives tsgo; tsgo found only on PATH falls back to typescript-language-server. It replaces the old package.json-based test.
  - presets.test.ts: TypeScript's `fileTypes` must equal `scripts` (#948). The tsc expectation in detect.test.ts now uses the SCRIPTS order.

smoke_evidence
  Before the fixes (new tests in place, old code):
  - #955: `pnpm -C frontend exec vitest run --project node src/lsp/internal/detect.test.ts`
      × addedSpecs: a repeated or taken name gets (2), (3) …; an empty command is skipped
      + "", + " (2)"   … Tests  1 failed | 24 passed (25)
  - #953, with the mutant `typeof value === "string"` → `true` put in for the run, then reverted (`-t "no version|field beats"`):
      × TypeScript: not detected without a config, without the package, or with no version   (received a tsc spec)
      × package manager: the project's field beats a lock file; …   Expected "yarn", Received "pnpm"
  - #954, mutant `^\d` (`-t "TypeScript"`):
      × TypeScript: the whole leading number is the major version
        - "TypeScript tsc --lsp --stdio @" + "TypeScript typescript-language-server --stdio @"
  - #954, mutant `\d+` (`-t "TypeScript"`):
      × TypeScript: not detected without a config, without the package, or with no version   (received a tsc spec)

  After all fixes:
  - pnpm -C frontend test → Test Files  92 passed (92) / Tests  1157 passed (1157), exit 0
  - pnpm -C frontend fmt:check → All matched files use the correct format., exit 0
  - pnpm -C frontend lint → oxlint --type-aware && eslint …, exit 0
  - pnpm -C frontend typecheck → vue-tsc -b, exit 0
  - pnpm -C frontend unused → exit 1: unused exports `addedSpecs`, `detect` and unused type `ProjectLookups` (src/lsp/index.ts:14–16).

deviations_from_brief
  - #946: the shared function is a new exported `projectUri(at: ProjectAt)` in `handshake.ts`. `projectFolder` calls it, and so does detection. The brief offered `projectFolder`/`fileUri`, but `projectFolder` takes a whole `ServerSpec`, and calling `fileUri` directly from both places is what the finding says can drift. `ProjectAt` is the `{ folder, root }` object that `specOf` and `detectIn` now take. `uri.ts` is unchanged.
  - #947: I added `inProject(project, program)` in detect.ts as the one "the project has this program" test. Both the `projectProgram` look and the native preview use it.
  - `unused` also reports the type `ProjectLookups` (index.ts:16), not only `detect` and `addedSpecs`. Same cause: the setup slice does not import them yet.
  - AGENTS.md now names the single program test, `projectUri`, and `added.ts`.

open_risks
  - frontend/src/lsp/internal/detect.ts `typescript`: for TypeScript below 7, detection now calls `findProgram("tsgo")` once per project. Before, a file lookup answered this. Tests that count `findProgram` calls only filter on oxlint.
```

Note for Main: `added.ts` and `added.test.ts` are new files. The brief says the orchestrator has to own `added.ts`; the hook did not block either file.