# Slice mr-review-mode-core — the review order, review mode in the remembered filters, the box's viewer

Feature: review mode on the merge-request page. Sources:

- Request `docs/slices/request-mr-review-mode.md`: rules 2, 3, 5, 6, 7, and the acceptance "Core tests for the
  order (rule 3 every step, ties, a reviewer other than Me) and for Clear filters dropping it".
- Design `docs/slices/briefs/mr-review-mode-design.md` option A, §1.1–1.8.
- Proposed plan §2 #165, #166; proposed RK62, RK63.

No other slice needs to land first; this is wave 1. **Why this slice also owns window state:** the core's two
signature changes (`Filters.review`, the viewer in the turn words) break `ui/MergeRequestDiscussions.vue` and two test
literals, and rule 5 changes that same box (design §4). So this slice leaves the tree green on its own. It adds no
button: review mode is reachable through the stored filters until `mr-review-mode-page` lands.

## Target

**Owned:**

- `frontend/src/mergeRequests/**` (core: `internal/filters.ts`, `stored.ts`, `choices.ts`, `discussions.ts`, new
  `internal/reviewOrder.ts`, their tests, `index.ts`, `AGENTS.md`).
- `frontend/src/ui/`: `mergeRequestFilters.ts`, `mergeRequestFilters.test.ts`, `mergeRequestsShown.ts`,
  `mergeRequests.ts`, `mergeRequests.test.ts`, `mergeRequestDiscussions.ts`, `MergeRequestDiscussions.vue`,
  `mergeRequestsText.ts`, `mergeRequestsText.test.ts`.
- `frontend/src/ipc/fixtureMergeRequestData.test.ts`: only its `Filters` literal (`:70-75`) gains `review: null`.

**Read-only:**

- Every other file. In particular:
  - `ui/MergeRequestsView.vue`, `ui/MergeRequestFilter.vue` and `ui/menuKeys.ts` belong to the page slice.
  - `ipc/**` except the one test above.
  - `ui/mergeRequestDueDates.ts`, `ui/windowStorage.ts`, `ui/problemText.ts`, `ui/AGENTS.md`.
  - `docs/**`.

**Non-goals:**

- The review-mode button, the picker, the sort icon and the view's wiring (page slice).
- Fixture data changes (page slice).
- Other sort choices, and sorting outside review mode.
- Assigning reviewers, notifications, a reviewer not on any loaded merge request.
- Any Rust or IPC change (design §1.8: none needed).

## Contract

Existing and used as is:

- `byDueDate`, `merged`, `compareDays`, `CalendarDay` (`order.ts`, `dueDate.ts`).
- `turnCounts(open, viewer)`, `discussionTurns(open, viewer)`, `displayName`, `personChoices`, `Choice`, `narrowed`,
  `sameValue`, `PersonValue`, `Held`, `ListedRequest`, `OpenDiscussion`.
- `DiscussionLoad`, `Discussions`, `DiscussionDetails`, `MergeRequestIid`.
- `glabRefusalText`, `problemText`.
- The slice's `discussionDetails` dependency (`ui/mergeRequests.ts:75`).

New (fixed for the page slice; you may add, never change):

```ts
// mergeRequests/internal/filters.ts
/** Review mode's reviewer (request-mr-review-mode rule 1): the logged-in user or a person, never "None". */
export type ReviewFor = Exclude<PersonValue, { readonly kind: "none" }>;
export type Filters = {
  readonly assignee: readonly Held<PersonValue>[];
  readonly reviewer: readonly Held<PersonValue>[];
  readonly label: readonly Held<LabelValue>[];
  readonly draft: DraftFilter;
  /** Rules 2–3: whose review order the shown rows follow; null: the normal order. */
  readonly review: ReviewFor | null;
};
export const NO_FILTERS: Filters; // review: null
/** Rule 2: Reviewer = who (included), Draft = ready, every other filter off, the order for who. */
export function reviewing(who: ReviewFor): Filters;
// isFiltered(filters): also true when only `review` is set.

// mergeRequests/internal/stored.ts
export type StoredFilters = {
  readonly assignee: readonly string[];
  readonly reviewer: readonly string[];
  readonly label: readonly string[];
  readonly draft: DraftFilter;
  /** "me" | "user:<username>"; the key is absent while review mode is off. */
  readonly review?: string;
};
// filtersFrom: `review` read by personFrom's words; "none", junk or a non-string → null.
// storedFilters: writes `review` only when not null; the four keys exactly as today.

// mergeRequests/internal/discussions.ts
/** Whose turn the box and the review order speak for (request-mr-discussions rule 3, review-mode rule 5). */
export type Viewer =
  | { readonly kind: "me"; readonly username: string | null }
  | { readonly kind: "person"; readonly username: string; readonly name: string };
/** null or Me → me; a person whose username is `me` → me; else the person, named by displayName of the first row
 *  reviewer with that username, else the username. */
export function viewerOf(review: ReviewFor | null, me: string | null, rows: readonly ListedRequest[]): Viewer;
export function turnText(turn: Turn, viewer: Viewer): string;
//   viewer turn: me "Your turn", person "<name>'s turn"; waiting: "Waiting for an answer" for both.
export function turnSummaryText(counts: TurnCounts, viewer: Viewer): string;
//   total 0 "No open discussions"; else "<n> of <total> waits|wait for you" / "… for <name>" (waits when n === 1).

// mergeRequests/internal/reviewOrder.ts (new)
/** A row's discussion details as the review order reads them (rule 6). */
export type ReviewDetails<F> =
  | { readonly kind: "none" } // never asked: no open discussion
  | { readonly kind: "loading" } // asked, not arrived: sorts as none
  | { readonly kind: "read"; readonly discussions: readonly OpenDiscussion[] }
  | { readonly kind: "failed"; readonly failure: F };
export type ReviewOrder<R, F> =
  | { readonly kind: "sorted"; readonly rows: readonly R[]; readonly loading: number }
  | { readonly kind: "failed"; readonly rows: readonly R[]; readonly row: R; readonly failure: F };
/** Rule 3 for `reviewer` (a username; null: nobody). `rows` in the list's order (newest first). */
export function reviewOrdered<R extends { readonly iid: number; readonly createdAt: number }, F>(
  rows: readonly R[],
  reviewer: string | null,
  dueOf: (iid: number) => CalendarDay | null,
  detailsOf: (iid: number) => ReviewDetails<F>,
): ReviewOrder<R, F>;
export function reviewSortedText(viewer: Viewer, loading: number): string;
export function reviewFailedText(viewer: Viewer, iid: number, reason: string): string;

// mergeRequests/internal/choices.ts
/** Rule 1's picker: `reviewerChoices` (personChoices of "reviewers") without "None", in its order; the chosen
 *  reviewer `included`, every other `off`. */
export function reviewChoices(
  reviewerChoices: readonly Choice<PersonValue>[],
  review: ReviewFor | null,
): readonly Choice<ReviewFor>[];
```

`index.ts` exports all of the above (`reviewing`, `ReviewFor`, `Viewer`, `viewerOf`, `ReviewDetails`, `ReviewOrder`,
`reviewOrdered`, `reviewSortedText`, `reviewFailedText`, `reviewChoices`).

**The order (`reviewOrdered`):**

1. `normal = byDueDate(rows, dueOf)`.
2. The first row of `normal` whose details are `failed` → `{ kind: "failed", rows: normal, row, failure }`.
3. Else each row's counts: `turnCounts(discussions, reviewer)` for `read`, and `{ viewersTurn: 0, waiting: 0 }` for
   `none` and `loading`.
4. `first = dueOf(iid) !== null && viewersTurn > 0`.
5. `rows = normal.toSorted(…)`: `first` rows before the rest; between two `first` rows 0, keeping the normal order
   (soonest day, equal days newest first); between two others `a.waiting - b.waiting`.
6. `loading` is the number of `loading` rows. Return `{ kind: "sorted", rows, loading }`.

**Words** (exact):

- `reviewSortedText`:
  - me: `Sorted for your review: due with your turn first, then fewest waiting on the author`
  - person: `Sorted for <name>'s review: due with their turn first, then fewest waiting on the author`
  - `loading > 0` appends ` (the discussions of 1 merge request are still loading; it moves when they arrive)` or
    ` (the discussions of <n> merge requests are still loading; they move when they arrive)`.
- `reviewFailedText`:
  - me: `Not sorted for your review: the discussions of !<iid> could not be read. <reason>`
  - person: `Not sorted for <name>'s review: the discussions of !<iid> could not be read. <reason>`

```ts
// ui/mergeRequestDiscussions.ts
export type DiscussionFailure = Extract<DiscussionLoad, { readonly kind: "refused" | "failed" }>;

// ui/mergeRequestsText.ts
export const REVIEW_MODE = "Review mode";
/** Why a row's discussions are missing: refused → glabRefusalText(answer); failed → problemText at step
 *  "discussions". Shared by the discussions box and the review order's icon. */
export function discussionsFailedText(failure: DiscussionFailure, platform: string): string;

// ui/mergeRequestFilters.ts
export type Choices = Readonly<{
  assignee: readonly Choice<PersonValue>[];
  reviewer: readonly Choice<PersonValue>[];
  label: readonly Choice<LabelValue>[];
  /** Rule 1's picker: reviewChoices(reviewer, filters.review). */
  review: readonly Choice<ReviewFor>[];
}>;
export type FilterActions = {
  click(filter: ListFilter, value: PersonValue | LabelValue, shift: boolean): void;
  setDraft(draft: DraftFilter): void;
  clear(filter: ListFilter): void;
  clearAll(): void;
  /** Rule 2: replaces the filters with reviewing(who). */
  review(who: ReviewFor): void;
};
export function createRememberedFilters(
  repository: Readonly<Ref<string | null>>,
  reviewable: () => boolean, // rule 7: details load fully
  storage?: StorageLike,
): RememberedFilters;
//   filters: read per repository; `review` read as null while !reviewable().
//   When reviewable() turns false while the stored entry holds a review, the entry is written once without it
//   (Reviewer, Draft and the rest kept); it does not come back with "Load fully".

// ui/mergeRequestsShown.ts
export type ReviewSort =
  | { readonly kind: "sorted"; readonly loading: number }
  | { readonly kind: "failed"; readonly iid: MergeRequestIid; readonly failure: DiscussionFailure };
export type Shown = FilterActions & {
  readonly filters: Readonly<Ref<Filters>>;
  readonly shownRows: ComputedRef<readonly MergeRequestRow[]>;
  readonly choices: ComputedRef<Choices>;
  readonly summary: ComputedRef<string>;
  /** Rule 5: viewerOf(filters.review, me, rows). */
  readonly viewer: ComputedRef<Viewer>;
  /** The review order's state for the sort icon; null while the order is off (no review, or details not "full"). */
  readonly reviewSort: ComputedRef<ReviewSort | null>;
};
// Listed (shownOf's input) gains `discussionDetails: () => DiscussionDetails` and
// `discussionQueue: Pick<Discussions, "discussions">`; the slice's State already has both.
// shownRows and reviewSort come from one computed: review null → datedFirst(passing), sort null; else
// reviewOrdered(passing, viewer.username, due date of the iid, the entry mapped: undefined → none, loading → loading,
// read → read, refused | failed → failed { failure: the entry }).
```

`MergeRequestDiscussions.vue`:

- Reads `viewer` instead of `me`: `discussionTurns(…, viewer.username)`, `turnCounts(…, viewer.username)`,
  `turnText(turn, viewer)`, `turnSummaryText(counts, viewer)`.
- Its header for `refused`/`failed` is `discussionsFailedText(entry, navigator.platform)`.
- Nothing else changes.

## Change

1. **Core.**
   1. `filters.ts`: `ReviewFor`, `Filters.review`, `NO_FILTERS`, `reviewing`, and `isFiltered`.
   2. `stored.ts`: the fifth key.
   3. `discussions.ts`: `Viewer`, `viewerOf`, and the words with the viewer.
   4. New `reviewOrder.ts`.
   5. `choices.ts`: `reviewChoices`.
   6. `index.ts`; then the tests below. Fix the `Filters` literals the new field breaks in the core's own tests and
      in `ipc/fixtureMergeRequestData.test.ts`.
2. **Texts.** `ui/mergeRequestDiscussions.ts`: `DiscussionFailure`. `ui/mergeRequestsText.ts`: `REVIEW_MODE` and
   `discussionsFailedText` (+ test).
3. **Remembered filters.** `ui/mergeRequestFilters.ts`: the `reviewable` gate, the one write on leaving "full",
   `review(who)`, `Choices.review` (+ test; its `FILTERS` literal gains `review: null`).
4. **Shown rows.** `ui/mergeRequestsShown.ts`: `reviewable = () => discussionDetails() === "full"` passed to
   `createRememberedFilters`; `viewer`; the one computed for `shownRows` and `reviewSort`. In
   `ui/mergeRequests.ts`, only what the types require.
5. **The box.** `MergeRequestDiscussions.vue`: the viewer and `discussionsFailedText`.
6. **Notes.** `mergeRequests/AGENTS.md`: the review order, `ReviewFor`, the stored `review` word, `Viewer` and the
   words. Put the `ui/` lines for the page slice's `ui/AGENTS.md` in `deviations_from_brief`.

## Acceptance

**Vitest (core)**, each test named for the bug it catches:

- `reviewOrder.test.ts`:
  - `due_rows_with_the_reviewers_turn_come_first_soonest_first`: an older-created row due sooner comes before a newer
    one due later.
  - `equal_due_days_with_the_reviewers_turn_keep_newest_first`.
  - `a_due_row_without_the_reviewers_turn_sorts_with_the_rest`.
  - `the_rest_sort_by_fewest_waiting_on_the_author`.
  - `ties_among_the_rest_keep_the_normal_order_due_first_then_newest`.
  - `another_reviewer_gets_their_own_turns_and_waits`: the same rows give different orders for "sam" and "anna".
  - `an_unknown_author_counts_as_the_reviewers_turn`.
  - `rows_not_arrived_sort_as_none_and_are_counted_loading` (`none` is not counted).
  - `a_failed_row_keeps_the_normal_order_and_is_named` (the first failed row in normal order, even after a loading
    one).
  - The words: me, person, loading 1 and 3, failed.
- `filters.test.ts`:
  - `reviewing_replaces_every_filter_with_reviewer_and_ready`.
  - `a_filter_edit_keeps_the_review_order` (`clicked`, `withDraft`, `cleared`).
  - `no_filters_has_no_review_order`.
  - `review_alone_counts_as_filtered`.
- `stored.test.ts`:
  - `review_is_stored_as_me_or_user_word_only_while_on`.
  - `the_stored_form_keeps_the_four_fields_older_yamt_reads`: the output's other keys are exactly today's for the same
    filters.
  - `a_review_word_none_or_junk_reads_as_off`.
  - A round trip for Me and a person.
- `choices.test.ts`: `the_picker_lists_me_then_the_reviewer_filters_people_without_none`, with the chosen one
  included; a held missing person keeps its place.
- `discussions.test.ts`:
  - `the_turn_words_name_another_reviewer`.
  - `viewer_of_a_person_who_is_me_is_me`.
  - `viewer_name_is_the_display_name_else_the_username`.
  - The summary's singular and plural for a person.

**Vitest (state):**

- `mergeRequestFilters.test.ts`:
  - `leaving_load_fully_turns_the_review_order_off_and_keeps_its_filters` (RK62): the stored entry has no `review`
    afterwards, and returning to "full" does not bring it back.
  - `the_review_order_reads_as_off_while_details_are_not_full`.
  - `review_sets_reviewer_and_ready_and_stores_the_review_word`.
- `mergeRequests.test.ts` (the slice rig, `mode` ref):
  - `review_mode_orders_the_shown_rows_and_a_late_answer_moves_them` (rule 6, an answer settles and the order changes).
  - `clear_filters_returns_the_normal_order_and_the_viewer_me`.
  - `the_viewer_follows_review_mode`.
  - `a_failed_row_leaves_the_normal_order_with_reviewSort_failed`.
  - `review_mode_comes_back_on_a_new_slice_over_the_same_storage` (reload).
- `mergeRequestsText.test.ts`: `discussionsFailedText` for each refused kind and for an IPC failure.

**Commands:**

- `pnpm -C frontend lint`, `typecheck`, `test` (including `fences.test.ts`, PM3: the core imports nothing from
  `src/`; PM10): summary lines.
- `just map-check`: list its findings (the new `reviewOrder.ts`) for the docs keeper.

**WebKit smoke on the fixture.** The page has no button yet, so set the stored filters by hand. Fixture data is as
today: discussion 1 is sam's, and !633 fails.

Start with `just app-session start-fixture --name rmc --diff --mr list --size 1600x1000`.

1. Write the stored state, then reload with `read "setTimeout(() => location.reload(), 0)"`:
   ```
   read "localStorage.setItem('yamt.mergeRequests.filters', JSON.stringify({'/home/sam/taskboard/.git': {assignee: [], reviewer: ['user:anna'], label: [], draft: 'ready', review: 'user:anna'}})); localStorage.setItem('yamt.mergeRequests.dueDates', JSON.stringify({'/home/sam/taskboard/.git': {'602': '2026-11-06', '622': '2026-11-01'}}))"
   ```
2. Click "Merge requests". The filters read "Reviewer: anna" and Draft "Ready". Read the rows' `!iid` in order:
   `!602 !622 !632 !630 !617 !612` (the normal order would be `!622 !602 !632 !630 !617 !612`).
3. Hover !632's discussions count. The header reads "2 of 2 wait for Anna Berg", and both lines read
   "Anna Berg's turn".
4. Click "Clear filters". The 40 rows return in the normal order, !632's box reads "2 of 2 wait for you" and
   "Your turn", and `localStorage` holds no entry for the repository.
5. Repeat step 1. Then Settings → Discussion details → Load lazily → Back.
   - The rows are `!622 !602 !632 !630 !617 !612`, with Reviewer and Ready kept.
   - The stored entry has no `review`.
   - Settings → Load fully → Back: still the normal order.
6. Write `review: 'me', reviewer: ['me']` and reload. !633 fails in today's fixture, so the rows keep the normal order
   (rule 6).

`shot` after step 2, and `just app-session stop --name rmc`.

**Mutation:** `just mutants HEAD` in your workspace (SP11). The run refuses more than 30 `.ts` files; this slice's
changed non-test `.ts` are about 10.

## Skills

`skill://ts-conventions`, `skill://vue-conventions` (the box), `skill://comment-policy`, `skill://risk-register`
(proposed RK62, RK63), `skill://verification`.
