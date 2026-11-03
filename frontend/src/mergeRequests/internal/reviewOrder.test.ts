import { expect, test } from "vitest";

import {
  calendarDayFrom,
  reviewFailedText,
  reviewOrdered,
  reviewSortedText,
  type CalendarDay,
  type OpenDiscussion,
  type Person,
  type ReviewDetails,
  type ReviewOrder,
  type Viewer,
} from "../index";

type Row = { readonly iid: number; readonly createdAt: number };
type Details = ReviewDetails<string>;

const SAM: Person = { username: "sam", name: "Sam Lee" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const NONE: Details = { kind: "none" };
const LOADING: Details = { kind: "loading" };
const ME: Viewer = { kind: "me", username: "sam" };
const AS_ANNA: Viewer = { kind: "person", username: "anna", name: "Anna Berg" };

function rows(...iids: readonly number[]): readonly Row[] {
  return iids.map((iid) => ({ iid, createdAt: iid }));
}

function lastBy(author: Person | null): OpenDiscussion {
  return { place: { kind: "overview" }, last: { author, createdAt: 0, text: "" } };
}

function read(...authors: readonly (Person | null)[]): Details {
  return { kind: "read", discussions: authors.map(lastBy) };
}

type Setup = {
  readonly due?: Readonly<Record<number, string>>;
  readonly details?: Readonly<Record<number, Details>>;
};

function ordered(
  listed: readonly Row[],
  reviewer: string | null,
  { due = {}, details = {} }: Setup,
): ReviewOrder<Row, string> {
  return reviewOrdered(
    listed,
    reviewer,
    (iid): CalendarDay | null => calendarDayFrom(due[iid] ?? ""),
    (iid) => details[iid] ?? NONE,
  );
}

function iids(listed: readonly Row[], reviewer: string | null, setup: Setup): readonly number[] {
  const order = ordered(listed, reviewer, setup);
  if (order.kind !== "sorted") {
    throw new Error(`not sorted: ${JSON.stringify(order)}`);
  }
  return order.rows.map((row) => row.iid);
}

test("due_rows_with_the_reviewers_turn_come_first_soonest_first", () => {
  const setup: Setup = {
    due: { 1: "2026-11-01", 3: "2026-11-05" },
    details: { 1: read(ANNA, SAM), 2: read(ANNA), 3: read(ANNA) },
  };
  expect(iids(rows(3, 2, 1), "sam", setup)).toEqual([1, 3, 2]);
});

test("equal_due_days_with_the_reviewers_turn_keep_newest_first", () => {
  const setup: Setup = {
    due: { 1: "2026-11-02", 2: "2026-11-02", 3: "2026-11-01" },
    details: { 1: read(ANNA), 2: read(ANNA, SAM, SAM), 3: read(SAM) },
  };
  expect(iids(rows(3, 2, 1), "sam", setup)).toEqual([2, 1, 3]);
  expect(iids(rows(1, 2, 3), "sam", setup)).toEqual([2, 1, 3]);
});

test("a_due_row_without_the_reviewers_turn_sorts_with_the_rest", () => {
  const setup: Setup = {
    due: { 3: "2026-11-01", 1: "2026-11-04" },
    details: { 3: read(SAM), 1: read(ANNA) },
  };
  expect(iids(rows(3, 2, 1), "sam", setup)).toEqual([1, 2, 3]);
});

test("the_rest_sort_by_fewest_waiting_on_the_author", () => {
  const setup: Setup = {
    details: { 4: read(SAM, SAM), 3: read(ANNA, ANNA, ANNA), 2: read(SAM, ANNA) },
  };
  expect(iids(rows(4, 3, 2, 1), "sam", setup)).toEqual([3, 1, 2, 4]);
});

test("ties_among_the_rest_keep_the_normal_order_due_first_then_newest", () => {
  const setup: Setup = {
    due: { 1: "2026-11-03", 3: "2026-11-02" },
    details: { 1: read(SAM), 2: read(ANNA, SAM), 3: read(SAM), 4: read(SAM) },
  };
  expect(iids(rows(4, 3, 2, 1), "sam", setup)).toEqual([3, 1, 4, 2]);
});

test("another_reviewer_gets_their_own_turns_and_waits", () => {
  const setup: Setup = {
    due: { 1: "2026-11-01", 2: "2026-11-02" },
    details: { 1: read(ANNA), 2: read(SAM), 3: read(SAM, SAM), 4: read(ANNA) },
  };
  expect(iids(rows(4, 3, 2, 1), "sam", setup)).toEqual([1, 4, 2, 3]);
  expect(iids(rows(4, 3, 2, 1), "anna", setup)).toEqual([2, 3, 1, 4]);
});

test("an_unknown_author_counts_as_the_reviewers_turn", () => {
  const setup: Setup = {
    due: { 1: "2026-11-02", 2: "2026-11-01" },
    details: { 1: read(null), 2: read(SAM) },
  };
  expect(iids(rows(2, 1), "sam", setup)).toEqual([1, 2]);
  expect(iids(rows(2, 1), null, { ...setup, details: { 2: read(SAM) } })).toEqual([2, 1]);
  expect(iids(rows(2, 1), null, setup)).toEqual([2, 1]);
});

test("rows_not_arrived_sort_as_none_and_are_counted_loading", () => {
  const setup: Setup = {
    due: { 1: "2026-11-03", 2: "2026-11-02", 3: "2026-11-01" },
    details: { 4: LOADING, 3: LOADING, 1: read(ANNA), 5: read(SAM) },
  };
  expect(ordered(rows(5, 4, 3, 2, 1), "sam", setup)).toEqual({
    kind: "sorted",
    rows: rows(1, 3, 2, 4, 5),
    loading: 2,
  });
  expect(ordered(rows(2, 1), "sam", setup)).toEqual({
    kind: "sorted",
    rows: rows(1, 2),
    loading: 0,
  });
});

test("a_failed_row_keeps_the_normal_order_and_is_named", () => {
  const setup: Setup = {
    due: { 1: "2026-11-01", 3: "2026-11-02", 2: "2026-11-03" },
    details: {
      1: LOADING,
      2: read(ANNA),
      3: { kind: "failed", failure: "b" },
      4: { kind: "failed", failure: "a" },
    },
  };
  expect(ordered(rows(4, 3, 2, 1), "sam", setup)).toEqual({
    kind: "failed",
    rows: rows(1, 3, 2, 4),
    row: { iid: 3, createdAt: 3 },
    failure: "b",
  });
});

test("the sorted words speak for me or name the reviewer", () => {
  expect(reviewSortedText(ME, 0)).toBe(
    "Sorted for your review: due with your turn first, then fewest waiting on the author",
  );
  expect(reviewSortedText({ kind: "me", username: null }, 0)).toBe(reviewSortedText(ME, 0));
  expect(reviewSortedText(AS_ANNA, 0)).toBe(
    "Sorted for Anna Berg's review: due with their turn first, then fewest waiting on the author",
  );
});

test("the sorted words say how many rows are still loading, singular and plural", () => {
  expect(reviewSortedText(ME, 1)).toBe(
    "Sorted for your review: due with your turn first, then fewest waiting on the author (the discussions of 1 merge request are still loading; it moves when they arrive)",
  );
  expect(reviewSortedText(AS_ANNA, 3)).toBe(
    "Sorted for Anna Berg's review: due with their turn first, then fewest waiting on the author (the discussions of 3 merge requests are still loading; they move when they arrive)",
  );
});

test("the failed words name the row and the reason", () => {
  expect(reviewFailedText(ME, 633, "glab failed: 500")).toBe(
    "Not sorted for your review: the discussions of !633 could not be read. glab failed: 500",
  );
  expect(reviewFailedText(AS_ANNA, 615, "glab failed: 500")).toBe(
    "Not sorted for Anna Berg's review: the discussions of !615 could not be read. glab failed: 500",
  );
});
