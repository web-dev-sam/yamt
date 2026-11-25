# Slice mr-heading-sides — the side column shows only beside files, in all three windows

Feature "MR heading" build 2 of 3, **beside `mr-heading-rust`** (it touches no Rust and no generated file; the two
ownership lists are disjoint). It lands before `mr-heading-web`, which starts from your `RangeApp.vue`. Request:
`docs/slices/request-mr-heading.md` rule 7 and the owner's answers 4 (read the request whole). Design:
`docs/slices/briefs/mr-heading-design.md` §4.4. Vision 2: one rule in one function for both keys and all three windows.

Facts (given, from the design's §4.4):

- `Screen = files | settings | serverLog { name } | mergeRequests` (`frontend/src/ui/screen.ts:3-7`). Merge window:
  files, settings, server logs; compare and range: files, settings, the merge-request list.
- `SideColumn.vue:7,14-25`: props `{ searchShown, filesShown }`, root `v-show="searchShown || filesShown"`, holds the
  search slot, the file list and the width handle (`usePanelWidth`, the width kept in `fileListWidth`). The merge root
  uses it at `App.vue:72-94`, the range root at `RangeApp.vue:106-142`. The compare root shows `CompareTabList` (one
  `<aside>` root, `CompareTabList.vue:70-71`) with `v-show="fileListShown"` (`CompareApp.vue:71-80`).
- The roots' `keydown` listeners: `App.vue:51-53` (`fileListKey`, `search.toggleKey`), `CompareApp.vue:43-44`
  (`fileListKey`), `RangeApp.vue:58-61` (both). Both keys go through `windowKey(target, action, event, platform)`
  (`ui/fileListKey.ts:17-32`; `WindowKeyTarget { asking, settings }` `:10-13`), called by `fileListKey` (`:34-38`) and
  `searching.ts:199-203` (`deps.keys`, `searching.ts:68`). The stores pass their state (`store.ts:233`,
  `compareStore.ts:162`, `rangeStore.ts:239`), which holds `screen`; the search targets are `MergeSearchTarget`
  (`mergeSearch.ts:34`) and `RangeSearchTarget` (`rangeSearch.ts:17`), both `WindowKeyTarget & …`. Test literals of a
  `WindowKeyTarget`: `diskChanges.test.ts:73`, `searching.test.ts:99,388,444`, `stops.test.ts:131`,
  `fileListKey.test.ts` (typecheck finds any other).
- `[INFERENCE]` WebKit restores a `display: none` element's scroll offset when it is shown again; step 4 of the
  acceptance checks it.

## Target

**Owned:** `frontend/src/ui/SideColumn.vue`, `frontend/src/ui/App.vue`, `frontend/src/ui/CompareApp.vue`,
`frontend/src/ui/RangeApp.vue`, `frontend/src/ui/fileListKey.ts`, `frontend/src/ui/AGENTS.md`,
`frontend/src/ui/**/*.test.ts` (this slice's tests and the `WindowKeyTarget` literals only).

**Read-only:** everything else. `mr-heading-rust` runs at the same time on Rust only. `mr-heading-web` owns
`RangeApp.vue`, `ui/AGENTS.md` and the test glob **after** you are committed; keep your `RangeApp.vue` change to the
side column (one attribute), so its diff stays small.

**Non-goals:** the merge-request line (`mr-heading-web`); any change to what the side column holds; the screens
themselves; other keys; a new store field.

## Contract (fixed; you may add, never change)

```ts
// ui/fileListKey.ts
export type WindowKeyTarget = {
  readonly asking: Asking;
  readonly settings: Readonly<ShallowRef<SettingsInUse>>;
  readonly screen: Readonly<ShallowRef<Screen>>;
};
// windowKey answers false — and does not call preventDefault — when target.screen.value.kind !== "files",
// checked before the key match; on the files screen it behaves as today.

// ui/SideColumn.vue
defineProps<{ searchShown: boolean; filesShown: boolean; onFiles: boolean }>();
// root: v-show="onFiles && (searchShown || filesShown)" — hidden, never unmounted.

// App.vue, RangeApp.vue: <SideColumn … :on-files="screen.kind === 'files'">
// CompareApp.vue:        <CompareTabList v-show="fileListShown && screen.kind === 'files'" …>
```

What "as it was" means (rule 7): on return to the files screen the column shows if and only if it showed when the
screen was left, with the same list or tree mode, folders open, scroll offset, width, search panel open or closed, its
query and results. Nothing is reset or reloaded by leaving.

## Change

1. `fileListKey.ts`: `screen` in `WindowKeyTarget`, the files-screen check in `windowKey`; every literal gains `screen`.
2. `SideColumn.vue`: the `onFiles` prop; `App.vue`, `RangeApp.vue` pass it; `CompareApp.vue`'s `v-show`.
3. `ui/AGENTS.md`: one line under the roots — the side column (file or tab list and search) shows only on the files
   screen, hidden with `v-show` so it comes back as it was; its two toggle keys act only there (`windowKey`).

## Acceptance

- `ui/fileListKey.test.ts`: `the_list_and_search_keys_do_nothing_off_the_files_screen` — for `settings`, `serverLog`
  and `mergeRequests`, `windowKey` answers false for both actions, `preventDefault` is not called, `fileListKey` leaves
  `fileListShown`; on `files` both act as before.
- `store.test.ts`, `compareStore.test.ts`, `rangeStore.test.ts`: the store's `fileListKey` on the settings screen leaves
  `fileListShown`, back on files it toggles (the existing Ctrl+B tests stay).
- `ui/searching.test.ts`: `toggle-search` off the files screen leaves `shown`.
- Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`, `just web-unused`,
  `just mutants HEAD`.
- WebKit (VF8, `just app-session`), 1280x800, dark and light (`read --name <n> "document.documentElement.dataset.theme
  = 'light'"`):
  1. Range `start-fixture --name sd-r --range-case review --mr list`: switch to tree mode, close one folder, scroll the
     list down, drag the width wider, open search (Ctrl/Cmd+Shift+S) and type a word. Open Settings (gear) → no side
     column, the settings screen starts at the window's left island edge; Ctrl+B and Ctrl/Cmd+Shift+S do nothing visible.
     Back to files → the column as it was (`read` the list's `scrollTop`, its width, the tree mode, the search query
     before and after). The merge-request list (`--mr list`'s button): the same.
  2. Hide the list (Ctrl+B) on files, open Settings, come back → still hidden; the search panel alone stays as it was.
  3. Compare `start-fixture --name sd-c --diff --mr list`: Settings and the merge-request list hide the tab list; back on
     files it is as it was (the shown tab, its scroll).
  4. Merge fixture (`start-fixture --name sd-m`, the default merge page): Settings hides the side column; back as it was.
     A server log screen, if the fixture offers one (a server row's log button), likewise; else say so.
     `shot` of each hidden and restored state, dark and light.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
