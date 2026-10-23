# RawCompareSeam (3.C-seam, board Raw compare row 5)

The settings view and the notice bar now work for any window root, and the merge window looks exactly as before. Screenshots of the settings view taken before and after the change match pixel for pixel (AE=0) in dark and light. All five frontend recipes pass. Two things are outside my files: `just map-check` will fail on the new file once it is committed until the project map names it, and the WebKit notice check needed a dev-console injection because the fixture page never creates a notice.

**summary**
- `frontend/src/ui/settingsStore.ts` is new: `SettingsStore`, `registerSettingsStore` and `useSettingsStore` exactly as the Contract gives them. `createAppStore` registers its store (`store.ts` goes from 297 to 299 lines).
- `SettingsView.vue`, `KeymapList.vue` and `SettingsButton.vue` read only `useSettingsStore()`. The Language servers section is now a default slot in `SettingsView`, and `App.vue` fills it.
- `NoticeBar.vue` takes ready `rows: readonly NoticeRow[]`. `NoticeRow` is exported from `noticeText.ts`, and `App.vue` passes a computed `notices.map(noticeRow)`.

**files_changed**
- `frontend/src/ui/settingsStore.ts` (new)
- `frontend/src/ui/settingsStore.test.ts` (new)
- `frontend/src/ui/store.ts`
- `frontend/src/ui/SettingsView.vue`
- `frontend/src/ui/KeymapList.vue`
- `frontend/src/ui/SettingsButton.vue`
- `frontend/src/ui/NoticeBar.vue`
- `frontend/src/ui/noticeText.ts`
- `frontend/src/ui/App.vue`

**tests_added**
- `settingsStore.test.ts` › "the settings view gets the store its window root registered, and nothing before that": `useSettingsStore()` throws `useSettingsStore() called before registerSettingsStore()` until something registers, then returns the registered object. This covers the guard branch.
- No existing test needed changing; no component tests use `NoticeBar` or `SettingsView`. `noticeText.test.ts` still passes unchanged.

**smoke_evidence**
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit 0
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0
- `pnpm -C frontend unused` → `$ knip --include exports,types`, exit 0
- `pnpm -C frontend fmt:check` → `All matched files use the correct format. Finished in 693ms on 374 files`
- `pnpm -C frontend test` → `Test Files 130 passed (130)` / `Tests 1798 passed (1798)`
- **WebKit setup:** `just app-session start-fixture --name seam --size 1600x1000` (Vite dev server + `just webdriver` + MiniBrowser). The page ran the new code: its resources include `http://localhost:33403/src/ui/settingsStore.ts`.
- **Section order**, read after the gear, plain and with `?servers`, before and after the change: `Theme|Antialiasing|Keymap|Language servers|Settings file` (identical each time).
- **Theme:** clicking Light gave `document.documentElement.dataset.theme` = `light`; clicking Dark gave `dark`.
- **Key added in Keymap:** the "Toggle file list" row read `Toggle file listanywhere in the windowCtrl+B`. After "Add Keyboard Shortcut", pressing Ctrl+Shift+F9 and OK, it read `…Ctrl+BCtrl+Shift+F9`.
- **Back:** after clicking Back, `document.querySelector('section[aria-label=Settings]')` → `null`.
- **`?servers`:** after answering "Don't start", the Language servers section lists oxlint, TypeScript, Vue and eslint under "Found in this repository" (`/tmp/seam/after-servers-light-bottom.png`).
- **Pixel compare** of the settings view (top and bottom of the scroll, dark and light, plain and `?servers`), `magick compare -metric AE before… after…`:
  - before-dark-top vs after-dark-top AE=0 (0)
  - before-dark-bottom vs after-dark-bottom AE=0 (0)
  - before-light-top vs after-light-top AE=0 (0)
  - before-light-bottom vs after-light-bottom AE=0 (0)
  - before-servers-dark-top vs after AE=0 (0)
  - before-servers-dark-bottom vs after AE=0 (0)
  - before-servers-light-top vs after AE=0 (0)
  - before-servers-light-bottom vs after AE=0 (0)
  - Before I changed any code, I ran the sequence twice and got AE=0 for all four views, so the method is deterministic.
- **Notices:** I set the store's `notices` from WebDriver (a disk change and a moved-on notice; see deviations).
  - Rows read: `word-marks.ts changed on disk; your edits in yamt were dropped — 2 conflicts left / Close the notice about word-marks.ts | The rebase moved on outside yamt; your unsaved edits in a.ts, b.ts were dropped / Close the notice about the dropped edits`
  - Closing the first left `The rebase moved on outside yamt; …`; closing the second left `ul[role=status]` count `0`.
  - `before-notice.png` vs `after-notice-fresh1.png` AE=0 (0), and vs `after-notice-fresh3.png` AE=0 (0).
  - One pixel, (9,1838) in the file list's bottom-left corner, is not stable: its blue value was 44 or 45 across three runs of the same new code (fresh1 vs fresh2 AE=0.00098). That is render noise, not this change.
- Screenshots are in `/tmp/seam/` (`before*`, `after*`, `*-notice*`). The session was stopped: `{"stopped":"seam",…,"vite"…"stopped"}`.

**deviations_from_brief**
1. **The slot holds the whole Language servers section**, heading included, not just `<LanguageServerSettings />` under a heading that stays in `SettingsView`. `App.vue` fills it with `<section aria-labelledby="settings-servers"><h3 …>Language servers</h3><LanguageServerSettings /></section>`. This follows design §6 ("The 'Language servers' section moves into a slot that only App.vue fills"), so the compare root will show no empty heading. The markup and position are unchanged, as AE=0 shows.
2. **Notice check in WebKit:** no fixture path or showcase case ever creates a disk-change or moved-on notice (the fixture `listStop` always returns `diskChanges: []`). I set the store's `notices` from WebDriver: `import(<the page's loaded /src/ui/store.ts URL>).then(m => m.useAppStore().notices.value = [...])`. This shows the real `NoticeBar`, its `noticeRow` rows and the real `dismissNotice` close path. It does not exercise `diskChanges.ts`, which is unchanged.
3. **Docs I could not edit (read-only for me), needed before `just map-check` passes:** `scripts/map-check.sh` checks committed files only, so it will report `frontend/src/ui/settingsStore.ts (not in .omp/skills/project-map/SKILL.md)` once this is committed. Suggested edits:
   - `.omp/skills/project-map/SKILL.md`, ui line for SettingsView: add `+ settingsStore.ts (`SettingsStore`, `registerSettingsStore`/`useSettingsStore`: the settings part any window root registers once; SettingsView, KeymapList and SettingsButton read only it, plan §2 #94)`.
   - `docs/architecture.md` §5.4: the same sentence, and note that `SettingsView`'s Language servers section is a slot `App.vue` fills and that `NoticeBar` takes `rows: NoticeRow[]`.
   - `skill://ts-conventions` TS15: add the `settingsStore` slot as an allowed module state, as design §7 #94 already plans.
4. `map-check` already fails in this tree on other slices' files and commands (`compare.rs`, `formatJson.ts`, `open_compare`, `show_tab`, …); none of that is from this slice.

**open_risks**
- `frontend/src/ui/settingsStore.ts:21`: one module-level `registered` slot. A second `registerSettingsStore` call silently replaces the first. That is fine with one root per window, but nothing detects two roots in one page.
- `frontend/src/ui/App.vue:108-113`: the Language servers markup (its `id="settings-servers"` heading) now lives in `App.vue`. If `SettingsView`'s section style changes later, this copy has to follow by hand.

Checks for you to run on the merged tree: `just check` (mainly `map-check` after the doc edits above, `sfc-order`, `web-*`) and `just mutants <base>` for `ui/settingsStore.ts`.