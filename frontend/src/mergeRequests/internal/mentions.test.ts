import { expect, test } from "vitest";

import {
  MENTION_LINES,
  knownMentions,
  mentionEdit,
  mentionLines,
  mentionWordAt,
  type KnownPeople,
  type MentionWord,
  type Person,
} from "../index";

function person(username: string, name: string): Person {
  return { username, name };
}

function usernames(people: readonly Person[]): readonly string[] {
  return people.map((one) => one.username);
}

function atEnd(text: string): MentionWord | null {
  return mentionWordAt(text, text.length);
}

test("a_word_starts_at_the_text_start_or_after_a_space_a_line_break_or_an_opening_bracket", () => {
  expect(atEnd("@an")).toEqual({ start: 0, end: 3, typed: "an" });
  for (const before of [" ", "\n", "\t"]) {
    expect(atEnd(`x${before}@an`)).toEqual({ start: 2, end: 5, typed: "an" });
  }
  for (const bracket of ["(", "[", "{"]) {
    expect(atEnd(`${bracket}@an`)).toEqual({ start: 1, end: 4, typed: "an" });
  }
});

test("an_at_after_a_letter_starts_no_word", () => {
  expect(mentionWordAt("a@b.c", 3)).toBeNull();
  expect(atEnd("a@b.c")).toBeNull();
  expect(atEnd("x@y")).toBeNull();
  expect(atEnd("see x@y")).toBeNull();
  expect(atEnd("@@a")).toBeNull();
  expect(atEnd(")@a")).toBeNull();
});

test("a_caret_inside_the_word_searches_the_text_before_it", () => {
  expect(mentionWordAt("@anna x", 3)).toEqual({ start: 0, end: 5, typed: "an" });
  expect(mentionWordAt("@a1_b.c-dë e", 2)).toEqual({ start: 0, end: 10, typed: "a" });
  expect(mentionWordAt("x @an", 4)).toEqual({ start: 2, end: 5, typed: "a" });
  expect(mentionWordAt("@an x", 3)).toEqual({ start: 0, end: 3, typed: "an" });
});

test("a_space_or_a_caret_outside_ends_the_word", () => {
  expect(atEnd("@an ")).toBeNull();
  expect(atEnd("@an x")).toBeNull();
  expect(mentionWordAt("x @an", 2)).toBeNull();
  expect(mentionWordAt("@an", -1)).toBeNull();
  expect(mentionWordAt("@an", 4)).toBeNull();
  expect(atEnd("@")).toEqual({ start: 0, end: 1, typed: "" });
});

test("a_name_with_an_accent_stays_one_word", () => {
  expect(atEnd("@zoë")).toEqual({ start: 0, end: 4, typed: "zoë" });
  expect(atEnd("@an.na-b_1")).toEqual({ start: 0, end: 10, typed: "an.na-b_1" });
  expect(atEnd("hi @😀x")).toBeNull();
});

const BEN = person("ben", "Ben Ode");
const ANNA = person("anna", "Anna Berg");
const ANNA2 = person("anna2", "Anna Two");
const ADAM = person("adam", "Adam Fox");
const DSCOTT = person("dscott", "Dana Scott");

test("known_people_come_before_found_people", () => {
  expect(usernames(mentionLines([BEN, ANNA], [ANNA2, ADAM], "a"))).toEqual([
    "anna",
    "anna2",
    "adam",
  ]);
});

test("starts_with_comes_before_contains_in_each_group", () => {
  expect(usernames(mentionLines([DSCOTT, ANNA], [], "an"))).toEqual(["anna", "dscott"]);
  expect(usernames(mentionLines([], [DSCOTT, ANNA], "AN"))).toEqual(["anna", "dscott"]);
  expect(usernames(mentionLines([BEN], [DSCOTT, ANNA], "an"))).toEqual(["anna", "dscott"]);
});

test("a_name_matches_without_its_spaces", () => {
  expect(usernames(mentionLines([ANNA], [], "annaberg"))).toEqual(["anna"]);
  expect(usernames(mentionLines([ADAM, ANNA], [], "berg"))).toEqual(["anna"]);
  expect(usernames(mentionLines([ANNA, person("bergo", "Bo Bergo")], [], "berg"))).toEqual([
    "bergo",
    "anna",
  ]);
});

test("each_person_is_listed_once", () => {
  const foundAnna = person("anna", "Anna B.");
  const lines = mentionLines([ADAM, ANNA], [foundAnna, ANNA2], "a");
  expect(usernames(lines)).toEqual(["adam", "anna", "anna2"]);
  expect(lines[1]).toBe(ANNA);
});

test("at_most_ten_lines", () => {
  const known = Array.from({ length: 8 }, (_, index) => person(`known${index}`, "Kim"));
  const found = Array.from({ length: 8 }, (_, index) => person(`found${index}`, "Kim"));
  const lines = mentionLines(known, found, "kim");
  expect(lines).toHaveLength(MENTION_LINES);
  expect(usernames(lines).slice(-2)).toEqual(["found0", "found1"]);
});

test("a_blank_text_lists_every_known_person_and_no_found_one", () => {
  expect(usernames(mentionLines([BEN, ANNA, BEN], [ADAM], ""))).toEqual(["ben", "anna"]);
  expect(usernames(mentionLines([BEN, ANNA], [ADAM], " "))).toEqual(["ben", "anna"]);
});

test("known_mentions_are_the_row_then_the_writers_each_once", () => {
  const row: KnownPeople<Person> = {
    author: BEN,
    assignees: [ANNA],
    reviewers: [{ person: ADAM }],
    approvedBy: [DSCOTT, ANNA],
  };
  expect(usernames(knownMentions(row, [null, ANNA2, BEN, null, ANNA2]))).toEqual([
    "ben",
    "anna",
    "adam",
    "dscott",
    "anna2",
  ]);
  expect(usernames(knownMentions({ ...row, author: null }, []))).toEqual([
    "anna",
    "adam",
    "dscott",
  ]);
  expect(usernames(knownMentions(null, [ANNA2, null, BEN, ANNA2]))).toEqual(["anna2", "ben"]);
});

test("the_pick_replaces_the_whole_word_and_adds_one_space", () => {
  expect(mentionEdit({ start: 4, end: 9, typed: "an" }, "anna")).toEqual({
    from: 4,
    to: 9,
    insert: "@anna ",
  });
});
