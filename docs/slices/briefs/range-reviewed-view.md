# Slice range-reviewed-view — the Reviewed button, the list marks, the count and the since-review view (wires the window)

Feature "Range reviewed" slice 4 of 4; needs `range-reviewed-store` committed. **This slice wires the window**: the smoke
pass (`range-reviewed-verify.md` steps B and C) runs once it is committed. Rules: `docs/slices/request-range-reviewed.md`
rules 1, 2, 3, 5, 6, 7 (read it whole). Design: `docs/slices/briefs/range-reviewed-design.md` option A (§1 items 3–4,
"Window") and proposed plan #196 (the words and defaults). Plan rows: #48 (the button's look), #106, #126, #145.

Facts (given):

- `RangeView.vue:67-111` header (icon, heading, mode note, Previous, Next, collapse toggle `aria-pressed`, then Send,
  merge requests, settings); columns' headings `:114-126` (`sideHeading`); `useSearchGoTo(search, shown, path, goTo)`
  `:43-48`; `RangeThreadLayer` `:133`.
- "Mark resolved" (`MergeToolbar.vue:176-188`): first, `mr-2 rounded border px-3.5 py-1 disabled:pointer-events-none`,
  filled `border-primary bg-primary text-on-primary hover:brightness-110`, outlined `border-control-border hover:bg-hover`.
  The merge count: `<span class="ml-3 text-fg-muted" role="status">` (`MergeToolbar.vue:204`).
- `RangeApp.vue:105-118` fills `FileList`'s `#file` slot with `RangeFileRow :file :label :threads`; `:126-134` mounts one
  `RangeView` per visited file keyed by `file.id`. `FileMark.vue:17-45`: resolved = lucide `check`, name `text-fg-muted`.
- `RangeFileRow.vue:27-50`: letter, label, old path, thread count (`ml-auto`), `RangeCounts`.
- `useRangeController.ts`: `RangeParts { path, load: () => Promise<RangeFile | null>, hosts, preferences, collapsed,
  threads, listed, events, build }` (`:54-69`); `land` (`:81-96`) turns a `RangeFile` into `{ kind: "columns", note }` or
  `{ kind: "sentence", text: fileSentence(file) }`; `build` passes `RangeOptions { preferences, collapsed, threads }`
  (`:109-113`); `rangeThreadParts` (`:197-213`); `useRangeController(file, hosts, { preferences })` (`:215-230`).
- `editor/range.ts`: `RangeOptions` (`:40-44`), `#pressed` starts a drag on a number press (`:153-162`), callers
  `range.browser.test.ts:24,130`, `rangeThreads.browser.test.ts:214`, `useRangeController.ts:109,228`.
- From `range-reviewed-store` (its Contract, fixed): `store.reviewed: RangeReviewed` (`marks`, `counted`, `busy`, `toggle`,
  `reviewFromStart`, `loadSince`), `ReviewMark`, `SinceReview` from `../ipc`.
- `pnpm -C frontend test:browser` cannot launch Playwright's WebKit on this host (#1242): browser tests are written and
  run by the verifier through MiniBrowser (`just webdriver`); say so in `acceptance_not_run` if you cannot run them.

## Target

Owned: `frontend/src/editor/range.ts`, `frontend/src/editor/range.browser.test.ts`,
`frontend/src/editor/rangeThreads.browser.test.ts`, `frontend/src/ui/useRangeController.ts`,
`frontend/src/ui/useRangeController.test.ts`, `frontend/src/ui/RangeView.vue`, `frontend/src/ui/RangeApp.vue`,
`frontend/src/ui/RangeFileRow.vue`, `frontend/src/ui/rangeText.ts`, `frontend/src/ui/rangeText.test.ts`,
`frontend/src/ui/AGENTS.md`.

Read-only: everything else (the store slice's files; `FileList.vue`/`FileTree.vue` stay generic and unchanged).

Non-goals: threads in the since view (rule 7: none shown, none started); a temporary whole/since switch (rule 6: none);
any Rust; marks in the merge or compare windows.

## Contract (fixed; you may add, never change)

```ts
// editor/range.ts
export type RangeOptions = {
  readonly preferences: Preferences;
  readonly collapsed: boolean;
  readonly threads: readonly ShownThread[];
  /** False in the since-review view: a press on a line number starts no drag and no thread (rule 7). */
  readonly startsThreads: boolean;
};

// ui/useRangeController.ts
export type RangeViewKind = "whole" | "sinceReview"; // derived from the mark: "sinceReview" iff "changedSinceReview"
export type RangeShown =
  | {
      readonly kind: "texts";
      readonly left: string;
      readonly right: string;
      readonly differences: readonly Difference[];
      readonly note: string | null;
    }
  | { readonly kind: "sentence"; readonly text: string };
// RangeParts.load: () => Promise<RangeShown | null>; RangeParts gains `startsThreads: boolean`.
export function wholeShown(file: RangeFile): RangeShown; // today's `land` rule (modeNote / fileSentence)
export function sinceShown(since: SinceReview): RangeShown; // texts: left = reviewed, right = current, note null;
// noText: sentence SINCE_NO_TEXT
export function useRangeController(
  file: RangeEntry,
  hosts: HostRefs<HTMLDivElement, SVGSVGElement>,
  options: { readonly preferences: MaybeRefOrGetter<Preferences>; readonly view: RangeViewKind },
): RangeHandle;
// "whole": as today (store.loadFile, the file's threads, startsThreads true).
// "sinceReview": load = store.reviewed.loadSince(file) → sinceShown; threads: () => []; listed: () => true;
//                events from rangeThreadParts (never fired: no threads, no drag); startsThreads false.

// ui/rangeText.ts — the words (plan #196)
export const REVIEWED_LABEL = "Reviewed";
export const REVIEW_FROM_START_LABEL = "Review from start";
export const SINCE_REVIEW_NOTE = "Changed since you reviewed it";
export const SINCE_REVIEW_HEADING = "As you reviewed it"; // the since view's left column heading
export const SINCE_NO_TEXT =
  "This file changed since you reviewed it, and one of the two versions is not text. Review from start shows the whole change.";
export function reviewedCount(counted: { reviewed: number; of: number }): string; // "3 of 13 reviewed"
export const REVIEW_MARK_WORDS: Readonly<Record<ReviewMark, string>> = {
  reviewed: "reviewed",
  changedSinceReview: "changed since reviewed",
};
```

## Change

1. `editor/range.ts`: `startsThreads`; `#pressed` with `startsThreads: false` starts no drag (a badge press cannot happen:
   no threads). Update both browser tests' options.
2. `useRangeController.ts`: `RangeShown`, `wholeShown`, `sinceShown`, the `view` option; `land` takes a `RangeShown`.
3. `RangeView.vue` (prop `view: RangeViewKind`):
   - First in the header: the **Reviewed** button — MergeToolbar's "Mark resolved" classes, filled when
     `marks.get(file.id) === "reviewed"` (`aria-pressed` true), outlined otherwise; `disabled` while `reviewed.busy`;
     `@mousedown.prevent`; click → `reviewed.toggle(file)`.
   - After the collapse toggle: `<span class="ml-3 text-fg-muted" role="status">{{ reviewedCount(counted) }}</span>`.
   - `view === "sinceReview"`: after the heading, `SINCE_REVIEW_NOTE` (muted) and an outlined **Review from start**
     button (`border-control-border hover:bg-hover`, disabled while busy) → `reviewed.reviewFromStart(file)`; the left
     column heading `SINCE_REVIEW_HEADING` (no subject title); no `RangeThreadLayer`; a search go-to whose `pane` is
     `"left"` is taken without moving (the reviewed text is not what the search read; plan #196), a `"right"` one goes
     to its match as today.
4. `RangeApp.vue`: `viewOf(file)` from `reviewed.marks`; `RangeView :key="`${file.id}:${viewOf(file)}`" :view`; the row
   gets `:review="reviewed.marks.value.get(file.id) ?? null"`.
5. `RangeFileRow.vue` (prop `review: ReviewMark | null`): reviewed → the name `text-fg-muted` and a lucide `check`
   (`size-3.5`, `text-fg-muted`); changed since review → lucide `refresh-ccw-dot` (`size-3.5`, `text-problem-warning`);
   each `role="img"` with `title`/`aria-label` from `REVIEW_MARK_WORDS`, `shrink-0`, at the row's end after the counts.
   Verify the icon exists in `@iconify-json/lucide` (else pick the nearest per `skill://vue-conventions` and report it).
6. `ui/AGENTS.md`: the range root's reviewed paragraph (store lines from `range-reviewed-store`'s report included).

## Acceptance

- `useRangeController.test.ts`: `a_since_review_view_loads_load_since_review_and_shows_reviewed_left_current_right`,
  `a_since_review_view_shows_no_threads_and_builds_with_starts_threads_false`,
  `a_no_text_since_reply_is_the_since_sentence`, `the_whole_view_is_unchanged` (existing cases pass unedited but for the
  `load` shape).
- `rangeText.test.ts`: `reviewedCount` ("0 of 13 reviewed", "13 of 13 reviewed") and the mark words.
- `range.browser.test.ts`: `a_number_drag_starts_no_thread_when_starts_threads_is_false` (and the existing drag case with
  `true`).
- Smoke on the fixture (`just app-session start-fixture --name rv --range-case review --reviewed seeded --size 1600x1000`):
  `docs/keys.md` row shows the check and a muted name, `src/board/board.ts` and `public/logo.png` the changed mark; header
  "1 of 13 reviewed"; board.ts shows "As you reviewed it" left, three added lines at right 41–43, no thread boxes, a drag
  over its numbers starts no draft; logo.png shows `SINCE_NO_TEXT`; on `config` Reviewed → `config` checked, `data/big.txt`
  opens; "Review from start" on board.ts → the whole change with the seeded threads, no mark. Dark and light.
- Commands: `pnpm -C frontend typecheck`, `pnpm -C frontend lint`, `pnpm -C frontend test`, `just mutants HEAD` (`editor/`
  is not mutated).

## Skills

`skill://cm6-rules` (`editor/range.ts`), `skill://vue-conventions`, `skill://ts-conventions`, `skill://verification`.
