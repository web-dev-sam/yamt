All four blocks are fixed and acceptance items 1–4 passed. One problem left over from round 1 turned up in the run (first open risk): with `--servers`, `oxfmt --check` also lists `web/package.json`. Nothing is committed and the temporary run folders are gone.

```
summary
  web/src/App.vue now has a `debugger;` and a badly formatted line in its <script setup>, the same in base, local and
  remote and clear of the conflicted line. The header and the "lsp: new conflict project" task name greet.ts as the one
  conflicted file with no seeds. The header now says correctly what the no-servers variant lacks and gives the general
  "not installed / not detected" rule. A failed PHP, Phpactor or composer.phar download, or a failed PHP extraction,
  prints one "PHP could not run" line instead of dying. With --servers, lsp-repo.sh checks for `uv` before `git init`.

files_changed
  scripts/lsp-repo.sh
  scripts/lsp-servers.sh
  .vscode/tasks.json

tests_added
  none: the brief's acceptance is command evidence, and these shell scripts have no test harness.

smoke_evidence
  How I ran it: the same as round 1. /tmp/yamt-presets-run/{scripts -> worktree scripts,
  frontend/node_modules -> /home/wds/Projects/yamt/frontend/node_modules}; removed afterwards.

  1. lsp-repo.sh --servers /tmp/yamt-test-presets-r1 → exit 0, 9 conflicted files listed
     (biome/src/index.js … web/src/App.vue, web/src/greet.ts, web/src/math.ts); ls-files -u | cut -f2 | sort -u | wc -l → 9
     git show :2:web/src/App.vue → const label = "local"; … debugger; … const   totals={a:1,b:2}
     git show :3:web/src/App.vue → const label = "remote"; then the same seeds
     Working tree: the markers surround only line 2 (`label`); `debugger;` and the `totals` line sit outside them.
     After `git checkout --ours -- src/App.vue src/greet.ts src/math.ts` in web/:
       oxlint: src/App.vue:6:1: error eslint(no-debugger): `debugger` statement is not allowed
               src/math.ts:8:3: error eslint(no-debugger): `debugger` statement is not allowed
       oxfmt --check: package.json / src/App.vue / src/math.ts  "Format issues found in above 3 files."
         (for App.vue, oxfmt changes only `const   totals={a:1,b:2}` → `const totals = { a: 1, b: 2 };`)
       tsc --noEmit -p .: src/math.ts(14,14): error TS2322 (unchanged)

  2. Run with XDG_CACHE_HOME=/tmp/yamt-empty-cache (an empty folder), sourcing the script and changing the version
     variable only for that call; the file itself is not edited:
       bash -c 'source scripts/lsp-servers.sh && php_version=0.0.0-unreachable && php_home=$cache/php-$php_version && install_servers'
     → exit 0
       curl: (22) The requested URL returned error: 404
       lsp-servers: PHP could not run (could not download https://dl.static-php.dev/static-php-cli/common/php-0.0.0-unreachable-cli-linux-x86_64.tar.gz); Phpactor, PHPStan and phpcs are left out
       lsp-servers: typescript-language-server 6.0.2, intelephense 1.18.5, pyright 1.1.414, biome 2.5.15, @vue/typescript-plugin 3.3.13, gopls v0.23.0, rust-analyzer 2026-10-12, php 0.0.0-unreachable (runs: false), …
       lsp-servers: launch yamt with PATH=/tmp/yamt-empty-cache/yamt/servers-path:$PATH
       servers-path: gopls intelephense pyright pyright-langserver rust-analyzer typescript-language-server
     The same way, with phpactor_version=0.0.0-unreachable → exit 0:
       lsp-servers: PHP could not run (could not download https://github.com/phpactor/phpactor/releases/download/0.0.0-unreachable/phpactor.phar); Phpactor, PHPStan and phpcs are left out
       (no php, phpactor or composer in servers-path)
     And with a tar.gz that has no `php` in it (php_version=9.9.9) → exit 0:
       tar: php: Not found in archive
       lsp-servers: PHP could not run (/tmp/yamt-empty-cache/yamt/php-9.9.9/php-9.9.9-cli-linux-x86_64.tar.gz holds no php); Phpactor, PHPStan and phpcs are left out

  3. PATH=/home/wds/.vite-plus/bin:/usr/bin:/bin (no ~/.local/bin, where uv lives) lsp-repo.sh --servers /tmp/yamt-test-presets-nouv
     → lsp-repo: uv is needed to make py/.venv; see https://docs.astral.sh/uv/   exit 1
     ls -A /tmp/yamt-test-presets-nouv → No such file or directory

  4. uvx --from shellcheck-py shellcheck -x scripts/lsp-repo.sh scripts/lsp-servers.sh → no output, exit 0.
     bash -n on both → ok; .vscode/tasks.json parses as JSON.

deviations_from_brief
  - Block 4: the `uv` check moved out of `install_python_tools` (lsp-servers.sh) into lsp-repo.sh's prerequisite
    checks, which run only with --servers, rather than being written twice. lsp-repo.sh is its only caller.
  - Block 3: when the PHP archive cannot be extracted, it is deleted, so the next run downloads it again instead of
    failing on the same cached file. A failed `composer install` of PHPStan and phpcs still dies; the brief names only
    the downloads and the extraction.
  - The "PHP could not run (…)" line now names the failed step ("could not download <url>", "<archive> holds no php",
    "<php> does not start") instead of only the php path.
  - App.vue's badly formatted line is `const   totals={a:1,b:2}`, and the template shows `{{ totals.a }}` so the
    variable is used.

open_risks
  - scripts/lsp-repo.sh:83-95 (round 1 code, not changed): with --servers, `oxfmt --check` also lists web/package.json.
    The "@vue/typescript-plugin" entry is added after "typescript", and oxfmt wants the devDependencies sorted, so
    there is one formatting problem beyond the seeds. The fix would put that entry before "oxfmt". I left it alone
    because it is outside the four blocks.
  - scripts/lsp-servers.sh:184-186: `install_python_tools` no longer checks for uv itself. Anyone calling it without
    lsp-repo.sh's prerequisite check gets bash's "uv: command not found" instead of the named message.

Checks for Main: just check (map-check is unaffected: no files added).
```