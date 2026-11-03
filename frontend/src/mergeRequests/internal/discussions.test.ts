import { expect, test } from "vitest";

import {
  DISCUSSIONS_LABEL,
  UNKNOWN_AUTHOR,
  discussionTurns,
  noteAuthorName,
  noteExcerpt,
  placeText,
  turnCounts,
  turnSummaryText,
  turnText,
  type DiscussionPlace,
  type OpenDiscussion,
  type Person,
} from "../index";

const SAM: Person = { username: "sam", name: "Sam Lee" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const OVERVIEW: DiscussionPlace = { kind: "overview" };

function discussion(
  id: string,
  author: Person | null,
  createdAt: number,
): OpenDiscussion & { id: string } {
  return { id, place: OVERVIEW, last: { author, createdAt, text: id } };
}

const BY_SAM = discussion("by-sam", SAM, 10);
const BY_ANNA = discussion("by-anna", ANNA, 20);
const BY_NOBODY = discussion("by-nobody", null, 30);
const MIXED = [BY_SAM, BY_ANNA, BY_NOBODY];

function turns(
  open: readonly (OpenDiscussion & { id: string })[],
  viewer: string | null,
): string[] {
  return discussionTurns(open, viewer).map((line) => `${line.discussion.id} ${line.turn}`);
}

test("the_viewers_own_last_comment_is_waiting_any_other_is_the_viewers_turn", () => {
  expect(turns(MIXED, "sam")).toEqual(["by-nobody viewer", "by-anna viewer", "by-sam waiting"]);
});

test("a_reviewer_other_than_me_gets_the_turns_from_their_side", () => {
  expect(turns(MIXED, "anna")).toEqual(["by-nobody viewer", "by-sam viewer", "by-anna waiting"]);
});

test("a_null_viewer_has_every_turn", () => {
  expect(turns(MIXED, null)).toEqual(["by-nobody viewer", "by-anna viewer", "by-sam viewer"]);
  expect(turnCounts(MIXED, null)).toEqual({ viewersTurn: 3, waiting: 0 });
});

test("the_viewers_turn_comes_first_then_newest_first_within_each", () => {
  const open = [
    discussion("mine-old", SAM, 1),
    discussion("theirs-old", ANNA, 2),
    discussion("mine-new", SAM, 50),
    discussion("theirs-new", ANNA, 40),
    discussion("theirs-mid", null, 3),
  ];
  expect(turns(open, "sam")).toEqual([
    "theirs-new viewer",
    "theirs-mid viewer",
    "theirs-old viewer",
    "mine-new waiting",
    "mine-old waiting",
  ]);
});

test("equal_times_keep_gitlabs_order", () => {
  const open = [
    discussion("first", ANNA, 5),
    discussion("mine", SAM, 5),
    discussion("second", null, 5),
    discussion("third", ANNA, 5),
  ];
  expect(turns(open, "sam")).toEqual([
    "first viewer",
    "second viewer",
    "third viewer",
    "mine waiting",
  ]);
  expect(turns([...open].reverse(), "sam")).toEqual([
    "third viewer",
    "second viewer",
    "first viewer",
    "mine waiting",
  ]);
});

test("the_counts_add_up_to_the_open_discussions", () => {
  const open = [...MIXED, discussion("again-sam", SAM, 40)];
  expect(turnCounts(open, "sam")).toEqual({ viewersTurn: 2, waiting: 2 });
  expect(turnCounts(open, "anna")).toEqual({ viewersTurn: 3, waiting: 1 });
  expect(turnCounts([], "sam")).toEqual({ viewersTurn: 0, waiting: 0 });
});

test.each([
  [{ viewersTurn: 2, waiting: 3 }, "2 of 5 wait for you"],
  [{ viewersTurn: 1, waiting: 4 }, "1 of 5 waits for you"],
  [{ viewersTurn: 1, waiting: 0 }, "1 of 1 waits for you"],
  [{ viewersTurn: 0, waiting: 3 }, "0 of 3 wait for you"],
  [{ viewersTurn: 0, waiting: 0 }, "No open discussions"],
])("the_summary_counts_words_singular_and_plural: %o reads %s", (counts, text) => {
  expect(turnSummaryText(counts)).toBe(text);
});

test("the_turn_words_are_not_swapped", () => {
  expect(turnText("viewer")).toBe("Your turn");
  expect(turnText("waiting")).toBe("Waiting for an answer");
  expect(DISCUSSIONS_LABEL).toBe("Open discussions");
});

test("a_file_place_reads_path_and_line_or_path_alone", () => {
  expect(placeText({ kind: "overview" })).toBe("Overview");
  expect(placeText({ kind: "file", path: "src/board/card.ts", line: 4 })).toBe(
    "src/board/card.ts:4",
  );
  expect(placeText({ kind: "file", path: "src/board/card.ts", line: null })).toBe(
    "src/board/card.ts",
  );
});

test("the_excerpt_keeps_three_lines_and_cuts_with_an_ellipsis", () => {
  expect(noteExcerpt("one\ntwo\nthree")).toBe("one\ntwo\nthree");
  expect(noteExcerpt("one\ntwo\nthree \nfour")).toBe("one\ntwo\nthree…");
  expect(noteExcerpt("one\r\ntwo\r\nthree\r\nfour")).toBe("one\ntwo\nthree…");
  expect(noteExcerpt("one\r\ntwo")).toBe("one\ntwo");
  expect(noteExcerpt("\n\n  \nfirst\nsecond\n\n")).toBe("first\nsecond");
  expect(noteExcerpt(`${"a".repeat(280)}`)).toBe("a".repeat(280));
  expect(noteExcerpt(`${"a".repeat(299)}b`)).toBe(`${"a".repeat(280)}…`);
  expect(noteExcerpt(`${"a".repeat(279)} b`)).toBe(`${"a".repeat(279)}…`);
  expect(noteExcerpt(`${"a".repeat(279)}😀😀`)).toBe(`${"a".repeat(279)}😀…`);
  expect(noteExcerpt(`${"😀".repeat(280)}`)).toBe("😀".repeat(280));
});

test("markup_and_capitals_stay_as_typed", () => {
  expect(noteExcerpt("**x** <b>X</b> &amp; LOUD")).toBe("**x** <b>X</b> &amp; LOUD");
});

test("an_unknown_author_is_someone", () => {
  expect(noteAuthorName(null)).toBe("Someone");
  expect(UNKNOWN_AUTHOR).toBe("Someone");
  expect(noteAuthorName(ANNA)).toBe("Anna Berg");
  expect(noteAuthorName({ username: "kim", name: " " })).toBe("kim");
});
