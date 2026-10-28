# FolderSumsVerify — final run notes (session 34)

Brief `docs/slices/briefs/folder-sums-verify.md`; verifier alone, 6m21s + one follow-up step (3b). HEAD `7d9cdcf`
(product `b16885c`). rustc 1.99.0, node v26.13.0, pnpm 12.0.0; MiniBrowser through `just app-session`.

**Gate: pass.** `just check` exit 0 in 34.4 s (`map-check: ok`, `golden` 10 ok, `hooks-test` 17 pass). No mutation run.

1. `just check`: pass.
2. WebKit `?range` review, threads seeded, 1600×1000, dark and light: `data +1−0`, `docs +4−1`, `public` none,
   `src +55−64`, `api +0−43`, `board +55−21`, `tools +2−0`, `vendor +1−1`, each equal to its file rows added up; every
   count `right=231`; dark `rgb(120,191,123)`/`rgb(246,107,113)`, light `rgb(32,138,60)`/`rgb(229,82,48)`, `system-ui`
   13px; `src` closed and reopened keeps `+55−64`; list view 0 folder rows, file rows as before (badge then counts).
   Theme switched through `data-theme` from page JS. Screenshots `/tmp/yamt-fs/verify/fx-*.png`.
3. Merge fixture page: no folders (12 level-1 files), nothing to compare. 3b, real app `--fresh-repo`, tree, dark and
   light: every folder row's children are `span.flex.size-4`, `svg`, `span.truncate` (+ the indent guide when nested),
   text the bare label, joined chains included (`compiler-core/src/transforms`). `merge-app-tree-{dark,light}.png`.
4. Real app on `scripts/range-repo.sh` `main...feature`: the same sums, dark and light, right edge 231; `src` closed
   keeps its sum. `app-tree-{dark,light}.png`.
5. Scratch repo with a chain (`--range a..b`, no user/system git config): numstat `- - assets/logo.png`, `4 0
   deep/three.ts`, `3 1 one.ts`, `2 0 two.ts`; tree `assets` none, `lib/core/util +9−1` (one row), `deep +4−0`.
   `chain-tree-{dark,light}.png`.
6. Closed: fixture and step-4/3b sessions by `app-session stop`; WM_DELETE_WINDOW on direct runs of both repos: `exit=0`
   each. One direct launch without `GDK_BACKEND=x11` may have shown on the owner's desktop; ended by SIGTERM (#1666).
