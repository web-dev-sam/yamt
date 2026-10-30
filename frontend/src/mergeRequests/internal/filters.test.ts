import { expect, test } from "vitest";

import {
  NO_FILTERS,
  cleared,
  filterLabel,
  filtered,
  isFiltered,
  passes,
  toggled,
  withDraft,
  type Filters,
  type ListedRequest,
  type DraftFilter,
  type LabelValue,
  type ListFilter,
  type Person,
  type PersonValue,
} from "../index";

const SAM: Person = { username: "sam", name: "Sam Lee" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const LITERAL_ME: Person = { username: "me", name: "Mae" };

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
  request(1, { assignees: [SAM], reviewers: [ANNA], labels: ["bug"] }),
  request(2, { assignees: [ANNA], labels: ["bug", "ui"], draft: true }),
  request(3, { reviewers: [SAM, ANNA] }),
  request(4, { assignees: [LITERAL_ME], labels: ["ui"], draft: true }),
];

function iids(filters: Filters, me: string | null): readonly number[] {
  return filtered(ROWS, filters, me).map((row) => row.iid);
}

test("no filter lets every row through", () => {
  expect(iids(NO_FILTERS, "sam")).toEqual([1, 2, 3, 4]);
});

test("any checked value within one filter matches", () => {
  const filters: Filters = {
    ...NO_FILTERS,
    assignee: [
      { kind: "person", username: "anna" },
      { kind: "person", username: "sam" },
    ],
  };
  expect(iids(filters, null)).toEqual([1, 2]);
});

test("every set filter must match across filters", () => {
  const filters: Filters = {
    assignee: [{ kind: "person", username: "anna" }, { kind: "none" }],
    reviewer: [{ kind: "person", username: "sam" }],
    label: [],
    draft: "all",
  };
  expect(iids(filters, null)).toEqual([3]);
  expect(iids({ ...filters, reviewer: [] }, null)).toEqual([2, 3]);
  expect(iids({ ...filters, reviewer: [], label: [{ kind: "label", title: "ui" }] }, null)).toEqual(
    [2],
  );
  expect(iids({ ...filters, reviewer: [], draft: "ready" }, null)).toEqual([3]);
});

test("Me resolves to the logged-in user, never a username spelled me", () => {
  const filters: Filters = { ...NO_FILTERS, assignee: [{ kind: "me" }] };
  expect(iids(filters, "sam")).toEqual([1]);
  expect(iids({ ...NO_FILTERS, reviewer: [{ kind: "me" }] }, "sam")).toEqual([3]);
  expect(iids(filters, "anna")).toEqual([2]);
});

test("Me matches nothing while the logged-in user is unknown", () => {
  expect(iids({ ...NO_FILTERS, assignee: [{ kind: "me" }] }, null)).toEqual([]);
});

test("None matches the rows with nobody or no label", () => {
  expect(iids({ ...NO_FILTERS, assignee: [{ kind: "none" }] }, null)).toEqual([3]);
  expect(iids({ ...NO_FILTERS, reviewer: [{ kind: "none" }] }, null)).toEqual([2, 4]);
  expect(iids({ ...NO_FILTERS, label: [{ kind: "none" }] }, null)).toEqual([3]);
});

test("a label value matches the rows carrying it", () => {
  expect(iids({ ...NO_FILTERS, label: [{ kind: "label", title: "bug" }] }, null)).toEqual([1, 2]);
});

test.each<[DraftFilter, readonly number[]]>([
  ["all", [1, 2, 3, 4]],
  ["drafts", [2, 4]],
  ["ready", [1, 3]],
])("Draft %s keeps %o", (draft, expected) => {
  expect(iids(withDraft(NO_FILTERS, draft), null)).toEqual(expected);
});

test("passes checks one row", () => {
  expect(passes(request(5, { draft: true }), withDraft(NO_FILTERS, "ready"), null)).toBe(false);
  expect(passes(request(5), withDraft(NO_FILTERS, "ready"), null)).toBe(true);
});

test("a toggle adds a value, a second toggle of an equal value removes it", () => {
  const once = toggled(NO_FILTERS, "reviewer", { kind: "person", username: "anna" });
  const twice = toggled(once, "reviewer", { kind: "me" });
  expect(twice.reviewer).toEqual([{ kind: "person", username: "anna" }, { kind: "me" }]);
  expect(toggled(twice, "reviewer", { kind: "person", username: "anna" }).reviewer).toEqual([
    { kind: "me" },
  ]);
  expect(twice.assignee).toEqual([]);
});

test("Me and a person named Me are different values", () => {
  const filters = toggled(NO_FILTERS, "assignee", { kind: "person", username: "Me" });
  expect(toggled(filters, "assignee", { kind: "me" }).assignee).toEqual([
    { kind: "person", username: "Me" },
    { kind: "me" },
  ]);
});

test("None and a label titled None are different values", () => {
  const filters = toggled(NO_FILTERS, "label", { kind: "label", title: "None" });
  expect(toggled(filters, "label", { kind: "none" }).label).toEqual([
    { kind: "label", title: "None" },
    { kind: "none" },
  ]);
});

test.each<[ListFilter, PersonValue | LabelValue]>([
  ["label", { kind: "me" }],
  ["label", { kind: "person", username: "sam" }],
  ["assignee", { kind: "label", title: "bug" }],
  ["reviewer", { kind: "label", title: "bug" }],
])("%s ignores a toggle of %o, a value of the other family", (filter, value) => {
  expect(toggled(NO_FILTERS, filter, value)).toBe(NO_FILTERS);
});

test.each<[ListFilter, PersonValue | LabelValue]>([
  ["label", { kind: "none" }],
  ["assignee", { kind: "none" }],
  ["reviewer", { kind: "none" }],
])("%s takes None", (filter, value) => {
  expect(toggled(NO_FILTERS, filter, value)[filter]).toEqual([{ kind: "none" }]);
});

test("cleared empties one filter and keeps the others", () => {
  const filters: Filters = {
    assignee: [{ kind: "me" }],
    reviewer: [{ kind: "none" }],
    label: [{ kind: "none" }],
    draft: "drafts",
  };
  expect(cleared(filters, "reviewer")).toEqual({ ...filters, reviewer: [] });
  expect(cleared(filters, "label")).toEqual({ ...filters, label: [] });
});

test.each<[string, Filters, boolean]>([
  ["nothing set", NO_FILTERS, false],
  ["an assignee", { ...NO_FILTERS, assignee: [{ kind: "none" }] }, true],
  ["a reviewer", { ...NO_FILTERS, reviewer: [{ kind: "me" }] }, true],
  ["a label", { ...NO_FILTERS, label: [{ kind: "none" }] }, true],
  ["drafts only", withDraft(NO_FILTERS, "drafts"), true],
  ["ready only", withDraft(NO_FILTERS, "ready"), true],
])("isFiltered with %s", (_set, filters, expected) => {
  expect(isFiltered(filters)).toBe(expected);
});

const LABELLED: Filters = {
  assignee: [],
  reviewer: [{ kind: "me" }, { kind: "person", username: "anna" }],
  label: [{ kind: "none" }, { kind: "label", title: "needs review" }],
  draft: "all",
};

test.each<[ListFilter, Filters, string]>([
  ["assignee", LABELLED, "Assignee"],
  ["reviewer", LABELLED, "Reviewer: Me, anna"],
  ["label", LABELLED, "Label: None, needs review"],
  ["assignee", { ...LABELLED, assignee: [{ kind: "none" }] }, "Assignee: None"],
  ["reviewer", NO_FILTERS, "Reviewer"],
  ["label", NO_FILTERS, "Label"],
])(
  "filterLabel of %s reads its name alone when unset, its values by username when set",
  (filter, filters, text) => {
    expect(filterLabel(filter, filters)).toBe(text);
  },
);
