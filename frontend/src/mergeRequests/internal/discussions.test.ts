import { expect, test } from "vitest";

import {
  DISCUSSIONS_LABEL,
  UNKNOWN_AUTHOR,
  discussionTurns,
  noteAuthorName,
  noteExcerpt,
  placeText,
  turnCounts,
  turnOf,
  turnSummaryText,
  turnText,
  viewerOf,
  type ListedRequest,
  type Mention,
  type OpenDiscussion,
  type Person,
  type TurnComment,
  type Viewer,
} from "../index";

/** A comment as the cases write it: its writer (null: a deleted account), then the usernames it mentions. */
type Said = readonly [writer: string | null, ...mentioned: string[]];

const SAM: Person = { username: "sam", name: "Sam Weller" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const PEOPLE: Readonly<Record<string, Person>> = {
  sam: SAM,
  anna: ANNA,
  ben: { username: "ben", name: "Ben Okafor" },
  chiara: { username: "chiara", name: "Chiara Rossi" },
  dmitri: { username: "dmitri", name: "Dmitri Volkov" },
  kim: { username: "kim", name: " " },
};
const ME_SAM: Viewer = { kind: "me", username: "sam" };
const AS_ANNA: Viewer = { kind: "person", username: "anna", name: "Anna Berg" };
const AS_BEN: Viewer = { kind: "person", username: "ben", name: "Ben Okafor" };
const NOBODY: Viewer = { kind: "me", username: null };

function reviewedBy(iid: number, reviewers: readonly Person[]): ListedRequest {
  return {
    iid,
    createdAt: iid,
    draft: false,
    assignees: [],
    reviewers: reviewers.map((person) => ({ person, state: "requested" })),
    labels: [],
  };
}

function mentionOf(username: string): Mention {
  const person = PEOPLE[username];
  if (person === undefined) {
    throw new Error(`no person ${username}`);
  }
  return person;
}

function comment([writer, ...mentioned]: Said): TurnComment {
  return {
    author: writer === null ? null : mentionOf(writer),
    mentions: mentioned.map(mentionOf),
  };
}

/** A discussion of the comments, oldest first, its last written at `createdAt`; `id` names it in the tests. */
function dated(
  id: string,
  createdAt: number,
  first: Said,
  ...rest: readonly Said[]
): OpenDiscussion & { id: string } {
  const comments = [first, ...rest].map(comment);
  const last = comments.pop() ?? comment(first);
  return {
    id,
    place: { kind: "overview" },
    earlier: comments,
    last: { ...last, createdAt, text: id },
  };
}

function said(first: Said, ...rest: readonly Said[]): OpenDiscussion {
  return dated("case", 0, first, ...rest);
}

/** The turn's words for `viewer` on a merge request by `author` (the cases' default: sam on dmitri's). */
function words(
  discussion: OpenDiscussion,
  viewer = ME_SAM,
  author: string | null = "dmitri",
): string {
  return turnText(turnOf(discussion, viewer.username, author), viewer);
}

test("b1_the_viewer_wrote_last_so_it_is_the_authors_turn", () => {
  expect(turnOf(said(["anna"], ["sam"]), "sam", "dmitri")).toEqual({ kind: "author" });
  expect(words(said(["sam"], ["anna", "sam"], ["sam"]))).toBe("Author's turn");
  expect(words(said(["sam"]), ME_SAM, null)).toBe("Author's turn");
});

test("b1_the_author_wrote_last_so_it_is_the_starters_turn", () => {
  expect(turnOf(said(["anna"], ["sam"]), "sam", "sam")).toEqual({
    kind: "person",
    username: "anna",
    name: "Anna Berg",
  });
  expect(words(said(["anna"], ["ben"], ["sam", "ben"]), ME_SAM, "sam")).toBe("Anna Berg's turn");
  expect(words(said(["kim"], ["sam"]), ME_SAM, "sam")).toBe("kim's turn");
  expect(words(said(["chiara", "kim"]))).toBe("kim's turn");
});

test("b1_the_author_started_and_wrote_last_so_it_waits", () => {
  expect(turnOf(said(["sam"], ["sam"]), "sam", "sam")).toEqual({ kind: "waiting" });
  expect(words(said(["sam"], ["anna"], ["sam"]), ME_SAM, "sam")).toBe("Waiting for an answer");
  expect(words(said(["sam"]), ME_SAM, "sam")).toBe("Waiting for an answer");
});

test("b1_a_deleted_starter_waits", () => {
  expect(words(said([null], ["sam"]), ME_SAM, "sam")).toBe("Waiting for an answer");
  expect(words(said([null], ["sam"]))).toBe("Author's turn");
});

test("b2_the_viewer_started_it", () => {
  expect(turnOf(said(["sam"], ["anna"]), "sam", "dmitri")).toEqual({ kind: "viewer" });
  expect(words(said(["sam"], ["anna", "ben"]))).toBe("Your turn");
});

test("b2_the_viewer_is_mentioned_by_someone_else_and_never_wrote", () => {
  expect(words(said(["ben", "sam"], ["chiara"]))).toBe("Your turn");
  expect(words(said(["ben"], ["dmitri", "anna", "sam"]))).toBe("Your turn");
  expect(words(said(["ben"], [null, "sam"]))).toBe("Your turn");
  expect(words(said(["ben", "anna"], ["chiara"]))).toBe("Author's turn");
});

test("b2_a_mention_counts_after_the_viewer_answered", () => {
  expect(words(said(["anna", "sam"], ["sam"], ["anna"]))).toBe("Your turn");
});

test("b2_the_viewer_is_the_author", () => {
  expect(words(said(["anna"], ["anna"]), ME_SAM, "sam")).toBe("Your turn");
  expect(words(said(["dmitri"]), AS_BEN, "ben")).toBe("Ben Okafor's turn");
});

test("b2_the_viewer_wrote_in_the_middle", () => {
  expect(words(said(["anna", "ben"], ["sam"], ["dmitri"], ["anna"]))).toBe("Your turn");
  expect(words(said(["anna"], ["sam"], ["dmitri"]))).toBe("Your turn");
});

test("b3_the_last_comment_mentions_someone", () => {
  expect(turnOf(said(["chiara"], ["anna", "ben"]), "sam", "dmitri")).toEqual({
    kind: "person",
    username: "ben",
    name: "Ben Okafor",
  });
  expect(words(said(["chiara"], ["anna", "ben"]))).toBe("Ben Okafor's turn");
  expect(words(said(["chiara"], ["anna", "ben", "chiara"]))).toBe("Ben Okafor's turn");
  expect(words(said(["chiara"], [null, "ben"]))).toBe("Ben Okafor's turn");
  expect(words(said(["chiara", "ben"], ["anna"]))).toBe("Author's turn");
});

test("b3_the_last_comment_is_not_the_authors", () => {
  expect(words(said(["anna"], ["anna"]))).toBe("Author's turn");
  expect(words(said(["dmitri"], ["anna"]))).toBe("Author's turn");
});

test("b3_the_author_answered_the_starter", () => {
  expect(turnOf(said(["anna"], ["dmitri"]), "sam", "dmitri")).toEqual({
    kind: "person",
    username: "anna",
    name: "Anna Berg",
  });
  expect(words(said(["anna"], ["chiara"], ["dmitri"]))).toBe("Anna Berg's turn");
});

test("b3_only_the_author_wrote_so_it_is_open", () => {
  expect(turnOf(said(["dmitri"]), "sam", "dmitri")).toEqual({ kind: "open" });
  expect(words(said(["dmitri"], ["anna"], ["dmitri"]))).toBe("Open");
  expect(words(said(["dmitri"], ["dmitri"]))).toBe("Open");
});

test("b3_a_mention_of_the_author_is_the_authors_turn", () => {
  expect(turnOf(said(["chiara"], ["ben", "dmitri"]), "sam", "dmitri")).toEqual({ kind: "author" });
  expect(words(said(["chiara"], ["ben", "dmitri", "anna"]))).toBe("Author's turn");
});

test("b3_all_and_group_mentions_are_no_mentions", () => {
  expect(words(said(["ben"], ["chiara"]))).toBe("Author's turn");
});

test("b3_a_self_mention_is_no_mention", () => {
  expect(words(said(["chiara", "chiara"]))).toBe("Author's turn");
  expect(words(said(["chiara", "chiara", "ben"]))).toBe("Ben Okafor's turn");
});

test("b4_header_counts_only_the_viewers_turn_and_orders_them_first", () => {
  const open = [
    dated("theirs-old", 1, ["anna"], ["chiara"]),
    dated("mine-old", 2, ["sam"], ["anna"]),
    dated("waiting", 50, ["anna"], ["sam"]),
    dated("mine-new", 40, ["ben", "sam"], ["ben"]),
    dated("open", 30, ["dmitri"]),
    dated("mine-tied", 2, ["anna"], ["sam"], ["anna"]),
  ];
  expect(
    discussionTurns(open, "sam", "dmitri").map(
      ({ discussion, turn }) => `${discussion.id} ${turnText(turn, ME_SAM)}`,
    ),
  ).toEqual([
    "mine-new Your turn",
    "mine-old Your turn",
    "mine-tied Your turn",
    "waiting Author's turn",
    "open Open",
    "theirs-old Author's turn",
  ]);
  const counts = turnCounts(open, "sam", "dmitri");
  expect(counts).toEqual({ viewersTurn: 3, authorsTurn: 2, total: 6 });
  expect(turnSummaryText(counts, ME_SAM)).toBe("3 of 6 wait for you");
  expect(turnCounts([], "sam", "dmitri")).toEqual({ viewersTurn: 0, authorsTurn: 0, total: 0 });
});

test.each([
  [{ viewersTurn: 2, authorsTurn: 0, total: 5 }, "2 of 5 wait for you"],
  [{ viewersTurn: 1, authorsTurn: 2, total: 5 }, "1 of 5 waits for you"],
  [{ viewersTurn: 1, authorsTurn: 0, total: 1 }, "1 of 1 waits for you"],
  [{ viewersTurn: 0, authorsTurn: 3, total: 3 }, "0 of 3 wait for you"],
  [{ viewersTurn: 0, authorsTurn: 0, total: 0 }, "No open discussions"],
])("the_summary_counts_words_singular_and_plural: %o reads %s", (counts, text) => {
  expect(turnSummaryText(counts, ME_SAM)).toBe(text);
  expect(turnSummaryText(counts, NOBODY)).toBe(text);
});

test.each([
  [{ viewersTurn: 2, authorsTurn: 1, total: 5 }, "2 of 5 wait for Anna Berg"],
  [{ viewersTurn: 1, authorsTurn: 1, total: 5 }, "1 of 5 waits for Anna Berg"],
  [{ viewersTurn: 0, authorsTurn: 0, total: 0 }, "No open discussions"],
])("the summary for another reviewer: %o reads %s", (counts, text) => {
  expect(turnSummaryText(counts, AS_ANNA)).toBe(text);
});

test("b5_review_mode_speaks_for_the_reviewer", () => {
  const case6 = said(["chiara"], ["anna", "ben"]);
  expect(turnOf(case6, "ben", "dmitri")).toEqual({ kind: "viewer" });
  expect(words(case6, AS_BEN)).toBe("Ben Okafor's turn");
  expect(words(said(["anna"], ["sam"]), AS_ANNA)).toBe("Anna Berg's turn");
  expect(words(said(["anna"], ["sam"]), ME_SAM)).toBe("Author's turn");
});

test("b6_a_deleted_person_is_never_viewer_author_or_mentioned", () => {
  const case10 = said([null], [null]);
  expect(turnOf(case10, "sam", "dmitri")).toEqual({ kind: "author" });
  expect(turnOf(case10, null, "dmitri")).toEqual({ kind: "author" });
  expect(turnOf(case10, null, null)).toEqual({ kind: "author" });
  expect(turnOf(said(["anna"], [null]), "sam", null)).toEqual({ kind: "author" });
  expect(turnOf(said([null], ["dmitri"]), "sam", "dmitri")).toEqual({ kind: "open" });
});

test("no_viewer_is_never_the_viewers_turn", () => {
  expect(turnOf(said(["anna"], ["ben"]), null, "dmitri")).toEqual({ kind: "author" });
  expect(turnOf(said(["anna"], ["ben"]), null, null)).toEqual({ kind: "author" });
  expect(turnOf(said(["dmitri"]), null, null)).toEqual({ kind: "author" });
  expect(turnOf(said(["anna"], ["dmitri"]), null, "dmitri")).toEqual({
    kind: "person",
    username: "anna",
    name: "Anna Berg",
  });
  expect(turnCounts([said(["anna"], ["ben"]), said(["dmitri"])], null, "dmitri")).toEqual({
    viewersTurn: 0,
    authorsTurn: 1,
    total: 2,
  });
});

test("the_turn_words_are_not_swapped", () => {
  expect(turnText({ kind: "viewer" }, ME_SAM)).toBe("Your turn");
  expect(turnText({ kind: "author" }, ME_SAM)).toBe("Author's turn");
  expect(turnText({ kind: "person", username: "ben", name: "Ben Okafor" }, AS_ANNA)).toBe(
    "Ben Okafor's turn",
  );
  expect(turnText({ kind: "waiting" }, AS_ANNA)).toBe("Waiting for an answer");
  expect(turnText({ kind: "open" }, ME_SAM)).toBe("Open");
  expect(turnText({ kind: "viewer" }, AS_ANNA)).toBe("Anna Berg's turn");
  expect(DISCUSSIONS_LABEL).toBe("Open discussions");
});

test("viewer_of_a_person_who_is_me_is_me", () => {
  const rows = [reviewedBy(1, [SAM, ANNA])];
  expect(viewerOf(null, "sam", rows)).toEqual(ME_SAM);
  expect(viewerOf({ kind: "me" }, "sam", rows)).toEqual(ME_SAM);
  expect(viewerOf({ kind: "me" }, null, rows)).toEqual({ kind: "me", username: null });
  expect(viewerOf({ kind: "person", username: "sam" }, "sam", rows)).toEqual(ME_SAM);
  expect(viewerOf({ kind: "person", username: "sam" }, null, rows)).toEqual({
    kind: "person",
    username: "sam",
    name: "Sam Weller",
  });
});

test("viewer_name_is_the_display_name_else_the_username", () => {
  const rows = [
    reviewedBy(1, [SAM]),
    reviewedBy(2, [{ username: "anna", name: "Anna Berg" }]),
    reviewedBy(3, [
      { username: "anna", name: "Anna B." },
      { username: "ben", name: " " },
    ]),
  ];
  expect(viewerOf({ kind: "person", username: "anna" }, "sam", rows)).toEqual(AS_ANNA);
  expect(viewerOf({ kind: "person", username: "ben" }, "sam", rows)).toEqual({
    kind: "person",
    username: "ben",
    name: "ben",
  });
  expect(viewerOf({ kind: "person", username: "zoe" }, "sam", rows)).toEqual({
    kind: "person",
    username: "zoe",
    name: "zoe",
  });
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
