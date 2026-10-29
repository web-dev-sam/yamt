# FolderSums — notes (session 34)

Slice brief `docs/slices/briefs/folder-sums.md`; web-impl, isolated, 7m35s. Patch `b16885c` (base `310a20a`),
`.omp/run/patches/FolderSums.patch`; 8 files, +143 −14.

## Summary (implementer)

- `ui/rangeFolderSums.ts` `folderSums`: one walk over the entries, folders from `folderPaths`, keyed by the path a
  folder row carries (a joined chain's deepest folder included); `notCounted` adds nothing.
- `FileTree.vue`: optional `folder` slot after a folder row's label; `FileList.vue` forwards it only when the window
  gives one (`<template v-if="$slots.folder" #folder>`), so the merge window passes nothing.
- `RangeCounts.vue` (`lines: RangeLineCounts`, formatted by `lineCounts`): the `+a −r` pair, moved out of
  `RangeFileRow.vue`; `ml-auto` from the user.
- `RangeApp.vue`: `sums = computed(() => folderSums(files))`; `folderLines(path)` → entry or `{ kind: "notCounted" }`;
  `<RangeCounts class="ml-auto">` in `#folder`.
- `frontend/src/ui/AGENTS.md`: one line (plan §2 #125).

## Tests (`rangeFolderSums.test.ts`)

Three folders deep counts at every level; a joined chain `a/b/c` has the chain's sum at its key; `notCounted` beside
counted adds nothing; only-`notCounted` folder has no entry; a `+0 −0` file gives zeros; a root file adds to no key.

## Evidence (implementer)

- typecheck, lint, test (201 files, 2744 tests), fmt:check, knip: clean. Stryker on `rangeFolderSums.ts`: 16 killed,
  0 survived.
- WebKit `?range` 1600×1000, tree: `data+1−0`, `docs+4−1`, `public` none, `src+55−64`, `api+0−43`, `board+55−21`,
  `tools+2−0`, `vendor+1−1`. Dark and light: folder (7) and file (12) counts all `right=231`, same colours
  (dark `rgb(120,191,123)`/`rgb(246,107,113)`, light `rgb(32,138,60)`/`rgb(229,82,48)`), `system-ui` 13px
  tabular-nums. `src` closed keeps `+55−64`. Aside 160px: a lengthened label truncates, counts whole, right 151 for
  folder and file. List view: 0 folder rows. Threads seeded: badge 149–172 then counts 180–231.
- Merge: fixture page has no folders (goldens are flat); real app `--fresh-repo` tree: folder rows' children are the
  chevron box, icon, `span.truncate` only (joined chains too). Screenshots `/tmp/folder-sums/*.png`.

## Deviations (accepted)

1. Merge-window check in the real app (fixture page has no folders).
2. `RangeCounts` props `{ lines }` (props were the implementer's).
3. `folderLines` maps a missing entry to `notCounted` (a folder with no counted file reads as such a file, rule 2).
4. Long-label truncation checked by editing a label in the page (no long folder name in the fixture).

## Open risks (implementer)

- A folder row's accessible name now includes its counts (`src+55−64`), as file rows' names already do; a script
  clicking a range folder by its bare name no longer matches.
- Joined chain not seen in the real range window; the final run's scratch repository covers it.

## Reviews (round 1)

- Mutation run `just mutants 310a20a`: `rangeFolderSums.ts` 16 killed, 0 survived.
- Boundary (`FolderSumsBoundary`): pass, no findings (ownership, contract word for word, one folder rule through
  `folderPaths`, one `+a −r` look, no range data in `TreeRow`, PM9 edges, naming, VU order).
- Correctness (`FolderSumsCorrectness`): pass; one nit #1665 (`folderLines`' `notCounted` stand-in), dropped under
  OR12: every folder row holds a file, so no entry means every file below is `notCounted`, as rule 2 equates them.
