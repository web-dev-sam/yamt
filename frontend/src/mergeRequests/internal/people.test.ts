import { expect, test } from "vitest";

import {
  NO_PEOPLE_TEXT,
  STACK_SHOWN,
  approversText,
  authorText,
  displayName,
  initials,
  peopleStack,
  pictureHue,
  reviewDone,
  reviewStateText,
  type Person,
  type ReviewState,
  type Reviewer,
} from "../index";

const SAM: Person = { username: "sam", name: "Sam Lee" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const BOB: Person = { username: "bob", name: "Bob" };
const ZOE: Person = { username: "zoe", name: "Zoe Quinn" };
const NAMELESS: Person = { username: "jdoe", name: "  " };

function reviewing(person: Person, state: ReviewState = "requested"): Reviewer {
  return { person, state };
}

function usernames(people: readonly Person[]): readonly string[] {
  return people.map((person) => person.username);
}

test("the stack shows assignees first, then reviewers not assigned, each once", () => {
  const stack = peopleStack([SAM], [reviewing(ANNA), reviewing(SAM, "approved")]);
  expect(usernames(stack.shown)).toEqual(["sam", "anna"]);
  expect(stack.more).toBe(0);
});

test("the stack shows three and counts the rest", () => {
  expect(STACK_SHOWN).toBe(3);
  const stack = peopleStack([SAM, ANNA], [reviewing(BOB), reviewing(ZOE), reviewing(ANNA)]);
  expect(usernames(stack.shown)).toEqual(["sam", "anna", "bob"]);
  expect(stack.more).toBe(1);
  const exact = peopleStack([SAM, ANNA, BOB], []);
  expect(usernames(exact.shown)).toEqual(["sam", "anna", "bob"]);
  expect(exact.more).toBe(0);
});

test("an empty stack shows nobody", () => {
  expect(peopleStack([], [])).toEqual({ shown: [], more: 0 });
  expect(NO_PEOPLE_TEXT).toBe("No assignee or reviewer");
});

test("the stack gives back the people it was given, with all their fields", () => {
  type Pictured = Person & { readonly picture: string | null };
  const pictured: Pictured = { ...SAM, picture: "sam.png" };
  const reviewer: { readonly person: Pictured } = { person: { ...ANNA, picture: null } };

  const { shown } = peopleStack([pictured], [reviewer]);

  expect(shown).toEqual([pictured, reviewer.person]);
  expect(shown[0]).toBe(pictured);
});

test("a blank name reads as the username", () => {
  expect(displayName(SAM)).toBe("Sam Lee");
  expect(displayName(NAMELESS)).toBe("jdoe");
  expect(displayName({ username: "x", name: "" })).toBe("x");
});

test.each<[Person, string]>([
  [SAM, "SL"],
  [{ username: "", name: " " }, ""],
  [BOB, "B"],
  [{ username: "m", name: "maria de la cruz" }, "MD"],
  [{ username: "e", name: " éva  kovács " }, "ÉK"],
  [NAMELESS, "J"],
])("initials of %o read %s", (person, text) => {
  expect(initials(person)).toBe(text);
});

test("the_same_username_always_gets_the_same_hue", () => {
  expect(pictureHue("anna")).toBe(pictureHue("anna"));
  expect(pictureHue("anna")).not.toBe(pictureHue("sam"));
});

test("a username's hue stays the same across versions, a whole degree below 360", () => {
  expect(pictureHue("anna")).toBe(144);
  expect(pictureHue("sam")).toBe(231);
  expect(pictureHue("")).toBe(0);
  for (const username of ["a".repeat(200), "zoë", "😀user", "x"]) {
    const hue = pictureHue(username);
    expect(Number.isInteger(hue)).toBe(true);
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  }
});

test.each<[ReviewState, string]>([
  ["requested", "Review requested"],
  ["reviewed", "Reviewed"],
  ["approved", "Approved"],
  ["changesRequested", "Changes requested"],
])("review state %s reads %s", (state, text) => {
  expect(reviewStateText(state)).toBe(text);
});

test.each<[ReviewState, boolean]>([
  ["requested", false],
  ["reviewed", true],
  ["approved", true],
  ["changesRequested", true],
])("only_a_done_review_can_be_re_requested: %s → %s", (state, done) => {
  expect(reviewDone(state)).toBe(done);
});

test("authorText names the author by display name, or unknown", () => {
  expect(authorText(ANNA)).toBe("Author: Anna Berg");
  expect(authorText(NAMELESS)).toBe("Author: jdoe");
  expect(authorText(null)).toBe("Author: unknown");
});

test("approversText lists one display name per line, or no approvals", () => {
  expect(approversText([ANNA, NAMELESS, SAM])).toBe("Anna Berg\njdoe\nSam Lee");
  expect(approversText([])).toBe("No approvals");
});
