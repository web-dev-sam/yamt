import { expect, test } from "vitest";

import {
  NARROW_FROM,
  labelChoices,
  narrowed,
  personChoices,
  reviewChoices,
  type Choice,
  type ChoiceState,
  type Held,
  type ListedRequest,
  type Person,
} from "../index";

const SAM: Person = { username: "sam", name: "Sam Lee" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const ZOE: Person = { username: "aaa", name: "Zoe Quinn" };

type Fields = {
  readonly assignees?: readonly Person[];
  readonly reviewers?: readonly Person[];
  readonly labels?: readonly string[];
};

function request(iid: number, fields: Fields = {}): ListedRequest {
  return {
    iid,
    createdAt: iid,
    draft: false,
    assignees: fields.assignees ?? [],
    reviewers: (fields.reviewers ?? []).map((person) => ({ person, state: "reviewed" })),
    labels: (fields.labels ?? []).map((title) => ({ title })),
  };
}

function included<V>(value: V): Held<V> {
  return { value, mode: "included" };
}

function excluded<V>(value: V): Held<V> {
  return { value, mode: "excluded" };
}

const ROWS: readonly ListedRequest[] = [
  request(1, { assignees: [ZOE, SAM], reviewers: [ANNA], labels: ["ui", "bug"] }),
  request(2, { assignees: [ANNA], labels: ["bug"] }),
  request(3, { assignees: [ANNA], reviewers: [SAM] }),
  request(4),
];

function rows<V>(
  choices: readonly Choice<V>[],
): readonly (readonly [string, number, ChoiceState])[] {
  return choices.map((listed) => [listed.label, listed.count, listed.state] as const);
}

test("Assignee lists Me first, then None, then the others, counted over every row", () => {
  expect(rows(personChoices(ROWS, "assignees", "sam", []))).toEqual([
    ["Me", 1, "off"],
    ["None", 1, "off"],
    ["Anna Berg", 2, "off"],
    ["Zoe Quinn", 1, "off"],
  ]);
});

test("Reviewer counts its own field", () => {
  expect(rows(personChoices(ROWS, "reviewers", "sam", []))).toEqual([
    ["Me", 1, "off"],
    ["None", 2, "off"],
    ["Anna Berg", 1, "off"],
  ]);
});

test("Me is missing while the logged-in user is unknown; that user is then listed by name", () => {
  expect(rows(personChoices(ROWS, "assignees", null, []))).toEqual([
    ["None", 1, "off"],
    ["Anna Berg", 2, "off"],
    ["Sam Lee", 1, "off"],
    ["Zoe Quinn", 1, "off"],
  ]);
});

test("values_follow_their_count_then_their_name", () => {
  const counted = [
    request(1, { assignees: [SAM], labels: ["c", "a", "b"] }),
    request(2, { assignees: [ZOE, ANNA], labels: ["b", "c", "d"] }),
    request(3, { assignees: [ZOE], labels: ["c", "b", "d"] }),
  ];
  expect(rows(labelChoices(counted, []))).toEqual([
    ["None", 0, "off"],
    ["b", 3, "off"],
    ["c", 3, "off"],
    ["d", 2, "off"],
    ["a", 1, "off"],
  ]);
  expect(rows(personChoices(counted, "assignees", null, []))).toEqual([
    ["None", 0, "off"],
    ["Zoe Quinn", 2, "off"],
    ["Anna Berg", 1, "off"],
    ["Sam Lee", 1, "off"],
  ]);
});

test("me_and_none_stay_first_whatever_their_count", () => {
  const counted = [request(1, { assignees: [ANNA] }), request(2, { assignees: [ANNA] })];
  expect(rows(personChoices(counted, "assignees", "sam", []))).toEqual([
    ["Me", 0, "off"],
    ["None", 0, "off"],
    ["Anna Berg", 2, "off"],
  ]);
  expect(rows(labelChoices([request(1, { labels: ["x"] })], []))).toEqual([
    ["None", 0, "off"],
    ["x", 1, "off"],
  ]);
});

test("a_held_value_no_longer_listed_comes_last_with_count_0", () => {
  expect(
    rows(
      labelChoices(ROWS, [
        included({ kind: "label", title: "backend" }),
        excluded({ kind: "label", title: "aardvark" }),
        included({ kind: "label", title: "ui" }),
        included({ kind: "none" }),
      ]),
    ),
  ).toEqual([
    ["None", 2, "included"],
    ["bug", 2, "off"],
    ["ui", 1, "included"],
    ["aardvark", 0, "excluded"],
    ["backend", 0, "included"],
  ]);
  const people = personChoices(ROWS, "assignees", "sam", [
    included({ kind: "person", username: "bob" }),
    included({ kind: "none" }),
  ]);
  expect(rows(people)).toEqual([
    ["Me", 1, "off"],
    ["None", 1, "included"],
    ["Anna Berg", 2, "off"],
    ["Zoe Quinn", 1, "off"],
    ["bob", 0, "included"],
  ]);
  expect(people[4]?.value).toEqual({ kind: "person", username: "bob" });
});

test("an_excluded_value_reads_excluded", () => {
  const choices = personChoices(ROWS, "assignees", "sam", [
    excluded({ kind: "me" }),
    included({ kind: "person", username: "aaa" }),
    excluded({ kind: "none" }),
  ]);
  expect(rows(choices)).toEqual([
    ["Me", 1, "excluded"],
    ["None", 1, "excluded"],
    ["Anna Berg", 2, "off"],
    ["Zoe Quinn", 1, "included"],
  ]);
  expect(rows(labelChoices(ROWS, [excluded({ kind: "label", title: "bug" })]))).toEqual([
    ["None", 2, "off"],
    ["bug", 2, "excluded"],
    ["ui", 1, "off"],
  ]);
});

test("a person value carries the username, Me and None their kinds", () => {
  expect(personChoices(ROWS, "reviewers", "sam", []).map((listed) => listed.value)).toEqual([
    { kind: "me" },
    { kind: "none" },
    { kind: "person", username: "anna" },
  ]);
});

test("of two people with the same name only the held one reads held", () => {
  const twin: Person = { username: "slee", name: SAM.name };
  const choices = personChoices([request(1, { assignees: [SAM, twin] })], "assignees", null, [
    included({ kind: "person", username: "slee" }),
  ]);
  expect(choices.map((listed) => [listed.value, listed.state])).toEqual([
    [{ kind: "none" }, "off"],
    [{ kind: "person", username: "sam" }, "off"],
    [{ kind: "person", username: "slee" }, "included"],
  ]);
});

test("a held Me while the user is unknown stays first, with 0", () => {
  expect(rows(personChoices(ROWS, "reviewers", null, [included({ kind: "me" })]))).toEqual([
    ["Me", 0, "included"],
    ["None", 2, "off"],
    ["Anna Berg", 1, "off"],
    ["Sam Lee", 1, "off"],
  ]);
});

test("a held person who is the logged-in user stays listed, with their count", () => {
  expect(
    rows(personChoices(ROWS, "reviewers", "sam", [excluded({ kind: "person", username: "sam" })])),
  ).toEqual([
    ["Me", 1, "off"],
    ["None", 2, "off"],
    ["Anna Berg", 1, "off"],
    ["sam", 1, "excluded"],
  ]);
});

test("Label lists None first, then the labels, counted over every row", () => {
  expect(rows(labelChoices(ROWS, []))).toEqual([
    ["None", 2, "off"],
    ["bug", 2, "off"],
    ["ui", 1, "off"],
  ]);
  expect(labelChoices(ROWS, []).map((listed) => listed.value)).toEqual([
    { kind: "none" },
    { kind: "label", title: "bug" },
    { kind: "label", title: "ui" },
  ]);
});

test("an empty list still offers None, and Me when known", () => {
  expect(rows(personChoices([], "assignees", "sam", []))).toEqual([
    ["Me", 0, "off"],
    ["None", 0, "off"],
  ]);
  expect(rows(labelChoices([], []))).toEqual([["None", 0, "off"]]);
});

test("narrowed keeps the choices whose label holds the typed text, any case, trimmed", () => {
  const choices = personChoices(ROWS, "assignees", "sam", []);
  expect(narrowed(choices, " BER ").map((listed) => listed.label)).toEqual(["Anna Berg"]);
  expect(narrowed(choices, "n").map((listed) => listed.label)).toEqual([
    "None",
    "Anna Berg",
    "Zoe Quinn",
  ]);
  expect(narrowed(choices, "")).toEqual(choices);
  expect(narrowed(choices, "xyz")).toEqual([]);
});

test("a held None while the user is unknown does not bring Me back", () => {
  expect(rows(personChoices(ROWS, "reviewers", null, [included({ kind: "none" })]))).toEqual([
    ["None", 2, "included"],
    ["Anna Berg", 1, "off"],
    ["Sam Lee", 1, "off"],
  ]);
});

test("Label's None counts only the rows with no label", () => {
  const labelled = [request(1, { labels: ["a"] }), request(2, { labels: ["b"] }), request(3)];
  expect(labelChoices(labelled, [])[0]).toEqual({
    value: { kind: "none" },
    label: "None",
    count: 1,
    state: "off",
  });
});

test("a checklist long enough for the narrowing box narrows to one typed label", () => {
  const titles = Array.from({ length: NARROW_FROM + 1 }, (_unused, index) => `area-${index}`);
  const choices = labelChoices([request(1, { labels: titles })], []);
  expect(choices.length).toBeGreaterThan(NARROW_FROM);
  expect(narrowed(choices, "AREA-3").map((listed) => listed.value)).toEqual([
    { kind: "label", title: "area-3" },
  ]);
});

test("the_picker_lists_me_then_the_reviewer_filters_people_without_none", () => {
  const ghost = { kind: "person", username: "ghost" } as const;
  const reviewer = personChoices(ROWS, "reviewers", "sam", [excluded(ghost)]);
  expect(rows(reviewer).map(([label]) => label)).toEqual(["Me", "None", "Anna Berg", "ghost"]);

  expect(rows(reviewChoices(reviewer, null))).toEqual([
    ["Me", 1, "off"],
    ["Anna Berg", 1, "off"],
    ["ghost", 0, "off"],
  ]);
  expect(rows(reviewChoices(reviewer, { kind: "me" }))).toEqual([
    ["Me", 1, "included"],
    ["Anna Berg", 1, "off"],
    ["ghost", 0, "off"],
  ]);
  const held = reviewChoices(reviewer, ghost);
  expect(rows(held)).toEqual([
    ["Me", 1, "off"],
    ["Anna Berg", 1, "off"],
    ["ghost", 0, "included"],
  ]);
  expect(held.map((listed) => listed.value)).toEqual([
    { kind: "me" },
    { kind: "person", username: "anna" },
    ghost,
  ]);
});
