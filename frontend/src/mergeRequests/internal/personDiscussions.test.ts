import { expect, test } from "vitest";

import {
  PERSON_GROUPS,
  foldedWriters,
  laterWriters,
  personEntries,
  personGroupOf,
  personLines,
  type KnownPeople,
  type OpenDiscussion,
  type Person,
  type PersonLine,
  type TurnComment,
  type Viewer,
} from "../index";

/** A comment as the cases write it: its writer (null: a deleted account), then the usernames it mentions. */
type Said = readonly [writer: string | null, ...mentioned: string[]];
type Row = KnownPeople<Person>;
type Case = OpenDiscussion & { readonly id: string };

const SAM: Person = { username: "sam", name: "Sam Weller" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const BEN: Person = { username: "ben", name: "Ben Okafor" };
const CHIARA: Person = { username: "chiara", name: "Chiara Rossi" };
const DMITRI: Person = { username: "dmitri", name: "Dmitri Volkov" };
const MARKUS: Person = { username: "markus", name: "Markus Lind" };
const ERIN: Person = { username: "erin", name: "Erin Hale" };
const KIM: Person = { username: "kim", name: " " };
const PEOPLE: Readonly<Record<string, Person>> = {
  sam: SAM,
  anna: ANNA,
  ben: BEN,
  chiara: CHIARA,
  dmitri: DMITRI,
};

function personOf(username: string): Person {
  const person = PEOPLE[username];
  if (person === undefined) {
    throw new Error(`no person ${username}`);
  }
  return person;
}

function comment([writer, ...mentioned]: Said): TurnComment {
  return {
    author: writer === null ? null : personOf(writer),
    mentions: mentioned.map(personOf),
  };
}

/** A discussion of the comments, oldest first, its last written at `createdAt`; `id` names it in the tests. */
function dated(id: string, createdAt: number, first: Said, ...rest: readonly Said[]): Case {
  const comments = [first, ...rest].map(comment);
  const last = comments.pop() ?? comment(first);
  return {
    id,
    place: { kind: "overview" },
    earlier: comments,
    last: { ...last, createdAt, text: id },
  };
}

function said(first: Said, ...rest: readonly Said[]): Case {
  return dated("case", 0, first, ...rest);
}

function row(people: Partial<Row> = {}): Row {
  return { author: DMITRI, assignees: [], reviewers: [], approvedBy: [], ...people };
}

function reviewedBy(...reviewers: readonly Person[]): Row {
  return row({ reviewers: reviewers.map((person) => ({ person })) });
}

const BY_DMITRI = row();

/** A discussion's writers as `laterWriters` reads them, the starter first. */
function writing(...authors: readonly (Person | null)[]): {
  readonly earlier: readonly { readonly author: Person | null }[];
  readonly last: { readonly author: Person | null };
} {
  return {
    earlier: authors.slice(0, -1).map((author) => ({ author })),
    last: { author: authors.at(-1) ?? null },
  };
}

test("the_persons_turn_is_group_one_for_the_viewer_and_for_another_person", () => {
  for (const person of ["sam", "anna"]) {
    const own = row({ author: personOf(person) });
    expect(personGroupOf(said(["ben"], [person], ["chiara"]), person, BY_DMITRI)).toBe("turn");
    expect(personGroupOf(said(["ben", person]), person, BY_DMITRI)).toBe("turn");
    expect(personGroupOf(said(["ben"], ["chiara", person], ["ben"]), person, BY_DMITRI)).toBe(
      "turn",
    );
    expect(personGroupOf(said(["ben"]), person, own)).toBe("turn");
    expect(personGroupOf(said(["ben"], [person]), person, BY_DMITRI)).toBe("wrote");
    expect(personGroupOf(said(["ben", person], [person]), person, BY_DMITRI)).toBe("wrote");
    expect(personGroupOf(said(["ben"], [person]), person, own)).toBe("wrote");
    expect(personGroupOf(said(["ben"]), person, BY_DMITRI)).toBe("other");
  }
});

test("started_is_the_starter_whose_turn_it_is_not", () => {
  expect(personGroupOf(said(["anna"], ["ben"], ["anna"]), "anna", BY_DMITRI)).toBe("started");
  expect(personGroupOf(said(["anna"]), "anna", reviewedBy(ANNA))).toBe("started");
  expect(personGroupOf(said(["anna"], ["ben"]), "anna", BY_DMITRI)).toBe("turn");
  expect(personGroupOf(said(["sam"], ["sam"]), "sam", BY_DMITRI)).toBe("started");
});

test("wrote_is_a_later_comment_whose_turn_it_is_not", () => {
  expect(personGroupOf(said(["ben"], ["anna"], ["chiara"], ["anna"]), "anna", BY_DMITRI)).toBe(
    "wrote",
  );
  expect(personGroupOf(said(["ben"], ["anna"]), "anna", reviewedBy(ANNA))).toBe("wrote");
  expect(personGroupOf(said(["ben"], ["anna"], ["chiara"]), "anna", BY_DMITRI)).toBe("turn");
});

test("reviewer_is_a_reviewer_who_never_wrote", () => {
  expect(personGroupOf(said(["ben"], ["chiara"]), "anna", reviewedBy(BEN, ANNA))).toBe("reviewer");
  expect(personGroupOf(said(["ben"]), "sam", reviewedBy(SAM))).toBe("reviewer");
});

test("a_non_reviewer_is_never_reviewer", () => {
  const only = row({ assignees: [ANNA], approvedBy: [ANNA], reviewers: [{ person: BEN }] });
  expect(personGroupOf(said(["ben"], ["chiara"]), "anna", only)).toBe("other");
});

test("every_other_discussion_is_other", () => {
  const discussions = [said(["ben"]), said(["ben"], ["chiara", "ben"]), said(["chiara"], [null])];
  for (const discussion of discussions) {
    expect(personGroupOf(discussion, "anna", reviewedBy(CHIARA))).toBe("other");
    expect(personGroupOf(discussion, "sam", BY_DMITRI)).toBe("other");
  }
});

test("a_null_person_puts_everything_in_other", () => {
  const discussions = [
    said(["ben", "sam"]),
    said(["sam"], ["anna"]),
    said(["anna"], ["anna"]),
    said([null], [null]),
  ];
  for (const discussion of discussions) {
    expect(personGroupOf(discussion, null, reviewedBy(SAM, ANNA))).toBe("other");
    expect(personGroupOf(discussion, null, row({ author: null }))).toBe("other");
  }
  expect(
    personEntries([{ row: reviewedBy(ANNA), discussions }], null).map(({ group }) => group),
  ).toEqual(["other", "other", "other", "other"]);
});

test("a_deleted_writer_is_never_the_person", () => {
  const deleted = row({ author: null, reviewers: [{ person: CHIARA }] });
  expect(personGroupOf(said([null], ["ben"], [null]), "anna", deleted)).toBe("other");
  expect(personGroupOf(said([null]), "sam", deleted)).toBe("other");
  expect(personGroupOf(said([null], ["anna"]), "anna", deleted)).toBe("wrote");
});

test("groups_come_in_c2_order_and_newest_last_comment_first_inside_each", () => {
  const first = [
    dated("reviewer", 9, ["chiara"]),
    dated("wrote", 5, ["ben"], ["anna"]),
    dated("turn-old", 2, ["ben", "anna"]),
  ];
  const second = [
    dated("other-old", 1, ["ben"]),
    dated("started", 3, ["anna"]),
    dated("turn-new", 8, ["chiara"], ["anna"], ["ben"]),
    dated("other-new", 7, ["ben"]),
  ];
  const entries = personEntries(
    [
      { row: reviewedBy(ANNA), discussions: first },
      { row: BY_DMITRI, discussions: second },
    ],
    "anna",
  );
  expect(entries.map(({ discussion, group }) => [discussion.id, group])).toEqual([
    ["turn-new", "turn"],
    ["turn-old", "turn"],
    ["started", "started"],
    ["wrote", "wrote"],
    ["reviewer", "reviewer"],
    ["other-new", "other"],
    ["other-old", "other"],
  ]);
  expect(entries.map(({ row: listed }) => listed.reviewers.length)).toEqual([0, 1, 0, 1, 1, 0, 0]);
  expect(entries[0]?.turn).toEqual({ kind: "viewer" });
  expect(entries[2]?.turn).toEqual({ kind: "author" });
  expect(PERSON_GROUPS).toEqual(["turn", "started", "wrote", "reviewer", "other"]);
});

test("equal_times_keep_the_rows_order_then_gitlabs", () => {
  const entries = personEntries(
    [
      { row: BY_DMITRI, discussions: [dated("a1", 4, ["ben"]), dated("a2", 4, ["chiara"])] },
      { row: BY_DMITRI, discussions: [dated("b1", 4, ["ben"]), dated("b2", 4, ["ben"])] },
    ],
    "sam",
  );
  expect(entries.map(({ discussion }) => discussion.id)).toEqual(["a1", "a2", "b1", "b2"]);
});

test("the_writers_are_every_comment_after_the_first_oldest_first", () => {
  expect(laterWriters(writing(ANNA))).toEqual([]);
  expect(laterWriters(writing(ANNA, MARKUS, ERIN))).toEqual([MARKUS, ERIN]);
  expect(laterWriters(writing(ANNA, MARKUS, ERIN, MARKUS))).toEqual([MARKUS, ERIN, MARKUS]);
  expect(laterWriters(writing(ANNA, null))).toEqual([null]);
});

test("the_fold_keeps_the_newest_writers", () => {
  const writers = [1, 2, 3, 4, 5, 6];
  expect(foldedWriters(writers, 4)).toEqual({ folded: [1, 2, 3], shown: [4, 5, 6] });
  expect(foldedWriters(writers, 5)).toEqual({ folded: [1, 2], shown: [3, 4, 5, 6] });
  expect(foldedWriters(writers, 6)).toEqual({ folded: [], shown: writers });
  expect(foldedWriters(writers, 7)).toEqual({ folded: [], shown: writers });
  expect(foldedWriters(writers, 1)).toEqual({ folded: writers, shown: [] });
  expect(foldedWriters(writers, 0)).toEqual({ folded: writers, shown: [] });
  expect(foldedWriters([1], 0)).toEqual({ folded: [], shown: [1] });
  expect(foldedWriters([1, 2], 1)).toEqual({ folded: [1, 2], shown: [] });
  expect(foldedWriters(writers, 3.5)).toEqual({ folded: [1, 2, 3, 4], shown: [5, 6] });
  expect(foldedWriters([1, 2], 1.5)).toEqual({ folded: [1, 2], shown: [] });
});

function marked(lines: readonly PersonLine<Person>[]): readonly [string, boolean][] {
  return lines.map(({ label, chosen }) => [label, chosen]);
}

test("person_lines_list_me_first_then_everyone_once_by_name", () => {
  const rows = [
    row({ assignees: [ANNA, SAM], reviewers: [{ person: BEN }], approvedBy: [ANNA] }),
    row({ author: null, reviewers: [{ person: CHIARA }], approvedBy: [BEN, KIM] }),
  ];
  const writers = [ERIN, null, ANNA, SAM, ERIN];
  const ME: Viewer = { kind: "me", username: "sam" };
  const lines = personLines(rows, writers, "sam", ME);
  expect(marked(lines)).toEqual([
    ["Me", true],
    ["Anna Berg", false],
    ["Ben Okafor", false],
    ["Chiara Rossi", false],
    ["Dmitri Volkov", false],
    ["Erin Hale", false],
    ["kim", false],
  ]);
  expect(lines[0]).toEqual({ value: ME, label: "Me", person: SAM, chosen: true });
  expect(lines[1]?.value).toEqual({ kind: "person", username: "anna", name: "Anna Berg" });
  expect(lines[1]?.person).toBe(ANNA);
  expect(lines[6]?.value).toEqual({ kind: "person", username: "kim", name: "kim" });

  const asAnna: Viewer = { kind: "person", username: "anna", name: "Anna Berg" };
  expect(marked(personLines(rows, writers, "sam", asAnna)).filter(([, chosen]) => chosen)).toEqual([
    ["Anna Berg", true],
  ]);
  const asSam: Viewer = { kind: "person", username: "sam", name: "Sam Weller" };
  expect(marked(personLines(rows, writers, "sam", asSam)).filter(([, chosen]) => chosen)).toEqual([
    ["Me", true],
  ]);

  const loggedOut = personLines(rows, writers, null, { kind: "me", username: null });
  expect(marked(loggedOut).map(([label]) => label)).toEqual([
    "Anna Berg",
    "Ben Okafor",
    "Chiara Rossi",
    "Dmitri Volkov",
    "Erin Hale",
    "kim",
    "Sam Weller",
  ]);
  expect(loggedOut.some(({ chosen }) => chosen)).toBe(false);

  expect(personLines([row()], [], "zoe", { kind: "me", username: "zoe" })[0]).toEqual({
    value: { kind: "me", username: "zoe" },
    label: "Me",
    person: null,
    chosen: true,
  });
  const anyMe: Viewer = { kind: "me", username: null };
  expect(marked(personLines(rows, writers, "sam", anyMe)).filter(([, chosen]) => chosen)).toEqual([
    ["Me", true],
  ]);
  const meSam: Viewer = { kind: "me", username: "sam" };
  expect(personLines(rows, writers, null, meSam).some(({ chosen }) => chosen)).toBe(false);
});
