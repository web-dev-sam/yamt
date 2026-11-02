# Slice mr-row-details-core — exclude filters, count order, due days, people and labels in the page's core

Feature: merge-request row details (request `docs/slices/request-mr-row-details.md` rules 3, 4, 5, 6, 7, 9 and the
"Pure code" acceptance; design `docs/slices/briefs/mr-row-details-design.md` option A, §1.6, §1.7, §2.2; proposed plan
§2 #155–#156; owner answer 3: due merge requests first). Framework-free, pure, tested (PM3: `mergeRequests/` imports no
other `src/` module). Runs beside `mr-row-details-rust`; starts after the local conflict check has closed (cite
`internal/readiness.ts` by symbol).

## Target

Owned: `frontend/src/mergeRequests/**` (new files `internal/dueDate.ts`, `internal/people.ts`, `internal/labels.ts`
and their tests included).

Read-only: everything else. The callers in `ui/` and `ipc/` are `mr-row-details-state`'s and `mr-row-details-page`'s:
after this slice, `pnpm -C frontend typecheck` reports errors only in `ui/mergeRequests.ts`, `ui/mergeRequests.test.ts`,
`ui/mergeRequestFilters.ts`, `ui/mergeRequestFilters.test.ts`, `ui/MergeRequestFilter.vue`, `ui/MergeRequestsView.vue`,
`ui/MergeRequestRow.vue` and `ipc/` merge-request files (expected; list them in your report). `docs/**` is the docs
keeper's.

Non-goals: Draft exclusion (request non-goal); any `Intl` other than `en`; storage, timers, DOM.

## Contract

Fixed; existing exports not named here stay as they are. All types `readonly`.

```ts
// internal/filters.ts
export type Mode = "included" | "excluded";
export type Held<V> = { readonly value: V; readonly mode: Mode };
export type ChoiceState = "off" | Mode;
export type Filters = {
  readonly assignee: readonly Held<PersonValue>[];
  readonly reviewer: readonly Held<PersonValue>[];
  readonly label: readonly Held<LabelValue>[];
  readonly draft: DraftFilter;
};
export type ReviewState = "requested" | "reviewed" | "approved" | "changesRequested";
export type Person = { readonly username: string; readonly name: string }; // unchanged
export type Reviewer = { readonly person: Person; readonly state: ReviewState };
export type ListedLabel = { readonly title: string };
export type ListedRequest = {
  readonly iid: number;
  readonly createdAt: number;
  readonly draft: boolean;
  readonly assignees: readonly Person[];
  readonly reviewers: readonly Reviewer[];
  readonly labels: readonly ListedLabel[];
};
export function stateOf<V extends PersonValue | LabelValue>(
  held: readonly Held<V>[],
  value: V,
): ChoiceState;
/** Rule 7: off → included (click) / excluded (shift); included → off (click) / excluded (shift); excluded → off. */
export function clicked(
  filters: Filters,
  filter: ListFilter,
  value: PersonValue | LabelValue,
  shift: boolean,
): Filters;
// `toggled` is removed (clean cutover). A value never appears twice in a filter; a new value goes last, a changed one
// keeps its place.
export function passes(row: ListedRequest, filters: Filters, me: string | null): boolean;
// inside a filter: (no included value, or any included matches) and no excluded value matches; across: every filter.
// "None" excluded = has at least one; "Me" with me null matches nobody (as today).
export function filterLabel(filter: ListFilter, filters: Filters): string; // "Assignee: not Me, anna"; held order
// isFiltered, cleared, withDraft, filterName, filtered, NO_FILTERS, sameValue: same meaning over the new shape.

// internal/choices.ts
export type Choice<V> = {
  readonly value: V;
  readonly label: string;
  readonly count: number;
  readonly state: ChoiceState;
};
export function personChoices(
  rows: readonly ListedRequest[],
  field: "assignees" | "reviewers",
  me: string | null,
  held: readonly Held<PersonValue>[],
): readonly Choice<PersonValue>[];
export function labelChoices(
  rows: readonly ListedRequest[],
  held: readonly Held<LabelValue>[],
): readonly Choice<LabelValue>[];
// order (rule 9): "Me" (when me is known or Me is held), then "None"; then listed values by count, highest first,
// equal counts by label (localeCompare(…, "en")); then held values no longer listed (count 0), by label. Counts over
// every row given (plan §2 #135). Labels by title.

// internal/stored.ts — StoredFilters keeps its shape (string arrays + draft)
// words: included as today ("me" | "none" | "user:<username>"; "none" | "label:<title>"); excluded = "not:" + that word.
// filtersFrom reads old and new words, drops unknown ones and a second word for a value already read (first wins);
// storedFilters writes in held order.

// internal/order.ts
export function byDueDate<R extends { readonly iid: number; readonly createdAt: number }>(
  rows: readonly R[],
  dueOf: (iid: number) => CalendarDay | null,
): readonly R[];
// rows with a due day first, earliest first (so overdue first); equal days newest created first, then higher iid;
// then the rest in the order given. `merged` unchanged.

// internal/dueDate.ts (new)
export type CalendarDay = { readonly year: number; readonly month: number; readonly day: number }; // month 1–12
export function calendarDayFrom(text: string): CalendarDay | null; // "YYYY-MM-DD" naming a real day, else null
export function calendarDayText(day: CalendarDay): string; // "YYYY-MM-DD" (storage, <input type=date>)
export function compareDays(a: CalendarDay, b: CalendarDay): number;
export function dueDateText(day: CalendarDay): string; // Intl "en" dateStyle "medium": "Nov 9, 2026"
export function daysLeft(day: CalendarDay, now: number): number; // whole days from the local day of `now`
export function daysLeftText(days: number): { readonly text: string; readonly overdue: boolean };
// 0 "Due today"; 1 "1 day left"; n "n days left"; -1 "1 day overdue"; -n "n days overdue" (overdue true)

// internal/people.ts (new)
export const STACK_SHOWN = 3;
export function peopleStack(
  assignees: readonly Person[],
  reviewers: readonly Reviewer[],
): { readonly shown: readonly Person[]; readonly more: number }; // assignees, then reviewers not assigned
export function displayName(person: Person): string; // name, or the username when name is blank
export function initials(person: Person): string; // first letters of the first two words of the
// display name, upper-case; one letter for one word
export function pictureHue(username: string): number; // integer 0–359, same username same hue
export function reviewStateText(state: ReviewState): string; // "Review requested" | "Reviewed" | "Approved" |
// "Changes requested"
export function authorText(author: Person | null): string; // "Author: Anna Berg" | "Author: unknown"
export function approversText(approvers: readonly Person[]): string; // one display name per line; none: "No approvals"
export const NO_PEOPLE_TEXT = "No assignee or reviewer";
/** Whether GitLab's "Re-request review" applies (owner #2104): reviewed, approved or changes requested. */
export function reviewDone(state: ReviewState): boolean;

// internal/labels.ts (new)
export function labelsShown<L>(labels: readonly L[]): {
  readonly first: L | null;
  readonly rest: readonly L[];
};
export function moreText(count: number): string; // "+2" (labels and the people stack)
```

`index.ts` exports every name above (and stops exporting `toggled`).

## Change

1. `filters.ts`: the types, `stateOf`, `clicked`, `passes`, `filterLabel`, `isFiltered` over `Held`; `personMatches`
   takes the people of a row (`assignees`, or `reviewers`' persons).
2. `choices.ts`: `state` in place of `checked`; the count order.
3. `stored.ts`: the `not:` form both ways.
4. `order.ts`: `byDueDate`. `dueDate.ts`, `people.ts`, `labels.ts` as contracted.
5. Tests beside each; `AGENTS.md` of `mergeRequests/`: one line per new module and the stored words.

## Acceptance

- `pnpm -C frontend test -- src/mergeRequests` (node), each named for the bug it catches, at least:
  - `filters.test.ts`: rule 7's six transitions; `the_owners_example_not_me_and_label_x_keeps_only_those_rows`;
    `none_excluded_means_at_least_one`; `an_included_and_an_excluded_value_in_one_filter`; `filterLabel` "Assignee: not
    Me, anna".
  - `choices.test.ts`: `values_follow_their_count_then_their_name`, `me_and_none_stay_first_whatever_their_count`,
    `a_held_value_no_longer_listed_comes_last_with_count_0`, `an_excluded_value_reads_excluded`.
  - `stored.test.ts`: `old_words_read_as_included_and_unknown_words_are_dropped` (today's exact JSON from
    `ui/mergeRequests.test.ts` as input), `an_excluded_word_round_trips`, `a_value_stored_twice_reads_once`.
  - `dueDate.test.ts`: `days_left_changes_at_local_midnight` (23:59 and 00:00 local, with `TZ` set by the test file as
    the existing tests do or by building `now` from local `Date` parts), `days_left_across_month_and_year_ends`
    (Jan 31 → Feb 1, Feb 28/29 leap and not, Dec 31 → Jan 1), `a_daylight_saving_day_counts_once` (Europe/Berlin
    2026-03-29 and 2026-10-25 if the runner honours `TZ`, else the local-parts construction), the five word forms,
    `calendarDayFrom` refusing `2026-02-30`, `2026-13-01`, `26-1-1`, empty.
  - `order.test.ts`: `dated_rows_come_first_soonest_on_top_overdue_first`, `equal_days_newest_first`,
    `undated_rows_keep_their_order`.
  - `people.test.ts`: the stack (assignees first, an assigned reviewer once, 3 shown, `more`), initials, a blank name,
    `the_same_username_always_gets_the_same_hue` and two usernames differing, `approversText`, `authorText`,
    `only_a_done_review_can_be_re_requested` (`reviewDone` false for requested, true for the other three).
  - `labels.test.ts`: none, one, three; `moreText(2) === "+2"`.
- `pnpm -C frontend lint` (the `mergeRequests/` files clean), `pnpm -C frontend typecheck` (errors only in the files
  listed in Target): paste the summary and the error file list.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://ts-conventions`, `skill://risk-register` (RK55, RK56), `skill://verification`.
