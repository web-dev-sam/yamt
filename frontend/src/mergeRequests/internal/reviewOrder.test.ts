import { expect, test } from "vitest";

import {
  calendarDayFrom,
  reviewFailedText,
  reviewOrdered,
  reviewSortedText,
  turnText,
  type CalendarDay,
  type OpenDiscussion,
  type Person,
  type ReviewDetails,
  type ReviewOrder,
  type Viewer,
} from "../index";

type Row = { readonly iid: number; readonly createdAt: number; readonly author: Person | null };
type Details = ReviewDetails<string>;

const SAM: Person = { username: "sam", name: "Sam Lee" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const DMITRI: Person = { username: "dmitri", name: "Dmitri Volkov" };
const NONE: Details = { kind: "none" };
const LOADING: Details = { kind: "loading" };
const ME: Viewer = { kind: "me", username: "sam" };
const AS_ANNA: Viewer = { kind: "person", username: "anna", name: "Anna Berg" };

function rows(...iids: readonly number[]): readonly Row[] {
  return iids.map((iid) => ({ iid, createdAt: iid, author: DMITRI }));
}

/** A discussion its writers wrote in turn, oldest first. */
function talk(first: Person | null, ...rest: readonly (Person | null)[]): OpenDiscussion {
  const said = [first, ...rest].map((author) => ({ author, mentions: [] }));
  const last = said.pop() ?? { author: first, mentions: [] };
  return { place: { kind: "overview" }, earlier: said, last: { ...last, createdAt: 0, text: "" } };
}

/** On dmitri's merge request: sam's turn and the author's for anna (sam started it, anna answered). */
const SAMS = talk(SAM, ANNA);
/** The author's turn for sam (sam answered last) and anna's turn (she started it). */
const AUTHORS = talk(ANNA, SAM);

function read(...discussions: readonly OpenDiscussion[]): Details {
  return { kind: "read", discussions };
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
    details: { 1: read(SAMS, AUTHORS), 2: read(SAMS), 3: read(SAMS) },
  };
  expect(iids(rows(3, 2, 1), "sam", setup)).toEqual([1, 3, 2]);
});

test("equal_due_days_with_the_reviewers_turn_keep_newest_first", () => {
  const setup: Setup = {
    due: { 1: "2026-11-02", 2: "2026-11-02", 3: "2026-11-01" },
    details: { 1: read(SAMS), 2: read(SAMS, AUTHORS, AUTHORS), 3: read(AUTHORS) },
  };
  expect(iids(rows(3, 2, 1), "sam", setup)).toEqual([2, 1, 3]);
  expect(iids(rows(1, 2, 3), "sam", setup)).toEqual([2, 1, 3]);
});

test("a_due_row_without_the_reviewers_turn_sorts_with_the_rest", () => {
  const setup: Setup = {
    due: { 3: "2026-11-01", 1: "2026-11-04" },
    details: { 3: read(AUTHORS), 1: read(SAMS) },
  };
  expect(iids(rows(3, 2, 1), "sam", setup)).toEqual([1, 2, 3]);
});

test("the_rest_sort_by_fewest_waiting_on_the_author", () => {
  const setup: Setup = {
    details: { 4: read(AUTHORS, AUTHORS), 3: read(SAMS, SAMS, SAMS), 2: read(AUTHORS, SAMS) },
  };
  expect(iids(rows(4, 3, 2, 1), "sam", setup)).toEqual([3, 1, 2, 4]);
});

test("ties_among_the_rest_keep_the_normal_order_due_first_then_newest", () => {
  const setup: Setup = {
    due: { 1: "2026-11-03", 3: "2026-11-02" },
    details: { 1: read(AUTHORS), 2: read(SAMS, AUTHORS), 3: read(AUTHORS), 4: read(AUTHORS) },
  };
  expect(iids(rows(4, 3, 2, 1), "sam", setup)).toEqual([3, 1, 4, 2]);
});

test("another_reviewer_gets_their_own_turns_and_waits", () => {
  const setup: Setup = {
    due: { 1: "2026-11-01", 2: "2026-11-02" },
    details: { 1: read(SAMS), 2: read(AUTHORS), 3: read(AUTHORS, AUTHORS), 4: read(SAMS) },
  };
  expect(iids(rows(4, 3, 2, 1), "sam", setup)).toEqual([1, 4, 2, 3]);
  expect(iids(rows(4, 3, 2, 1), "anna", setup)).toEqual([2, 3, 1, 4]);
});

test("no_reviewer_has_no_turn_so_nothing_comes_first", () => {
  const setup: Setup = {
    due: { 1: "2026-11-02", 2: "2026-11-01" },
    details: { 1: read(SAMS), 2: read(AUTHORS) },
  };
  expect(iids(rows(2, 1), "sam", setup)).toEqual([1, 2]);
  expect(iids(rows(2, 1), null, setup)).toEqual([2, 1]);
});

test("b5_review_order_counts_authors_turns_as_waiting_on_the_author", () => {
  const answered = talk(ANNA, DMITRI);
  const listed: readonly Row[] = [
    { iid: 4, createdAt: 4, author: ANNA },
    { iid: 3, createdAt: 3, author: null },
    { iid: 2, createdAt: 2, author: DMITRI },
    { iid: 1, createdAt: 1, author: DMITRI },
  ];
  const setup: Setup = {
    details: {
      4: read(answered),
      3: read(talk(DMITRI)),
      2: read(answered, talk(DMITRI), talk(DMITRI)),
      1: read(AUTHORS),
    },
  };
  expect(iids(listed, "sam", setup)).toEqual([2, 4, 3, 1]);
});

test("rows_not_arrived_sort_as_none_and_are_counted_loading", () => {
  const setup: Setup = {
    due: { 1: "2026-11-03", 2: "2026-11-02", 3: "2026-11-01" },
    details: { 4: LOADING, 3: LOADING, 1: read(SAMS), 5: read(AUTHORS) },
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
      2: read(SAMS),
      3: { kind: "failed", failure: "b" },
      4: { kind: "failed", failure: "a" },
    },
  };
  expect(ordered(rows(4, 3, 2, 1), "sam", setup)).toEqual({
    kind: "failed",
    rows: rows(1, 3, 2, 4),
    row: { iid: 3, createdAt: 3, author: DMITRI },
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

test.each<[string, Viewer]>([
  ["me", ME],
  ["a named reviewer", AS_ANNA],
  ["a reviewer named by a lowercase username", { kind: "person", username: "ben", name: "ben" }],
])("the review words name %s as the turn words do", (_case, viewer) => {
  const possessive = turnText({ kind: "viewer" }, viewer).replace(/ turn$/u, "");
  const inside = viewer.kind === "me" ? possessive.toLowerCase() : possessive;
  expect(reviewSortedText(viewer, 0)).toMatch(new RegExp(`^Sorted for ${inside} review: `, "u"));
  expect(reviewFailedText(viewer, 1, "")).toMatch(
    new RegExp(`^Not sorted for ${inside} review: `, "u"),
  );
});
