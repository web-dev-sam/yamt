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

/** On dmitri's merge request: sam's turn, sam wrote in it; anna wrote last, so the author's turn for her. */
const SAMS = talk(SAM, ANNA);
/** Sam wrote last, so the author's turn for him, sam wrote in it; anna's turn (she started it). */
const AUTHORS = talk(ANNA, SAM);
/** The author answered anna: anna's turn, sam never wrote in it. */
const OTHERS = talk(ANNA, DMITRI);

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

test("review_order_d1_soonest_due_first_even_above_more_waiting", () => {
  const setup: Setup = {
    due: { 3: "2026-11-05", 1: "2026-11-01" },
    details: { 3: read(OTHERS), 2: read(SAMS, SAMS, SAMS), 1: read(SAMS) },
  };
  expect(iids(rows(3, 2, 1), "sam", setup)).toEqual([1, 3, 2]);
});

test("review_order_d1_an_overdue_day_is_above_todays", () => {
  const today = "2026-11-05";
  const overdue = "2026-10-30";
  const setup: Setup = {
    due: { 2: today, 1: overdue },
    details: { 2: read(SAMS, SAMS), 1: read(OTHERS) },
  };
  expect(iids(rows(2, 1), "sam", setup)).toEqual([1, 2]);
});

test("review_order_d2_more_waiting_first_within_one_day", () => {
  const setup: Setup = {
    due: { 1: "2026-11-02", 2: "2026-11-02", 3: "2026-11-02" },
    details: {
      1: read(SAMS),
      2: read(SAMS, SAMS),
      3: read(OTHERS),
      4: read(SAMS),
      5: read(SAMS, SAMS, SAMS),
    },
  };
  expect(iids(rows(5, 4, 3, 2, 1), "sam", setup)).toEqual([2, 1, 3, 5, 4]);
});

test("review_order_d3_fewer_written_in_first_within_equal_d1_and_d2", () => {
  const setup: Setup = {
    details: {
      4: read(SAMS, AUTHORS, AUTHORS),
      3: read(SAMS, AUTHORS),
      2: read(SAMS, OTHERS),
      1: read(SAMS),
      5: read(OTHERS),
    },
  };
  expect(iids(rows(5, 4, 3, 2, 1), "sam", setup)).toEqual([2, 1, 3, 4, 5]);
});

test("review_order_d4_a_full_tie_keeps_newest_first", () => {
  const setup: Setup = {
    due: { 1: "2026-11-02", 2: "2026-11-02", 3: "2026-11-02" },
    details: { 1: read(SAMS), 2: read(SAMS), 3: read(SAMS), 4: read(SAMS), 5: read(SAMS) },
  };
  expect(iids(rows(1, 2, 3, 5, 4), "sam", setup)).toEqual([3, 2, 1, 5, 4]);
});

test("review_order_another_reviewer_changes_d2_and_d3", () => {
  const setup: Setup = {
    details: { 4: read(AUTHORS, SAMS), 3: read(OTHERS), 2: read(SAMS), 1: read(AUTHORS) },
  };
  expect(iids(rows(4, 3, 2, 1), "sam", setup)).toEqual([2, 4, 3, 1]);
  expect(iids(rows(4, 3, 2, 1), "anna", setup)).toEqual([3, 1, 4, 2]);
});

test("review_order_no_reviewer_keeps_the_normal_order", () => {
  const setup: Setup = { details: { 1: read(SAMS), 2: read(AUTHORS) } };
  expect(iids(rows(2, 1), "sam", setup)).toEqual([1, 2]);
  expect(iids(rows(2, 1), null, setup)).toEqual([2, 1]);
});

test("review_order_the_rows_author_weighs_the_turn", () => {
  const listed: readonly Row[] = [
    { iid: 3, createdAt: 3, author: null },
    { iid: 2, createdAt: 2, author: DMITRI },
    { iid: 1, createdAt: 1, author: SAM },
  ];
  const setup: Setup = {
    details: { 3: read(talk(ANNA)), 2: read(talk(ANNA)), 1: read(talk(ANNA)) },
  };
  expect(iids(listed, "sam", setup)).toEqual([1, 3, 2]);
});

test("review_order_loading_rows_count_zero_and_zero_and_are_counted", () => {
  const setup: Setup = {
    due: { 1: "2026-11-03", 2: "2026-11-02", 3: "2026-11-01" },
    details: { 4: LOADING, 3: LOADING, 1: read(SAMS), 5: read(AUTHORS) },
  };
  expect(ordered(rows(5, 4, 3, 2, 1), "sam", setup)).toEqual({
    kind: "sorted",
    rows: rows(3, 2, 1, 4, 5),
    loading: 2,
  });
  expect(ordered(rows(2, 1), "sam", setup)).toEqual({
    kind: "sorted",
    rows: rows(2, 1),
    loading: 0,
  });
});

test("review_order_a_failed_row_keeps_the_normal_order_and_is_named", () => {
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

test("review_order_d5_words_speak_for_me_or_name_the_reviewer", () => {
  expect(reviewSortedText(ME, 0)).toBe(
    "Sorted for your review: soonest due date first, then most discussions waiting for you, then fewest discussions you wrote in",
  );
  expect(reviewSortedText({ kind: "me", username: null }, 0)).toBe(reviewSortedText(ME, 0));
  expect(reviewSortedText(AS_ANNA, 0)).toBe(
    "Sorted for Anna Berg's review: soonest due date first, then most discussions waiting for Anna Berg, then fewest discussions Anna Berg wrote in",
  );
});

test("review_order_d5_words_say_how_many_rows_are_still_loading", () => {
  expect(reviewSortedText(ME, 1)).toBe(
    "Sorted for your review: soonest due date first, then most discussions waiting for you, then fewest discussions you wrote in (the discussions of 1 merge request are still loading; it moves when they arrive)",
  );
  expect(reviewSortedText(AS_ANNA, 3)).toBe(
    "Sorted for Anna Berg's review: soonest due date first, then most discussions waiting for Anna Berg, then fewest discussions Anna Berg wrote in (the discussions of 3 merge requests are still loading; they move when they arrive)",
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
  const possessive = turnText({ kind: "viewer" }, viewer, DMITRI).replace(/ turn$/u, "");
  const inside = viewer.kind === "me" ? possessive.toLowerCase() : possessive;
  expect(reviewSortedText(viewer, 0)).toMatch(new RegExp(`^Sorted for ${inside} review: `, "u"));
  expect(reviewFailedText(viewer, 1, "")).toMatch(
    new RegExp(`^Not sorted for ${inside} review: `, "u"),
  );
});
