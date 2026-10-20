```json
{
  "lens": "correctness-reviewer",
  "patch": ".omp/run/patches/ServerGroupHeaderR1.patch (84ec8fa)",
  "verdict": "pass",
  "findings": [],
  "prior_findings": [
    {
      "id": 1292,
      "status": "fixed",
      "evidence": "useDropdownMenu.ts:115-122 adds a window capture `contextmenu` listener for every drop-down (ServerGroup, PresetPicker, KeymapList). In contextMenuElsewhere (:51-57), a target inside `menu()` leaves the drop-down open. Any other target, the opener included, goes through the same closeAfterClick path a left outside click uses."
    },
    {
      "id": 1293,
      "status": "fixed",
      "evidence": "`git show 84ec8fa^:frontend/src/ui/menuKeys.test.ts` had 5 tests; the file now has 4. Only \"rows and pins are one list …\" is gone. Escape/Tab, Down/Up, wrap, and other-keys/empty are still there unchanged."
    }
  ],
  "mutants": {
    "run": "just mutants 00611ee",
    "triage": [
      {
        "where": "useDropdownMenu.ts:54 `openFor.value !== null` → true",
        "drop": "VF7 equivalent. If the drop-down is already closed, closeAfterClick either sets openFor to null, which it already is, or calls close(), which does nothing when `which === null`."
      },
      {
        "where": "useDropdownMenu.ts:53-54 `inside`/`=== true`/`!inside` inversions, or the listener removed",
        "drop": "The real-app evidence would catch these. In the app, an xdotool right-click on the toolbar left `expanded \"false\"` with only ToolbarMenu open. On the fixture page, a right-click on a row inside the list left it open. In the app, a right-click on PresetPicker gave `menu:false`. Each mutant flips one of these outcomes."
      },
      {
        "where": "useDropdownMenu.ts:121 `capture: true` → false",
        "drop": "VF7 equivalent today. No `contextmenu` handler in frontend/src stops propagation: MergeToolbar, ServerGroup, ServerMenu and ToolbarMenu only use `.prevent`, and CodeMirror's modClick handler only returns false. So the event still reaches window in the bubble phase. The code as written is correct, and the capture listener runs first anyway."
      },
      {
        "where": "closeAfterClick / close / toggle / menuKey (pre-existing NoCoverage)",
        "drop": "Unchanged from round 1. These are the same rules a left outside click uses, and round 1's WebKit steps 4/5/8 were re-run with the same numbers."
      }
    ],
    "hidden_bug": "none found"
  },
  "checked": [
    "Toolbar right-click with the list open: the window capture listener runs before MergeToolbar's header handler `@contextmenu.prevent=\"openMenu\"` (MergeToolbar.vue:177). It sets openFor to null synchronously, so in the same flush the list is removed and ToolbarMenu mounts. Only ToolbarMenu shows, as acceptance 2 asks.",
    "The keyboard comes back as after any outside close. barPressed (MergeToolbar.vue:158-161) prevents the default action of a secondary mousedown, so focus stays on a list item. closeAfterClick then calls close(), and focus goes back to the opener. ToolbarMenu does not take focus (its buttons are tabindex -1 and it prevents mousedown) and it closes on any keydown, so moving focus back to the opener does not fight it.",
    "Right-click on the group button (opener) closes the list. The implementer's change from \"outside the menu and the opener\" (deviations) is accepted: otherwise the list would stay open under ToolbarMenu, and acceptance 2 asks for it to close.",
    "Right-click inside the teleported list: the target is inside `menu()`, so nothing closes. The list's `@contextmenu.prevent` does not stop propagation, and because the list is teleported the event does not bubble to the header, so ToolbarMenu does not open (fixture evidence: menus [\"Language servers\"]).",
    "KeymapList opens its menu on @click (KeymapList.vue:136) and has no contextmenu handler. So the capture close cannot fight a toggle in the same event, and the reopen-on-right-click race does not exist.",
    "PresetPicker and KeymapList get the close through the shared composable. Right-clicking a focusable target leaves focus on that target, the same as a left click. The implementer's open_risk is accepted as the existing rule.",
    "Placement is unchanged. belowLeft returns `{x: left, y: bottom}` from getBoundingClientRect, the same as the old inline code in ServerGroup.vue and ServerStatus.vue. useMenuPlacement uses the same border-box useElementSize, the same useWindowSize and the same menuPosition call. ServerMenu passes `() => props.at` and stays reactive. The evidence matches round 1: the list at [1462,39] is the group button's bottom-left, the oxlint menu at [1304,39] is its opener's bottom-left, and the 480 px Vue menu is clamped to 1120/1600.",
    "ServerGroup.vue:35-37: `opener.value !== null` guards the same case the old `box !== undefined` did.",
    "OpenMenu is a single type: serverMenuToggle.ts. ServerMenu's `defineProps<OpenMenu>()` keeps name/at/opener, and both callers (ServerStatus.vue, ServerGroup.vue) still pass all three.",
    "The fixture-page evidence avoids the WebDriver right-click, whose `click:0` gives a false pass, and the app evidence used xdotool, which logs no `click`. So the #1292 evidence would fail without the fix.",
    "Risk register: none of RK1–RK27 is owned by ui/useDropdownMenu, ServerGroup, ServerMenu or ServerStatus. cm6-rules does not apply because editor/ is untouched.",
    "No test was run. No block depended on one."
  ]
}
```