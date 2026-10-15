All nine blocks are fixed. Both acceptance items were observed: the block-2 test fails under the old whole-spec comparison, and all five frontend recipes exit 0. The `frontend/node_modules` link was made for the recipes and removed afterwards. Nothing is committed.

```
summary
  The Vue note now says which program runs ("tsc" or "tsgo"); a tsgo project reads "TypeScript's native preview (tsgo) runs no plugins".
  setSpecs keeps a server's run when only its help or notes changed; the kept server shows the new ones.
  Formats has no "withIntegration" any more: Phpactor's own rule is "never", and its integrations' own `formats` flags decide.
  One serverHint (detection and the Settings list), one root+folder join (uri.ts absolutePath), one root passed through serverSetup.
  New tests for blocks 7, 8 and 9.

files_changed
  frontend/src/lsp/AGENTS.md
  frontend/src/lsp/index.ts, frontend/src/lsp/index.test.ts
  frontend/src/lsp/internal/added.ts, added.test.ts (test title only)
  frontend/src/lsp/internal/choices.ts
  frontend/src/lsp/internal/detect.ts, detect.test.ts
  frontend/src/lsp/internal/install.ts
  frontend/src/lsp/internal/presets.ts, presets.test.ts
  frontend/src/lsp/internal/server.ts
  frontend/src/lsp/internal/spec.ts
  frontend/src/lsp/internal/tool.ts
  frontend/src/lsp/internal/uri.ts, uri.test.ts
  frontend/src/lsp/internal/vue.ts
  frontend/src/ui/serverSetup.ts, serverSetup.test.ts
  frontend/src/ui/serverText.ts, serverText.test.ts

tests_added
  Block 1:
  - detect.test.ts "Vue in a TypeScript 7 or native-preview project: the TypeScript spec carries the note with the program that runs and the project's version" (changed): the tsc note has program "tsc" and version 7.0.0; the tsgo note has program "tsgo" and version 5.9.3.
  - serverText.test.ts "the tsgo Vue note names the native preview, not the typescript package's version" (new): the exact tsgo sentence. The tsc test was updated to carry program "tsc".
  Block 2:
  - index.test.ts "rule 3: a help-only or notes-only change keeps the run and shows the new words; a command change restarts": it replaces the old "a spec's notes are part of it" test, which pinned the opposite rule. It checks that nothing is stopped, the same fake server is kept and views() shows the new help and notes. A changed command then stops the old run and starts tsgo.
  Block 3:
  - presets.test.ts: Phpactor's rule is now "never".
  - The existing Phpactor integration tests in detect.test.ts still pass unchanged, including formats true only with php-cs-fixer or phpcs on.
  - The existing added.test.ts case still expects a hand-added Phpactor to format (now through mayFormat).
  Block 4:
  - The existing help tests in detect.test.ts and added.test.ts still pass with serverHint as the one builder.
  Block 5:
  - uri.test.ts, four new absolutePath tests:
    - POSIX root with and without a trailing slash, and the empty folder.
    - Windows drive root keeps its backslashes and loses a trailing one.
    - Verbatim `\\?\D:\repo` (with and without a trailing backslash) loses the prefix, same as fileUri.
    - A UNC root keeps its two leading backslashes.
  Block 6:
  - The existing serverSetup tests still pass.
  Block 7:
  - detect.test.ts "Vue: oxlint and eslint in a project with vue and no TypeScript config are their no-vue specs, with no Vue spec or note": the specs are exactly oxlint then eslint at @web, they equal the no-vue run, and no notes appear.
  Block 8:
  - serverSetup.test.ts "focus: a look that finds no root applies nothing; the running servers keep their run": setSpecs is not called, the servers stay running and nothing is stopped.
  - serverSetup.test.ts "focus: a detection that rejects is logged and applies nothing": projectFiles answers with a Proxy that throws on an index read, so detect rejects. servers.detect_failed is logged, setSpecs is not called and the servers stay running.
  Block 9:
  - detect.test.ts "reads: a python-only project reads its tools' configs and the lock files, nothing of other ecosystems": the exact batch is py/{ruff.toml,.ruff.toml,pyproject.toml,ty.toml,pyrightconfig.json}, then py/{uv,poetry,pdm}.lock, then the same three lock files at the root.

smoke_evidence
  Acceptance 1 (block 2 fails with the old rule): setSpecs was set back to whole-spec equality (JSON.stringify of the spec, no takeDisplay):
    pnpm -C frontend exec vitest run --project node src/lsp/index.test.ts -t "help-only"
     × rule 3: a help-only or notes-only change keeps the run and shows the new words; a command change restarts
    AssertionError: expected [ 1, 2 ] to deeply equal []
     ❯ src/lsp/index.test.ts:734:24   expect(host.stopped).toEqual([]);
     Tests  1 failed | 103 skipped (104)
  The fix was then put back (runsAs + takeDisplay) and the full suite passes.
  Acceptance 2 (pipefail, after the last edit):
    == lint       $ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"          EXIT lint=0
    == typecheck  $ vue-tsc -b                                                              EXIT typecheck=0
    == test       Test Files  100 passed (100)   Tests  1314 passed (1314)                  EXIT test=0
    == unused     $ knip --include exports,types                                            EXIT unused=0
    == fmt:check  All matched files use the correct format.                                 EXIT fmt:check=0

deviations_from_brief
  - Block 3 design: the brief's second option. Formats loses "withIntegration" and Phpactor's rule becomes "never". detect.ts fromProject's integrations case sets
    formats = spec.formats || (an integration that is on has formats set), and formatsIn takes only Formats.
    A hand-added Phpactor knows no project, and added.test.ts pins it as formatting. So tool.ts gains `mayFormat(tool)` (the tool's rule is not "never", or one of its integrations can format), and added.ts uses it in place of `formats.kind !== "never"`.
  - Block 1: the run type in vue.ts is now a sum type, `TypeScriptRun = { kind: "noPlugins"; program; version } | { kind: "plugins" }`. spec.ts gains `TypeScriptProgram = "tsc" | "tsgo"`, which SpecNote.program uses.
  - Block 2: Server.spec is now a getter over a private field. Server gains `runsAs(spec)` (every field compared except help and notes) and `takeDisplay(spec)` (takes the new help and notes).
  - Block 4: the one builder is `install.ts` `serverHint(place, look)` for `used` and eslint looks. recipeHint is no longer exported. detect.ts serverOf now takes the command and the hint. The TypeScript server's hint stays a direct nodeHint call in detect.ts, because only detection knows the version; the Settings list gives it no help, as before.
  - Block 5: absolutePath uses the root's backslashes when the root has any, as the old absoluteFolder did. A drive root drops the leading "/" that fileUri adds.
  - Block 6: answer() reads setup.root once before the write and passes that root to storedAnswer before and after it, where the old code read setup.root again after the write.
  - Outside the brief's list, I updated lsp/AGENTS.md (line 5: serverHint, Phpactor formatting and mayFormat, absolutePath, the note's program, display-only help and notes) and retitled one added.test.ts test (literal only).

open_risks
  - frontend/src/lsp/internal/uri.ts:26 absolutePath: a verbatim UNC root (`\\?\UNC\server\share`) gets no special handling, as in fileUri; it was not tried.
  - frontend/src/ui/serverSetup.ts:132 answer(): if the root is still null when the user answers and only appears while the write is in flight, nothing is applied until the next focus. Before, the root was read again after the write.
  - frontend/src/lsp/internal/tool.ts:30 mayFormat: a hand-added Phpactor still sends formatting requests when no formatting integration is on (same as before this fix).
  - .omp/run/mutants/PresetsChrome2.txt is untracked in the tree; it is not mine.
```