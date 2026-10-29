# PlanScoutRangeList — facts on the range file tree's counts and collapsing unchanged lines

Read-only scout run by the orchestrator on 2026-10-28 at main `15ab31c` (session 32, planning the requests after 0.6.0-beta.1). Facts cite `path:line` at that commit; `[INFERENCE]` marks guesses.

## Summary
**(A)** The range window and the merge window both use the generic `FileList.vue` → `FileTree.vue`, and the tree comes from the pure `treeRows` in `ui/fileTree.ts`. Only file rows get a slot (`#file`). Folder rows show an icon, a chevron and the label, with no counts, in both windows. A range file row shows `+n −m` from `RangeEntry.lines`, which is `counted | notCounted`. Binary and "Missing" entries are `notCounted`. Submodules are counted by git.

**(B)** Collapse exists only in the merge window. The state lives in `ui/collapsing.ts` (localStorage `yamt.collapse.unchanged`), the merge store holds it, and `MergeToolbar.vue` toggles it. The range and compare windows have no collapse code at all. The fold code is 3-pane, center-driven code tied to `Chunk`/`Pane`/`Frame`/strips. Only a few leaf helpers would work for two columns.

## (A) File list and tree: facts
- **Tree builder (pure):** `frontend/src/ui/fileTree.ts:97-104` `export function treeRows<F extends ListedFile>(files, closed): readonly TreeRow<F>[]`. It builds `Folder<F>` (`:18-21` `{ folders: Map; files: {name,file}[] }`) in `folderTree` (`:36-52`). `pushFolderRows` (`:56-79`) joins single-folder chains and pushes `{ kind: "folder", path, label, depth: place.depth, open }` (`:75`). File rows are `{ kind: "file", file, label: name, depth }` (`:93`).
  - `ListedFile = { readonly path: string }` (`:1`). The folder variant of `TreeRow` (`:3-10`) carries only path, label, depth and open, so no data per folder.
- **`FileTree.vue`:** `defineSlots<{ file(props: { file: F; label: string }): unknown }>()` (`:12`). Rows:
  - file: `<slot v-if="row.kind === 'file'" name="file" …/>` (`:82`)
  - folder: `<span v-else class="truncate">{{ row.label }}</span>` (`:83`)
  - There is no folder slot and no count. The icon comes from `folderIcon(row.path, row.open)` (`:21`).
- **`FileList.vue`:** `const rows = computed(() => treeRows(props.files, closed.value))` (`:22`). Its slots are only `file` and `footer` (`:15`). It forwards `#file` into the tree. In list mode it renders the same `#file` slot with `:label="file.path"`.
  - The list/tree mode comes from `createFileListMode()` (`:18`, `fileListMode.ts:8` key `"yamt.files.view"`). That is one key for every window kind.
- **Range use:** `RangeApp.vue:90-91` `<template #file="{ file, label }"><RangeFileRow :file="file" :label="label" :threads="counts.get(file.id) ?? 0" /></template>`. Thread counts per file are computed in `rangeThreads.ts:187-192`.
- **`RangeFileRow.vue`:**
  - `const counts = computed(() => lineCounts(props.file.lines))` (`:23`)
  - it renders `<span class="text-success-signal">{{ counts.added }}</span><span class="text-problem-error">{{ counts.removed }}</span>` only `v-if="counts !== null"` (`:50-55`)
  - plus the change letter (`:11-16`), the old path for a rename, and the thread badge (`:44`)
  - Formatting: `rangeText.ts:63-66` `lineCounts(lines)` returns `{ added: "+n", removed: "−m" }` or `null` for `notCounted`.
- **Merge use:** `App.vue:68-81` uses the same `FileList`, with `#file` → `<FileMark :status="file.status" :label="label" />` and a `#footer` `OperationLabel`. Folder rows there are also label-only, rendered by the same `FileTree.vue:83`.
  - `FileEntry` is `{ path, status, unsupported }` (`fileTree.test.ts:7`).
- **Wire type:**
  - Rust: `crates/range/src/lib.rs:53-56` `pub enum RangeLineCounts { Counted { added: u32, removed: u32 }, NotCounted }`.
  - TS: `ipc/bindings.ts:512` and `ipc/rangeDomain.ts:15-21` `RangeEntry { id, path, change, lines: RangeLineCounts }`.
- **Where counts come from:** `crates/range/src/entries.rs:135-139` maps `Numstat::Lines { added, removed } => Counted` and `Numstat::Binary | Numstat::Missing => NotCounted`. `Numstat` is defined at `crates/gitio/src/diff.rs:44-48`.
  - "Missing" means a pair with no numstat record (test `diff.rs:274-288`, a `T` type change gets `Missing`).
  - Plan §2 #104: "`+n −m` are git's counts" (`docs/plan.md:136`).

**What each special entry carries:**

| Entry | `lines` | Source |
|---|---|---|
| Binary | `NotCounted` | `entries.rs:138`; `load.rs:67` `if file.binary` → `RangeFile::Binary` |
| Submodule (gitlink) | `Counted`, git gives 1/1 | `gitio/tests/diff.rs:186-203` `numstat: lines(1, 1)`; `entries.rs:207-236` added gitlink → `counted(1, 0)` |
| Too large (> 8 MiB) | Whatever numstat gave; the size decision is separate | `load.rs:70-73` `is_too_large` → `TooLarge` |

[INFERENCE] A too-large text file is usually `Counted`, unless git itself treats it as binary.

## (B) Collapse unchanged lines: facts
- **State:** `ui/collapsing.ts:11` `const STORAGE_KEY = "yamt.collapse.unchanged"`.
  - `createCollapsing` (`:13-27`) uses `storedValue<boolean>(…, true, { read: raw => raw !== "false" … })` and returns `{ collapsing, toggleCollapsing }`.
  - `storedValue` is `useStorage(key, …)` (`ui/windowStorage.ts:15-30`), which is localStorage by default.
- **Owner:** only the merge store. `store.ts:181` `...createCollapsing()`, with buttons `store.ts:160` `createHiddenButtons()`.
  - `rangeStore.ts` and `compareStore.ts` hold only `preferences`/`fileListShown` (`rangeStore.ts:45-46,173`; `compareStore.ts:53-54,127`).
  - Documented in `docs/architecture.md:754`.
- **Toggle button:** `MergeToolbar.vue:83-89` `collapse: { icon: ChevronsDownUp, keepsKeyboard: true, run: toggleCollapsing, selected: collapsing, disabled: noSummary }`, read from `useAppStore()` (`:47-48`).
- **Into the editor:**
  - `MergeView.vue:53,65` `collapsed: collapsing`
  - `useMergeController.ts:46` `readonly collapsed: MaybeRefOrGetter<boolean>`, plus `:154-156` `watch(toRef(collapsed), (on) => { current()?.setCollapsed(on); })` and `:184` at build time
  - `editor/index.ts:58` `MergeOptions.collapsed`; `:83-84` `const runs = foldRuns(data.chunks, docs); this.#folds = new Folds(runs, hosts, () => this.#views, options.collapsed)`; `:224-227` `setCollapsed` calls `this.#folds.setCollapsed(collapsed); this.#frame.realign();`
- **Editor internals (file names):**
  - `internal/foldRuns.ts`: `Fold`/`FoldLevel = Record<Pane, Hidden|null>`, `CONTEXT_LINES = 4`, 3 levels, `foldRuns(chunks: Chunk[], docs: Record<Pane,Text>)`. Run edges come from `CHUNK_RANGE = { left: "local", center: "middle", right: "remote" }` (`:17-21,69`).
  - `internal/folds.ts`: `FoldFields { runs; center: StateField<FoldState>; sides: StateField<number[]> }` (`:27-31`); `collapseSpec` (`:171-187`); `pushFolds` mirrors center → left/right (`:255-271`); `sideReveals` dispatches to `center()` (`:282-302`).
  - `internal/foldView.ts`: the `FoldLine`/`WaveMarker` widgets, `foldDecorations(folds, pane: Pane)` (`:76`), `centerFolds`/`sideFolds`, and class `Folds`. Its constructor takes `hosts: WaveHosts` (left, center, right plus strips). `setCollapsed` dispatches on `views().center` (`:197-202`).
  - `internal/folding.ts`: `Folding(hosts: readonly Element[], show)` (`:19`), the hover and click handling for waves. It is generic over elements.
  - `internal/foldSelection.ts`: pure `revealKeep` and `leaveAllHidden` over `Hidden[]`. Not tied to panes.
  - `internal/wavePhase.ts:7-8` `WaveHosts = Record<Pane, HTMLElement> & { strips: [Element, Element] }`, which uses `STRIP_PANES` from geometry.
  - `internal/geometry.ts:11-15` `Pane = "left"|"center"|"right"`, plus `waveRows`. `frame.ts:9,55,74-75,96-98` consumes `FoldFields` and `realign()` (`scroll.follow("center")`). `minimap.ts:17,82` and `strips.ts:118` draw waves.
- **Range and compare today:**
  - No fold, wave or collapse code: a grep of `fold|wave|collaps` over `editor/compare.ts`, `internal/compare{Views,Frame,Strip,Fields}.ts`, `useCompareController.ts`, `useRangeController.ts`, `CompareView.vue` and `RangeView.vue` finds nothing.
  - `RangeOptions = { readonly preferences: Preferences }` (`editor/range.ts:35`). `useRangeController.ts:175` options are `{ preferences }` only.
- **Two-column seams `RangeController` uses** (`editor/range.ts`):
  - `createReadOnlyColumnViews(texts, hosts, { settings, updated, extensions: [threadField, threadNumbers(…)] })` (`:57-68`). The `extensions` slot is where extra fields can be added.
  - `CompareFrame({ views, strip, fields: [differenceField, threadField], anchors: threadAnchors })` (`:71-76`). Any field listed in `fields` re-measures the layout (`compareFrame.ts:96-104`).
  - `ScrollSync<Column>` (`compareFrame.ts:91`). `CompareFrame` has no `realign` method; the merge `Frame` does (`frame.ts:96`).
  - `Column = "left"|"right"`, `COLUMNS` (`compareViews.ts:32`). The diff data is `Difference { left: LineRange; right: LineRange }` (`bindings.ts:180-187`), not `Chunk`.
- **Range toolbar:** the header inside `RangeView.vue:51-79` holds:
  - file icon, `h2` heading, mode note
  - Previous/Next (`ArrowUp`/`ArrowDown`, disabled while `!columns`; `:62,73` `moveToChange`)
  - `<RangeSendButton class="ml-auto" />` (`:77`) and `<SettingsButton />` (`:78`)
  - It has no `contextmenu` menu.
- **Compare toolbar** (`CompareView.vue:52-90`): Format button, `CompareLanguagePicker`, Previous/Next, `SettingsButton`.
- **Hide menu is not shared:**
  - `TOOLBAR_BUTTONS` holds merge ids (`continue, abortMerge, previous, next, collapse, applyLeft, applyRight, undo, redo`; `toolbarButtons.ts:8-18`), key `"yamt.toolbar.hidden"` (`:35`).
  - `ToolbarMenu.vue:15` reads `useAppStore()`. Only `MergeToolbar.vue:174` opens it (`@contextmenu.prevent="openMenu"`).
  - Fence PM9 bars range-prefixed files from importing `src/ui/store`/`App` (`frontend/scripts/fences.ts:55-66` `ROOT_FILES`, `WINDOW_FILE`, `range: "PM9"`).
  - `collapsing.ts` and `toolbarButtons.ts` themselves are not root files [INFERENCE: so a range file may import them].

## Explicit answers
- **Where folder sums would be computed:** nowhere today; there is no count at any folder row. The existing seams are:
  1. pure `ui/fileTree.ts`: `folderTree`/`pushFolderRows`. The folder `TreeRow` variant (`:4-10`) holds no data, and `F` is only `{ path }`.
  2. `FileTree.vue`/`FileList.vue`: they have only a `file` slot (`FileTree.vue:12,82-83`; `FileList.vue:15`), so a folder slot or folder data would be new.
  3. Formatting: `rangeText.ts:63` `lineCounts`, which returns `null` for `notCounted`.
  - Because the components are shared, the merge window's folder rows would be affected too unless the change is opt-in.
- **Where the collapse toggle state lives and its persistence:** in `Collapsing` (`ui/collapsing.ts`), created only in the merge store (`store.ts:181`), in localStorage key `yamt.collapse.unchanged`. The key carries no window-kind prefix. [INFERENCE] localStorage is per origin, so every window kind would share this key, as `yamt.files.view` is already shared through `FileList.vue:18`. The range and compare stores have no collapse state.
- **Is the collapse code reusable for two columns:** not as it is; it is 3-pane specific.
  - `foldRuns` takes 3-way `Chunk`s and `Pane` (`foldRuns.ts:17-21,69`).
  - `FoldFields` has a `center` field that is the authority, and sides that mirror it (`folds.ts:27-31,255-302`).
  - `Folds` needs `WaveHosts` with a center and two strips (`foldView.ts:185-196`; `wavePhase.ts:7-8`).
  - `setCollapsed` dispatches on `views().center`, and the merge `Frame` and minimap consume `FoldFields`.
  - These pieces are pane-agnostic and could be reused for two columns: `foldSelection.ts`, `folding.ts` (`Folding` over any elements), the widget, gutter and theme parts of `foldView.ts` (`FoldLine`, `WaveMarker`, `waveTheme`), and the pure `hiddenLines`/level-growth logic in `foldRuns.ts`. [INFERENCE] `foldDecorations` is typed on `Pane`, so it would need a `Column` type.
  - `CompareFrame`'s `fields` and `extensions` seams would carry new fold fields.

[You have received this identical output 3 times. Re-reading 'agent://ScoutRangeList' will not change it — use a narrower selector (path:A-B), or proceed with the edit.]