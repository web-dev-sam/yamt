import { expect, test } from "vitest";

import {
  NO_FILTERS,
  filtersFrom,
  storedFilters,
  type Filters,
  type Held,
  type Mode,
  type ReviewFor,
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
  review: null,
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
    review: null,
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
      review: null,
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
    review: null,
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
    review: null,
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
    review: null,
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

test("review_is_stored_as_me_or_user_word_only_while_on", () => {
  expect(storedFilters({ ...NO_FILTERS, review: { kind: "me" } }).review).toBe("me");
  expect(
    storedFilters({ ...NO_FILTERS, review: { kind: "person", username: "anna" } }).review,
  ).toBe("user:anna");
  expect(Object.keys(storedFilters(FILTERS))).not.toContain("review");
});

test("the_stored_form_keeps_the_four_fields_older_yamt_reads", () => {
  const anna: ReviewFor = { kind: "person", username: "anna" };
  const { review, ...others } = storedFilters({ ...FILTERS, review: anna });
  expect(review).toBe("user:anna");
  expect(others).toEqual(storedFilters(FILTERS));
  expect(Object.keys(others)).toEqual(["assignee", "reviewer", "label", "draft"]);
});

test.each<[string, unknown]>([
  ["none", "none"],
  ["an empty user", "user:"],
  ["a bare username", "anna"],
  ["an excluded word", "not:me"],
  ["a number", 3],
  ["an array", ["me"]],
  ["null", null],
])("a_review_word_none_or_junk_reads_as_off (%s)", (_kind, review) => {
  expect(filtersFrom({ reviewer: ["me"], review })).toEqual({
    ...NO_FILTERS,
    reviewer: [included({ kind: "me" })],
  });
});

test.each<ReviewFor>([{ kind: "me" }, { kind: "person", username: "anna" }])(
  "review mode for %j round trips through storage",
  (review) => {
    const filters: Filters = {
      ...NO_FILTERS,
      reviewer: [included(review)],
      draft: "ready",
      review,
    };
    expect(filtersFrom(JSON.parse(JSON.stringify(storedFilters(filters))))).toEqual(filters);
  },
);
