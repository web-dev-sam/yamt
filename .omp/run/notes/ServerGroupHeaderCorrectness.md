```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/useDropdownMenu.ts",
      "line": 94,
      "rule_id": "request-server-pins rule 5",
      "problem": "Rule 5 says a press outside closes the drop-down, but a right-press does not. The outside close goes through vueuse `onClickOutside`, which acts only on the `click` event (`@vueuse/core` 15.0.0 `dist/index.js:266-279`; `pointerdown` only arms it). A secondary button fires `contextmenu`/`auxclick`, not `click` ([INFERENCE] UI Events; WebKit not probed, because the ownership hook blocked my probe). So with the Servers list open, a right-click anywhere in the toolbar (the group button too) opens `ToolbarMenu` (`MergeToolbar.vue` header `@contextmenu.prevent=\"openMenu\"`) on top of the list, which stays open. Both are `fixed z-10` and the later teleport covers the list. Escape then closes only `ToolbarMenu`, whose window capture handler stops it. The pinned buttons' and rows' `ServerMenu` closes on any `pointerdown`, so the header now has two different close rules side by side.",
      "fix": "In `useDropdownMenu`, also close on a window capture `contextmenu` (or a `pointerdown` with `button !== 0`) whose target is outside the menu and the opener, using the same `closeAfterClick` path. Add a WebKit step: open the list, right-click the toolbar, and see only `ToolbarMenu`."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/menuKeys.test.ts",
      "line": 32,
      "rule_id": "review-protocol Grading (test passes with the feature deleted)",
      "problem": "\"rows and pins are one list\" is the existing count-arithmetic test again (it repeats lines 10-19 with `count: 4`), and `stepMenuItem` never sees roles. It still passes if `MENU_ITEMS` loses `[role=menuitemcheckbox]`, which is exactly the bug that would make every pin unreachable by keyboard. The test's name claims a rule it does not hold. If it stays, a later reader trusts a node test for pin reachability, while the only evidence is WebKit step 8.",
      "fix": "Delete the test. In `menuKeys.ts`, name WebKit step 8 as the evidence for `MENU_ITEMS`: no DOM environment exists in the node project, so no test there can hold the selector."
    },
    {
      "severity": "nit",
      "file": "frontend/src/ipc/fixtureServers.test.ts",
      "line": 69,
      "rule_id": null,
      "problem": "The name says \"the eslint rule finds its package\", but the test asserts `devDependencies.eslint`. The eslint rule never reads that field: it reads config existence and `nearestPackage` existence only (`lsp/internal/detect.ts:156-157`). Nothing gets harder as the app grows; only the name misleads.",
      "fix": "Assert what the rule reads (`eslint.config.js` and `node_modules/eslint/package.json` answer `Text`) and name the test for that, or drop the `devDependencies` assertion."
    }
  ],
  "checked": [
    "groupDot (serverText.ts:118-122) matches the brief: first of problem>warning>busy>running, else stopped. serverText.test.ts checks all 15 pairs in both orders, the empty list, and running beside stopped, so a swapped urgency or an all-running rule fails.",
    "serverButtons.ts maps views in view order, with `pinned` by `ServerKey`. serverButtons.test.ts 'pinned when its key is pinned, never by its shown name' passes the name 'TypeScript' in the set and expects false, which catches a name-vs-key bug. A pin whose server is not a view yields no button, because the map runs over views only.",
    "Pinned buttons in view order, not pin order: in the real-app evidence ruff was pinned after oxlint yet shows as 'ruff ; oxlint', matching the list order (ServerStatus.vue `pinned` = filter over `buttons`).",
    "Header rendered only while views exist: ServerStatus.vue `v-if=\"buttons.length > 0\"` wraps ServerGroup too, and the list is a v-if inside ServerGroup, so all servers off unmounts the teleported list.",
    "Drop-down structure (ServerGroup.vue template): `ul role=menu` labelled 'Language servers', `li role=none`, menuitem with `aria-haspopup`, title = state line, menuitemcheckbox pin with `aria-checked`, pinLabel/pinTitle, max-h-[60vh] overflow-y-auto, menuPosition at the button's bottom-left.",
    "DOM order of MENU_ITEMS gives row1, pin1, row2… for `stepMenuItem` (useDropdownMenu.ts:69). Observed in WebKit step 8 of the report.",
    "Pin with the list open: the `li` is keyed by `button.key`, so the focused pin node survives `togglePin`. The click is inside the list, so `onClickOutside` does not fire and the list stays open (WebKit step 3/8).",
    "Row choice: `chooseRow` awaits `close()` (focus to the group button after nextTick) before setting `rowMenu`. ServerMenu mounts later and focuses its first item, so the order is right.",
    "A second group click while a row's menu is open: ServerMenu `pressedElsewhere` counts its opener (the group button) as inside, so `pointerdown` does not close it, and `groupClicked` then only nulls `rowMenu`. `aria-expanded` = list or rowMenu.",
    "Escape/Tab in every ServerMenu: `props.opener.focus()` before `emit('close')` (ServerMenu.vue keyPressed). The opener is the group button for rows and `event.currentTarget` for pins.",
    "Accepted open risk, a pinned server unpinned while its menu is open: unpinning needs the list, and pressing the group button closes the pinned ServerMenu on `pointerdown`. There is no keyboard path from ServerMenu to the list, so this cannot be reached.",
    "Accepted open risk, list anchor taken at click time: ServerStatus is `ml-auto` before the gear in all three headers (MergeToolbar.vue:207, MergeView.vue:202, ChoiceView.vue:75) and ServerGroup is its last laid-out child (both ServerMenus are teleported). Pins added on the left therefore do not move the group button; the report's 'moves left' does not happen there.",
    "Accepted open risk, `useWindowFocus` starting from `document.hasFocus()`: the real-app focus-away was observed closing the list. Inactive MergeViews' ServerGroups close nothing (openFor null).",
    "Blur close for PresetPicker/KeymapList: the same `close()` that refocuses the opener; a ServerMenu row menu closes through its own existing blur watch.",
    "The Settings view and the gear: a left click outside the list closes it through `closeAfterClick`, and Show log closes ServerMenu before the `serverLog` screen.",
    "Fixture host only with `?servers`: main.ts `serverHost()` returns the Tauri host in the app, otherwise a fixture host iff `URLSearchParams.has('servers')`, else null (unchanged path). `serverSetup.startUp` skips setup on null.",
    "fixtureServers `foldersUp('web/app')` = ['web/app','web',''], and the test 'web/app' found at the root `.bin` catches a walk limited to the project. NotFound `searched` is in walk order. `projectFile` prefix `${path}/` makes 'node_modules/typ' Missing (tested). The context root equals the fixtureSettings REPOSITORY, so the answers and pins key on one root.",
    "Survivors, fixtureServers.ts (#732, module-level): TREE={}, typescript name/version, package.json {} and devDependencies {}, and ONLY_IN_THE_APP='' would be killed by the existing tests if re-evaluated (findProgram Found, typescript toEqual, eslint toHaveProperty, ONLY_IN_THE_APP toBe).",
    "Survivors, fixtureServers.ts, equivalent (VF7 a): name/private, devDependencies versions, the eslint/vue package.json contents, tsconfig contents, eslint.config.js text, and `.bin/*` contents. Detection reads only existence for these (detect.ts:156-157 eslint, vue.ts:21 nearestPackage, hasConfig, findProgram `!== undefined`). The only content read is TypeScript's version (detect.ts:101), and the test holds that.",
    "Survivor fixtureSettings.ts REPOSITORY='': the tests compare against the import, so this is equivalent for behaviour; any non-empty root works.",
    "Survivors, serverText.ts GROUP_URGENCY (5): #732. Each mutation fails the pair test if re-evaluated (e.g. 'busy'→'' makes ['busy','running'] give running).",
    "Survivors LANGUAGE_SERVERS/SERVERS='': word constants whose value is the spec, observed in WebKit step 1 ('Language servers' label, 'Servers' text). A node test would only restate the literal, so these are not a gap.",
    "NoCoverage, useDropdownMenu.ts:65/69: pre-existing focus and item logic; the diff only swapped the selector string. Observed in WebKit step 8. There is no DOM environment in the node project (frontend/package.json has no happy-dom/jsdom/test-utils).",
    "NoCoverage, useDropdownMenu.ts:107-110 blur watch: a framework registration with a one-line branch that node cannot exercise (vueuse `defaultWindow` is undefined there). Observed in the real app (q-a focus-away: list closed; focus-back: active 'Language servers'). Dropped per VF7 (c).",
    "Not raised [INFERENCE, unobserved]: on macOS, where WebKit buttons are not mouse-focusable, clicking a pinned button while the list is open would leave focus in the list. `closeAfterClick`→`close()` would then focus the group button after the flush in which the pinned ServerMenu mounted and focused its first item. On WebKitGTK buttons are mouse-focusable, so `closeAfterClick` takes the no-refocus branch. Worth one macOS check.",
    "Risk register: no RK row is owned by these ui/ipc files; architecture §3.1 (merge-core) and CM1–CM9 (editor/) are not touched by this patch.",
    "No targeted test run (the ownership hook refused a scratch WebKit probe). The block rests on the vueuse source read plus the UI Events rule that `click` is primary-button only."
  ]
}
```