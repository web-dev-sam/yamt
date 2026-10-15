Slice 3.Y-detect-2 is finished. Detection now covers every language in plan #72 except Vue, Deno and bash, and all four acceptance items were observed. `just map-check` will fail until the project map names the new `ecosystems.ts`; the exact text is under deviations.

```
summary
  lsp/internal/ecosystems.ts (new) is the one ecosystem table (node, python, rust, go, php, clang): each
  ecosystem's project rule, its ProgramFolders, and the only folder-walking code. presets.ts lists oxfmt, Biome,
  oxlint, TypeScript, eslint, rust-analyzer, gopls, ruff, ty, basedpyright, pyright, Phpactor (else Intelephense)
  and clangd. InstallHint is now the fixed sum type, and python's package manager comes from the nearest lock
  file. installText covers every hint kind, and ServerMenu shows any number of steps and the optional lines.

files_changed
  frontend/src/lsp/internal/ecosystems.ts (new), ecosystems.test.ts (new)
  frontend/src/lsp/internal/project.ts (new), install.ts (new), languageIds.test.ts (new)
  frontend/src/lsp/internal/detect.ts, detect.test.ts, presets.ts, presets.test.ts, spec.ts,
    packageManager.ts, packageManager.test.ts, languageIds.ts
  frontend/src/lsp/index.ts, index.test.ts (hint literal only), frontend/src/lsp/AGENTS.md
  frontend/src/ui/serverText.ts, serverText.test.ts, ServerMenu.vue, question.test.ts (hint literal only)

tests_added
  ecosystems.test.ts:
    - each manifest of each ecosystem: nested, at the root, absent, or a folder (not a project)
    - the workspace Cargo.toml beats a member's own; a [workspace.*] table counts, the word in other text does not;
      with no workspace, the nearest Cargo.toml; a TooLarge workspace file is treated as a plain Cargo.toml
    - go.work beats a nearer go.mod
    - build/compile_commands.json makes the folder holding build/ the project
    - manifests are read along the folder chain, rule by rule; the program folders per ecosystem
  detect.test.ts (new tests):
    - a .ts beside a root Cargo.toml never brings rust-analyzer; a .rs reads only Cargo.toml paths
    - a folder that is a project of two ecosystems is read in one batch, specs in table order
    - rust-analyzer: full spec (checkOnSave false in settings and in start options); found in ~/.cargo/bin counts;
      missing gives the rustup hint; no manifest, no spec
    - gopls: full spec on PATH; ~/go/bin counts; missing gives the go hint; no manifest, no spec
    - ruff: [tool.ruff.lint] section counts on PATH; ruff.toml with ruff in ~/.local/bin counts;
      .ruff.toml without ruff gives pip's hint
    - ruff, ty, basedpyright without config: only the .venv copy counts, a PATH copy does not;
      formats true/false/false
    - ty, basedpyright, pyright: config signs count, missing gives their PyPI package names
    - pyright: pyrightconfig.json counts; a venv copy alone does not
    - python manager: uv.lock, poetry.lock, pdm.lock, nearest wins, a Folder is skipped, none gives null
    - PHP: both found gives Phpactor with the trust-check option; Intelephense alone gives Intelephense with no
      options; a PHAR in ~/.local/bin counts; vendor/bin counts; neither gives Phpactor's download hint
    - clangd: formats only with .clang-format in the project or _clang-format at the root;
      build/compile_commands.json project; missing gives the system hint
    - Biome: the project's copy counts and formats; a PATH copy does not
    - existing node tests: unchanged in meaning; the fake findProgram now follows ProgramFolders
      (project folders up to the root, then PATH, then home)
  presets.test.ts:
    - table order with each preset's ecosystem and formats rule; file types; settings and start options;
      commands incl. Intelephense as the fallback; install recipes; pyproject section regex
      (matches [tool.ruff] and [tool.ruff.lint]; not [tool.ruffle] or a commented line)
  packageManager.test.ts: every Python lock file names its manager
  languageIds.test.ts: php, pyi, c/h, the C++ extensions, bash
  serverText.test.ts:
    - node managers; the vue sentence with only the project step and no PATH line
    - uv / poetry / pdm / pip (exact commands and labels)
    - rustup, go (with its line), download (with and without the needs line), system (no step)

smoke_evidence
  1. Node tests: `pnpm -C frontend test` → exit 0, "Tests 1264 passed (1264)". The tests that prove each rule
     are listed above.

  2. Throwaway script (frontend/src/lsp/internal/detectSmoke.ts, deleted afterwards). It ran detect on the 9
     conflicted paths of /tmp/yamt-test-detect2 (built with the main checkout's lsp-repo.sh --servers). Its fake
     lookups used fs and followed row 2's rules. Output with PATH=/home/wds/.cache/yamt/servers-path:$PATH:
       Biome | biome lsp-proxy | project=biome | formats=true | install=-
       clangd | clangd | project=c | formats=true | install=-
       gopls | gopls | project=go | formats=true | install=-
       Phpactor | phpactor language-server | project=php | formats=false | install=-
       ruff | ruff server | project=py | formats=true | install=-
       ty | ty server | project=py | formats=false | install=-
       basedpyright | basedpyright-langserver --stdio | project=py | formats=false | install=-
       rust-analyzer | rust-analyzer | project=rs | formats=true | install=-
       oxfmt | oxfmt --lsp | project=web | formats=true | install=-
       oxlint | oxlint --lsp | project=web | formats=false | install=-
       TypeScript | typescript-language-server --stdio | project=web | formats=false | install=-
     Plain PATH and HOME: the same, except Phpactor install=download and TypeScript install=node. gopls is found
     in ~/go/bin (Home); rust-analyzer is found as rustup's ~/.cargo/bin proxy.
     Empty HOME with a system PATH: gopls install=go, rust-analyzer install=rustup, Phpactor install=download,
     TypeScript install=node.

  3. pnpm -C frontend lint → exit 0 ($ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue")
     typecheck → exit 0 ($ vue-tsc -b); test → exit 0 (Tests 1264 passed); unused → exit 0 ($ knip …);
     fmt:check → exit 0 ("All matched files use the correct format.").

  4. Real app: target/debug/yamt built in this tree, run through `just app-session` (private Xvfb; it always
     uses its own empty HOME and XDG_CONFIG_HOME).
     (a) PATH line given. The question listed: Biome — biome/; clangd — c/; gopls — go/; Phpactor — php/;
         ruff, ty, basedpyright — py/; rust-analyzer — rs/; oxfmt, oxlint, TypeScript — web/.
         After Start all 11 servers showed Running. Hover messages per file:
           c/src/main.c L10 "Incompatible pointer to integer conversion initializing 'int' with an expression of
             type 'char[6]'" clangd -Wint-conversion
           go/calc/calc.go L9 'cannot use "three" (untyped string constant) as int value…' gopls IncompatibleAssign
           py/api/stats.py L1 "`os` imported but unused" ruff F401 (+ basedpyright reportUnusedImport);
             L11 ty invalid-assignment and basedpyright reportAssignmentType (2 errors, 1 warning)
           biome/src/index.js L4 "This is an unexpected use of the debugger statement." Biome lint/suspicious/noDebugger
           web/src/math.ts L8 "`debugger` statement is not allowed" oxlint
           rs/core/src/lib.rs L8 "expected 2 arguments, found 1" rust-analyzer E0061. This needed a second run
             with RUSTUP_HOME/CARGO_HOME pointing at ~/.rustup and ~/.cargo (see open risks).
           php/src/Stats.php: Phpactor ran (log: "Done indexing (10.06s …)"), no trust prompt, and 0 problems
             (its PHPStan integration is row 5).
         Ctrl+S formatted:
           gofmt: `var   spaced = map[string]int{"a":1,"b":2}` → `var spaced = map[string]int{"a": 1, "b": 2}`
           ruff: `totals={"a":1,"b":2}` → `totals = {"a": 1, "b": 2}`
           Biome: `export const   spaced={a:1,b:2}` → `export const spaced = { a: 1, b: 2 };`
           rustfmt: `pub fn spaced()->i32{1}` → `pub fn spaced() -> i32 {\n    1\n}`
         Screenshot: /tmp/yamt-detect2-shots/a-rust-hover.png
     (b) HOME empty; PATH=/usr/local/bin:/usr/bin:/bin:/home/wds/.vite-plus/bin plus a folder holding only a
         tauri-driver link. The question showed "gopls (not installed)", "Phpactor (not installed)",
         "rust-analyzer (not installed)", "TypeScript (not installed)". The menus read:
           rust-analyzer: Not installed / For all projects: / rustup component add rust-analyzer [Copy] /
             Or install it any other way that puts rust-analyzer on your PATH. / yamt finds it when you come back to this window.
           gopls: … go install golang.org/x/tools/gopls@latest [Copy] / It goes to Go's bin folder (usually
             ~/go/bin), where yamt looks too. / Or install it any other way … / yamt finds it …
           Phpactor: … curl -Lo ~/.local/bin/phpactor https://github.com/phpactor/phpactor/releases/latest/download/phpactor.phar
             && chmod a+x ~/.local/bin/phpactor [Copy] / Needs PHP 8.2 or later. / Or install it any other way … / yamt finds it …
         Screenshot of a not-installed menu: /tmp/yamt-detect2-shots/b-menu-Phpactor.png
         (also b-menu-gopls.png, b-menu-rust-analyzer.png)
         A plain run on this machine would find both: gopls as ~/go/bin/gopls (Home), and rust-analyzer as rustup's
         proxy, which exits at once: `~/.cargo/bin/rust-analyzer --version` → "error: Unknown binary 'rust-analyzer'
         in official toolchain 'stable-x86_64-unknown-linux-gnu'.", exit 1.
     After each `app-session stop`, `ps -eo pid,lstart,args` for every preset program, yamt and tauri-driver
     showed only VS Code's own servers, started at 09:05 by VS Code's process 4610. None came from the three runs.

deviations_from_brief
  - The project map needs updating; I don't own it. `just map-check` fails because "ecosystems" is not in
    .omp/skills/project-map/SKILL.md. Replace "presets (the four tools' table), detect (project folders, presets,
    install hints)" on lines 82–83 with: "ecosystems (the one table: project rule and ProgramFolders per ecosystem,
    folder walking), presets (the tools' table), project (one ecosystem's project: its files, program lookups,
    nearest file), install (install hints from recipes and lock files), detect (projects per path, presets)".
    docs/architecture.md §5.3b likely needs the same words; I have not changed it.
  - New files beyond the brief: project.ts and install.ts were split out of detect.ts to stay under the 300-line
    cap. ProjectLookups now lives in project.ts (same type); detect.test.ts imports it from there.
  - New exports:
      PythonManager (index.ts)
      ECOSYSTEMS, Ecosystem, Files, PACKAGE_JSON, joined, parentOf, foldersUp, present, manifestPaths, projectOf (ecosystems.ts)
      Project, ProjectLookups, readFiles, jsonField, foundAnywhere, inProject, nearest, hasConfig (project.ts)
      NodeHint, nodeHint, recipeHint (install.ts)
      Formats, Tool, Recipe, Sign (presets.ts)
      PYTHON_LOCK_FILES, PYTHON_LOCK_MANAGER (packageManager.ts)
  - PROGRAM_FOLDERS (spec.ts) is kept for added.ts and now reads ECOSYSTEMS.node.folders, so the folder list
    exists once.
  - Decisions the brief left open:
      * PHP is not a fixed "PHP" name: the spec is named after the server found ("Phpactor" or "Intelephense"),
        and each uses its own options (Intelephense gets no Phpactor trust key). With neither installed it shows
        "Phpactor (not installed)".
      * Biome counts only through its program in the project (biome.json is not a sign), as the brief's list says.
      * The vue hint has only the project step: a global plugin install is never found.
      * Python with no lock file: the label is "In <folder>, in the project's virtual environment:".
        Single-step kinds use "For all projects:".
      * The download note reads "Needs PHP 8.2 or later."
      * InstallText is now { reason: string | null; steps: readonly InstallStep[]; notes: readonly string[];
        otherWay: string | null; comeBack }. `notes` replaces managerNote and holds the go, needs and system lines.
      * Paths join an ecosystem by file type, so a .rs file under a package.json no longer creates a node
        project. Files whose type no node preset serves were the only ones that did before.
  - Phpactor's dotted key at the top level of initializationOptions is confirmed by Phpactor's
    doc/lsp/vim.rst (the init_options example uses `["language_server_phpstan.enabled"] = false`; "The
    init_options key maps directly to Phpactors configuration"). `language_server.enable_trust_check` is in
    configuration.rst line 969. In the real app's log there was no trust prompt.
  - Scaffolding during the work, all removed: a frontend/node_modules link to the main checkout, the throwaway
    script, and /tmp helper folders. The worktree's target/ (gitignored) remains from the app build.
  - Running app (a) and app (b) wrote formatted Saves into /tmp/yamt-test-detect2; app (b) therefore showed
    "differs on disk" notices.

open_risks
  - `just app-session` gives the app an empty HOME, so in (a) rustup found no toolchain and rust-analyzer could not
    load the workspace ("rustup could not choose a version of cargo to run"). The Rust problem and rustfmt result
    come from a second run with RUSTUP_HOME and CARGO_HOME set. A desktop start with the real HOME does not have
    this problem.
  - The PHP seed (Stats.php:16) is not underlined: Phpactor without its PHPStan integration reports nothing
    there. That integration is row 5.
  - frontend/src/lsp/internal/detect.ts:157 (`used`): the first-found loop asks for the servers one after another;
    only PHP has more than one.
  - frontend/src/lsp/internal/ecosystems.ts:30: the workspace pattern `^[ \t]*\[workspace[\].]` also treats a
    member's Cargo.toml with `[workspace.lints]` as a workspace (Cargo would not accept that file anyway).
  - Checks for Main: just map-check (after the map update), just check, just mutants on this patch.
```