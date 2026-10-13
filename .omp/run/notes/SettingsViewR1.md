# SettingsViewR1 — web-impl report (verbatim JSON)

```json
{
  "summary": "All ten rework findings are fixed. \"Add Keyboard Shortcut\" now opens with the action's first key filled in, as WebStorm does, and opens empty when the action has none. `keymapEdit.ts` now exports one `keyOwners`, used by both the clash question and the dialog's live warning. Both menus now handle their keys through one pure `stepMenuItem` with one step table, in new `ui/menuKeys.ts`. The dialog field's key handling is now a pure `fieldKey` in new `ui/keyField.ts`, and both new modules have node tests. A click outside a row menu now leaves focus where the click put it. The comment, `SET_KEYS`, separator, `moveToDefault` and `SetKeyEntry` nits are also done.",
  "files_changed": [
    "frontend/src/ui/KeymapList.vue",
    "frontend/src/ui/KeyRecorder.vue",
    "frontend/src/ui/SettingsView.vue",
    "frontend/src/ui/MergeToolbar.vue",
    "frontend/src/ui/keyText.ts",
    "frontend/src/ui/keymapEdit.ts",
    "frontend/src/ui/keymapEdit.test.ts",
    "frontend/src/ui/menuKeys.ts (new)",
    "frontend/src/ui/menuKeys.test.ts (new)",
    "frontend/src/ui/keyField.ts (new)",
    "frontend/src/ui/keyField.test.ts (new)",
    "frontend/src/editor/internal/pane.ts"
  ],
  "tests_added": [
    {
      "name": "keymapEdit.test.ts › a key's owners are every other action holding it, never the action itself",
      "proves": "#703: `keyOwners` lists every other action that holds the key, in `KEY_ACTIONS` order, and never the action itself. The clash question and the dialog warning share this rule."
    },
    {
      "name": "menuKeys.test.ts › Escape and Tab close a menu",
      "proves": "#704: Escape and Tab (Shift+Tab has key Tab too) both close a menu."
    },
    {
      "name": "menuKeys.test.ts › Down and Up move to the next and previous item",
      "proves": "#704: one step table drives Up and Down."
    },
    {
      "name": "menuKeys.test.ts › Down on the last item wraps to the first, Up on the first to the last",
      "proves": "#704: Up and Down wrap around."
    },
    {
      "name": "menuKeys.test.ts › other keys, and arrows in an empty menu, are left alone",
      "proves": "#704: other keys and an empty menu give no decision."
    },
    {
      "name": "keyField.test.ts › Tab and Shift+Tab leave the field; with Ctrl they are recorded",
      "proves": "#711: Shift+Tab leaves the field instead of being recorded; Ctrl+Tab is recorded as Mod-Tab."
    },
    {
      "name": "keyField.test.ts › plain Enter confirms the shown key, and is recorded when no key is shown",
      "proves": "#711: Enter never confirms an empty field; Shift+Enter is recorded."
    },
    {
      "name": "keyField.test.ts › plain Escape cancels; with Shift it is recorded",
      "proves": "#711: Escape with Shift does not cancel."
    },
    {
      "name": "keyField.test.ts › a key with its modifiers replaces the shown one; a modifier alone changes nothing",
      "proves": "#711: record versus ignore."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; pnpm -C frontend typecheck (each then run again with `echo $?`)",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"\n$ vue-tsc -b\nlint=0\ntypecheck=0"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": " Test Files  48 passed (48)\n      Tests  566 passed (566)\ntest=0"
    },
    {
      "command": "just sfc-order; just web-unused; just map-check",
      "observed": "$ tsx scripts/check-sfc-order.ts\n$ knip --include exports,types\nscripts/map-check.sh\nmap-check: ok\nsfc=0 unused=0 map=0"
    },
    {
      "command": "pnpm -C frontend exec oxfmt --check src/ui src/editor/internal/pane.ts",
      "observed": "All matched files use the correct format."
    },
    {
      "command": "Fixes reverted at the same time with the edit tool, then `vitest run --project node src/ui/keymapEdit.test.ts src/ui/keyField.test.ts src/ui/menuKeys.test.ts`, then restored (files back at their original snapshot tags). Reverts: keyOwners without `other !== action`; keyField Tab check `&& !event.shiftKey`, Escape check `!modified` instead of `plain`, Enter confirming without `shown !== null`; menuKeys without Tab close and without the modulo wrap",
      "observed": "× Escape and Tab close a menu\n× Down on the last item wraps to the first, Up on the first to the last\n× Tab and Shift+Tab leave the field; with Ctrl they are recorded\n× plain Enter confirms the shown key, and is recorded when no key is shown\n× plain Escape cancels; with Shift it is recorded\n× a key's owners are every other action holding it, never the action itself\n(× also: changing to a key the action already has … , an existing test)\nTests  7 failed | 15 passed (22)"
    },
    {
      "command": "WebKit fixture run, as in round 1: `pnpm -C frontend dev --port 5392 --strictPort`; `just webdriver 4492` (MiniBrowser --automation, 1600x1000, test-screen placed it on Samsung HDMI-A-1); real WebDriver pointer/key actions, state read with execute only; script /tmp/svr1-wd/run.mjs (round-1 helpers wd.mjs/h.mjs copied)",
      "observed": "settings open, focused: BUTTON Back\napply menu: [\"Add Keyboard Shortcut\",\"---\",\"Change Enter…\",\"Remove Enter\",\"Change Space…\",\"Remove Space\"] focused: BUTTON Add Keyboard Shortcut\nrow menu Up from first: BUTTON Remove Space\nrow menu Down from last: BUTTON Add Keyboard Shortcut\nrow menu Down: BUTTON Change Enter…\nrow menu Escape: menus 0 focused: BUTTON apply\nEnter on row: menus 1 focused: BUTTON Add Keyboard Shortcut\nrow menu Tab: menus 0 focused: BUTTON apply\nAdd on Apply dialog: {\"title\":\"Keyboard Shortcut\",\"field\":\"Enter\",\"status\":\"\",\"okDisabled\":false,...} focused: INPUT Keyboard shortcut\n+ menu open, focused: BUTTON Set Enter\n+ menu Up from first: BUTTON Set Shift+Tab\n+ menu Down from last: BUTTON …
    }
  ],
  "deviations_from_brief": [
    "WebKit check \"Remove All on Find\": Find has one default key, and WebStorm's menu shows Remove All only past two keys (kept from round 1). I used Find's only Remove (\"Remove Ctrl+F\") to empty the action, then checked Add as the brief asks.",
    "#704: the one step table is `ARROW_STEPS`, exported from `menuKeys.ts`. KeymapList's row-to-row `stepRow` (no wrap) uses it too, so `ROW_STEPS` and `MENU_STEPS` are both gone. `stepMenuItem` takes `{ count, focused }` (item count and focused index) plus the event, and returns `close | focus{index} | ignore`. Each caller keeps its own DOM side effects; KeyRecorder still stops propagation so Escape does not cancel the dialog.",
    "#711: `fieldKey(event, shown, platform)` returns `leave | cancel | confirm{key} | record{key} | ignore`. The ShortcutTextField comment moved from KeyRecorder.vue to keyField.ts with the rule it describes. KeyRecorder's Enter path now emits `decision.key` directly; the OK button still goes through `confirm()`.",
    "#702: the `Recording` type in KeymapList gained `initial` (Add: the action's first key or null; Change: the key being changed). KeyRecorder's `initial` prop is unchanged.",
    "#710: a new `closeMenuAfterClick` sits next to `closeMenu`. It refocuses the row only when `document.activeElement` is body or inside the menu; otherwise it only closes the menu.",
    "#706: `SET_KEYS` uses `.map` and throws `set key <text> does not parse`, the same form as `defaultKeys` in ipc/keys.ts.",
    "New files: frontend/src/ui/menuKeys.ts, menuKeys.test.ts, keyField.ts, keyField.test.ts. `just map-check` passed without them being named in the project map; the orchestrator may still want to add them to the map's ui/ line."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/KeymapList.vue:75-82 (closeMenuAfterClick)",
      "risk": "The check assumes focus has already moved when the click handler runs. vueuse's onClickOutside reacts to the click, which comes after pointerdown/focus; this was seen in WebKitGTK (field kept focus; empty-space click refocused the row). An engine where clicking a button does not focus it (macOS WebKit) leaves focus on body, so the row is refocused. That is the intended fallback."
    },
    {
      "location": "frontend/src/ui/menuKeys.ts:19",
      "risk": "With no item focused (focused = -1), Up goes to the second-to-last item, as the old handlers did. This cannot happen in practice because opening a menu focuses its first item."
    }
  ]
}

[Some lines truncated to 768 chars]
```
