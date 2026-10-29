# Slice FolderSums — a folder row in the range window's tree shows the sum of its files' `+a −r`

Board "Folder sums" row 1 (session 34). Request `docs/slices/request-folder-sums.md` (read it whole: rules 1–6,
acceptance, non-goals); decision `docs/plan.md` §2 **#125** (read it whole). You are the only implementer.

Facts (given, at `aa463ae`; these files are unchanged since `15ab31c`):

- `ui/fileTree.ts:56-79` `pushFolderRows` joins a chain of single folders into one row: `label = names.join("/")`,
  `path = parent/label` (`:72-73`), so a folder row's `path` is the deepest folder's full path (`src/ui/parts`).
  `:106-109` `export function folderPaths(path)` returns every folder holding a file path (`a/b/c.ts` → `a`, `a/b`),
  the same strings folder rows carry. The folder `TreeRow` (`:4-10`) holds `path, label, depth, open` only.
- `ui/FileTree.vue:12` `defineSlots<{ file(props: { file: F; label: string }): unknown }>()`; `:82` file rows render
  the `file` slot; `:83` a folder row renders `<span v-else class="truncate">{{ row.label }}</span>` and nothing
  after it. The row is `flex items-center gap-2 … py-1 pr-2` (`:64`).
- `ui/FileList.vue:15` slots `file` and `footer`; `:22` `rows = computed(() => treeRows(props.files, closed.value))`;
  `:75-77` forwards `#file` into `FileTree`; `:79-96` the list view (no folder rows) renders the same `file` slot.
- Merge window: `ui/App.vue:68-81` passes `#file` (`FileMark`) and `#footer`, no folder content. It is read-only here.
- Range window: `ui/RangeApp.vue:50` `files = computed(() => start.value?.files ?? [])`; `:90-92`
  `<template #file="{ file, label }"><RangeFileRow :file :label :threads="counts.get(file.id) ?? 0" /></template>`.
- `ui/RangeFileRow.vue:23` `counts = computed(() => lineCounts(props.file.lines))`; `:49-56` the pair:
  `<span v-if="counts !== null" class="flex shrink-0 gap-1.5 tabular-nums" :class="{ 'ml-auto': threads === 0 }">`
  holding `<span class="text-success-signal">{{ counts.added }}</span><span class="text-problem-error">{{ counts.removed }}</span>`;
  the thread badge before it (`:39-48`) carries `ml-auto` when shown.
- `ui/rangeText.ts:63-67` `lineCounts(lines: RangeLineCounts): LineCounts | null` — `{ added: "+n", removed: "−m" }`
  (a real minus sign), `null` for `notCounted`. Stays the one formatter.
- `ipc` `RangeLineCounts = Readonly<{ kind: "counted"; added: number; removed: number } | { kind: "notCounted" }>`;
  `RangeEntry { id, path, change, lines }` (`ipc/rangeDomain.ts:15-21`); a renamed entry's `path` is its new path.
- Fixture `?range` = `frontend/fixtures/range/review.json` (generated from `scripts/range-repo.sh`, `main...feature`).
  Its folder sums: `data` +1 −0; `docs` +4 −1; `public` none (only `public/logo.png`, `notCounted`); `src` +55 −64;
  `src/api` +0 −43 (a deleted file); `src/board` +55 −21; `tools` +2 −0 (holds `build.sh` counted +0 −0); `vendor`
  +1 −1. Root file `config` has no folder. Neither the fixture nor `range-repo.sh` has a joined chain: your node test
  covers it; the final run checks it in the real app on a scratch repository.
- Range-only files carry the prefix (`Range*.vue`, `range*.ts`; `frontend/src/ui/AGENTS.md` "Range window"); a range
  file may import `fileTree.ts` (not a root file; fence PM9 bars only `store`/`App`).

## Target

Owned: `frontend/src/ui/FileTree.vue`, `frontend/src/ui/FileList.vue`, `frontend/src/ui/RangeApp.vue`,
`frontend/src/ui/RangeFileRow.vue`, `frontend/src/ui/RangeCounts.vue` (new), `frontend/src/ui/rangeFolderSums.ts`
(new), `frontend/src/ui/rangeFolderSums.test.ts` (new), `frontend/src/ui/AGENTS.md`.

Read-only: everything else (`fileTree.ts`, `rangeText.ts`, `App.vue` included). Docs are the orchestrator's.

Non-goals: counts in the list view; a thread count per folder; anything in the merge window (its tree looks exactly
as before); abbreviating big numbers; a tooltip on the counts; changing the fixture or `scripts/range-repo.sh`.

## Contract (fixed; you may add, never change)

```ts
// frontend/src/ui/rangeFolderSums.ts
/** Git's counts summed per folder over every counted file below it, at any depth, keyed by the folder's full path as
 *  `folderPaths` names it — the path a tree folder row carries, a joined chain's deepest folder included. A
 *  `notCounted` file adds nothing; a folder with no counted file below it has no entry. */
export function folderSums(
  files: readonly Pick<RangeEntry, "path" | "lines">[],
): ReadonlyMap<string, Extract<RangeLineCounts, { kind: "counted" }>>;
```

```ts
// FileTree.vue — the folder slot renders after a folder row's label; not given → the row is as today
defineSlots<{
  file(props: { file: F; label: string }): unknown;
  folder?(props: { path: string }): unknown;
}>();
// FileList.vue — forwards `folder` into the tree view (the list view has no folder rows)
defineSlots<{
  file(props: { file: F; label: string }): unknown;
  folder?(props: { path: string }): unknown;
  footer(): unknown;
}>();
```

## Change

1. `rangeFolderSums.ts`: `folderSums` as above, one walk over the entries, the folders of each from `folderPaths`
   (never a second split-by-`/` rule).
2. `FileTree.vue`: the optional `folder` slot after the label span of a folder row, props `{ path: row.path }`. The
   label span stays the tree's (one look for every window's folder label).
3. `FileList.vue`: forward `folder` to `FileTree`. With no `folder` content from the window (the merge window), a
   folder row renders as before — nothing visible added.
4. `RangeCounts.vue`: the `+a −r` pair moved out of `RangeFileRow.vue:49-56` (classes, colours, gap, tabular
   figures; formatted by `lineCounts`). `RangeFileRow.vue` uses it with its `ml-auto` rule unchanged; its look is
   unchanged. Props are yours.
5. `RangeApp.vue`: `folderSums(files)` once per file list (`computed`); in the `#folder` slot a folder with an entry
   shows `RangeCounts` at the row's right end (`ml-auto`, the same right edge as a file row's counts); one with no
   entry shows nothing.
6. `frontend/src/ui/AGENTS.md`: one short line under the range window: folder sums (plan §2 #125) — where they are
   built, the tree's `folder` slot, `RangeCounts.vue`.

## Acceptance

- Node, `rangeFolderSums.test.ts`: nested folders sum at every level (a file three folders deep counts in all
  three); a joined chain (`a/b/c/x.ts` alone under `a`) has the chain's sum at `a/b/c`, the key its folder row
  carries; a `notCounted` file beside counted ones adds nothing; a folder holding only `notCounted` files has no
  entry; a counted `+0 −0` file alone in a folder gives `{ added: 0, removed: 0 }`; a root-level file adds to no key.
  Your tests kill the mutants on your lines (Stryker, SP5).
- WebKit, fixture page (`just app-session start-fixture --range-case review`, MiniBrowser 1600×1000), tree view,
  dark **and** light: every folder row reads the sums in Facts (`public` none); each folder's numbers sit at the
  same right edge as the file rows' counts (bounding boxes' `right` within 1 px) with the same computed colours,
  font family and size; closing `src` keeps `+55 −64` on its row; the list view shows no folder rows and file rows
  read as before; a file row with a thread badge (`--threads seeded`) still shows badge then counts. At the narrowest
  list width a long folder label truncates while its counts stay whole. Screenshots pasted.
- WebKit, merge fixture page (`just app-session start-fixture`), tree view: folder rows show chevron, icon and label
  only, as before (screenshot + the folder rows' `textContent`).

Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`, `pnpm -C frontend fmt:check`.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
