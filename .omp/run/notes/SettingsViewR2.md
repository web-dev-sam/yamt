# SettingsViewR2 — implementer report (fields read one by one)

```json
{
  "summary": "I fixed #723, #716 and #715, and every acceptance line passes.\n- #723: when a row's edit menu won't fit below the bottom of the settings column, it now opens above the row; otherwise it opens below as before. The check runs when the menu opens.\n- #716: new keyField tests cover Ctrl+Escape → record Mod-Escape, Ctrl+Enter with a key shown → record Mod-Enter, and Alt+Tab → record Alt-Tab.\n- #715: `FieldKey` and `MenuStep` are no longer exported.",
  "files_changed": [
    "frontend/src/ui/KeymapList.vue",
    "frontend/src/ui/keyField.ts",
    "frontend/src/ui/keyField.test.ts",
    "frontend/src/ui/menuKeys.ts"
  ],
  "tests_added": [
    {
      "name": "keyField.test.ts › Tab and Shift+Tab leave the field; with Ctrl or Alt they are recorded",
      "proves": "Alt+Tab is recorded as Alt-Tab, not treated as leaving the field. This fails if `altKey` is dropped from `modified`."
    },
    {
      "name": "keyField.test.ts › plain Enter confirms the shown key, and is recorded when no key is shown",
      "proves": "Ctrl+Enter with a key shown is recorded as Mod-Enter and does not confirm. This fails with `plain = !event.shiftKey`."
    },
    {
      "name": "keyField.test.ts › plain Escape cancels; with Shift or Ctrl it is recorded",
      "proves": "Ctrl+Escape is recorded as Mod-Escape and does not cancel. This fails with `plain = !event.shiftKey`."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; pnpm -C frontend typecheck; pnpm -C frontend test; just sfc-order; just web-unused (each run once more with exit code printed)",
      "observed": "lint=0 typecheck=0 test=0 sfc=0 unused=0. Tails: `$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"` (no findings); `$ vue-tsc -b` (no output); `Test Files  48 passed (48)` / `Tests  566 passed (566)`; `$ tsx scripts/check-sfc-order.ts` (no output); `$ knip --include exports,types` (no output)"
    },
    {
      "command": "keyField.ts line 21 temporarily changed to `const plain = !event.shiftKey;`, then `pnpm -C frontend exec vitest run --project node src/ui/keyField.test.ts`",
      "observed": "× plain Enter confirms … (expected kind 'record', received 'confirm', line 55); × plain Escape cancels; with Shift or Ctrl it is recorded (expected 'record', received 'cancel', line 67); `Tests  2 failed | 2 passed (4)`. The line was then restored."
    },
    {
      "command": "keyField.ts line 17 temporarily changed to `const modified = event.ctrlKey || event.metaKey;`, same vitest run",
      "observed": "× Tab and Shift+Tab leave the field; with Ctrl or Alt they are recorded (expected 'record', received 'leave', line 38-40); `Tests  1 failed | 3 passed (4)`. The line was then restored, and the file shows `Tests  4 passed (4)`."
    },
    {
      "command": "pnpm -C frontend dev --port 5791 --strictPort + just webdriver 4791 (MiniBrowser, setWindowRect 1600x1000, clicks sent as WebDriver pointer actions). Opened settings with the gear, scrolled the Settings section so Outdent's row bottom = column bottom, clicked Outdent's row",
      "observed": "bottom row: {\"column\":[5,959],\"viewport\":[1600,964],\"row\":[912,959],\"menu\":[810.5,912],\"below\":false,\"items\":[\"Add Keyboard Shortcut visible\",\"Change Shift+Tab… visible\",\"Remove Shift+Tab visible\"],\"focused\":\"Add Keyboard Shortcut\"}. Screenshot /tmp/settings-r2-bottom.png shows the menu opening upward above Outdent's row, every item visible."
    },
    {
      "command": "same session: scrollTop = 0, clicked the Apply row (top)",
      "observed": "top row: {\"row\":[214.5,261.5],\"menu\":[261.5,418],\"below\":true,\"items\":[\"Add Keyboard Shortcut visible\",\"Change Enter… visible\",\"Remove Enter visible\",\"Change Space… visible\",\"Remove Space visible\"]}. Screenshot /tmp/settings-r2-top.png shows the menu below the Apply row."
    }
  ],
  "deviations_from_brief": [
    "Decided by me: 'the settings column's visible area' is the bottom edge of the menu's nearest ancestor that clips its content (overflow-y not visible), which is the Settings section, or `window.innerHeight` if there is none. Matching on the overflow style means KeymapList doesn't depend on a selector from SettingsView.vue, which this slice doesn't own.",
    "Decided by me: the menu's first item gets focus only after the upward placement has rendered (one extra `nextTick`). Otherwise focusing an item still placed below would make the column scroll it into view before the menu moves up.",
    "Decided by me: the menu opens above whenever it doesn't fit below, even if it also doesn't fit above. This follows the brief's wording; I didn't compare the space above and below.",
    "WebKit run: the column was scrolled by setting `scrollTop` from a script, not with a real wheel. Clicks on the gear and the rows were real WebDriver pointer actions. The screenshots are in /tmp, outside the repo, and the throwaway driver script was deleted."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/KeymapList.vue:97",
      "risk": "The menu's position is measured only when it opens. If the column is scrolled or resized while the menu is open, the menu stays on the side chosen at opening, which matches the brief's 'measure on open'. If the column is shorter than row + menu, the menu opens above and can be clipped at the top."
    }
  ]
}
```
