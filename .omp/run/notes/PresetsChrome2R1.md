All three blocks are fixed. The five `pnpm -C frontend` recipes and `just sfc-order` exit 0, and the real-app checks in item 3 passed. One thing is left for you: `just map-check` will fail until the project map names the new `useDropdownMenu.ts`. That file is outside what I'm allowed to edit; the exact line to add is under deviations below.

```
summary
  - Block 1: a language server that exits while still starting is now a failed start, `failed` with reason `{ kind: "exited"; code }`. The words are "Stopped while starting: exited with code N", or "… exited" when there is no code. yamt does not try to stop a run that is already gone. `crashed` is now only for a server that was running, and it no longer shows install steps.
  - Block 2: the open/close/flip-above drop-down behaviour now lives in one place, `ui/useDropdownMenu.ts`. PresetPicker and KeymapList both use it, and the copies in each are deleted.
  - Block 3: `addedServerFields(server)` sits next to `parseAddedServer` in `ui/serverSetup.ts`. It is the inverse: command joined by spaces, file types by ", ". `fill`, the "Added by you" rows and their Remove labels, and the PresetPicker rows all call it.

files_changed
  frontend/src/lsp/internal/state.ts
  frontend/src/lsp/internal/server.ts
  frontend/src/lsp/index.test.ts
  frontend/src/ui/serverText.ts
  frontend/src/ui/serverText.test.ts
  frontend/src/ui/installText.ts
  frontend/src/ui/installText.test.ts
  frontend/src/ui/useDropdownMenu.ts            (new)
  frontend/src/ui/PresetPicker.vue
  frontend/src/ui/KeymapList.vue
  frontend/src/ui/serverSetup.ts
  frontend/src/ui/serverSetup.test.ts
  frontend/src/ui/LanguageServerSettings.vue

tests_added
  Block 1:
  - lsp/index.test.ts "rule 9: an exit during initialize is a failed start, not stopped again; messages before running are dropped"
    (replaces "a crash during initialize is crashed"): the state is failed/exited code 2; the log contains "yamt: Exited with code 2" and ends with "yamt: Stopped while starting: exited with code 2"; `host.stopped` is empty; no problems are shown.
    The existing "rule 9: an exit yamt did not ask for is crashed{code}…" still covers a crash after running: state crashed 137.
  - ui/installText.test.ts: "a failed start ($reason.kind) with help…" now has the rows failed/exited 1 and failed/exited null in place of the two crashed rows. "no install text under $kind…" gained crashed 1 and crashed null (a crash after running gets no install steps).
  - ui/serverText.test.ts ROWS: exited 1 → "Stopped while starting: exited with code 1", dot problem; exited null → "Stopped while starting: exited", dot problem.
  Block 2: no node test. The composable needs a DOM; the evidence is the real-app run in item 3.
  Block 3:
  - ui/serverSetup.test.ts "the add form: a server's fields are its command joined by spaces, its file types by commas".
  - ui/serverSetup.test.ts "the add form: $name from the list parses back to its own command and file types": one case per `presetChoices()` entry; `parseAddedServer(addedServerFields(choice))` equals `{ command, fileTypes }`.

smoke_evidence
  1. The tests above. `pnpm -C frontend exec vitest run --project node src/lsp src/ui` → "Test Files 49 passed" after the log assertion fix. The first run failed on my own log-order assumption, which I corrected.
  2. Each recipe was run with its exit status checked:
     lint: "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"" == exit 0
     typecheck: "$ vue-tsc -b" == exit 0
     test: "Tests 1335 passed (1335)" == exit 0
     unused: "$ knip --include exports,types" == exit 0
     fmt:check: "All matched files use the correct format." == exit 0
     just sfc-order: "$ tsx scripts/check-sfc-order.ts" == exit 0
  3. Setup: `cargo tauri build --debug --no-bundle` built target/debug/yamt from this tree ("Finished `dev` profile … in 42.56s"). The repository was made with `scripts/lsp-repo.sh --servers /tmp/yamt-test-chrome2r1`.
     (a) Session c2r1 (`just app-session start-app`, PATH with servers-path). Question dismissed, Settings opened, scrolled to the bottom.
       - "From the list": the menu opened above the button (class `bottom-full`, menu bottom 965.5 = button top 965.5), first item focused. Shot: /tmp/yamt-c2r1-list-open.png.
       - Escape → `{"focused":"From the list","menus":0}`.
       - Reopened, then clicked the "Language servers" heading (outside) → `{"focused":"From the list","menus":0}`.
       - Clicked "Intelephense" → inputs ["intelephense --stdio","php"], focus back on "From the list".
       - Second click on the open button → closed, focus on the button.
       - Clicked the Outdent row while the list was open → the list closed without taking focus, and the row's menu opened with "Add Keyboard Shortcut" focused. Its menu opened below; shot /tmp/yamt-c2r1-row-below.png.
       - Escape → `{"focused":"BUTTON:Outdent…","menus":[]}`.
       - "Find next" row near the bottom → menu class `bottom-full` (flipped above), "Add Keyboard Shortcut" focused. Shot: /tmp/yamt-c2r1-row-above.png.
       - Escape → focus on the "Find next" row.
       - Reopened, clicked the "Window" heading → `{"focused":"BUTTON:Find next…","menus":[]}`.
       - Second click on the open row → closed, focus on the row.
     (b) Session c2r1b, started with PATH=/home/wds/.cargo/bin:/usr/local/bin:/usr/bin:/bin, RUSTUP_HOME=/home/wds/.rustup, CARGO_HOME=/home/wds/.cargo, no servers-path. Start, then rs/core/src/lib.rs, then the rust-analyzer button. The menu text read:
       "rust-analyzer / Stopped while starting: exited with code 1 / If it is not installed: / For all projects: / rustup component add rust-analyzer / Copy / Or install it any other way that puts rust-analyzer on your PATH. / yamt finds it when you come back to this window. / Start / Restart / Show log"
       Shot: /tmp/yamt-c2r1-rs-menu.png. Show log: "error: Unknown binary 'rust-analyzer' in official toolchain …", "Exited with code 1", "Stopped while starting: exited with code 1".
     Both sessions were stopped. pgrep afterwards found only VS Code's tsserver processes. The frontend/node_modules link has been removed.

deviations_from_brief
  - New file frontend/src/ui/useDropdownMenu.ts. `just map-check` (PM6) needs its name in .omp/skills/project-map/SKILL.md, which is not mine to edit. Line to add, in the ui row after "menuKeys.ts (`stepMenuItem`: both menus' Up/Down/Escape/Tab);":
      useDropdownMenu.ts (`useDropdownMenu`: a drop-down's open/close, flip above, outside click and focus return; PresetPicker and KeymapList);
    Also in that row, `serverSetup.ts (… `parseAddedServer`)` should become `… `parseAddedServer`, `addedServerFields`)`.
  - The composable takes `{ menu, opener }`, two getters. Its key is generic: KeymapList uses KeyAction, PresetPicker uses the single literal "presets". The outside-click ignore list is now the open menu's opener element, which is equivalent to KeymapList's old `[data-keymap-row][aria-expanded=true]` selector. I split it into module-level functions over one state object because of the 40-line function limit.
  - The `failText` (log) and `failLine` (menu) words for `exited` are the same sentence.
  - target/ was created in this tree by the build and is not in git status.

open_risks
  - frontend/src/lsp/internal/server.ts:237 — only a `starting` run becomes failed/exited. A `launching` run has no attempt, so it never sees an exit. A server that exits after `initialized` is `crashed` with no install help, as the brief asks.
  - frontend/src/ui/useDropdownMenu.ts — no node test, because it needs a DOM. Mutants on it are left to the app smoke above.
```