# Slice range-reviewed-store — the window's reviewed source, marks, toggle and next file (no view yet)

Feature "Range reviewed" slice 3 of 4; needs `range-reviewed-app` committed with the regenerated `ipc/bindings.ts`.
Rules: `docs/slices/request-range-reviewed.md` rules 2, 3 (the count), 5, 6. Design:
`docs/slices/briefs/range-reviewed-design.md` option A (§1 items 3–4, "Window"). Plan rows: #48 (next file), #117,
proposed #195/#196. The `view` slice builds the button, the list marks and the since view on top of this one.

Facts (given):

- Generated (slice `app`): `commands.listReviewed() → Result<FileReview[], IpcError>`, `markReviewed(file)`,
  `unmarkReviewed(file) → null`, `loadSinceReview(file) → SinceReview`; `ReviewMark = "reviewed" | "changedSinceReview"`;
  `SinceReview = { kind: "texts"; reviewed; current; differences: Difference[] } | { kind: "noText" }`. No new `IpcError`
  kind.
- Sources: `ReviewSource.ts` (interface), `tauriReview.ts`, `fixtureReview.ts` (`createFixtureReview(log, search, start)`,
  `?range…&threads=seeded`) are the pattern; `RangeSource.ts:7-11` extends them; `tauriRange.ts:8-23`,
  `fixtureRange.ts:139-171` spread them; `compareDomain.ts:85` `toDifferences`; `domain.ts` is the only place brands are
  made (`isRangeFileId`), `ipc/AGENTS.md:1-5`.
- `rangeStore.ts` (297 lines; oxlint `max-lines` 300): `State`, `createRangeStore`, `showPath` (`:236-242`), `markShown`
  / `forget` / `MOUNTED_FILES` (the visited list, `:94,244-264`), `startUp` (`:266-278`), `loadFile` (`:280-290`: a failure
  forgets the view and reports `open`). `rangeThreads.ts` is the pattern for a store part with its own source calls and
  `problems` callback (`rangeStore.ts:155-170`).
- `ui/nextFile.ts:3-8` `nextUnresolved(files, active)` (#48), used by the merge store.
- `problem.ts:65-105` `Problem` union, `failureFields` (`:140-171`); `problemText.ts:100-153` words.
- Fixture `?range=review` file order (design §0): 0 `config`, 3 `docs/keys.md`, 5 `public/logo.png` (binary),
  7 `src/board/board.ts`, 13 files in all. app-session builds fixture URLs in `frontend/scripts/app-session/startArgs.ts:
  107-118` (`--range-case`, `--threads`), start-app's range in `startArgs.ts:56-67`, usage in `args.ts:20-31`.

## Target

Owned: `frontend/src/ipc/ReviewedSource.ts`, `frontend/src/ipc/reviewedDomain.ts`, `frontend/src/ipc/tauriReviewed.ts`,
`frontend/src/ipc/fixtureReviewed.ts` (all new) and their `*.test.ts`; `frontend/src/ipc/RangeSource.ts`,
`frontend/src/ipc/tauriRange.ts`, `frontend/src/ipc/tauriRange.test.ts`, `frontend/src/ipc/fixtureRange.ts`,
`frontend/src/ipc/fixtureRange.test.ts`, `frontend/src/ipc/index.ts`, `frontend/src/ipc/AGENTS.md`;
`frontend/src/ui/rangeReviewed.ts`, `frontend/src/ui/rangeVisited.ts` (new) and their tests; `frontend/src/ui/nextFile.ts`,
`frontend/src/ui/nextFile.test.ts`, `frontend/src/ui/problem.ts`, `frontend/src/ui/problem.test.ts`,
`frontend/src/ui/problemText.ts`, `frontend/src/ui/problemText.test.ts`, `frontend/src/ui/rangeStore.ts`,
`frontend/src/ui/rangeStore.test.ts`, `frontend/src/ui/rangeThreads.test.ts` (an import only);
`frontend/scripts/app-session/**`.

Read-only: everything else (`ipc/bindings.ts` generated; `ui/AGENTS.md` belongs to `view`: put your lines for it in
`deviations_from_brief`).

Non-goals: any `.vue` file, `useRangeController.ts`, `editor/`, `rangeText.ts` (slice `view`).

## Contract (fixed; you may add, never change)

```ts
// ipc/reviewedDomain.ts
export type ReviewMark = Generated.ReviewMark;                       // "reviewed" | "changedSinceReview"
export type ReviewMarks = ReadonlyMap<RangeFileId, ReviewMark>;      // a file not in it is unreviewed
export type SinceReview =
  | { readonly kind: "texts"; readonly reviewed: string; readonly current: string; readonly differences: readonly Difference[] }
  | { readonly kind: "noText" };
export function toReviewMarks(raw: readonly Generated.FileReview[]): ReviewMarks;   // ids through isRangeFileId; a repeat throws
export function toSinceReview(raw: Generated.SinceReview): SinceReview;             // differences through toDifferences

// ipc/ReviewedSource.ts — RangeSource extends SettingsSource, ReviewSource, ReviewedSource, MergeRequestSource
export interface ReviewedSource {
  listReviewed(): Promise<SourceResult<ReviewMarks>>;
  markReviewed(file: RangeFileId): Promise<SourceResult<null>>;
  unmarkReviewed(file: RangeFileId): Promise<SourceResult<null>>;
  loadSinceReview(file: RangeFileId): Promise<SourceResult<SinceReview>>;
}

// ui/nextFile.ts — #48's rule once; nextUnresolved keeps its signature and calls it
export function nextOpen<F extends { readonly path: string }>(
  files: readonly F[], active: string | null, done: (file: F) => boolean,
): string | null;

// ui/rangeReviewed.ts — the marks' one owner in the window (only writer: its own actions after Rust answered)
export type ReviewedStep = "list" | "mark" | "unmark" | "since";
export type RangeReviewed = {
  readonly marks: Readonly<ShallowRef<ReviewMarks>>;
  /** Rule 3's "N of M reviewed": `reviewed` counts only "reviewed" marks; `of` is the list's length. */
  readonly counted: ComputedRef<{ readonly reviewed: number; readonly of: number }>;
  /** True until the first list answers ok, and while a mark/unmark runs (one write at a time). */
  readonly busy: Readonly<ShallowRef<boolean>>;
  load(): Promise<void>;
  /** Rule 2: "reviewed" → unmark, stay; otherwise → mark, then show the next file in `start.files` order whose mark is
   *  not "reviewed" (wrapping, never itself; none → stay). Ignored while busy. */
  toggle(entry: RangeEntry): Promise<void>;
  /** Rule 6: forgets a mark; the file shows its whole change (the view derives it from `marks`). Ignored while busy. */
  reviewFromStart(entry: RangeEntry): Promise<void>;
  /** The since view's reply; a failure drops the file's view (as `loadFile`) and reports, answering null. */
  loadSince(entry: RangeEntry): Promise<SinceReview | null>;
};
export function createRangeReviewed(
  source: ReviewedSource,
  window: {
    readonly start: Readonly<ShallowRef<RangeStart | null>>;
    show(path: string): void;          // rangeStore's showPath
    forget(file: RangeFileId): void;   // rangeVisited's forget
    problems(problem: Problem): void;
  },
): RangeReviewed;

// ui/problem.ts — one new member
| { readonly action: "reviewed"; readonly step: ReviewedStep; readonly path: string | null; readonly cause: ProblemCause }
// problemText.ts words: list "Could not read the Reviewed marks", mark "Could not mark <path> reviewed",
// unmark "Could not unmark <path>", since "Could not show what changed in <path> since the review"

// ui/rangeStore.ts — RangeStore gains
readonly reviewed: RangeReviewed;
// startUp: after openRange succeeds, reviewed.load() runs beside threads.load() and gitlab.checkNow().
```

`rangeStore.ts` stays ≤ 300 lines: move the visited list (`MOUNTED_FILES`, `markShown`, `forget`) into
`ui/rangeVisited.ts` and update every importer (no re-export).

**Fixture** (`fixtureReviewed.ts`, `createFixtureReviewed(log, search, shown: Case)`; in memory, like threads):
`?range…` alone → no marks; `&reviewed=seeded` → `docs/keys.md` reviewed, `src/board/board.ts` changed since review, `public/logo.png`
changed since review. `loadSinceReview(board.ts)` = `texts` with `current` = the case's right text of board.ts,
`reviewed` = that text without its right lines 40–42 (0-based), `differences` = `[{ left: { start: 40, len: 0 }, right: {
start: 40, len: 3 } }]` (with the word fields the generated `Difference` needs, empty); `loadSinceReview(logo.png)` =
`noText`; any other file's since = `texts` of its own right text twice with no differences. `markReviewed` sets
`reviewed`, `unmarkReviewed` deletes; an id past the list → `UnknownRangeFile`. Another `reviewed=` value logs
`range.fixture_reviewed_miss { value }` and seeds nothing. Log `range.fixture_reviewed { kind, file }` per call.

**app-session**: `start-fixture --range-case <case> --reviewed seeded` adds `&reviewed=seeded` (only with `--range-case`);
`start-app --range <spec> --repo <dir> --review-of <project!iid>` passes `--review-of=<project!iid>` (only with `--range`).

## Change

1. ipc: domain, source interface, tauri and fixture sources, `RangeSource`/`tauriRange`/`fixtureRange` spreads, `index.ts`
   exports, `AGENTS.md` paragraph (the pattern of `ReviewSource`'s).
2. ui: `nextOpen` (+ `nextUnresolved` through it), `rangeVisited.ts`, `rangeReviewed.ts`, `problem.ts`/`problemText.ts`,
   `rangeStore.ts` wiring.
3. app-session: the two flags, their usage lines and refusals.

## Acceptance

- `nextFile.test.ts`: `next_open_wraps_skips_done_and_never_answers_the_active_file`, the existing `nextUnresolved` cases
  unchanged.
- `rangeReviewed.test.ts` (over the fixture source, `?range=review&reviewed=seeded` where useful):
  `marking_an_unreviewed_file_opens_the_next_not_reviewed_file_in_list_order`, `…_wraps_to_the_top`,
  `marking_the_last_unreviewed_file_stays`, `a_changed_since_review_file_counts_as_not_reviewed_for_the_next_file`,
  `unmarking_a_reviewed_file_stays_and_forgets_it`, `review_from_start_forgets_a_changed_mark`,
  `the_count_counts_only_reviewed_marks_of_every_listed_file`, `a_failed_mark_keeps_the_marks_and_reports_with_the_path`,
  `a_second_toggle_while_one_runs_is_ignored`, `busy_until_the_list_answers`, `a_failed_since_load_forgets_the_view_and_reports`.
- `rangeStore.test.ts`: start-up order gains `listReviewed` after `openRange`; the visited-list tests pass unchanged in
  expectations (imports from `rangeVisited.ts`).
- `reviewedDomain.test.ts`, `tauriReviewed.test.ts` (each command's call and conversion, a failure passed through),
  `fixtureReviewed.test.ts` (seeded marks, board.ts's since reply, logo's `noText`, mark/unmark, unknown id, a miss logged),
  `problemText.test.ts` (the four words), app-session `startArgs.test.ts` (both flags and their refusals).
- Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test` (node), `just mutants HEAD`.

## Skills

`skill://ts-conventions`, `skill://vue-conventions` (store parts), `skill://ipc-contract`, `skill://verification`.
