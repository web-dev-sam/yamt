# Slice sidebar-next-file-web — next file in the sidebar's order; "left to review" total

Request `docs/slices/request-sidebar-next-file.md` (rules 1–5, non-goals, acceptance; read it whole); plan §2 **#201**
(amends #48, #196). Base: main `868bd1a8`. Web only; no IPC change.

## Facts (given)

- `ui/nextFile.ts`: `nextOpen(files, active, done)` (wrapping, skips done files and the active one, none → null) and
  `nextUnresolved(files, active)`. Callers: `ui/rangeReviewed.ts` `mark` (:95, over `window.start.value.files`) and
  `ui/opening.ts` `moveOn` (:67, over the merge window's `state.files`), which Mark resolved, Keep, Delete and Take
  left/right reach.
- `ui/FileList.vue` (shared by `App.vue`, the merge window, and `RangeApp.vue`) calls `createFileListMode()` itself
  (:19) — the mode lives inside the component, so no store can read it. List view renders `files` in the given order;
  tree view renders `fileTree.ts` `treeRows(files, closed)`: folders first, then files, each by `compareNames`, a
  single-child chain joined. A change of `active` already opens the folders above it (`revealed`, :29–37).
- `ui/fileListMode.ts`: `createFileListMode(storage?)` → `{ mode, toggle }`, persisted under `yamt.files.view`.
- `ui/rangeFolderSums.ts` sums git counts (`folderSums`) and finds reviewed folders (`reviewedFolders`) over
  `ReviewMarks` (a file is reviewed only when its mark is `"reviewed"`).
- `ui/RangeCounts.vue` renders `rangeText.ts` `lineCounts` coloured (success / error); nothing for `notCounted`.
- Words live in `ui/rangeText.ts` (`FOLDER_REVIEWED_WORD` is the pattern for a title + aria-label word).

## Target

**Owned:** `frontend/src/ui/{nextFile,nextFile.test,fileTree,fileTree.test,fileListMode,fileListMode.test,
rangeReviewed,rangeReviewed.test,opening,rangeStore,rangeStore.test,store,store.test,rangeFolderSums,
rangeFolderSums.test,rangeText,rangeText.test}.ts`, `frontend/src/ui/{FileList,App,RangeApp,RangeCounts}.vue`,
`frontend/src/ui/AGENTS.md`; a new `*.test.ts` beside any of these when a rule needs one (e.g. `opening.test.ts`).

**Read-only:** everything else (`FileTree.vue`, `RangeFileRow.vue`, `ipc/**`, fixtures). Doc lines outside
`ui/AGENTS.md` go in `deviations_from_brief`.

**Non-goals:** the request's non-goals; Rust; the compare window (it has no file list).

## Contract (fixed; you may add, never change)

```ts
// ui/fileTree.ts — the one order rule (rule 1)
export function sidebarOrder<F extends ListedFile>(
  files: readonly F[],
  mode: FileListMode,
): readonly F[];
//   "list" → files as given; "tree" → the file rows of the tree with every folder open, in row order

// ui/rangeFolderSums.ts — rule 3/4
export function leftToReview(
  files: readonly Pick<RangeEntry, "id" | "lines">[],
  marks: ReviewMarks,
): RangeLineCounts; // Σ counted lines of files whose mark is not "reviewed"; none counted → { kind: "notCounted" }

// ui/rangeText.ts
export const LEFT_TO_REVIEW_WORD = "left to review";
```

- **One mode owner per window:** each window store (`store.ts`, `rangeStore.ts`) calls `createFileListMode()` once and
  exposes it; `FileList.vue` gets the mode as a prop and asks for the toggle by an event — it no longer calls
  `createFileListMode`. The next-file rule of that window reads the same mode (no second instance: two refs drift).
- Both next-file callers walk `sidebarOrder(files, mode)`; `nextOpen`'s wrap/skip rules unchanged.
- The total: an optional named slot in `FileList.vue`'s heading, rendered immediately left of the toggle button;
  `RangeApp.vue` fills it with the total of `leftToReview(files, marks)`, muted (`text-fg-muted`, not the file rows'
  colours — e.g. a `muted` prop on `RangeCounts.vue`), `title` and `aria-label` `LEFT_TO_REVIEW_WORD`, nothing rendered
  for `notCounted`. `App.vue` passes no slot (rule 5). `RangeApp.vue` stays a composition surface (VU16): the sum is
  a `computed` over the helper, no logic in the template.

## Change

1. `sidebarOrder` in `fileTree.ts` reusing `treeRows` (never a second sort).
2. Mode lifted into both stores; `FileList.vue` prop + toggle event; `App.vue`/`RangeApp.vue` wire them.
3. `rangeReviewed.ts` `mark` and `opening.ts` `moveOn` walk `sidebarOrder(…, mode)`; their window types gain what they
   need to read the mode.
4. `leftToReview`, the muted total in the heading slot, `LEFT_TO_REVIEW_WORD`.
5. `ui/AGENTS.md`: the order rule, the mode's owners, the total.

## Acceptance

- Unit tests that fail on today's code: `sidebarOrder` tree order differs from list order (e.g. `a.txt`, `b/x.txt`,
  `c.txt` → tree `b/x.txt`, `a.txt`, `c.txt`; a joined chain; root files after folders); Reviewed in tree mode moves to
  the next tree row, wrapping; a merge-window move-on in tree mode goes to the next unresolved tree row; switching the
  mode switches the order; `leftToReview` skips `"reviewed"`, counts `"changedSinceReview"` and unmarked, ignores
  `notCounted`, all reviewed → `notCounted`.
- `pnpm -C frontend typecheck`, `lint`, `fmt:check`, `test` clean; `just web-unused`, `just sfc-order`, `just
  arch-check` clean.
- `just mutants HEAD`: every surviving mutant on a new line killed or reasoned.
- WebKit fixture (`just app-session start-fixture --name sn --range-case review --reviewed seeded`): the total sits
  left of the toggle, muted in dark and light, hovers "left to review", drops by a file's counts on Reviewed and
  returns on unmark. Shots dark + light. The real-app order checks are the smoke pass's.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
