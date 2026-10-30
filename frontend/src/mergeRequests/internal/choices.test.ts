import { expect, test } from "vitest";

import {
  NARROW_FROM,
  labelChoices,
  narrowed,
  personChoices,
  type Choice,
  type ListedRequest,
  type Person,
} from "../index";

const SAM: Person = { username: "sam", name: "Sam Lee" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const ZOE: Person = { username: "aaa", name: "Zoe Quinn" };

function request(iid: number, fields: Partial<Omit<ListedRequest, "iid">> = {}): ListedRequest {
  return {
    iid,
    createdAt: iid,
    draft: false,
    assignees: [],
    reviewers: [],
    labels: [],
    ...fields,
  };
}

const ROWS: readonly ListedRequest[] = [
  request(1, { assignees: [ZOE, SAM], reviewers: [ANNA], labels: ["ui", "bug"] }),
  request(2, { assignees: [ANNA], labels: ["bug"] }),
  request(3, { assignees: [ANNA], reviewers: [SAM] }),
  request(4),
];

function rows<V>(choices: readonly Choice<V>[]): readonly (readonly [string, number, boolean])[] {
  return choices.map((listed) => [listed.label, listed.count, listed.checked] as const);
}

test("Assignee lists Me first, then None, then the others by name, counted over every row", () => {
  expect(rows(personChoices(ROWS, "assignees", "sam", []))).toEqual([
    ["Me", 1, false],
    ["None", 1, false],
    ["Anna Berg", 2, false],
    ["Zoe Quinn", 1, false],
  ]);
});

test("Reviewer counts its own field", () => {
  expect(rows(personChoices(ROWS, "reviewers", "sam", []))).toEqual([
    ["Me", 1, false],
    ["None", 2, false],
    ["Anna Berg", 1, false],
  ]);
});

test("Me is missing while the logged-in user is unknown; that user is then listed by name", () => {
  expect(rows(personChoices(ROWS, "assignees", null, []))).toEqual([
    ["None", 1, false],
    ["Anna Berg", 2, false],
    ["Sam Lee", 1, false],
    ["Zoe Quinn", 1, false],
  ]);
});

test("a person value carries the username, Me and None their kinds", () => {
  expect(personChoices(ROWS, "reviewers", "sam", []).map((listed) => listed.value)).toEqual([
    { kind: "me" },
    { kind: "none" },
    { kind: "person", username: "anna" },
  ]);
});

test("checked values show checked", () => {
  const choices = personChoices(ROWS, "assignees", "sam", [
    { kind: "me" },
    { kind: "person", username: "aaa" },
  ]);
  expect(rows(choices)).toEqual([
    ["Me", 1, true],
    ["None", 1, false],
    ["Anna Berg", 2, false],
    ["Zoe Quinn", 1, true],
  ]);
});

test("of two people with the same name only the checked one shows checked", () => {
  const twin: Person = { username: "slee", name: SAM.name };
  const choices = personChoices([request(1, { assignees: [SAM, twin] })], "assignees", null, [
    { kind: "person", username: "slee" },
  ]);
  expect(choices.map((listed) => [listed.value, listed.checked])).toEqual([
    [{ kind: "none" }, false],
    [{ kind: "person", username: "sam" }, false],
    [{ kind: "person", username: "slee" }, true],
  ]);
});

test("a checked person no longer in the list stays checked with 0, among the others by name", () => {
  const choices = personChoices(ROWS, "assignees", "sam", [
    { kind: "person", username: "bob" },
    { kind: "none" },
  ]);
  expect(rows(choices)).toEqual([
    ["Me", 1, false],
    ["None", 1, true],
    ["Anna Berg", 2, false],
    ["bob", 0, true],
    ["Zoe Quinn", 1, false],
  ]);
  expect(choices[3]?.value).toEqual({ kind: "person", username: "bob" });
});

test("a checked Me while the user is unknown stays first, checked with 0", () => {
  expect(rows(personChoices(ROWS, "reviewers", null, [{ kind: "me" }]))).toEqual([
    ["Me", 0, true],
    ["None", 2, false],
    ["Anna Berg", 1, false],
    ["Sam Lee", 1, false],
  ]);
});

test("a checked person who is the logged-in user stays listed, with their count", () => {
  expect(
    rows(personChoices(ROWS, "reviewers", "sam", [{ kind: "person", username: "sam" }])),
  ).toEqual([
    ["Me", 1, false],
    ["None", 2, false],
    ["Anna Berg", 1, false],
    ["sam", 1, true],
  ]);
});

test("Label lists None first, then the labels by title, counted over every row", () => {
  expect(rows(labelChoices(ROWS, []))).toEqual([
    ["None", 2, false],
    ["bug", 2, false],
    ["ui", 1, false],
  ]);
  expect(labelChoices(ROWS, []).map((listed) => listed.value)).toEqual([
    { kind: "none" },
    { kind: "label", title: "bug" },
    { kind: "label", title: "ui" },
  ]);
});

test("a checked label no longer in the list stays checked with 0", () => {
  expect(
    rows(
      labelChoices(ROWS, [
        { kind: "label", title: "backend" },
        { kind: "label", title: "ui" },
        { kind: "none" },
      ]),
    ),
  ).toEqual([
    ["None", 2, true],
    ["backend", 0, true],
    ["bug", 2, false],
    ["ui", 1, true],
  ]);
});

test("an empty list still offers None, and Me when known", () => {
  expect(rows(personChoices([], "assignees", "sam", []))).toEqual([
    ["Me", 0, false],
    ["None", 0, false],
  ]);
  expect(rows(labelChoices([], []))).toEqual([["None", 0, false]]);
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

test("a checked None while the user is unknown does not bring Me back", () => {
  expect(rows(personChoices(ROWS, "reviewers", null, [{ kind: "none" }]))).toEqual([
    ["None", 2, true],
    ["Anna Berg", 1, false],
    ["Sam Lee", 1, false],
  ]);
});

test("Label's None counts only the rows with no label", () => {
  const labelled = [request(1, { labels: ["a"] }), request(2, { labels: ["b"] }), request(3)];
  expect(labelChoices(labelled, [])[0]).toEqual({
    value: { kind: "none" },
    label: "None",
    count: 1,
    checked: false,
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
