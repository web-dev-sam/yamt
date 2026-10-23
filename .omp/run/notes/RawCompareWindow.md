# RawCompareWindow (3.C-window, board Raw compare row 11)

The compare window is built and shows on screen: `yamt --raw` and `?raw` now mount a second root with the tab panel, the two-column view, its toolbar and the language drop-down. All the layer recipes pass. One acceptance step is not covered: the window-close path (flush the unsent columns, then exit) never ran, because I couldn't trigger a real close in the private display. Select-all on rename also misses in one case (details under open_risks).

**summary**
- `main.ts` has two root functions. `data-window="compare"` (app) or `?raw` (fixture) mounts the compare window, which never builds `LanguageServers` or the merge store. Otherwise the merge start runs as before.
- New components: `CompareApp.vue`, `TabList.vue`, `CompareView.vue` and `LanguagePicker.vue`.
- `useCompareController.ts` is the compare window's only way into `editor/`. It handles the settle → save → show order, Format failures → `reportFormat`, `track`/untrack, preferences and language, and undo/redo from anywhere in the shown tab.
- Fence PM7 in `fences.ts`: compare files never import `store.ts`, `App.vue` or `lsp/`.
- `compareColumns()` in `paneSplit.ts` gives the two-column grid with the merge window's 2.5rem strip.
- app-session: `start-app --raw` starts the app with `--raw` and no `--repo`; `start-fixture --raw` opens `?raw`, and `--raw-case <case>` opens `?raw=<case>`.

**files_changed**
- `frontend/src/main.ts`
- `frontend/src/ui/CompareApp.vue` (new)
- `frontend/src/ui/TabList.vue` (new)
- `frontend/src/ui/CompareView.vue` (new)
- `frontend/src/ui/LanguagePicker.vue` (new)
- `frontend/src/ui/useCompareController.ts` (new)
- `frontend/src/ui/useCompareController.test.ts` (new)
- `frontend/src/ui/paneSplit.ts`, `frontend/src/ui/paneSplit.test.ts`
- `frontend/src/ui/AGENTS.md`
- `frontend/scripts/fences.ts`, `frontend/scripts/fences.test.ts`
- `frontend/scripts/app-session/args.ts`, `args.test.ts`, `start.ts`, `fixture.ts`
- `frontend/src/ipc/index.ts` (with your permission)

**tests_added**
- `fences.test.ts`, "a compare file importing the merge store, App.vue or lsp/ violates PM7": the failing path for `./store`, `./App.vue`, `./store.ts`, `../lsp` and `../lsp/index.ts`.
- `fences.test.ts`, "merge files importing the store and compare files importing their own neighbours violate nothing": the passing side of the same rule.
- `useCompareController.test.ts`, three tests:
  - one failed column becomes one notice entry with its line; formatted and unchanged columns give none.
  - both columns failing give left then right; none failing gives an empty list (this clears the tab's old Format notices).
  - each settled column is saved, and a reply is shown only after its save answers; a dropped (null) reply shows nothing.
- `paneSplit.test.ts`: `compareColumns()` is `minmax(0, 1fr) 2.5rem minmax(0, 1fr)`.
- `args.test.ts`: `--raw` with `--repo` or `--fresh-repo` is refused; `start-app --raw` opens no repository; `start-fixture` gives `""`, `?raw` or `?raw=json-payload`.

**smoke_evidence**
- **Recipes:** `pnpm -C frontend typecheck` passes (`vue-tsc -b`, no errors). `test` → `Test Files 146 passed (146)`, `Tests 1913 passed (1913)`. `lint`, `unused` (knip) and `fmt:check` ("All matched files use the correct format.") are clean, and so is `just sfc-order`.
- **WebKit, compare page** (`just app-session start-fixture --name cmpw --raw-case json-payload`, MiniBrowser):
  - Page: `href …/?raw=json-payload`, tabs `["Compare 1 Auto · JSON"]`, `bands: 4`, word marks `[2,2]`, changed-line marks `[4,4]`.
  - Removal bars: the json-payload fixture has none in its data, so I checked other cases. `?raw=typescript` → `removals:[2,0], bands:2`; `?raw=words` → `removals:[0,1], bands:5`. Between them, both columns show bars.
  - "+": `[["Compare 1","false"],["Compare 2 Auto · Plain text","true"]]`.
  - Switching tabs: Compare 2's right scroller stayed at `scrollTop` 300 and its texts were unchanged after going to Compare 1 and back.
  - Rename: Enter → `Payload`; Escape after typing "Other" → still `Payload`; empty + Enter → still `Payload`; blur keeps the draft.
  - Close: an empty Compare 3 closed with `dialog:null`. Compare 2 with text asked "Close Compare 2? Its text is lost."; No kept it, Yes closed it.
  - Ctrl+B: the panel's display went `"none"` then back to `"flex"`.
  - Language: the button read "Auto · JSON"; picking TypeScript gave the label "TypeScript" and both columns re-highlighted. Arrow keys move through the menu; Escape returns focus to the button.
  - Format on `{"a":1,…}` against `{ "a": 1, … }` gave two identical formatted texts. Invalid left → notice "Compare 2, left: not valid JSON (line 1): Expected a string key".
  - The gear opens a settings view with only Theme, Antialiasing, Keymap and Settings file.
  - Screenshots in `/tmp/yamt-compare-window/`:
    - dark: `json-dark.png`, `notice-dark.png`, `close-question-dark.png`, `panel-hidden-dark.png`, `language-menu-dark.png`, `typescript-dark.png`, `settings-dark.png`, `words-dark.png`, `typescript-fixture-dark.png`
    - light: `settings-light.png`, `words-light.png`
- **Real app** (`cargo tauri build --debug --no-bundle`, then `just app-session start-app --name rawapp --raw --home /tmp/yamt-raw-home`):
  - Start: `window:"compare"`, one tab "Compare 1".
  - Typing into both columns gave `bands:2, lines:[2,2], words:[1,1]` after the pause.
  - Format on two JSON layouts → the shown view has 0 bands. Invalid right column → "Compare 2, right: not valid JSON (line 2): Expected a string key", and the left column was formatted.
  - Restart: after renaming tab 2 to "Payload", picking TypeScript in tab 1 and showing Payload, I stopped and restarted with the same home. Tabs came back as `[["Compare 1 TypeScript","false"],["Payload Auto · JSON","true"]]`, texts included (`tabs.json` shows the picked language and `shown: 2`).
  - `kill -9`, one second after typing "killed after a second": after a restart the right column ends in that line.
  - Second instance → `yamt: another yamt --raw window is open (/tmp/yamt-raw-home/.local/share/yamt/compare)`, `exit 2`.
- **Merge window** (`start-app --fresh-repo`): `window:"merge"`, 7 files, a file opens with 3 editors, and the settings headings include "Language servers".
- **Not exercised:** the window-close path. Tauri's `plugin:window|close` is refused by permissions ("core:window:allow-close"), `xdotool windowquit` didn't close the window, and `kwin_x11` wouldn't run on Xvfb. The texts in the restart and kill tests were saved by the 300 ms settle, not by the close flush.

**deviations_from_brief**
- `frontend/src/ipc/index.ts`: removed the unused re-exports `ColumnWrite`, `CompareStart`, `LeftLine` and `RightLine` so `pnpm unused` passes. You added the file to Owned for this.
- app-session: `start-app` now has `opens: dir | fresh | raw` instead of `repo`. A raw session records `repoDir: ""`, since `state.ts` isn't mine. `start-fixture` gets `--raw` and `--raw-case <case>` (the case value implies `--raw`); this was needed to stay under the 300-line cap in `args.ts`.
- `CompareView` also wires the controller's `historyKey` (Undo/Redo from anywhere while the tab is shown and no question is open), copying how `MergeView` does it.
- Four new components (VU15 reasons): `CompareApp` is the second root, `TabList` the tab panel, `CompareView` the two-column view, `LanguagePicker` the drop-down.
- Wording I chose: the Format hover is "Format covers JSON and XML only" when disabled and "Format both columns as <language>" when enabled. The arrows reuse the merge toolbar's "Previous change"/"Next change". The tab panel's handle is labelled "Tab list width". The tab's × is labelled "Close <name>", with "Close tab" as its hover text.
- The rename field takes focus through a function ref, not `useTemplateRef`, because it sits inside `v-for`.

**open_risks**
- `TabList.vue:61-66`: double-clicking the name of a tab that isn't shown yet switches tabs, and in WebKitGTK the caret then lands at the end instead of selecting the whole name. A trace showed no script writing the selection; the collapse comes about 30 ms later, during the render that reveals the tab's view. On the shown tab the name is selected. Enter, Escape, empty and blur all behave correctly either way.
- `CompareApp.vue:62-67`: the close path (`flushAll`, then return true) wasn't driven in the app (see above).
- `TabList.vue`: a tab never opened in this run shows "Auto · Plain text" for an Auto language, because nothing has detected it yet; it updates once the tab is shown.
- The json-payload fixture has no removal bars, so "removal bars in both columns" was shown with the typescript and words fixtures instead.
- Main's final run should do `just check` (including `map-check`; the map doesn't name the new files yet, and docs are out of my slice) and `just mutants`.