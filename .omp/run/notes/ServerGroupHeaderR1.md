All five findings are fixed. The recipes exit 0, and the right-click checks were run with real X11 right-clicks in the app's WebKitGTK webview as well as on the `?servers` fixture page. One thing to know first: the WebDriver right-click can't serve as evidence for #1292. WebKitGTK's driver ends a button-2 press with `mouseup:0` + `click:0`, so that `click` would close the list even without the fix. On the fixture page I used a bare `contextmenu` event instead, and a real `xdotool click 3` in the app.

```
summary
  New ui/useMenuPlacement.ts: `useMenuPlacement(menu, at)` measures the menu and the window and places it with
  `menuPosition`; `belowLeft(opener)` is the shared "under its opener" anchor. ServerGroup and ServerMenu now use it.
  serverMenuToggle.ts exports `OpenMenu`. ServerStatus and ServerGroup hold it, and ServerMenu's props are `OpenMenu`.
  useDropdownMenu also closes on a `contextmenu` press outside the menu (the opener counts as outside), through
  `closeAfterClick`. ui/AGENTS.md reworded (#1291); the count test is deleted (#1293).

files_changed
  frontend/src/ui/useMenuPlacement.ts (new)
  frontend/src/ui/useDropdownMenu.ts
  frontend/src/ui/ServerGroup.vue
  frontend/src/ui/ServerMenu.vue
  frontend/src/ui/ServerStatus.vue
  frontend/src/ui/serverMenuToggle.ts
  frontend/src/ui/menuKeys.test.ts
  frontend/src/ui/AGENTS.md

tests_added
  none. "rows and pins are one list …" is removed from menuKeys.test.ts (#1293). The contextmenu close is a window
  listener and needs a DOM, so its evidence is the WebKit and real-app runs below.

smoke_evidence
  1. Recipes (each exit code read on its own):
     lint=0 ("oxlint --type-aware && eslint --max-warnings 0"), typecheck=0 (vue-tsc -b), sfc=0,
     fmt=0 ("All matched files use the correct format. … 344 files"), unused=0 (knip --include exports,types)
     test=0: "Test Files 116 passed (116)", "Tests 1573 passed (1573)"
  2a. WebKit fixture (app-session start-fixture q1r 1600x1000, location.href="/?servers", Don't start):
     - List open; a bare contextmenu (button 2) on <header> at 800,20:
       {"before":true,"ev":["contextmenu:2:HEADER"],"menus":["ToolbarMenu"],"expanded":"false","active":"Language servers"}
       Screenshot /tmp/yamt-q1r/toolbar-rightclick.png: only ToolbarMenu is visible.
     - List open; contextmenu on the group button:
       {"ev":["contextmenu:2:Language servers"],"menus":["ToolbarMenu"],"expanded":"false","before":true}
     - contextmenu on a row inside the list → menus ["Language servers"] (the list stays open).
     - PresetPicker (Settings → "From the list", 16 items, opener 563,930): contextmenu at 900,200 →
       {"menu":false,"expanded":"false","active":"From the list"}. A contextmenu inside it → menu stays; Escape →
       closed, active "From the list".
     - The driver quirk: WebDriver pointerDown/Up with button 2 logs
       ["mousedown:2:SPAN","contextmenu:2:SPAN","mouseup:0:SPAN","click:0:SPAN"]. That bogus click chose an "oxlint" row.
     - Round 1 steps:
       2. Rows oxlint=Stopped, TypeScript=Stopped, Vue=Not installed, eslint=Not installed; 4 pins "false/Pin to the
          header"; list at [1462,39] = the group button's bottom-left; active "oxlint"; expanded "true".
       3. Header ["oxlint@1304","TypeScript@1368","Language servers@1462"]; pins true/true/false/false, "Unpin from the
          header"; bg "rgba(119, 76, 213, 0.35)";
          stored {"/fixture/repository":["oxlint (repository root)","TypeScript (repository root)"]}
       4. Escape → {"open":false,"active":"Language servers","expanded":"false"}
       5. Pinned oxlint → menu "oxlint" at [1304,39] (opener bottom-left 1304,39), items [Start, Show log], keyboard on
          Start → Down → "Show log" → Enter → ["oxlint log","Nothing logged yet."] → Back → file list shown (11 visible
          rows). Row menu TypeScript at [1462,39]. A group click while it is open → 0 menus, expanded "false".
          The Vue row menu (480 px wide) is pushed left to left 1120 / right 1600 (innerWidth 1600).
       6. Unpin TypeScript → header ["oxlint@1398","Language servers@1462"], list still open.
       8. Keyboard from the group button:
          Enter → menuitem:oxlint; Down → Pin oxlint (checked=true); Down Down → Pin TypeScript (false);
          Space → checked=true, list=true; Up → menuitem:TypeScript;
          Enter → "menuitem:Start | list=false | expanded=true";
          Escape → "Language servers | list=false | expanded=false".
          Pinned oxlint: Escape in its menu → active "oxlint".
  2b. Real app, WebKitGTK (cargo tauri build --debug --no-bundle → "Built application at: …/target/debug/yamt";
      scripts/lsp-repo.sh /tmp/yamt-q1r/lsp; start-app q1a on :2; Don't start). Right-clicks are xdotool click 3:
     - List open, right-click toolbar 800,20:
       ev ["pointerdown:2:HEADER","mousedown:2:HEADER","contextmenu:2:HEADER","pointerup:2:HEADER","mouseup:2:HEADER",
       "auxclick:2:HEADER"] (no click event, as the finding expected); menus ["ToolbarMenu:8 items"];
       expanded "false". Screenshot /tmp/yamt-q1r/app-toolbar-rightclick.png.
     - List open, right-click group button 1507,25 → contextmenu:2:Language servers; menus ["ToolbarMenu"];
       expanded "false".
     - PresetPicker open (16 items), right-click at 900,200 → {"menu":false,"expanded":"false"}.
  3. grep "useElementSize" frontend/src/ui/*.vue → No matches found.
  4. Stopped q1r ("session":"ended": webdriver, vite) and q1a ("session":"ended": tauri-driver, xvfb).
     pgrep MiniBrowser|WebKitWebDriver|tauri-driver|Xvfb :2|target/debug/yamt → "no sessions left".

deviations_from_brief
  - #1292: the fix text says to close only for a target "outside the menu and the opener". Acceptance 2 wants a
    right-click on the group button to close the list. A secondary press on the opener has no toggle to handle it,
    so it would leave the list under ToolbarMenu. Only a target inside the menu is ignored. Left clicks still go
    through onClickOutside with the opener ignored.
  - I used `contextmenu` rather than `pointerdown` with button !== 0, so macOS Ctrl+click is covered too.
  - #1290: beyond the brief's `useMenuPlacement`, `belowLeft(opener)` is in the same file, for the bottom-left anchor
    the finding also names. ServerStatus uses it as well.
  - #1289: ServerMenu's props are `defineProps<OpenMenu>()` so the shape lives in one place. `menuAfterClick` stays
    generic, because its node test uses plain objects without an HTMLElement.
  - ui/AGENTS.md paragraph 7 also names OpenMenu, useMenuPlacement/belowLeft and the right-press close, and drops
    "placed by `menuPosition`".
  - WebKit evidence for the fixture page used dispatched `contextmenu` events because of the driver quirk above.
    Real right-clicks were done in the app on a private display. The fixture MiniBrowser runs on the owner's desktop,
    so xdotool was not used there.
  - For the orchestrator: the project map must name ui/useMenuPlacement.ts (map-check).

open_risks
  - frontend/src/ui/useDropdownMenu.ts:51-57: on a right-press, WebKitGTK moves focus to a focusable target before
    `contextmenu`. `closeAfterClick` then leaves focus there (PresetPicker case: active became a keymap row). This is
    the same rule as a left click.
  - frontend/src/ui/ServerGroup.vue:35-37: the list's anchor is still taken at click time (round 1's risk, unchanged).
```

Still to run on your side: `just check` (map-check needs `ui/useMenuPlacement.ts` in the project map) and `just mutants` on `ui/useDropdownMenu.ts` and `ui/useMenuPlacement.ts`.