# Final run — a folder row in the range window's tree shows the sum of its files' `+a −r`

Board "Folder sums" row 2 (session 34). Row 1 (`FolderSums`) is committed and accepted (notes
`.omp/run/notes/FolderSums.md`): `ui/rangeFolderSums.ts` `folderSums` (sums per folder path over `folderPaths`), an
optional `folder` slot after the tree's folder label (`FileTree.vue`, forwarded by `FileList.vue`; the merge window
passes none), `RangeCounts.vue` (the `+a −r` pair of the file and folder rows), `RangeApp.vue` filling the slot. Rules:
`docs/slices/request-folder-sums.md` and `docs/plan.md` §2 **#125** (read both whole). Read-only (VF6); you fix nothing
(VF1); alone. **No mutation run** (VF7, owner #1630): the patch had its own. Real-app sessions `v-fs-…`; scratch under
`/tmp/yamt-fs/verify/`. The owner's own yamt may be running: leave it alone; never `pkill`/`killall`.

Expected sums for `main...feature` of `scripts/range-repo.sh` (the fixture `?range` is generated from it): `data`
+1 −0; `docs` +4 −1; `public` none (only the binary `logo.png`); `src` +55 −64; `src/api` +0 −43; `src/board`
+55 −21; `tools` +2 −0; `vendor` +1 −1.

## Recipes

1. `just check` from the main checkout at HEAD. Any failure is `gate: fail` with its first 30 relevant lines.
2. WebKit, fixture page (`just app-session start-fixture --range-case review --threads seeded`, MiniBrowser 1600×1000),
   tree view, dark **and** light:
   a. Every folder row reads the expected sums; `public` shows none; each folder's numbers are each equal to the sum
   of the file rows below it (open every folder and add them up from the page).
   b. Folder counts sit at the same right edge as file rows' counts (bounding boxes' `right` within 1 px), in the same
   computed colours, font family and size.
   c. Close `src`: its row keeps `+55 −64`; reopen it: unchanged.
   d. The list view has no folder rows; file rows (with and without a thread badge) read as before.
3. Merge window, fixture page (`just app-session start-fixture`), tree view: folder rows show chevron, icon and label
   only. Compare with a screenshot from `310a20a` (the commit before row 1) if you can build it read-only in a scratch
   worktree under `/tmp/yamt-fs/verify/`; else describe what you observed.
4. Real app on a private X display (`cargo tauri build --debug --no-bundle`), repository from `scripts/range-repo.sh
   /tmp/yamt-fs/verify/repo`, `just app-session start-app --name v-fs --range main...feature --repo …`: the folder rows
   read the expected sums, dark and light; closing `src` keeps its sum.
5. Real app, a scratch repository with a joined chain, built with plain git under `/tmp/yamt-fs/verify/chain` without
   any user or system git config (`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1`, risk RK19): commit `a` holds
   `lib/core/util/one.ts` (10 lines), `lib/core/util/two.ts` (5 lines), `assets/logo.png` (a few binary bytes) and
   `README.md`; commit `b` changes 3 lines of `one.ts` (replace 1 of them, add 2), adds 2 lines to `two.ts`, changes
   `logo.png`'s bytes, and adds `lib/core/util/deep/three.ts` (4 lines). Open `--range a..b` (use the two commit ids or
   tags): the chain row `lib/core/util` is the only row for the chain and shows the sum of the file rows below it
   (+9 −1 if built as described: verify against the file rows shown); `deep` under it shows +4 −0; `assets` shows none.
6. Close (WM_DELETE_WINDOW) every app you started → exit status recorded.

## Report

`gate: pass|fail`, the `just check` result line, one observed value or screenshot path per step.
