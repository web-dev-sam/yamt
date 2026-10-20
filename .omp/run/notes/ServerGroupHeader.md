I built the header group, the pins, the `?servers` fixture host and the keyboard and blur rules. All five frontend recipes exit 0. WebKit steps 1–12 and real-app steps 1–6 were run and observed, with two caveats noted below: in WebKit, step 9 was checked with synthetic window events, and the Settings switch showed the wrong tick. Every session I started is stopped, and nothing is committed.

The Settings problem (open_risks 1) belongs to row 5, not this slice. On the `?servers` page, switching a server off works: Settings mutes its row, and the server leaves the header and the list. But the checkbox stays ticked, because the in-memory settings reply arrives before WebKit undoes the cancelled click. The real app was not affected.

```
summary
  New ui/ServerGroup.vue: the "Servers" button (groupDot dot, chevron-down, "Language servers", aria-expanded), a
  teleported menu with a row and a pin per server, and a chosen row's ServerMenu in the list's place.
  ServerStatus.vue: counts, note, the pinned buttons in view order, then ServerGroup. New ui/serverButtons.ts
  (DOT_CLASSES moved here); serverText.ts gains groupDot and the group/pin words.
  menuKeys.ts MENU_ITEMS; useDropdownMenu queries it and closes on window blur; ServerMenu focuses its opener on
  Escape/Tab. New ipc/fixtureServers.ts; main.ts builds it only with ?servers.

files_changed
  frontend/src/ui/ServerGroup.vue (new), frontend/src/ui/serverButtons.ts (new), frontend/src/ui/serverButtons.test.ts (new)
  frontend/src/ui/ServerStatus.vue, ServerMenu.vue, useDropdownMenu.ts, menuKeys.ts, menuKeys.test.ts, serverText.ts,
  serverText.test.ts, AGENTS.md
  frontend/src/ipc/fixtureServers.ts (new), frontend/src/ipc/fixtureServers.test.ts (new), frontend/src/ipc/index.ts,
  frontend/src/ipc/fixtureSettings.ts (only `export` on REPOSITORY, granted by Main), frontend/src/main.ts

tests_added
  serverText.test.ts
    - "rule 4: the group's dot is the more urgent of any two kinds, in either order": all 15 pairs over
      problem > warning > busy > running > stopped, both orders.
    - "rule 4: no servers read as stopped; one running beside stopped ones reads as running".
    - "rule 5: the pin's title says what a press does; its name names the server".
  serverButtons.test.ts
    - "one button per view, in view order, named by the shown name and keyed by the key".
    - "a button is pinned when its key is pinned, never by its shown name".
    - "a button's title is its state line and its dot the state's dot class".
  menuKeys.test.ts
    - "rows and pins are one list: Down goes row 1, pin 1, row 2; Up from row 2 to pin 1".
  fixtureServers.test.ts
    - "the context is fixture mode's repository".
    - "findProgram walks .bin from the project up to the root".
    - "a program in no .bin is not found, and the answer names every folder tried".
    - "projectFiles answers each path: a file's text, a folder, or missing".
    - "the package.json lists eslint, so the eslint rule finds its package".
    - "a start answers SpawnFailed: language servers run only in the app".
  The blur close in useDropdownMenu has no node test: it is a watch on vueuse useWindowFocus, which needs a window.
  It is observed in WebKit and the real app below.

smoke_evidence
  1. Recipes (exit codes read separately)
     lint=0, typecheck=0, unused=0, fmt=0 ("All matched files use the correct format."), sfc-order exit 0
     pnpm -C frontend test → "Test Files 116 passed (116)", "Tests 1572 passed (1572)"

  2. WebKit (MiniBrowser, app-session start-fixture q7-fx, 1600x1000, then location.href="/?servers")
     1. Question: "oxlint, TypeScript, Vue (not installed), eslint (not installed) — the repository root" → Don't start.
        Visible [aria-haspopup=menu] = [["Language servers","Language servers","Servers"]]; dot "bg-problem-warning".
     2. Rows: oxlint=Stopped, TypeScript=Stopped, Vue=Not installed, eslint=Not installed.
        4 pins aria-checked "false", title "Pin to the header". Keyboard on "oxlint"; aria-expanded "true".
     3. Header: oxlint@1304, TypeScript@1368, "Language servers"@1462. List open.
        Pins true/true/false/false; titles "Unpin from the header"; pressed bg rgba(119, 76, 213, 0.35).
        Stored: {"/fixture/repository":["oxlint (repository root)","TypeScript (repository root)"]}
     4. Escape → {"open":false,"active":"Language servers","expanded":"false"}
     5. Pinned oxlint → menu "oxlint" [Start, Show log], keyboard on Start → Show log → "oxlint log / Nothing logged
        yet." → Back → file list shown.
     6. Unpin TypeScript → header ["oxlint","Language servers"], list still open.
     7. Reload → Don't start → header ["oxlint","Language servers"]; stored {"/fixture/repository":["oxlint (repository root)"]}
     8. Keyboard, focus on the group button:
        - Enter → menuitem:oxlint
        - Down → menuitemcheckbox:Pin oxlint
        - Down, Down → Pin TypeScript
        - Space → aria-checked true, list open
        - Up → menuitem:TypeScript
        - Enter → "menuitem:Start | TypeScript | false | true" (ServerMenu has the keyboard, list closed, group expanded)
        - Escape → active "Language servers", expanded "false"
        Pinned button: Escape in its menu → active "oxlint".
     9. `focus-away` refuses fixture sessions ("needs the private display of a start-app session").
        This MiniBrowser's document.hasFocus() is false, so synthetic window focus then blur → list closed, active
        "Language servers". The real focus-away is in 3 below.
     10. Start from oxlint's menu → title "Could not start: language servers run only in the app"; dot "bg-problem-error".
     11. Settings, Found:
         - 4 switches: oxlint/TypeScript/Vue/eslint all true.
         - TypeScript off → header ["oxlint","Language servers"]; list [oxlint, Vue, eslint].
         - On again → header ["oxlint","TypeScript","Language servers"]; pins stored unchanged.
         - All four off → 0 group buttons, all rows muted; screenshot /tmp/yamt-q7/webkit-all-off.png shows no status area.
     Also checked:
       - A group click while eslint's row menu is open → ServerMenu false, list false, expanded false.
       - Without ?servers ("/"): no dialog, 0 group buttons.
     12. Screenshots: /tmp/yamt-q7/webkit-dark-pins-list.png, /tmp/yamt-q7/webkit-light-pins-list.png

  3. Real app (cargo tauri build --debug --no-bundle → "Built application at: …/target/debug/yamt";
     scripts/lsp-repo.sh --servers /tmp/yamt-q7/lsp; --home /tmp/yamt-q7/home on every start)
     q-a:
       - Start → header ["Language servers"], status ["1 error, 0 warnings"].
       - List: Biome=Running, clangd, gopls, Phpactor, ruff, ty, basedpyright, rust-analyzer, oxfmt, oxlint,
         TypeScript (=Stopped).
       - Pin Biome and oxlint → "Biome:Running ; oxlint:Stopped ; Language servers"; Escape → keyboard on the group.
       - Biome menu: Stop → Stopped, pgrep empty; Start → Running, pgrep "…biome lsp-proxy".
         Show log → "Starting biome lsp-proxy … Exited with code 0 … Starting biome lsp-proxy".
       - Unpinned Biome, pinned ruff. Opened py/api/stats.py: counts "2 errors, 1 warning";
         pgrep "/tmp/yamt-q7/lsp/py/.venv/bin/ruff server".
       - Settings, click ruff --role switch → "ruff=false"; pgrep none.
         Header "oxlint:Stopped ; Language servers"; counts "2 errors, 0 warnings"; list without ruff.
       - focus-away with the list open → closed, hasFocus false; focus-back → active "Language servers".
       - Screenshot /tmp/yamt-q7/app-dark-pins-list.png.
     q-b (restart, same repo and home):
       - "no question"; header "oxlint:Stopped ; Language servers"; pins {"…/lsp":["oxlint (web)","ruff (py)"]}.
       - py file opened, 12 s → "pgrep after 12 s: none"; ty and basedpyright running.
       - ruff on → pgrep "…ruff server"; header "ruff:Running ; oxlint:Stopped ; …" (pin back).
       - Off then on in this run → log "Starting ruff server in py / Exited with code 0 / Starting ruff server in py".
       - oxfmt switched off; file shows "off": {"/tmp/yamt-q7/lsp": ["oxfmt (web)"]}.
     Suffix:
       - git merge --abort, web/ copied to web2/ on local and remote, merged again → 12 conflicted files.
       - q-d: no question; header "ruff ; oxlint (web) ; Language servers".
       - List: … ruff (pinned), …, oxlint (web) (pinned), TypeScript (web), oxfmt (web2), oxlint (web2), TypeScript (web2).
       - Switches: oxfmt (web)=false, all others true.
       - Light screenshot /tmp/yamt-q7/app-light-pins-list.png.
     q-c (conflict-repo /tmp/yamt-q7/plain, two hand-added servers in --settings):
       - Question "oxlint, taplo — added by you" → Start.
       - Pin oxlint → deleted-side view (docs/removed.md): ["oxlint@1400,11","Language servers@1463,11"].
       - Choice view (assets/logo.bin): same two buttons; list "oxlint=Stopped, taplo=Stopped".
       - Row taplo → menu "taplo / Stopped / Start / Show log"; Escape → active "Language servers".
       - Screenshots: app-dark-deleted-side.png, app-dark-choice.png, app-light-choice.png, app-light-deleted-side.png (in /tmp/yamt-q7).

  4. Stopped: q7-fx (webdriver, vite), q-a, q-b, q-d, q-c (each "session":"ended").
     pgrep for tauri-driver, Xvfb :2, target/debug/yamt, MiniBrowser → "no sessions left".

deviations_from_brief
  - frontend/src/ipc/fixtureSettings.ts: `export` added on REPOSITORY (line 16) so fixtureServers.ts imports it; Main granted this.
  - The fixture tree also holds node_modules/vue/package.json. Without it Vue is never found, and design step 1 expects
    "Vue (not installed)".
  - The fixture host's `send` and `stop` do nothing: `start` never gives a RunId, so no run can reach them.
  - ServerGroup rows also carry aria-label = name and aria-description = state line, like the pinned buttons. Without
    them app-session (and its name order) named a row by its title ("Stopped").
  - The ServerMenu's first-item focus and item query use MENU_ITEMS too. It has only menuitems, so this is the same behaviour.
  - WebKit used `app-session start-fixture` (its own dev server and webdriver on free ports), not ports 5277/4447;
    ?servers was opened with location.href.
  - VU15, one line for the new component: ServerGroup.vue owns one popup group (button, list, a row's ServerMenu),
    which keeps ServerStatus small (design §8).
  - ui/AGENTS.md: row 6's lines (ResizeDots, dividers, FileList handle) plus PaneDivider.vue added, with my own paragraph.
  - Needed outside my files (orchestrator): project map / map-check must name ui/ServerGroup.vue, ui/serverButtons.ts
    and ipc/fixtureServers.ts; architecture and CHANGELOG are not updated.
  - .omp/run/slices.json (modified) and .omp/run/patches/PaneHandlesR1.patch (untracked) were already in the tree; I did not touch them.

open_risks
  - frontend/src/ui/LanguageServerSettings.vue (row 5, not mine): in fixture mode a switch click leaves the native
    checkbox ticked although the server is off (row muted, server gone from header and list).
    [INFERENCE] The in-memory reply resolves before WebKit restores the cancelled click. In the real app the IPC reply
    is slower and the switch shows correctly ("ruff=false").
  - frontend/src/ui/ServerGroup.vue:44-52: the list's anchor is taken at click time. A pin added while the list is open
    moves the group button left, and the list stays where it opened.
  - frontend/src/ui/useDropdownMenu.ts:107: vueuse useWindowFocus starts from document.hasFocus(). A window that never
    had focus (this MiniBrowser) sees no change on blur. In the real app the close was observed.
  - frontend/src/ui/ServerStatus.vue: if a pinned server's menu is open and that server is unpinned, the menu keeps a
    detached opener until it closes. Not seen in use.
```

Still to run on your side: `just check` (including map-check once the three files are in the project map) and `just mutants` on `ui/serverButtons.ts`, `ui/serverText.ts`, `ui/useDropdownMenu.ts`, `ui/menuKeys.ts` and `ipc/fixtureServers.ts`.