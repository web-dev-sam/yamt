Row 5 is finished. All three acceptance items passed, and row 4's blocks #1009–#1012 and #1016 are folded in. `just map-check` will fail until someone updates the project map, which I don't own; the exact text needed is under deviations.

```
summary
  Vue now works through the TypeScript plugin. The TypeScript server serves .vue files when the plugin is in the project. Without the
  plugin a never-started "Vue" spec carries the plugin's install hint. A TypeScript 7 or tsgo project that uses vue gets the
  vueNeedsTypeScript6 note. Phpactor turns on PHPStan, Psalm, PHP-CS-Fixer and phpcs only when the tool's program and its config
  are in the project folder. pyright gets python.pythonPath from the project's virtualenv. A found preset server carries `help`,
  and `notes` exists on every spec. Deno and bash-language-server are in the table as list-only; presetChoices() lists every
  preset's server. A hand-added server whose program and arguments equal a preset's gets that preset's name, rules and help,
  and every added server looks for its program in every ecosystem's folders.
  Row 4's blocks:
  - #1009: one tomlTable() and one fileHolds(), used by both the rust rule and the pyproject.toml sections.
  - #1010: the Phpactor install command uses curl --create-dirs.
  - #1011: install.ts HINT_FILES replaces ecosystemFiles.
  - #1012: PythonTool has an explicit package.
  - #1016: tests now pin which files detection reads.

files_changed
  frontend/src/lsp/internal/tool.ts (new): the shared types moved out of presets.ts, plus Integration, FromProject
    and the new "withIntegration" formats rule
  frontend/src/lsp/internal/candidates.ts (new): the files detection reads, moved out of detect.ts
  frontend/src/lsp/internal/integrations.ts (new), vue.ts (new), choices.ts (new), choices.test.ts (new)
  frontend/src/lsp/internal/presets.ts, detect.ts, added.ts, ecosystems.ts, install.ts, project.ts, spec.ts, json.ts (isObject exported)
  frontend/src/lsp/index.ts, frontend/src/lsp/AGENTS.md
  frontend/src/lsp/index.test.ts, internal/detect.test.ts, added.test.ts, ecosystems.test.ts, presets.test.ts, spec.test.ts
  frontend/src/ui/serverSetup.ts (passes the root to addedSpecs)
  frontend/src/ui/question.test.ts, serverText.test.ts, servers.test.ts (spec literals only: help: null, notes: [])

tests_added
  detect.test.ts
    - Vue with the plugin: the spec's exact file types (scripts + vue), the exact plugin option with location "/repo/web",
      and the TypeScript server's hint as help
    - Vue: the location uses the root's own separators ("C:\repo\web"), and is the root itself for a project at the root
    - Vue without the plugin: TypeScript unchanged, plus a "Vue" spec with the plugin hint (reason vue, pnpm, folder web)
    - TypeScript 7 + vue gives the note with "7.0.0"; tsgo + vue gives the note with "5.9.3"
    - no vue package: nothing changes, plugin or not, and no note in TypeScript 7
    - help: a found server carries the hint, a missing one only `install`; Intelephense and program-only presets have null
    - Phpactor (test.each over the 4 integrations): each config name turns its key on, with the right formats; program only,
      config only, program in a parent folder or config in a parent folder: off
    - Phpactor with every integration at once; Intelephense never gets them
    - pyright: pythonPath from .venv and from venv; none with only a PATH python; ruff gets none
    - reads (#1016): the exact list for a node-only project; a rust-only project reads only its manifests; a php project reads
      its tool files
    - existing full-spec literals updated with help (found rust-analyzer, gopls, ruff, clangd, Phpactor) and notes; the curl literal
  added.test.ts
    - `ruff server` matches ruff (name "ruff (2)" because ruff is taken, python help; typed program and file types kept)
    - `/opt/x/intelephense.cmd --stdio` matches Intelephense and never formats
    - start options built for the root (oxlint's workspaceUri, Phpactor's trust key); `phpactor.bat` and `rust-analyzer.EXE` match;
      formats unless "never"; Deno settings; eslint and rustup help
    - other arguments, a missing argument, a longer name or `ruff.exe.old` match nothing (today's behaviour); the unmatched
      literals now expect EVERY_ECOSYSTEM_FOLDERS, help: null, notes: []
  choices.test.ts: the order and command of every server (TypeScript and eslint as their servers, Phpactor then
    Intelephense, Deno, bash), each name once; the file types
  ecosystems.test.ts (#1009): every ecosystem's folders de-duplicated in table order; tomlTable accepts plain, indented and dotted
    headers and rejects commented, longer and quoted ones; an indented [workspace] counts; fileHolds only for readable text
  presets.test.ts: list-only presets (ecosystem null, their commands and file types), DETECTED_PRESETS, "withIntegration",
    Deno's options, fromProject per preset, --create-dirs
  index.test.ts: installing the plugin drops Vue and restarts TypeScript, which then serves App.vue; a note-only change is a
    changed spec; presetChoices through the public surface; the added-server folders test now expects every ecosystem's folders

smoke_evidence
  1. pnpm -C frontend exec vitest run --project node (detect, added, choices, ecosystems) --reporter=verbose → every test listed
     above ✓, "Tests 85 passed (85)".
  2. In frontend/: lint → exit 0 ($ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue");
     typecheck → exit 0 ($ vue-tsc -b); test → exit 0 ("Test Files 99 passed (99) / Tests 1291 passed (1291)");
     unused → exit 0 ($ knip --include exports,types); fmt:check → exit 0 ("All matched files use the correct format.").
  3. target/debug/yamt built in this tree (cargo tauri build --debug --no-bundle) and run through app-session (private Xvfb,
     own HOME and XDG_CONFIG_HOME), with PATH=/home/wds/.cache/yamt/servers-path:$PATH.
     Repository /tmp/yamt-test-detect3 was built with the main checkout's lsp-repo.sh --servers.
     The question listed "Biome — biome/ … oxfmt, oxlint, TypeScript — web/", with no Vue entry. I clicked Start.
     (a) web/src/App.vue: the error underline is on `count` in line 4 `const count: number = "three";`.
         Hover: "Type 'string' is not assignable to type 'number'. TypeScript 2322". Shot: /tmp/yamt-detect3-a-vue.png
     (b) php/src/Stats.php, status area "1 error, 8 warnings". The lines are hidden by collapsing unchanged fragments, so I
         turned that off. Hovers:
         - line 16: "Function undefined_helper not found. Phpactor function.notFound / Learn more at
           https://phpstan.org/user-guide/discovering-symbols" (PHPStan through Phpactor)
         - line 19: "Expected 0 spaces after opening parenthesis; 1 found — Phpactor
           Squiz.Functions.FunctionDeclarationArgumentSpacing.SpacingAfterOpen", "Expected 1 space between comma and argument
           "$b"; 0 found", "Expected 0 spaces before closing parenthesis; 1 found" (phpcs PSR12)
         Ctrl+S: `function spaced( $a,$b ) { return $a+$b; }` → `function spaced($a, $b)\n{\n    return $a + $b;\n}`.
         One Ctrl+Z restores the single line; Ctrl+Shift+Z brings the formatted text back. Shot: /tmp/yamt-detect3-b-php-hover.png
     (c) Repository /tmp/yamt-test-detect3-plain, built without --servers. The question showed "oxfmt, oxlint, TypeScript,
         Vue (not installed) — web/". Status area: "Vue {Not installed}". The Vue menu read: "Vue / Not installed / This
         project uses Vue; its .vue files need the package @vue/typescript-plugin in this project. / In web/: / pnpm add -D
         @vue/typescript-plugin [Copy] / yamt finds it when you come back to this window. / Show log"
         (shot /tmp/yamt-detect3-c-vue-menu.png).
         I copied web/node_modules/@vue/typescript-plugin from the --servers repository, then focus-away and focus-back.
         The status area then had no Vue and showed "TypeScript {Running}". App.vue showed the `count` underline; hover
         "Type 'string' is not assignable to type 'number'. TypeScript 2322". Shot: /tmp/yamt-detect3-c-after.png
     After each app-session stop, pgrep -af for every preset program (biome, clangd, gopls, phpactor, phpstan, phpcs,
     intelephense, pyright, basedpyright, ruff server, ty server, rust-analyzer, oxlint/oxfmt --lsp, typescript-language-server,
     tsserver, deno lsp, bash-language-server) listed only VS Code's own servers (pids 5171–6262, VS Code and
     ~/Projects/yamt/frontend paths); none came from the app ("none left from yamt").

deviations_from_brief
  - The project map needs updating; I don't own it. The lsp line in .omp/skills/project-map/SKILL.md must name the new files,
    or `just map-check` fails: tool (preset vocabulary: Command, Formats, Integration, FromProject, Tool, Recipe, Sign, Look),
    candidates (the files detection reads), integrations (Phpactor's tool integrations), vue (the Vue rule), choices (each
    preset's server, presetChoices); plus `presetChoices` in index.ts's public list. docs/architecture.md §5.3b likely needs
    the same words.
  - New files beyond the brief. tool.ts and candidates.ts keep presets.ts and detect.ts under the 300-line limit.
    integrations.ts, vue.ts and choices.ts each hold one rule.
  - Other structure changes:
    - Preset is a sum type. A detected preset has an ecosystem and a look; a list-only one has `ecosystem: null` and a command.
      DETECTED_PRESETS holds the detected ones.
    - Tool gains `fromProject` (nothing | integrations | venvPython).
    - Formats gains "withIntegration", used by Phpactor.
    - spec.ts PROGRAM_FOLDERS is replaced by ecosystems.ts EVERY_ECOSYSTEM_FOLDERS.
    - project.ts gains Place, Wanted, projectProgram, modulePackage and nearestPackage (the last two moved from detect.ts).
      nearest, hasConfig and the hint builders take a Place, so the added-server path needs no lookups.
  - serverSetup.ts: besides the addedSpecs call, `look` returns the root (or null) and `apply`/`addedOf` take it, so the root
    passed in is a string, never null. Behaviour is unchanged.
  - Phpactor sends only the integration keys that are on (true). It never sends false, so a project's own .phpactor.json
    setting is not overridden.
  - Checked against Phpactor's doc/reference/configuration.rst: all four keys exist as written (boolean, default false).
    Default bins are %project_root%/vendor/bin/{phpstan,psalm,phpcs}. The page names no config files except examples
    (%project_root%/psalm.xml, %project_root%/.php-cs-fixer.php), so the other config names are the brief's, from the tools.
    Because the default bin is under %project_root%, `vendor/bin/<tool>` counts only in the project folder; a parent's
    copy does not.
  - Decisions on `help` the brief left open:
    - Intelephense (the fallback) and presets without an install recipe get null: oxfmt, Biome, oxlint, tsc/tsgo, Deno, bash.
    - A missing server has `install` set and help null.
    - A hand-added TypeScript match gets null, because its hint needs the project's TypeScript version.
    - Hand-added hints are built for the repository root with no lock file read (manager null).
  - The "Vue" spec runs the TypeScript server's command (never started), with file types ["vue"].
  - setSpecs: a changed spec (fileTypes plus the plugin option) is a new spec. The old run stops and the new one starts when a
    document it serves is open. Shown in test and in the real app (c). A note-only change also restarts the server.
  - #1011: venv-python is found through findProgram (no file read). The vendor-tool files come from integrationFiles() in
    integrations.ts, the module that checks them.
  - Scaffolding, all removed: a frontend/node_modules link to the main checkout, a /tmp Phpactor probe script, the fetched
    configuration.rst. The worktree's target/ (gitignored) remains from the app build.
  - Not mine and untouched: .omp/run/mutants/PresetsDetect2.txt (untracked, already present).

open_risks
  - frontend/src/lsp/internal/vue.ts:13 `absoluteFolder`: a Windows root in verbatim form (\\?\C:\…) has not been tried with
    tsserver's require.
  - frontend/src/lsp/internal/detect.ts `fromProject`: when a tool's initializationOptions are not an object, the
    integration keys replace them. Only Phpactor has integrations, and its options are an object, so this case never runs.
  - The real app check (b) needed "Collapse unchanged fragments" turned off: the PHP problems sit in hidden unchanged lines,
    and the status counts (1 error, 8 warnings) showed them first.
  - Checks for Main: just map-check (after the map update), just check, just mutants on this patch.
```