import { expect, test } from "vitest";

import { NO_FILTERS, filtersFrom, storedFilters, type Filters, type StoredFilters } from "../index";

const FILTERS: Filters = {
  assignee: [{ kind: "me" }, { kind: "person", username: "anna" }],
  reviewer: [{ kind: "none" }, { kind: "person", username: "user:odd" }],
  label: [{ kind: "none" }, { kind: "label", title: "label:x" }, { kind: "label", title: "none" }],
  draft: "drafts",
};

test("the remembered form spells values as words", () => {
  const form: StoredFilters = {
    assignee: ["me", "user:anna"],
    reviewer: ["none", "user:user:odd"],
    label: ["none", "label:label:x", "label:none"],
    draft: "drafts",
  };
  expect(storedFilters(FILTERS)).toEqual(form);
});

test("filters read back as written", () => {
  expect(filtersFrom(JSON.parse(JSON.stringify(storedFilters(FILTERS))))).toEqual(FILTERS);
  expect(filtersFrom(storedFilters(NO_FILTERS))).toEqual(NO_FILTERS);
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

test("unreadable words are dropped and readable ones kept", () => {
  expect(
    filtersFrom({
      assignee: ["me", 7, "user:", "anna", "label:bug", "user:sam", null],
      reviewer: ["ME", "none"],
      label: ["label:", "bug", "user:sam", "me", "label:ui", "none"],
      draft: "maybe",
    }),
  ).toEqual({
    assignee: [{ kind: "me" }, { kind: "person", username: "sam" }],
    reviewer: [{ kind: "none" }],
    label: [{ kind: "label", title: "ui" }, { kind: "none" }],
    draft: "all",
  });
});

test.each(["all", "drafts", "ready"] as const)("Draft %s reads back", (draft) => {
  expect(filtersFrom({ draft }).draft).toBe(draft);
});
