# SettingsView — web-impl report (verbatim JSON)

```json
{
  "summary": "The settings view now has its content: Theme (Dark/Light buttons that show which one is pressed), Keymap and Settings file (a path field with Use and Default, where Escape puts back the path in use). New KeymapList.vue shows the 14 actions in their groups, with key labels or None, and marks changed actions in the primary colour. Each row opens WebStorm's Keymap edit menu, built by keyText.keymapMenu. New KeyRecorder.vue is WebStorm's Keyboard Shortcut dialog: it records keys, has a + menu, shows a live \"Already used by:\" line and has OK/Cancel. MergeToolbar hides Undo/Redo through HISTORY_BUTTONS_SHOWN = false and keeps their code. Leftovers #696, #697, #700 and #701 are fixed.",
  "files_changed": [
    "frontend/src/ui/SettingsView.vue",
    "frontend/src/ui/KeymapList.vue",
    "frontend/src/ui/KeyRecorder.vue",
    "frontend/src/ui/MergeToolbar.vue",
    "frontend/src/ui/keyText.ts",
    "frontend/src/ui/keyText.test.ts",
    "frontend/src/ui/settings.ts",
    "frontend/src/ui/store.test.ts",
    "frontend/src/editor/internal/pane.ts",
    "frontend/src/editor/internal/sideKeys.ts",
    "frontend/src/editor/internal/sideKeys.test.ts"
  ],
  "tests_added": [
    {
      "name": "keyText.test.ts › the edit menu changes and removes each key by its label; default keys offer no reset",
      "proves": "Each key gets a 'Change <label>…' / 'Remove <label>' pair carrying that key (Linux and macOS labels). Add comes first, then a separator. Default keys get no Reset."
    },
    {
      "name": "keyText.test.ts › Remove All shows past two keys, and Reset Shortcuts follows it without a separator",
      "proves": "The separator rules of KeymapPanel.createEditActionGroup: Remove All only when there are more than 2 keys, and Reset gets its own separator only when Remove All is not shown."
    },
    {
      "name": "keyText.test.ts › an action left without keys offers Add and Reset with one separator between",
      "proves": "Doubled and trailing separators are dropped, and the commands are add then reset."
    },
    {
      "name": "keyText.test.ts › the + menu sets Enter, Escape, Tab and Shift+Tab, labelled for the platform",
      "proves": "setKeyMenu gives the four ShortcutTextField keys with 'Set <label>' on Linux and macOS."
    },
    {
      "name": "keyText.test.ts › the conflict line names every action already using the key",
      "proves": "usedByText builds 'Already used by: Find' and joins several owners."
    },
    {
      "name": "store.test.ts › a move to a file with the same broken keys names the new path in the Keys problem",
      "proves": "#700: key problems count as changed when the path changes, so the Keys problem names the new file. Without the fix it would keep the old path."
    },
    {
      "name": "sideKeys.test.ts › a side key is always consumed: it runs the pane's runner, and a pane without one does nothing with it",
      "proves": "#701: runSideKey always returns true (which matches preventDefault: true) and calls the pane's runner. A state with no runner uses the facet's do-nothing default."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint && pnpm -C frontend typecheck && pnpm -C frontend test && just sfc-order && just web-unused && echo ALL-OK",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"\n$ vue-tsc -b\n$ vitest run --project node\n Test Files  46 passed (46)\n      Tests  557 passed (557)\n$ tsx scripts/check-sfc-order.ts\n$ knip --include exports,types\nALL-OK   (also: pnpm -C frontend fmt:check → \"All matched files use the correct format.\")"
    },
    {
      "command": "WebKit run setup: pnpm -C frontend dev --port 5391 --strictPort; just webdriver 4491 (MiniBrowser --automation, window 1600x1000); real WebDriver pointer/key actions; state read with execute only. Gear → Settings.",
      "observed": "test-screen: test windows go to Samsung (HDMI-A-1). After the gear: focused BUTTON Back. Headings: Theme, Keymap, Side panes, Anywhere in the file, Find, Result pane, Settings file. Screenshots: /tmp/sv-wd/view-dark.png + view-dark-bottom.png (whole view in Dark), view-light-top.png + view-light-bottom.png (whole view in Light), menu-dark.png + menu-light.png (open row menu), dialog-conflict-dark.png + dialog-conflict-light.png (key dialog with the conflict warning), plus-menu-light.png, merge-toolbar-dark.png."
    },
    {
      "command": "Step 1: click Light, then Dark",
      "observed": "after Light: {theme:light, panel:rgb(255,255,255), editor (hidden .cm-editor):rgb(255,255,255), pressed:[Dark=false, Light=true]}; after Dark: {theme:dark, panel:rgb(25,26,28), editor:rgb(25,26,28), pressed:[Dark=true, Light=false]}"
    },
    {
      "command": "Step 2: click Apply row → menu; Down Down; Escape; Down/Up on rows; Enter; click 'Change Enter…'; type a; click OK; Back; toolbar Next change; Enter; a; Ctrl+Z",
      "observed": "menu [Add Keyboard Shortcut, ---, Change Enter…, Remove Enter, Change Space…, Remove Space], focus on Add Keyboard Shortcut; Down Down → Remove Enter; Escape → menu null, focus BUTTON apply; Down → ignore, Up → apply; Enter reopens the menu; dialog {title 'Keyboard Shortcut', field 'Enter', okDisabled false}, focus INPUT; after a: field 'A'; after OK: dialog null, focus BUTTON apply; apply row keys [A, Space], name class 'text-primary' rgb(56,113,225). Merge: 'pane 0 with focused change'; Enter: 3 changes · 1 conflict → 3 changes · 1 conflict (not applied); a: → 2 changes · 1 conflict (applied); Ctrl+Z: → 3 changes · 1 conflict"
    },
    {
      "command": "Step 3: Undo row → Add Keyboard Shortcut → Ctrl+Z in field → Ctrl+F → OK → Move; Back; Ctrl+F",
      "observed": "dialog opened field '' okDisabled true; Ctrl+Z → field 'Ctrl+Z', no warning (Undo's own key); Ctrl+F → field 'Ctrl+F', status 'Already used by: Find'; question 'Key Already in Use — Ctrl+F is already used by Find. Move it to Undo? Move Cancel'; after Move find keys [] none:true, undo keys [Ctrl+Z, Ctrl+F], focus BUTTON undo; merge status after settings unchanged (2 changes · 1 conflict, so Ctrl+Z in the field undid nothing); Ctrl+F right after Back: 2 changes → 3 changes · 1 conflict, find bars 0 (Ctrl+F undoes)"
    },
    {
      "command": "Step 4: same as step 3 with Cancel in the question",
      "observed": "after Cancel find keys [Ctrl+F], undo keys [Ctrl+Z], neither marked (class 'block'), focus BUTTON undo; merge status unchanged"
    },
    {
      "command": "Step 5: Light; Redo row → Add; Shift alone, Ctrl alone; Ctrl+F; click +; Set Escape; Escape; then Add → Enter (empty) → Enter → question → Cancel; Change Ctrl+Y… → Tab → Escape",
      "observed": "opened: field '' okDisabled true; Shift alone, Ctrl alone: field '' okDisabled true; Ctrl+F: 'Already used by: Find'; + menu [Set Enter, Set Escape, Set Tab, Set Shift+Tab], focus on Set Enter; Set Escape: field 'Escape', 'Already used by: Close find', focus back on INPUT; Escape in field: dialog null, redo row unchanged [Ctrl+Shift+Z, Ctrl+Y], focus BUTTON redo; Enter in empty field records 'Enter' ('Already used by: Apply'); Enter with a key shown → confirms → clash question 'Enter is already used by Apply. Move it to Redo?'; Cancel → redo and apply unchanged; Change prefilled field 'Ctrl+Y'; Tab → focus on the + button; Escape there → dialog null, focus BUTTON redo; Escape in the + menu closes only the menu (dialog keeps 'Ctrl+F', focus…
    },
    {
      "command": "Step 6: Reset Shortcuts on Apply, Undo (and Find)",
      "observed": "apply menu ends '---, Reset Shortcuts'; apply row [Enter, Space], class 'block' (not marked); undo menu [Add, ---, Change Ctrl+Z…, Remove Ctrl+Z, Change Ctrl+F…, Remove Ctrl+F, ---, Reset Shortcuts] → undo row [Ctrl+Z] not marked; find menu [Add Keyboard Shortcut, ---, Reset Shortcuts] → [Ctrl+F]"
    },
    {
      "command": "Step 7: Ignore row → Remove All; Back; Next change arrow; Delete; Backspace; x",
      "observed": "ignore menu ends '---, Remove All' (3 keys, not changed → no Reset); ignore row keys [] none:true, marked text-primary; merge 'pane 0 with focused change' 2 changes · 1 conflict; Delete → 2 changes · 1 conflict (no ignore); Backspace, x → 2 changes · 1 conflict; then Reset → [Backspace, Delete, X]"
    },
    {
      "command": "Step 8: settings file field",
      "observed": "start {field:'/fixture/settings.json', defaultDisabled:true}; typed 'relative/settings.json' + Enter → field stays 'relative/settings.json', problem bar 'Could not use the settings file: relative/settings.json is not an absolute path; start it with / or ~/.'; Escape → field '/fixture/settings.json'; '/fixture/other.json' + click Use → field '/fixture/other.json', defaultDisabled false, problem null; click Default → field '/fixture/settings.json', defaultDisabled true"
    },
    {
      "command": "Step 9: shown file's toolbar buttons; Ctrl+Z",
      "observed": "Mark resolved | Previous change | Next change | Apply non-conflicting changes from the left | Apply non-conflicting changes from the right | Settings (no Undo/Redo; screenshot merge-toolbar-dark.png); Ctrl+Z after an apply: 2 changes · 1 conflict → 3 changes · 1 conflict"
    },
    {
      "command": "Menu: click outside, row clicked again, Tab",
      "observed": "click outside (beside the 'Theme' heading): menu null, focus BUTTON find; clicking the row twice: menu null, focus BUTTON find; Tab in the menu: menu null, focus BUTTON find"
    }
  ],
  "deviations_from_brief": [
    "New files, for the project map (`map-check` will fail until they are listed; the map is not owned): `frontend/src/ui/KeymapList.vue` (VU15: \"14 rows with a menu each; the view stays a layout\") and `frontend/src/ui/KeyRecorder.vue` (VU15: \"WebStorm's Keyboard Shortcut dialog\"). Suggested map/architecture text for ui/: \"SettingsView (Theme, Keymap, Settings file) + KeymapList (rows, WebStorm's Keymap edit menu) + KeyRecorder (Keyboard Shortcut dialog)\"; keyText.ts gains \"menu entries (keymapMenu), + menu (setKeyMenu), conflict line (usedByText)\".",
    "The issue references in comments are written as 'board item 662' (MergeToolbar) and 'board item 690' (pane.ts), not '#662'/'#690'. scripts/palette.test.ts flags `#662)` and `#690)` as hex colour literals.",
    "#701: added and exported `runSideKey(state, command)` in sideKeys.ts as the test seam, the same pattern as the exported `refuseNativeHistory`. The facet's default is now a do-nothing runner, and the binding always returns true.",
    "#696: the comment cites only the checked @codemirror/commands lines (dist/index.js:267-271 = history()'s beforeinput handler) and names the path the guard is for: the browser's own Undo/Redo command, macOS Edit ▸ Undo or Cmd+Z in WKWebView.",
    "Decided: 'Add Keyboard Shortcut' opens the dialog empty. WebStorm's ShortcutDialog.showAndGet fills it with the action's first key, but the brief contrasts Change ('prefilled with that key') and needs an empty field with OK disabled (step 5).",
    "Decided: the edit menu drops doubled and trailing separators, e.g. an action with no keys shows Add, ---, Reset. I could not check IntelliJ's popup code (only keymap/impl/ui is under /tmp/ij-diff), so this is not cited as WebStorm behaviour.",
    "Decided: per key, the menu lists 'Change <label>…' then 'Remove <label>' as a pair.",
    "Decided: Tab in an open menu closes it and returns focus to the row (or to the field for the + menu). Up/Down wrap inside menus but stop at the first and last row in the list.",
    "Decided: plain Tab/Shift+Tab leave the field. Ctrl/Alt/Meta+Tab are recorded.",
    "Colours and Tailwind values: a changed action's name is `text-primary` (#3871e1 in both themes). Theme buttons: pressed = `aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-on-primary`, the other bordered `border-control-border hover:bg-hover`. Rows: `hover:bg-row-hover`, open row `aria-expanded:bg-row-selected`. Key labels: `<kbd>` with `rounded border border-control-border bg-panel-inline px-1.5 font-sans`; None and the place line are `text-fg-muted`. Menus: `rounded border border-control-border bg-panel py-1`, items `hover:bg-hover focus:bg-row-selected`, separators `border-t border-control-border`, `min-w-56`, below the row at `top-full left-2`. Dialog: `w-[22rem] overflow-visible rounded-lg border border-control-border bg-panel`…
    "The dialog needed `overflow-visible`: WebKit's modal `<dialog>` clips (overflow: auto), and the WebKit run first showed the + menu cut off.",
    "Fixed words that never change ('Theme', 'Keymap', 'Settings file', 'None', 'Keyboard Shortcut', 'OK', 'Cancel', 'Use', 'Default', the muted file line) are in the templates, as MergeToolbar/QuestionDialog do. keyText.ts holds only the words built from data: menu labels, '+' menu labels, the conflict line.",
    "frontend/node_modules was installed in the isolated worktree (`pnpm install --offline --frozen-lockfile`) so the recipes could run; it is gitignored.",
    "While working I changed one class in KeymapList.vue with `sed -i` instead of the edit tool (separator border-separator → border-control-border). The result is checked by fmt:check and lint."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/SettingsView.vue (restorePath on Escape)",
      "risk": "WebKitGTK: right after Escape puts the path back (a value set by the program), the first Ctrl+A in the field selects nothing; a later Ctrl+A works. A plain `input.value =` from execute shows the same thing, so it looks like a WebKit quirk rather than this code. I did not work around it."
    },
    {
      "location": "frontend/src/ui/KeymapList.vue:recorded",
      "risk": "Focus after the clash question: QuestionDialog is removed with v-if and gives no focus back, so KeymapList puts focus on the row again only when document.activeElement is body. This was seen to work in WebKit (focus BUTTON undo after Move/Cancel); other engines may differ."
    },
    {
      "location": "WebKit run, step 3 first attempt",
      "risk": "In one earlier pass, an 'a' and a Ctrl+F right after a find bar had been opened and closed (Escape) applied and undid nothing, and a later Ctrl+Z did undo. I could not reproduce it in two later runs (s4b, s7), where every step behaved. It is probably the focus left by the find bar; editor/ is not part of this slice."
    },
    {
      "location": "frontend/src/ui/keyText.ts:keymapMenu",
      "risk": "keyText.ts now imports isDefault from keymapEdit.ts (ui → ui). The brief called keyText 'words only'; the menu needs to know whether the keys are the defaults to decide on Reset."
    }
  ]
}

[Some lines truncated to 768 chars]
```
