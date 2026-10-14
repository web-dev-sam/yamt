# FileTreeViewR1 — 3.L-tree, rework 1 (#812–#817)

Brief `docs/slices/briefs/3.L-tree-view-rework-1.md`; commit `a1b492d`. Transcript `history://FileTreeViewR1`.

- #815: fileTree, folderIcon, fileIcon tests are top-level `test()`; grep for `describe(`/`it(`/`oxfmt-ignore` in
  `src/ui` empty.
- #813: new `ui/iconTable.ts` (`IconTable<T>`, `IconRow<T>` = `[icon, names: string]`, `iconTable`, `lookup`,
  `nameKey`), no vue import; `fileIcon.ts` 288, `folderIcon.ts` 247 lines.
- #812: both tables `[icon, "space separated names"]`, split once in `iconTable`; no pragma; every name kept
  (folder 288/288 compared by script).
- #817: `folderIcon(path, open)` uses `nameKey`; FileTree passes `row.path`.
- #816: `revealed(closed, path)` in fileTree.ts, same set object when nothing opens; FileList's watch writes only
  on change; 4 tests.
- #814: `rowStart(depth)` → `rowPadding`, `guideLeft` in FileTree.vue's script.
- Evidence: lint, typecheck, test (62 files / 694), fmt:check, sfc-order, web-unused, map-check exit 0. Stryker on the
  four files: fileIcon 100, folderIcon 100, iconTable 100, fileTree 93.81 (6 survivors/no-cov on round-1 lines,
  judged equivalent: equal sibling names impossible, Map re-set, `noUncheckedIndexedAccess` guard). WebKit fixture:
  11 tree rows sorted, file icons identical in tree and list, button round trip.
- Open: reveal watch and `folderIcon(row.path)` not exercised in a running window this round (unit-tested).
