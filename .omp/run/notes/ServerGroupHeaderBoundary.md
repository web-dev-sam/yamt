```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "file": "frontend/src/ui/ServerGroup.vue",
      "line": 14,
      "rule_id": "TS6",
      "problem": "`type RowMenu = { name; at: Point; opener: HTMLElement }` is a second hand-written copy of `OpenMenu` in `ServerStatus.vue:15`. Both mirror `ServerMenu`'s props. If ServerMenu gains a prop, both copies have to change together, and nothing ties them to each other.",
      "fix": "Declare the open-menu shape once and import it in both components, for example `export type OpenMenu` in `serverMenuToggle.ts`, which already holds the open-menu rule (`menuAfterClick<Menu extends { name }>`)."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/ServerGroup.vue",
      "line": 21,
      "rule_id": null,
      "problem": "Lines 21-38 copy, line for line, the code in `ServerMenu.vue:25-51` that places a teleported menu: `useElementSize(…, { box: \"border-box\" })` + `useWindowSize()` + `menuPosition({ pointer, menu, viewport })` → `{ left, top }`. Lines 45-48 also repeat the bottom-left anchor from `ServerStatus.vue:38-41`. The next teleported menu will copy this a third time, and a fix to how a menu is measured has to be made in every copy.",
      "fix": "Move the measure-and-place step into one `ui/` composable (e.g. `useMenuPlacement(menu, at)` returning the `placement` style). Use it in ServerMenu and ServerGroup, and drop the inline copies."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/AGENTS.md",
      "line": 5,
      "rule_id": null,
      "problem": "\"Fixture mode (no host) only loads and refreshes\" is now wrong for `?servers`: that page has a host and runs detection and the start question (line 7 says so). A reader of line 5 will assume fixture mode never detects servers.",
      "fix": "Reword it as \"With no host (fixture mode without `?servers`) it only loads and refreshes.\""
    }
  ],
  "checked": [
    "Ownership: every touched file is in Owned (ui/ServerStatus.vue, ServerGroup.vue, serverButtons.ts+test, serverText.ts+test, ServerMenu.vue, useDropdownMenu.ts, menuKeys.ts+test, ipc/fixtureServers.ts+test, ipc/index.ts, main.ts, ui/AGENTS.md), plus `ipc/fixtureSettings.ts` (only `export` on REPOSITORY, granted and accepted) and the notes file.",
    "Fixed contract matches: `ServerButton` {key: ServerKey, name, title, dot: string, pinned} and `serverButtons(views, pinned: ReadonlySet<string>)` in view order (serverButtons.ts:4-31); `DOT_CLASSES` moved there and removed from ServerStatus; `groupDot(kinds): DotKind` gives the first of problem/warning/busy/running, else stopped (serverText.ts GROUP_URGENCY); `MENU_ITEMS` is exactly \"[role=menuitem], [role=menuitemcheckbox]\" (menuKeys.ts:1); `defineProps<{ buttons: readonly ServerButton[]; dot: DotKind }>()` (ServerGroup.vue:16).",
    "One open/close rule: the group list uses `useDropdownMenu<\"servers\">` (toggle, close, menuKey, outside click with the opener ignored) and `stepMenuItem` over `MENU_ITEMS`; it is placed with `menuPosition` as the brief asks. There is no second key or close rule in ServerGroup. `groupClicked` only adds the brief's 'close the row's menu first' branch.",
    "useDropdownMenu: closes on blur through `watch(useWindowFocus())` → `close`, which gives focus back to the opener (request rule 5). The first-item focus and the item query both use `MENU_ITEMS`, so PresetPicker and KeymapList pick up both changes without edits.",
    "ServerMenu: the Escape/Tab 'close' step calls `props.opener.focus()` before `emit('close')` (ServerMenu.vue:82). Its item queries use `MENU_ITEMS`; accepted deviation, same behaviour because it has only menuitems.",
    "State ownership: pins are read only from `store.pinnedServers` (ServerStatus.vue:22,25) and passed down as `buttons`. There is no copy. `togglePin(key)` is the store action (VU9); ServerGroup holds only `at` and `rowMenu` (UI state, one writer each). `serverPins.ts` remains the only writer of pins.",
    "Fixture host only in fixture mode: main.ts `serverHost()` returns the Tauri host when IN_APP, the fixture host only with `?servers`, otherwise null. serverSetup's `host === null` paths are unchanged.",
    "PM2/PM3/TS8: `ipc/fixtureServers.ts` imports only `./domain` (types), `./fixtureSettings`, `./ServerHost` (type), so no vue/tauri/ui imports. It is exported through `ipc/index.ts` and its only importer is main.ts. No ui/ file imports it.",
    "Vision 2: the fixture repository root is one constant (`REPOSITORY`), shared by fixtureSettings.ts and fixtureServers.ts.",
    "Words: \"Servers\", \"Language servers\", the pin titles and the pin label are in serverText.ts (SERVERS, LANGUAGE_SERVERS, pinTitle, pinLabel). ServerGroup's template has no literal words. `ONLY_IN_THE_APP` stays in ipc/ by design: it is the host's SpawnFailed message (like an OS error from Rust), ui/ wraps it in \"Could not start: …\", and ipc cannot import ui.",
    "Accepted deviations: rows carry aria-label/aria-description like the pinned buttons; `node_modules/vue/package.json` in the fixture tree; no-op `send`/`stop` in the fixture host, which `start` makes unreachable because no RunId is ever issued (the ServerHost contract is not affected); VU15 one-line reason given for ServerGroup.vue (one popup group, as design §8 says); ui/AGENTS.md gains row 6's Resizing paragraph (ResizeDots.vue, PaneDivider.vue, usePaneDividers.ts all exist).",
    "Growth: ServerStatus still does one job (counts, note, pinned buttons and their menu, then the group). ServerGroup's one job is the group popup (button, list, a row's ServerMenu). No new import edges against architecture §2; ServerGroup → ServerMenu/menuPosition/useDropdownMenu/serverButtons/serverText/store are all ui-internal.",
    "VU1/VU2/VU4/VU5/VU6: ServerGroup has script-setup → template; sections in order (imports, type, defineProps, state, computed, functions); `useTemplateRef` for opener/list; typed props; template handlers are plain calls with no inline logic.",
    "Comments: the patch adds none to source files (CP rules not triggered).",
    "Decision record: #58 (header contents are a window choice: pins in localStorage through serverPins, not touched here); #70 (the fixture host implements `ServerHost`, so lsp/ is unchanged and Rust parses nothing); #71's per-server buttons are replaced by pins + group exactly as #83 'Header' says; #83 'Fixture page' (one project: oxlint, TypeScript, Vue, eslint; start answers 'language servers run only in the app'). No contradictions.",
    "Pre-existing and outside Owned, not raised: KeyRecorder.vue:84,98 still queries \"[role=menuitem]\" itself; ServerMenu and ToolbarMenu each keep their own blur close (they are point-placed popovers, not useDropdownMenu users); SettingsView.vue:95 has a literal \"Language servers\" heading.",
    "Not re-raised, per context: the Settings switch tick in fixture mode (#1288); map/architecture lines for the three new files (the orchestrator's docs step)."
  ]
}
```