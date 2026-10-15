All four Change items are in, and all three acceptance items were observed. Main approved one edit outside the brief's files (`ServerView` now carries `help` and `notes`), and I made one split to stay under the 300-line limit. Both are listed under deviations. `just map-check` will fail until the project map names the two new files (exact text below).

```
summary
  Settings → Language servers has a "From the list" button (PresetPicker.vue). It opens yamt's own themed menu of
  presetChoices() with each command beside its name; picking one fills Command and File types, both still editable, and
  Add works as before. The hint line under the form mentions the list. A server that failed to start or exited, and
  whose spec has `help`, shows "If it is not installed:" and then the same install text as "Not installed". A spec's
  notes show as muted lines under the state line (the TypeScript 7 Vue note). The Poetry install hint gains the .venv line.

files_changed
  frontend/src/ui/PresetPicker.vue (new)
  frontend/src/ui/installText.ts (new)
  frontend/src/ui/installText.test.ts (new)
  frontend/src/ui/serverText.ts
  frontend/src/ui/serverText.test.ts
  frontend/src/ui/LanguageServerSettings.vue
  frontend/src/ui/ServerMenu.vue
  frontend/src/ui/AGENTS.md
  frontend/src/ui/servers.test.ts
  frontend/src/lsp/internal/state.ts
  frontend/src/lsp/index.ts
  frontend/src/lsp/index.test.ts

tests_added
  installText.test.ts "python: %s installs with …": now takes the expected lines as a column; the poetry row expects
    exactly the line "yamt looks in the project's .venv, which Poetry uses only with virtualenvs.in-project set to
    true.", uv and pdm expect none.
  installText.test.ts "a failed start ($kind) with help leads into the install text" (notFound, spawnFailed,
    initializeFailed, timedOut, crashed with code 1 and with null): returns lead "If it is not installed:" plus
    installText(help); with help null it returns null.
  installText.test.ts "no install text under $kind, which installing would not fix" (noHost, outsideRepository,
    stopped, starting, running, stopping, notInstalled): returns null.
  serverText.test.ts "the TypeScript 7 Vue note names the project's TypeScript version": version 7.0.2 appears in the sentence.
  lsp/index.test.ts "rule 3: setSpecs keeps an unchanged spec's run …": views() now must carry each spec's help and
    notes (one spec has a system hint and the vueNeedsTypeScript6 note, the other null and []).
  servers.test.ts "serverViews follow LanguageServers.onChange": the expected view now includes help: null, notes: [].

smoke_evidence
  1. pnpm -C frontend exec vitest run --project node src/ui/installText.test.ts src/ui/serverText.test.ts --reporter=verbose
     → "✓ … python: poetry installs with `poetry add --group dev ruff` here and `pipx install ruff` for all projects",
       "✓ … a failed start (failed|crashed) with help leads into the install text" ×6,
       "✓ … no install text under … which installing would not fix" ×7,
       "✓ … the TypeScript 7 Vue note names the project's TypeScript version", "Tests 48 passed (48)".
  2. pnpm -C frontend run -s <recipe>, each with exit 0:
       lint ($ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"), typecheck ($ vue-tsc -b),
       test ("Test Files 100 passed (100) / Tests 1305 passed (1305)"), unused ($ knip --include exports,types),
       fmt:check ("All matched files use the correct format."), sfc-order ($ tsx scripts/check-sfc-order.ts).
  3. Build: target/debug/yamt from this tree (cargo tauri build --debug --no-bundle).
     Repository: /home/wds/Projects/yamt/scripts/lsp-repo.sh --servers /tmp/yamt-test-chrome2.
     Runs: `just app-session` (private Xvfb, its own HOME and XDG folders).
     (a) PATH=/home/wds/.cache/yamt/servers-path:$PATH; answered Start; Settings; scrolled to the bottom; "From the list".
         The menu opened in yamt's dark theme, above the button (no room below), first item focused. Shot:
         /tmp/yamt-chrome2-a-list.png. It lists oxfmt, Biome, oxlint, TypeScript, eslint, rust-analyzer, gopls, ruff, ty,
         basedpyright, pyright, Phpactor, Intelephense, clangd, Deno and bash-language-server, each with its command.
         Picking Intelephense filled the inputs with ["intelephense --stdio","php"], closed the menu and put focus back
         on "From the list". In a second run with the final build, `click "Intelephense" --role menuitem` gave the same
         values. Add, then php/src/Stats.php: the status area shows "Intelephense | Running" (green dot, shot
         /tmp/yamt-chrome2-a-running.png); pgrep: "node /home/wds/.cache/yamt/servers-path/intelephense --stdio".
     (b) env PATH=/home/wds/.cache/yamt/servers-path:… left out; PATH=/home/wds/.cargo/bin:/usr/local/bin:/usr/bin:/bin,
         RUSTUP_HOME=/home/wds/.rustup, CARGO_HOME=/home/wds/.cargo. Run outside the app, the stub prints "error: Unknown
         binary 'rust-analyzer' in official toolchain 'stable-x86_64-unknown-linux-gnu'." and exits 1.
         Start, then rs/core/src/lib.rs. rust-analyzer's menu read: "rust-analyzer / Stopped: exited with code 1 /
         If it is not installed: / For all projects: / rustup component add rust-analyzer / Copy / Or install it any
         other way that puts rust-analyzer on your PATH. / yamt finds it when you come back to this window. / Start /
         Restart / Show log". Shot: /tmp/yamt-chrome2-b-rust.png.
     (c) The fixture page cannot carry a note: in fixture mode serverSetup only loads and refreshes, and sets no specs.
         So I used a real TypeScript 7 project: /tmp/yamt-test-chrome2-ts7, a copy of the smoke repository whose
         web/node_modules/typescript is typescript@7.0.2 (`npm install --prefix /tmp/yamt-ts7-pkg`; a real
         package.json and links, because detection did not find TypeScript while the whole folder was one symlink).
         `tsc --version` printed "Version 7.0.2". Start, then web/src/App.vue. TypeScript's menu read: "TypeScript /
         Stopped / Vue files get no type problems: TypeScript 7.0.2 runs no plugins, and Vue needs TypeScript 6. / Start
         / Show log". Shot: /tmp/yamt-chrome2-c-ts7.png.
     After each `app-session stop`, pgrep -af for every preset program (intelephense, phpactor, biome, clangd, gopls,
     rust-analyzer, ruff/ty server, basedpyright, oxlint/oxfmt --lsp, typescript-language-server, tsserver, tsc --lsp)
     found only pids 6261/6262. Those are rust-analyzer-proc-macro-srv from the rustup toolchain, running before these
     sessions; the row 5 report also traced them to VS Code. Nothing was left over from yamt.

deviations_from_brief
  - lsp/ edits, granted by Main mid-run: `ServerView` (lsp/internal/state.ts) gains `help: InstallHint | null` and
    `notes: readonly SpecNote[]`, filled from the spec in lsp/index.ts `views()`. The test literals follow in
    lsp/index.test.ts and ui/servers.test.ts. Reason: the menu only had name/project/state, and hand-added servers'
    help exists nowhere else the ui can reach.
  - New file ui/installText.ts, plus installText.test.ts, split out of serverText.ts. The new words took serverText.ts
    to 338 lines, over max-lines 300. The install-hint text (commands per package manager, steps, notes, installText,
    failureHelp, InstallText, FailureHelp) moved there unchanged, and its tests moved with it. The Goal says words live
    only in serverText.ts; this is the one exception, and ui/AGENTS.md says so.
  - New component ui/PresetPicker.vue (VU15 reason): the menu's own open/close/focus/keyboard state is separate from
    the add form. It reuses the key list's row-menu pattern (absolute menu, onClickOutside, stepMenuItem, flips above
    when out of room).
  - Two new words in serverText.ts: "From the list" and the hint sentence ("\"From the list\" fills both fields with a
    known server."). Menu items are labelled by the server name alone (aria-label), because the name and the command
    otherwise run together as one word.
  - Brief item 2 left the "exited" case open. `FailReason` has no exit case; an exit while starting arrives as state
    `crashed` (server.ts #exited), and that is what rustup's stub produced. So `failureHelp` covers failed (notFound,
    spawnFailed, initializeFailed, timedOut) and crashed. It excludes noHost and outsideRepository. A server that
    crashes after running a while also shows the steps, because the state cannot tell the two apart.
  - noteLine has no switch: SpecNote has one kind, and oxlint's no-unnecessary-condition rejects a switch over it.
  - Project map, which I don't own: the ui line in .omp/skills/project-map/SKILL.md must name PresetPicker ("From the
    list": presetChoices() in yamt's menu, fills Command and File types) and installText.ts (an install hint's text:
    commands per package manager, steps, lines; failureHelp). `ServerView` now carries help/notes. Without this,
    `just map-check` fails.
  - Scaffolding: frontend/node_modules was linked to the main checkout for the recipes and removed afterwards. Left
    in place: target/ (gitignored) from the app build, and the throwaway /tmp/yamt-test-chrome2-ts7 and /tmp/yamt-ts7-pkg.
  - .omp/run/mutants/PresetsDetect3.txt shows as untracked in git status; I did not create it and left it alone.

open_risks
  - frontend/src/ui/serverText.ts:124 noteLine: a second SpecNote kind that also has a `version` field would compile
    and silently get the Vue sentence; the switch should come back once a second kind exists.
  - frontend/src/ui/installText.ts failedWhileStarting: `crashed` after a long run also shows "If it is not installed:"
    (see deviations); only a new state kind could separate the two.
  - frontend/src/ui/PresetPicker.vue: the menu is positioned inside the settings scroller (top-full or bottom-full).
    With a window shorter than the 16 rows, part of it would only show after scrolling. Not tried below 1000 px.
  - Checks for Main: just map-check (after the map update), just check, just mutants on this patch.
```