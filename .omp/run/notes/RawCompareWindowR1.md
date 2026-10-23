# RawCompareWindowR1 (3.C-window rework 1, board Raw compare row 11)

All eleven blocks are fixed inside the Owned globs and every layer recipe passes. The merge page is pixel-identical before and after (AE=0, dark and light). The window-close path itself was still not driven in the real app; only the unit tests cover it. Nothing is committed.

**summary**
- One width mechanism for both side panels: `usePanelWidth.ts` plus `PanelWidthHandle.vue`, used by `FileList` and `CompareTabList`. One view shell, `PaneFrame.vue`, used by `MergeView` and `CompareView`: it holds the hidden-view classes, the rounded section, both plan §2 #51 paint comments, and the shown-and-no-question key guard (it emits `shownKeydown`).
- The compare store now owns `visited`. It also returns the screen to the tabs on show and add, keeps a single close flush that also waits for writes already running, and the close-handler registration is caught and logged. `useThemeAttribute()` in `settingsStore.ts` is called by both roots.
- Every compare-only file now carries the prefix (`CompareTabList.vue`, `CompareLanguagePicker.vue`), and PM7 is just `Compare*.vue | compare*.ts | useCompare*.ts`.
- `languageLabel` reads plain "Auto" before a tab has been detected. The arrow words come from `ACTION_NAMES`. app-session records `repoDir: null` for a raw session.

**files_changed**
- `frontend/src/ui/`: `CompareApp.vue`, `CompareView.vue`, `FileList.vue`, `MergeView.vue`, `App.vue`, `compareStore.ts`, `compareStore.test.ts`, `compareTabs.ts`, `compareTabs.test.ts`, `settingsStore.ts`, `AGENTS.md`
- New: `CompareTabList.vue` (was `TabList.vue`, deleted), `CompareLanguagePicker.vue` (was `LanguagePicker.vue`, deleted), `PanelWidthHandle.vue`, `PaneFrame.vue`, `usePanelWidth.ts`
- `frontend/scripts/`: `fences.ts`, `fences.test.ts`, `app-session/state.ts`, `app-session/state.test.ts`, `app-session/start.ts`

**tests_added**
- `compareStore.test.ts`:
  - "a tab's view is kept once shown, in the list's order, with its latest entry, until it closes": covers #1542 (show adds, close removes, a rename updates the entry).
  - "after a restart only the shown tab gets a view": a stored list mounts only the shown tab.
  - "%s from the settings view shows the tabs again", for `showTab` and `addTab`: covers #1550.
  - "a second close request while the first flush runs waits for that same flush, sending nothing twice": the same promise comes back, one write is sent, and a later flush runs again.
  - "flushAll waits for a save already in flight though nothing is left unsent": covers #1552.
  - I broke the code on purpose (no shared promise, no wait for running writes) and both #1552 tests failed; then I restored it.
- `compareTabs.test.ts`, "Auto before anything was detected reads Auto alone": covers #1549.
- `fences.test.ts`: the PM7 failing path now uses `CompareTabList.vue`, `CompareLanguagePicker.vue` and a new `useCompareFormat.test.ts`; the passing test checks that an unprefixed `TabList.vue` is outside the rule.
- `state.test.ts`, "a raw session opens no repository and reads back with none, not an empty path": null survives a round trip, and a number is refused.

**smoke_evidence**
- **Recipes:** `typecheck` (`vue-tsc -b`) passes; `test` gives `Test Files 146 passed (146)`, `Tests 1925 passed (1925)`; `lint`, `unused` (knip) and `fmt:check` ("All matched files use the correct format.") are clean; `just sfc-order` exits 0.
- **Merge page AE=0.** The "before" build is `git archive HEAD` served from `/tmp` with its own `node_modules`. One MiniBrowser loaded both servers, opened `nuxt-island-test.ts` and took a shot each time.
  - Dark: `magick compare -metric AE one-36099.png two-39959.png` → `0 (0)`, and `one-39959.png` vs `two-36099.png` → `0 (0)`.
  - Light (Settings → Light → Back): `light-36099-…128.png` vs `light-39959-…195.png` → `0 (0)`, and `light-36099-…216.png` vs `light-39959-…138.png` → `0 (0)`.
  - Some other pairs differ by a few pixels at 1/255 on rounded edges. Pairs from the same build differ the same way, so this is the browser, not the code.
- **Compare page, fixture** (`?raw=json-payload`):
  - Width shared with the merge file list: dragging "Tab list width" by +100 gave `{"stored":"340","w":340}`. The merge page then read `{"handle":"File list width","w":340}`; dragging that by −60 stored `"280"`, and `?raw` read `280`.
  - "+" from settings: `settings:false`, Compare 3 selected and its view shown. A tab click from settings: `settings:false`, Compare 1 selected, views `["shown","hidden","hidden"]`.
  - Arrow titles read `["Format both columns as JSON","Language","Previous change","Next change","Settings"]`.
- **Real app** (`start-app --raw --home /tmp/yamt-r1-home`, after `cargo tauri build --debug --no-bundle`):
  - The output and the state file both show `"repoDir":null`.
  - Typing JSON into Compare 2, showing Compare 1 and restarting gave `[["Compare 1Auto · Plain text","true"],["Compare 2Auto","false"]]` with one view mounted. Showing Compare 2 then read "Auto · JSON" with two views.
  - Settings → Light → tab click gave theme `light`, settings closed, Compare 1 shown.
- Screenshots are in `/tmp/yamt-r1/`: `compare-json-dark.png`, `compare-json-light.png`, `compare-dragged-dark.png`, `compare-tab-from-settings-dark.png`, `app-unvisited-auto-dark.png`, `app-light.png`, plus the merge before/after shots.

**deviations_from_brief**
- Files outside my globs still use the old names and need updating by you: `.omp/skills/project-map/SKILL.md` (tree lines 142–143 and PM7 line 178), `docs/architecture.md` lines 112 and 1092–1095, and the docs' mention of `repoDir`. `just map-check` will flag the new files until the map names `CompareTabList`, `CompareLanguagePicker`, `PanelWidthHandle`, `PaneFrame` and `usePanelWidth`.
- `PaneFrame` hands the strip-layer classes to the views as a `stripLayer` slot prop, so the strip paint comment lives in one place even though the views place their strips themselves.
- To stay under the 300-line cap, `compareStore.ts` records each write in flight inside `saveColumn`, and `flushAll` itself clears the close flush when it finishes. The file is now exactly 300 lines.
- The #1553 catch sits in `CompareApp.vue` (`watchWindowClose`, log event `compare.close_guard_failed`) rather than the store, again because of that cap.
- `languageLabel` takes a new `Detected` type (`string | null | undefined`, where undefined means "not detected yet"), also used as `CompareLanguagePicker`'s prop.
- `SettingsView.vue` needed no change.

**open_risks**
- `CompareApp.vue:54-64` / `compareStore.ts:269-291`: the real close (`flushAll` through `onWindowClose`) is still only proven by unit tests; the private display can't send a window close.
- `compareStore.ts` is at 300 lines, the `max-lines` cap, so the next addition there needs a split.
- `PaneFrame.vue:4`: the `asking` and `columns` props, and `MergeView`'s merged keydown handler (history key, then Save, in one listener instead of two), keep the old order and the AE shots match, but I did not run a keyboard-level check for Undo/Save.

Run next: `just check` (including `map-check` once the docs are updated) and `just mutants` on the changed lines.