# Request — a folder in the diff window's tree shows the sum of its files' changed lines

Settled with the owner on 2026-10-28 (session 32); details by the orchestrator as owner (OR13). A design may refine a
detail it names, never reopen a rule. Facts: `.omp/run/notes/PlanScoutRangeList.md` part (A) (path:line at main
`15ab31c`). "Diff mode" is the range window (`yamt --diff=<a>..<b>`): the only window whose files carry line counts.

## Owner's words

- "for diff mode: show the sum of changes for a folder (sum of all subfiles/subfolders)"

## Rules

1. **Folder counts.** In the range window's tree view, every folder row shows `+a −r` at its right end, in the same
   colours, font and place as a file row's counts (`RangeFileRow.vue:50-55`, `rangeText.ts:63-66`): `a` and `r` are
   the sums of git's counts (#104) over every file below the folder, at any depth.
2. **Uncounted files add nothing.** A binary file or a type change (`RangeLineCounts::NotCounted`,
   `crates/range/src/entries.rs:135-139`) adds nothing; a folder with no counted file below it shows no counts, as
   such a file shows none.
3. **Joined folders** (a chain of single folders shown as one row, `fileTree.ts:62-75`, e.g. `src/ui/parts`) show the
   sum of the deepest folder, which is the chain's.
4. **Open or closed** alike: a closed folder shows its sum too.
5. A renamed file counts under the folders of its new path (the row it sits in).
6. **Unchanged**: list view (no folder rows); the merge window's tree (its files carry no counts, so its folder rows
   stay as they are); file rows; the thread badge (no thread count per folder).

## Acceptance

WebKit fixture (`?range`) and the real app on `scripts/range-repo.sh`: each folder row's numbers equal the sums of
the file rows below it, nested folders included; a folder holding only the binary file shows none; a joined chain
shows one sum; closing a folder keeps its sum; the merge window's tree looks as before. The pure sum is tested
(nested folders, a joined chain, an uncounted file, a folder with only uncounted files). `just check` passes; dark and
light.

## Non-goals

Counts in list view; thread counts per folder; counts in the merge window; abbreviating big numbers.

## Slice graph (proposal; the session's orchestrator refines it)

| row | slice                                                                                                                                           | owner    | owns (coarse)                                                                                         | needs |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- | ----- |
| 1   | folder counts: a `folder` slot in the generic tree (merge window passes none, so its rows stay as they are), the pure sum, the range folder row | web-impl | `ui/FileTree.vue`, `ui/FileList.vue`, `ui/RangeApp.vue`, a range-side sum module and row, their tests | —     |
| 2   | final run: `just check`, WebKit, real app                                                                                                       | verifier | —                                                                                                     | 1     |

Seam (fact): a folder row carries the deepest folder's full path (`fileTree.ts:72-75`), so a map from folder path to
sums built once from the entries answers every row, joined chains included. The tree today has only a `file` slot
(`FileTree.vue:12,82-83`; `FileList.vue:15`). The window-wide search (`request-search.md`) later puts a panel above this
list: this feature lands first so the two never edit `FileList.vue` at once.
