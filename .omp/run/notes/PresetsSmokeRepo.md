The smoke repository is rebuilt: one project per language, each with its conflicted file and its seeds, and a new `scripts/lsp-servers.sh` that installs the pinned servers into the cache. One thing will fail when you run it: `just map-check` (PM6), because the project map does not name `scripts/lsp-servers.sh` yet. The map is outside my files, so the exact lines are under deviations below.

```
summary
  scripts/lsp-repo.sh now builds web/ (2 .ts conflicts plus a conflicted src/App.vue), biome/, py/, rs/ (two-crate Cargo
  workspace), go/, php/ and c/: 9 conflicts. Each file has one seeded problem per server and one badly formatted line
  outside its conflict. --servers no longer writes the settings file (add_ruff_to_settings and the jq need are gone).
  New scripts/lsp-servers.sh (sourced, or run alone; `--path` prints the servers folder) installs pinned versions once
  into ~/.cache/yamt/<tool>-<version>:
    typescript-language-server 6.0.2, intelephense 1.18.5, pyright 1.1.414, @biomejs/biome 2.5.15,
    @vue/typescript-plugin 3.3.13, gopls v0.23.0, rust-analyzer 2026-10-12 (release binary), static PHP 8.4.23,
    phpactor 2026.10.07.0, composer 2.10.3, phpstan 2.3.1, phpcs 4.0.4; in py/.venv via uv: ruff 0.17.0, ty 0.0.88,
    basedpyright 1.40.2.
  PATH line: PATH=/home/wds/.cache/yamt/servers-path:$PATH   (PHP runs here, so Phpactor is installed)

files_changed
  scripts/lsp-repo.sh
  scripts/lsp-servers.sh (new)
  .vscode/tasks.json

tests_added
  none: the brief's acceptance is command evidence; these are shell scripts with no test harness.

smoke_evidence
  How I ran it: the worktree has no frontend/node_modules. I ran the worktree scripts through
  /tmp/yamt-presets-run/{scripts -> worktree scripts, frontend/node_modules -> /home/wds/Projects/yamt/frontend/node_modules}
  and removed that folder afterwards.

  1. lsp-repo.sh /tmp/yamt-test-presets-a → exit 0
       lsp-repo: /tmp/yamt-test-presets-a is mid-merge; conflicted files:
       biome/src/index.js
       c/src/main.c
       go/calc/calc.go
       php/src/Stats.php
       py/api/stats.py
       rs/core/src/lib.rs
       web/src/App.vue
       web/src/greet.ts
       web/src/math.ts
     git -C /tmp/yamt-test-presets-a ls-files -u | cut -f2 | sort -u → the same 9 paths.
     lsp-repo.sh --servers /tmp/yamt-test-presets-b → exit 0
       lsp-servers: typescript-language-server 6.0.2, intelephense 1.18.5, pyright 1.1.414, biome 2.5.15, @vue/typescript-plugin 3.3.13, gopls v0.23.0, rust-analyzer 2026-10-12, php 8.4.23 (runs: true), phpactor 2026.10.07.0, composer 2.10.3, phpstan 2.3.1, phpcs 4.0.4; in project venvs: ruff 0.17.0, ty 0.0.88, basedpyright 1.40.2
       lsp-servers: launch yamt with PATH=/home/wds/.cache/yamt/servers-path:$PATH
       lsp-repo: /tmp/yamt-test-presets-b is mid-merge; conflicted files:
       (the same 9 paths); ls-files -u | cut -f2 | sort -u → the same 9 paths.

  2. Version answers (servers-path, or the project's bin folder in presets-b):
       typescript-language-server: 6.0.2
       pyright: pyright 1.1.414   (pyright-langserver has no version flag: "Connection input stream is not set")
       rust-analyzer: rust-analyzer 0.3.3081-standalone
       php: PHP 8.4.23 (cli) (built: Jul  7 2026 05:22:53) (NTS gcc 14.2.0)
       phpactor: Phpactor 2026.10.07.0
       composer: Composer version 2.10.3 2026-08-27 13:34:23
       gopls version: golang.org/x/tools/gopls v0.23.0
       intelephense: no version flag (`--version` crashes with a parse error); package.json says 1.18.5
       py/.venv/bin: ruff 0.17.0 / ty 0.0.88 / basedpyright 1.40.2
       biome/node_modules/.bin/biome: Version: 2.5.15
       web/node_modules: @vue/typescript-plugin 3.3.13, vue 3.5.43 (package.json)
       php/vendor/bin: PHPStan - PHP Static Analysis Tool 2.3.1 / PHP_CodeSniffer version 4.0.4 (stable)

  3. Seeds. Run on a third --servers repo (/tmp/yamt-test-presets-c) after `git checkout --ours` on the conflicted
     files, because the tools cannot parse marker files:
       tsc --noEmit -p web: web/src/math.ts(14,14): error TS2322: Type 'string' is not assignable to type 'number'.
       oxlint: src/math.ts:8:3: error eslint(no-debugger): `debugger` statement is not allowed
       oxfmt --check: src/math.ts
       ruff check: api/stats.py:1:8: F401 [*] `os` imported but unused
       ruff format --diff: -totals={"a":1,"b":2} / +totals = {"a": 1, "b": 2}
       ty check: api/stats.py:11:14: error[invalid-assignment] Object of type `Literal["three"]` is not assignable to `int`
       basedpyright: py/api/stats.py:11:14 - error: Type "Literal['three']" is not assignable to declared type "int"
       biome lint: src/index.js:4:3 lint/suspicious/noDebugger … × This is an unexpected use of the debugger statement.
       biome format: - export·const···spaced={a:1,b:2} / + export·const·spaced·=·{·a:·1,·b:·2·};
       gofmt -l: calc/calc.go
       go vet: vet: calc/calc.go:9:17: cannot use "three" (untyped string constant) as int value in variable declaration
       rustfmt --check: -pub fn spaced()->i32{1} / +pub fn spaced() -> i32 { / +    1 / +}
       rust-analyzer diagnostics rs (its own diagnostics, no cargo check): … rs/core/src/lib.rs: Error RustcHardError("E0061") from LineCol { line: 7, col: 9 } …: expected 2 arguments, found 1
       clang-format --dry-run: c/src/main.c:7:4: warning: code should be clang-formatted [-Wclang-format-violations]
       clangd --check=c/src/main.c: Compile command from CDB is: [/tmp/yamt-test-presets-c/c] /usr/bin/cc -std=c17 -c …
                                    E[…] [-Wint-conversion] Line 10: incompatible pointer to integer conversion initializing 'int' with an expression of type 'char[6]'
                                    All checks completed, 1 errors
       phpstan analyse: php/src/Stats.php:16:Function undefined_helper not found. [identifier=function.notFound]
                        (--error-format=json stdout starts with `{"totals":…`, no warning before it)
       phpcs (PSR12): php/src/Stats.php:19:16: error - Expected 0 spaces after opening parenthesis; 1 found (and 7 more on line 19)
     What the final real-app check must see where there is no command line:
       - Vue (@vue/typescript-plugin): in web/src/App.vue, `const count: number = "three";` (line 4) underlined as a type error.
       - PHP: because PHP runs here, Phpactor is the PHP server, not Intelephense ("first found"). Expect PHPStan's
         "Function undefined_helper not found" on Stats.php line 16 and phpcs's PSR12 errors on line 19 through
         Phpactor. Intelephense's "undefined function" on line 16 shows only when Phpactor is absent.

  4. uvx --from shellcheck-py shellcheck -x scripts/lsp-repo.sh scripts/lsp-servers.sh (ShellCheck 0.11.0) → exit 0,
     no output. shellcheck is not installed here; uvx ran it without putting anything in ~/.local/bin.
     bash -n on both → exit 0. .vscode/tasks.json parses as JSON.

  5. sha256sum plus `ls -la --time-style=full-iso` of ~/go/bin, ~/.cargo/bin and ~/.local/bin, saved before and after:
       settings.json 03de9d5f1fab92d3c38cceb09c1b37d3370e8fbc47f969adc78ab7c9db9ffe22, the same before and after.
       ~/go/bin (gopls dated 2026-06-26), ~/.cargo/bin and ~/.local/bin entries: identical.
       The only diff line is the `..` entry of ~/.cargo/bin, i.e. ~/.cargo itself: its timestamp became 11:59:30. That
       is the time of my evidence `cargo check` in rs/ (cargo's package cache in ~/.cargo), not the scripts. No
       ~/.cargo/bin entry changed.

deviations_from_brief
  - Project map needs updating (not my file). `.omp/skills/project-map/SKILL.md` line 54 is out of date, and PM6
    needs lsp-servers.sh named. Replace line 54 with:
      scripts/lsp-repo.sh     `[--servers] <dir>`: language-server smoke repository, one project per ecosystem left mid-merge (web/ with oxlint, oxfmt, TypeScript 5.9 and vue linked from frontend/node_modules, 3 conflicts incl. App.vue; biome/, py/, rs/ (Cargo workspace), go/, php/, c/ with 1 conflict each; one problem per server and one badly formatted line outside the conflicts); with the flag, the pinned servers from lsp-servers.sh, plus the Vue plugin, Biome, py/.venv (uv: ruff, ty, basedpyright) and php/vendor (PHPStan, phpcs); VS Code tasks "lsp: new conflict project" / "lsp: open in yamt"
      scripts/lsp-servers.sh  `[--path]`: pinned language servers installed once into ~/.cache/yamt/<tool>-<version> (npm, go install, rust-analyzer release binary, static PHP + Phpactor + composer.phar) and linked into ~/.cache/yamt/servers-path; prints the PATH line; sourced by lsp-repo.sh
    The git-sandbox.sh entry ("sourced by conflict-repo.sh and golden-repo.sh") could also add lsp-repo.sh and
    lsp-servers.sh, which already source it.
  - Without --servers the network-free repository has no @vue/typescript-plugin, biome/node_modules, py/.venv or
    php/vendor (the same as ruff and typescript-language-server before). So that variant shows "Vue (not installed)",
    and Biome is not detected at all. web/package.json lists the plugin only with --servers, as it did for
    typescript-language-server.
  - typescript-language-server now lives only in servers-path, as a program found on PATH. It is no longer linked
    into web/node_modules/.bin or listed in web/package.json.
  - web/tsconfig.json include is now ["src", "src/**/*.vue"] (was ["src"]), the usual Vue layout. `tsc --noEmit -p web`
    still reports only the math.ts seed.
  - PHP is 8.4.23, the newest 8.4 static build, not 8.5.8: I picked 8.4 as the lower-risk choice for Phpactor's
    dependencies. That is my judgement, not checked.
  - PHPStan and phpcs are installed once with composer into ~/.cache/yamt/php-tools-…, then copied (`cp -a`) into
    php/vendor, not linked. A link would put their real path outside the repository, which files.rs treats as Missing.
    Composer's home and cache are inside ~/.cache/yamt.
  - PHPStan's turbo-ext folder is removed from the cached install. The static PHP cannot load extensions ("Dynamic
    loading not supported"), and PHPStan printed a startup warning on stdout ahead of its JSON. After removing the
    folder, phpstan's JSON output starts clean.
  - lsp-servers.sh has a `--path` flag (prints the servers folder). The "lsp: open in yamt" task uses it to prepend to
    PATH, so XDG_CACHE_HOME is respected without VS Code substituting `${…}` itself.
  - lsp-repo.sh writes files from here-documents (`write <path> <<EOF`) instead of printf format strings. That keeps
    the seeds readable and avoids shellcheck SC2059 (a variable used as a printf format).
  - Added `# shellcheck source=…` lines above the `source` calls; scripts/third-party-licenses.sh already uses
    shellcheck directives.
  - The script requires `uname -sm` = "Linux x86_64": the pinned rust-analyzer and PHP builds are x86_64 Linux only.

open_risks
  - scripts/lsp-servers.sh `install_gopls`: `go install` uses the default Go caches (~/go/pkg/mod, ~/.cache/go-build).
    These are not on the off-limits list and ~/go/bin is untouched, but they are user folders.
  - scripts/lsp-servers.sh `install_python_tools`: uv uses ~/.cache/uv. basedpyright's wheel pulls a Node runtime
    wheel, so the first --servers run downloads it.
  - scripts/lsp-repo.sh, App.vue and the web/ links: whether the TypeScript server actually loads
    @vue/typescript-plugin from the per-entry links (real path in the cache) is untested here. That belongs to the
    real-app check and the detect-3 build's plugin wiring.
  - scripts/lsp-repo.sh, the php/ project: with PHP present, the PHP server is Phpactor. Intelephense's
    undefined-function underline is visible only if servers-path lacks phpactor, e.g. after deleting
    ~/.cache/yamt/servers-path/phpactor.
  - scripts/lsp-repo.sh, the rs/ project: rust-analyzer creates rs/target and rs/Cargo.lock when it loads.
    rs/.gitignore covers target/, but Cargo.lock appears as an untracked file.

Checks for Main: just map-check (after the project-map update), just check.
```