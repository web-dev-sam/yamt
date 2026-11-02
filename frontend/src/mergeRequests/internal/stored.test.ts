import { expect, test } from "vitest";

import {
  NO_FILTERS,
  filtersFrom,
  storedFilters,
  type Filters,
  type Held,
  type Mode,
  type StoredFilters,
} from "../index";

function included<V>(value: V): Held<V> {
  return { value, mode: "included" };
}

function excluded<V>(value: V): Held<V> {
  return { value, mode: "excluded" };
}

const FILTERS: Filters = {
  assignee: [included({ kind: "me" }), excluded({ kind: "person", username: "anna" })],
  reviewer: [excluded({ kind: "none" }), included({ kind: "person", username: "user:odd" })],
  label: [
    included({ kind: "none" }),
    excluded({ kind: "label", title: "label:x" }),
    included({ kind: "label", title: "not:none" }),
  ],
  draft: "drafts",
};

test("the remembered form spells values as words, excluded ones after not:", () => {
  const form: StoredFilters = {
    assignee: ["me", "not:user:anna"],
    reviewer: ["not:none", "user:user:odd"],
    label: ["none", "not:label:label:x", "label:not:none"],
    draft: "drafts",
  };
  expect(storedFilters(FILTERS)).toEqual(form);
});

test("an_excluded_word_round_trips", () => {
  expect(filtersFrom(JSON.parse(JSON.stringify(storedFilters(FILTERS))))).toEqual(FILTERS);
  expect(filtersFrom(storedFilters(NO_FILTERS))).toEqual(NO_FILTERS);
  expect(
    filtersFrom({ assignee: ["not:me"], reviewer: ["not:user:sam"], label: ["not:label:bug"] }),
  ).toEqual({
    assignee: [excluded({ kind: "me" })],
    reviewer: [excluded({ kind: "person", username: "sam" })],
    label: [excluded({ kind: "label", title: "bug" })],
    draft: "all",
  });
});

test.each<Mode>(["included", "excluded"])(
  "a %s person, label and None read back in that mode",
  (mode) => {
    const filters: Filters = {
      assignee: [{ value: { kind: "person", username: "anna" }, mode }],
      reviewer: [{ value: { kind: "none" }, mode }],
      label: [{ value: { kind: "label", title: "bug" }, mode }],
      draft: "all",
    };
    expect(filtersFrom(storedFilters(filters))).toEqual(filters);
  },
);

test("old_words_read_as_included_and_unknown_words_are_dropped", () => {
  expect(filtersFrom({ assignee: ["me"], reviewer: [], label: ["none"], draft: "ready" })).toEqual({
    assignee: [included({ kind: "me" })],
    reviewer: [],
    label: [included({ kind: "none" })],
    draft: "ready",
  });
  expect(
    filtersFrom({
      assignee: ["me", 7, "user:", "anna", "label:bug", "user:sam", null, "not:", "not:user:"],
      reviewer: ["ME", "none", "not:not:me", "NOT:me"],
      label: ["label:", "bug", "user:sam", "me", "label:ui", "none", "not:label:"],
      draft: "maybe",
    }),
  ).toEqual({
    assignee: [included({ kind: "me" }), included({ kind: "person", username: "sam" })],
    reviewer: [included({ kind: "none" })],
    label: [included({ kind: "label", title: "ui" }), included({ kind: "none" })],
    draft: "all",
  });
});

test("a_value_stored_twice_reads_once", () => {
  expect(
    filtersFrom({
      assignee: ["not:me", "me", "user:anna", "not:user:anna"],
      reviewer: ["none", "none"],
      label: ["label:bug", "not:label:bug", "label:bug"],
    }),
  ).toEqual({
    assignee: [excluded({ kind: "me" }), included({ kind: "person", username: "anna" })],
    reviewer: [included({ kind: "none" })],
    label: [included({ kind: "label", title: "bug" })],
    draft: "all",
  });
});

test.each([
  ["undefined", undefined],
  ["null", null],
  ["a number", 3],
  ["a string", "me"],
  ["an array", ["me"]],
  ["an empty object", {}],
  ["fields of the wrong type", { assignee: "me", reviewer: { 0: "me" }, label: 4, draft: 1 }],
])("junk in storage (%s) reads as no filter", (_kind, stored) => {
  expect(filtersFrom(stored)).toEqual(NO_FILTERS);
});

test.each(["all", "drafts", "ready"] as const)("Draft %s reads back", (draft) => {
  expect(filtersFrom({ draft }).draft).toBe(draft);
});
