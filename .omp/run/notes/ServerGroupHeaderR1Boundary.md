```json
{
  "lens": "boundary",
  "round": "ServerGroupHeaderR1 (84ec8fa), re-check of #1289, #1290, #1291 (RV8)",
  "verdict": "pass",
  "findings": [],
  "checked": [
    "#1289 fixed: `OpenMenu` is declared once, at `frontend/src/ui/serverMenuToggle.ts:3`, next to the open-menu rule `menuAfterClick`. ServerStatus.vue:9,21 imports it and holds `shallowRef<OpenMenu | null>`. ServerGroup.vue:9,21 does the same. ServerMenu.vue:21 is `defineProps<OpenMenu>()`. A grep of frontend/src for `OpenMenu|RowMenu` finds no other hand-written `{ name; at; opener }` shape.",
    "#1289 deviation accepted: `menuAfterClick<Menu extends { readonly name: string }>` stays generic so its node test can use plain objects. The shape is still defined in one place, and the generic does not copy it.",
    "#1290 fixed: `useElementSize`, `useWindowSize` and `menuPosition` (measure and place) now exist only in `ui/useMenuPlacement.ts:13-27`. ServerGroup.vue:26 calls `useMenuPlacement(list, at)` and ServerMenu.vue:26 calls `useMenuPlacement(panel, () => props.at)`. A grep for `useElementSize|useWindowSize|menuPosition` in ui/ finds no inline copy in ServerGroup or ServerMenu (Acceptance 3).",
    "#1290 anchor fixed: the bottom-left anchor is `belowLeft(opener)` (useMenuPlacement.ts:8-11). ServerStatus.vue:38 and ServerGroup.vue:36 use it. A grep for `getBoundingClientRect` in ui/ finds no other left/bottom anchor copy. The other hits (ChoiceView, FileList, MergeView, ServerLogView, useDropdownMenu `visibleBottom`, ToolbarMenu) are different rules.",
    "ToolbarMenu.vue:20-38 still has its own `menuPosition` call with a size measured once at mount. The brief says to leave it (a different rule, read-only), so it does not count as a leftover copy.",
    "The new composable has one job (where a teleported menu goes: its anchor point plus the clamped `{left, top}`) and the right home. It is in `ui/` because it uses @vueuse/core and vue, which PM3 keeps out of editor/lsp/connectors/model. It imports only `./menuPosition`, a sibling in the same layer. No new edge breaks the §2 dependency direction, and nothing imports a sibling's `internal/` (PM5).",
    "VU13: `useMenuPlacement` takes `MaybeRefOrGetter` for both read inputs and reads them with `toValue` inside the `computed`. It takes no callbacks. `MenuPlacement` is a local type, not an unused export.",
    "VU2 order holds in ServerGroup.vue (imports → macros → state, incl. `placement` → computed → functions) and ServerMenu.vue (`placement` among the state lines, before the computeds). The implementer's sfc-order run returned 0.",
    "Dead weight: ServerMenu.vue no longer imports `useElementSize`, `useWindowSize`, `menuPosition` or `Point`. ServerStatus.vue no longer imports `Point`. ServerGroup.vue keeps `type Point` only for its own `at` shallowRef (the list's anchor, which is not a copy of `OpenMenu`).",
    "Growth check: no touched component gained a job. ServerGroup is still button + list + row menu, ServerStatus is still counts/note/pins/group, and ServerMenu is still the menu body. There is no new state (`at`, `rowMenu` and `menu` keep their single writers). The `contextmenu` close sits once in the shared `useDropdownMenu`, so it is not copied per drop-down.",
    "#1291 fixed: ui/AGENTS.md:5 now reads \"With no host (fixture mode without `?servers`) it only loads and refreshes.\", the brief's wording. Paragraph 7 now names `OpenMenu` (serverMenuToggle.ts, ServerMenu's props), `useMenuPlacement`/`belowLeft` and the right-press close, and drops the stale \"placed by `menuPosition`\". It matches the code.",
    "Ownership: every touched file is in the brief's `Owned` list (useDropdownMenu.ts, ServerGroup.vue, ServerStatus.vue, ServerMenu.vue, serverMenuToggle.ts, the new useMenuPlacement.ts, menuKeys.test.ts, ui/AGENTS.md) plus the run notes.",
    "Outside Owned, for the orchestrator: `.omp/skills/project-map/SKILL.md:96` does not name `ui/useMenuPlacement.ts` yet, and its serverMenuToggle.ts entry names only `menuAfterClick`. PM6 `just map-check` will flag the new file until the map is updated. The implementer flagged this in deviations. It is not a patch defect because the map is not in this brief's `Owned` list."
  ]
}
```