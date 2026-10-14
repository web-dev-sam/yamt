# FileTreeView — 3.L-tree, round 1

Brief `docs/slices/briefs/3.L-tree-view.md`; plan §2 #61 (View, Tree, Icons). Transcript `history://FileTreeView`.

## Summary

- Header button: lucide `list` + "View as tree" (list), `list-tree` + "View as list" (tree); `@mousedown.prevent`
  keeps the keyboard. Header 40 px (`h-10`).
- `ui/fileListMode.ts` `createFileListMode(storage?)`: `useStorage` + serializer, key `yamt.files.view`, anything
  but `tree` → list, storage failures → one `files.view_storage_failed` warning, in-memory choice kept.
- `ui/fileTree.ts` `treeRows(files, closed)`, `folderPaths(path)`, `TreeRow`: folders first, `Intl.Collator`
  numeric/base with code-unit tie-break, compact chains, chained row keyed by its last folder.
- `ui/FileTree.vue` (new; props `{ rows, active }`, emits `select`, `toggle`): rows, chevrons, 8 px indent, guides
  in `--color-control-border` on hover (100 ms fade), ARIA tree roles.
- `FileList.vue`: panel, header button, width, mode, closed set (session), reveal watch on `active`.
- `ui/folderIcon.ts` `folderIcon(name, open)`, `FOLDER_ICON_ROWS` (56 types from the brief); `fileIcon.ts` now
  exports generic `iconTable`, `lookup`, `IconRow<T>`; `// oxfmt-ignore` above the folder table (first in repo).

## Evidence

- lint, typecheck, test (61 files / 673 tests), sfc-order, web-unused, fmt:check, map-check exit 0.
- WebKit fixture: header screenshot; tree with 11 level-1 rows sorted; focus stays in the left pane, ArrowDown
  steps; reload keeps tree (`localStorage` "tree"); back to list, same option texts.
- Real app (conflict-repo, Xvfb): rows exactly as the brief's 15 expected; `packages` before `packages-private/…`;
  icons asset/docs/package/src/generic; guides on hover only; closing `packages` hides its 4 rows; reveal after
  Mark resolved reopens `packages-private/sfc-playground/src`; restart keeps tree; owner's storage untouched.
  Screenshots `/tmp/tree-fx-*.png`, `/tmp/tree-app-*.png`.

## Deviations

- `folderIcon.ts`/`folderIcon.test.ts` instead of `fileIcon.ts` (approved: max-lines).
- `// oxfmt-ignore` on `FOLDER_ICON_ROWS` (188 vs ~401 lines).
- Reveal writes the closed set only when a holding folder is closed.

## Open risks

- `fileTree.ts:23` collator uses the system locale (tests assume ICU base order for ASCII).
- Reveal watch untested by unit tests (SFC); observed in the real app.
