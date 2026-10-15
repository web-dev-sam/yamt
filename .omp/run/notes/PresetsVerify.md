The gate passes, but `just mutants c74c92e` did not run: cargo-mutants stopped on the unmutated tree because one test failed there. So no mutants were tested and there are no survivors to judge. Playwright WebKit cannot launch on this host. Every part of recipe 4 was observed in the real app, with two deviations, and the protected folders and the owner's settings did not change.

Run on HEAD `b33d52d`, clean tree (`git status --short` empty before and after).

```
gate: "pass"

failures:
  - step: "just mutants c74c92e (VF7), not part of the gate"
    excerpt: |
      flaky: passes in `just check` (nextest, one process per test) and fails in cargo-mutants' baseline
      `cargo test`, where tests in one binary run on threads of a single process.
      running 18 tests  (yamt-lsp-host --test run)
      test a_bare_program_name_is_found_in_a_project_folder_and_not_without_it ... FAILED
      thread '...' panicked at crates/lsp-host/tests/run.rs:399:5:
      SpawnFailed { program: "lsp-echo", message: "Text file busy (os error 26)" }
      test result: FAILED. 17 passed; 1 failed
      *** result: Failure(101)
      ERROR cargo test failed in an unmutated tree, so no mutants were tested
      error: recipe `mutants` failed with exit code 4
      target/mutants/mutants.out/{caught,missed,timeout,unviable}.txt: 0 lines each.
      The StrykerJS step comes after the cargo step and never ran (set -e), so no .ts files were mutated.
      18 non-test changed files under the mutated paths since c74c92e are untested by mutation.
      [INFERENCE] Cause: the test copies lsp-echo into tools/ and starts it right away. Another test on another
      thread forks at the same moment and briefly holds the copy's write handle, so the start gets ETXTBSY.
      This is a real flake in the test (owner: lsp-host). Not rerun (VF1/VF2).
  - step: "pnpm -C frontend test:browser"
    excerpt: |
      Error: browserType.launch:
      ║ Host system is missing dependencies to run browsers. ║
      ║     sudo pnpm exec playwright install-deps           ║
      ║     sudo apt-get install libicu74 libxml2 libflite1  ║
      [ELIFECYCLE] Command failed with exit code 1.
      Playwright WebKit does not launch here; engine.browser.test.ts did not run.

smoke:
  - recipe: "1. just check"
    pass: true
    observed: |
      exit=0. Tail of each step:
      fmt-check "All matched files use the correct format." / cargo fmt --check silent
      clippy -D warnings "Finished `dev` profile"
      test "Summary [4.225s] 449 tests run: 449 passed, 1 skipped"
      deny "advisories ok, bans ok, licenses ok, sources ok" (warnings only: license-not-encountered,
        unmaintained paste RUSTSEC-2024-0436 and proc-macro-error RUSTSEC-2024-0370)
      bindings-check / fixtures-check: diff -u / diff -ru produced no output
      web-lint, web-typecheck: no output
      web-test "Test Files 100 passed (100) / Tests 1335 passed (1335)"
      web-unused (knip): no output
      arch-check: ok; map-check: ok
      golden: "ok" for all 10 cases
      sfc-order: no output
      hooks-test: "tests 16, pass 16, fail 0"

  - recipe: "2. just mutants c74c92e"
    pass: false
    observed: "Baseline failed (see failures). No survivors exist, so none could be judged (a/b/c or real gap)."

  - recipe: "3. pnpm -C frontend test:browser"
    pass: false
    observed: "WebKit does not launch: 'Host system is missing dependencies to run browsers' (libicu74, libxml2, libflite1)."

  - recipe: "4.1 Question"
    pass: true
    observed: |
      Debug binary built with `cargo tauri build --debug --no-bundle`. Repo built with
      scripts/lsp-repo.sh --servers /tmp/yamt-test-presets-final: 9 conflicted files.
      Started via app-session with PATH=~/.cache/yamt/servers-path:$PATH, RUSTUP_HOME=~/.rustup, CARGO_HOME=~/.cargo.
      Dialog: "Start this project's language servers?"
        Biome — biome/
        clangd — c/
        gopls — go/
        Phpactor — php/
        ruff, ty, basedpyright — py/
        rust-analyzer — rs/
        oxfmt, oxlint, TypeScript — web/
      Buttons: Start / Don't start. Clicked Start.
      Status bar showed: Biome clangd gopls Phpactor ruff ty basedpyright rust-analyzer oxfmt oxlint TypeScript.
      Screenshot: /tmp/yv/shots/01-start.png

  - recipe: "4.2 Problems per language (hover)"
    pass: true
    observed: |
      Real pointer hover (xdotool mousemove on the private display); text read from the tooltip.
      Underlines were only in the Result pane: none of the visible lint ranges sat in the Local or Remote pane.
      biome/src/index.js: "This is an unexpected use of the debugger statement. Biome lint/suspicious/noDebugger"
      web/src/math.ts:
        "`debugger` statement is not allowed … oxlint eslint(no-debugger)"
        "Type 'string' is not assignable to type 'number'. TypeScript 2322" (count)
      web/src/App.vue:
        "Type 'string' is not assignable to type 'number'. TypeScript 2322"
        "`debugger` statement is not allowed … oxlint eslint(no-debugger)"
      py/api/stats.py:
        os: "`os` imported but unused … ruff F401 / Import "os" is not accessed basedpyright reportUnusedImport"
        "three": "Object of type `Literal["three"]` is not assignable to `int` ty invalid-assignment /
          Type "Literal['three']" is not assignable to declared type "int" … basedpyright reportAssignmentType"
      rs/core/src/lib.rs: "expected 2 arguments, found 1 rust-analyzer E0061"
      go/calc/calc.go: "cannot use "three" (untyped string constant) as int value in variable declaration gopls IncompatibleAssign"
      c/src/main.c: "Incompatible pointer to integer conversion initializing 'int' with an expression of type 'char[6]' clangd -Wint-conversion"
      php/src/Stats.php:
        line 16: "Function undefined_helper not found. Phpactor function.notFound / Learn more at
          https://phpstan.org/user-guide/discovering-symbols Phpactor function.notFound"
          (shown twice in one tooltip, both labelled "Phpactor", not "PHPStan")
        line 19: phpcs Squiz.Functions.FunctionDeclarationArgumentSpacing.* (3 messages),
          Squiz.Functions.MultiLineFunctionDeclaration.BraceOnSameLine / ContentAfterBrace,
          PSR12.Operators.OperatorSpacing.NoSpaceBefore / NoSpaceAfter, all labelled "Phpactor"
      Screenshots: /tmp/yv/shots/02-biome.png, 04-math-full.png, 05-app-vue.png, 06-py.png, 07-rs.png,
      08-go.png, 09-c.png, 10-php.png

  - recipe: "4.3 Ctrl+S formats"
    pass: true
    observed: |
      Real Ctrl+S (xdotool) with the cursor in Result.
      App.vue: line 8 `const   totals={a:1,b:2}` became `const totals = { a: 1, b: 2 };`.
        The conflict's » × and × « controls are still on line 2 (/tmp/yv/shots/11-vue-saved.png).
        One Ctrl+Z gave back the bad line; a second Ctrl+Z changed nothing; Ctrl+Shift+Z restored the formatted line.
      biome/index.js, py/stats.py (ruff), rs/lib.rs (rustfmt), go/calc.go (gofmt), c/main.c (clang-format),
      php/Stats.php (phpcbf), web/math.ts (oxfmt): for each one, saving changed the editor, and one Ctrl+Z
      restored exactly the pre-save text.
      The files on disk hold the formatted text with git's markers <<<<<<< HEAD / ======= / >>>>>>> remote, e.g.
        `export const spaced = { a: 1, b: 2 };`
        `totals = {"a": 1, "b": 2}`
        `int spaced(int a, int b) { return a + b; }`
        `function spaced($a, $b)\n{\n    return $a + $b;\n}`

  - recipe: "4.4 Not installed"
    pass: true
    observed: |
      PATH=/usr/local/bin:/usr/bin:<node 24.22.0 bin>:/tmp/yv/driverbin, with RUSTUP_HOME and CARGO_HOME unset
      and an empty HOME (the helper's). /tmp/yv/driverbin holds only a tauri-driver symlink: the helper fails
      with "spawn tauri-driver ENOENT" when the driver is not on PATH, and putting ~/.cargo/bin on PATH was not allowed.
      Question: "gopls (not installed) — go/", "Phpactor (not installed) — php/",
      "rust-analyzer (not installed) — rs/", "oxfmt, oxlint, TypeScript (not installed) — web/".
      Menus:
        rust-analyzer "Not installed ¦ For all projects: ¦ rustup component add rust-analyzer ¦ Copy …"
        gopls "go install golang.org/x/tools/gopls@latest ¦ Copy ¦ It goes to Go's bin folder (usually ~/go/bin) …"
        Phpactor "curl --create-dirs -Lo ~/.local/bin/phpactor https://github.com/phpactor/phpactor/releases/latest/download/phpactor.phar && chmod a+x ~/.local/bin/phpactor ¦ Copy ¦ Needs PHP 8.2 or later."
        TypeScript "This project uses TypeScript 5.9.3, which needs the separate package typescript-language-server.
          ¦ In web/: ¦ pnpm add -D typescript-language-server ¦ Or for all projects: ¦ pnpm add -g typescript-language-server"
      Repo built without --servers (/tmp/yamt-test-presets-bare): "oxfmt, oxlint, TypeScript, Vue (not installed) — web/".
        Vue menu: "This project uses Vue; its .vue files need the package @vue/typescript-plugin in this project.
        ¦ In web/: ¦ pnpm add -D @vue/typescript-plugin"
      Screenshots: /tmp/yv/shots/21-ni-question.png, 22-ni-{rust-analyzer,gopls,Phpactor,TypeScript}.png,
      23-vue-not-installed.png

  - recipe: "4.5 Exit while starting / crash after running"
    pass: true
    observed: |
      PATH=system+node+~/.cargo/bin with the real RUSTUP_HOME and CARGO_HOME, no servers-path.
      rust-analyzer menu: "Stopped while starting: exited with code 1 ¦ If it is not installed: ¦ For all projects:
        ¦ rustup component add rust-analyzer ¦ Copy …"
      Its log: "error: Unknown binary 'rust-analyzer' in official toolchain 'stable-x86_64-unknown-linux-gnu'." /
        "Exited with code 1". Screenshot: /tmp/yv/shots/25-ra-exit-starting.png
      Crash case, in the servers session: a running gopls was ended with SIGTERM.
        Deviation: I used `pkill -f`, not `kill`; both send SIGTERM, and it took both the wrapper and the real gopls.
        Menu: "gopls ¦ Stopped: exited ¦ Start ¦ Restart ¦ Show log", with no install steps
        (/tmp/yv/shots/20-gopls-crashed.png).

  - recipe: "4.6 Found again on focus"
    pass: true
    observed: |
      Bare repo with servers-path on PATH. Before: Vue button present; App.vue had only oxlint's `debugger;` underline.
      Copied /tmp/yamt-test-presets-final/web/node_modules/@vue/typescript-plugin into the bare repo's web/node_modules/@vue/.
      app-session focus-away (to xmessage) then focus-back (to app), no Restart.
      After: buttons "oxlint | TypeScript" only, with Vue gone. New underline on `count`, hover:
      "Type 'string' is not assignable to type 'number'. TypeScript 2322". Screenshot: /tmp/yv/shots/24-vue-found.png

  - recipe: "4.7 Settings → Language servers → From the list"
    pass: true
    observed: |
      The menu is yamt's own (role=menu, opens upward above the button), with 17 entries: oxfmt, Biome, oxlint,
      TypeScript, eslint, rust-analyzer, gopls, ruff, ty, basedpyright, pyright, Phpactor, Intelephense, clangd,
      Deno, bash-language-server (with their commands). Screenshot: /tmp/yv/shots/15-from-list-menu.png
      Escape: visible menus 0. Reopen: 1. Outside click at (1400,300): 0.
      Picking Intelephense filled Command "intelephense --stdio" and File types "php".
      Add: settings.json added=[{command:["intelephense","--stdio"],fileTypes:["php"]}]. Opening Stats.php started
        `node ~/.cache/yamt/servers-path/intelephense --stdio` and the toolbar showed Intelephense.
      "Remove intelephense --stdio": added=[] and no intelephense process left.
      Keymap row menus:
        "Apply" row (rowBottom 118) opened below (menuTop 118): "Add Keyboard Shortcut | Change Enter… |
          Remove Enter | Change Space… | Remove Space"; Escape closed it.
        "Toggle file list" row (rowTop 934) flipped above (menuBottom 934); an outside click closed it.
      Screenshots: /tmp/yv/shots/18-keyrow-below.png, 19-keyrow-flipped.png

  - recipe: "4.8 Lock file appears"
    pass: true
    observed: |
      ruff/ty/basedpyright PIDs 624994/625000/625006/625042 before `touch py/uv.lock`, and the same PIDs after
      focus-away and focus-back.
      ruff log: a single "13:26:59 yamt Starting ruff server in py" and no later start
      (/tmp/yv/shots/13-ruff-log.png).

  - recipe: "4.9 No leftovers"
    pass: true
    observed: |
      After each `app-session stop`, pgrep for yamt-test-presets / servers-path / .cache/yamt / yamt-app-session
      found nothing.
      A pgrep for the preset program names found only processes that predate this run (PIDs 5171–6262: the
      owner's VS Code tsserver, its oxlint/oxfmt --lsp, its rust-analyzer and proc-macro-srv). They were already
      running before Start.

  - recipe: "5. Owner's files untouched"
    pass: true
    observed: |
      ls -la of ~/go/bin, ~/.cargo/bin, ~/.local/bin and ~/.config/yamt, before vs after: the entries in each
      folder are identical.
      ~/.config/yamt/settings.json sha256 03de9d5f…ffe22 is the same before and after (mtime 2026-10-14 22:28:40).
      The only diff line is the `..` of ~/.cargo/bin, i.e. ~/.cargo itself: mtime went from 13:15:12 to 13:21:57,
      which falls within the `just check` run. That is outside the listed folders.
```

**Environment (VF5):**
- rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0, cargo-mutants 27.1.0.
- Server versions from `lsp-servers.sh`: typescript-language-server 6.0.2, intelephense 1.18.5, biome 2.5.15, @vue/typescript-plugin 3.3.13, gopls v0.23.0, rust-analyzer 2026-10-12, php 8.4.23, phpactor 2026.10.07.0, phpstan 2.3.1, phpcs 4.0.4, ruff 0.17.0, ty 0.0.88, basedpyright 1.40.2.
- clangd and clang-format come from /usr/bin.
- Playwright WebKit is unavailable (missing system libraries). The real app runs on a private Xvfb display (:2) through app-session.
- Shell quoting caveat: `just app-session read '…'` breaks JS expressions that contain parentheses, so I called `pnpm -C frontend exec tsx scripts/app-session.ts` directly.

Screenshots are in `/tmp/yv/shots/` (01–25). Logs: `/tmp/yv/check.log`, `/tmp/yv/mutants.log`.

The lsp-host flake needs a fix by its owner, then `just mutants c74c92e` needs a rerun to judge any survivors. Separately, the two identical "Function undefined_helper not found" entries labelled "Phpactor" in item 4.2 may need a look.