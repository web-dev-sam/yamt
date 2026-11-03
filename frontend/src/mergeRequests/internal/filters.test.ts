import { expect, test } from "vitest";

import {
  NO_FILTERS,
  cleared,
  clicked,
  filterLabel,
  filtered,
  isFiltered,
  passes,
  reviewing,
  stateOf,
  withDraft,
  type ChoiceState,
  type DraftFilter,
  type Filters,
  type Held,
  type LabelValue,
  type ListFilter,
  type ListedRequest,
  type Person,
  type PersonValue,
  type ReviewFor,
} from "../index";

const SAM: Person = { username: "sam", name: "Sam Lee" };
const ANNA: Person = { username: "anna", name: "Anna Berg" };
const LITERAL_ME: Person = { username: "me", name: "Mae" };
const ME: PersonValue = { kind: "me" };
const NOBODY: PersonValue = { kind: "none" };

type Fields = {
  readonly assignees?: readonly Person[];
  readonly reviewers?: readonly Person[];
  readonly labels?: readonly string[];
  readonly draft?: boolean;
};

function request(iid: number, fields: Fields = {}): ListedRequest {
  return {
    iid,
    createdAt: iid,
    draft: fields.draft ?? false,
    assignees: fields.assignees ?? [],
    reviewers: (fields.reviewers ?? []).map((person) => ({ person, state: "requested" })),
    labels: (fields.labels ?? []).map((title) => ({ title })),
  };
}

function person(username: string): PersonValue {
  return { kind: "person", username };
}

function label(title: string): LabelValue {
  return { kind: "label", title };
}

function included<V>(value: V): Held<V> {
  return { value, mode: "included" };
}

function excluded<V>(value: V): Held<V> {
  return { value, mode: "excluded" };
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

test("any included value within one filter matches", () => {
  const filters: Filters = {
    ...NO_FILTERS,
    assignee: [included(person("anna")), included(person("sam"))],
  };
  expect(iids(filters, null)).toEqual([1, 2]);
});

test("every set filter must match across filters", () => {
  const filters: Filters = {
    assignee: [included(person("anna")), included(NOBODY)],
    reviewer: [included(person("sam"))],
    label: [],
    draft: "all",
    review: null,
  };
  expect(iids(filters, null)).toEqual([3]);
  expect(iids({ ...filters, reviewer: [] }, null)).toEqual([2, 3]);
  expect(iids({ ...filters, reviewer: [], label: [included(label("ui"))] }, null)).toEqual([2]);
  expect(iids({ ...filters, reviewer: [], draft: "ready" }, null)).toEqual([3]);
});

test("Me resolves to the logged-in user, never a username spelled me", () => {
  const filters: Filters = { ...NO_FILTERS, assignee: [included(ME)] };
  expect(iids(filters, "sam")).toEqual([1]);
  expect(iids({ ...NO_FILTERS, reviewer: [included(ME)] }, "sam")).toEqual([3]);
  expect(iids(filters, "anna")).toEqual([2]);
});

test("Me matches nothing while the logged-in user is unknown", () => {
  expect(iids({ ...NO_FILTERS, assignee: [included(ME)] }, null)).toEqual([]);
  expect(iids({ ...NO_FILTERS, assignee: [excluded(ME)] }, null)).toEqual([1, 2, 3, 4]);
});

test("None matches the rows with nobody or no label", () => {
  expect(iids({ ...NO_FILTERS, assignee: [included(NOBODY)] }, null)).toEqual([3]);
  expect(iids({ ...NO_FILTERS, reviewer: [included(NOBODY)] }, null)).toEqual([2, 4]);
  expect(iids({ ...NO_FILTERS, label: [included({ kind: "none" })] }, null)).toEqual([3]);
});

test("a label value matches the rows carrying it", () => {
  expect(iids({ ...NO_FILTERS, label: [included(label("bug"))] }, null)).toEqual([1, 2]);
});

test("a reviewer value matches the rows the person reviews, whatever their review state", () => {
  const row: ListedRequest = {
    ...request(5),
    reviewers: [{ person: SAM, state: "approved" }],
  };
  expect(passes(row, { ...NO_FILTERS, reviewer: [included(person("sam"))] }, null)).toBe(true);
  expect(passes(row, { ...NO_FILTERS, reviewer: [included(person("anna"))] }, null)).toBe(false);
});

test("the_owners_example_not_me_and_label_x_keeps_only_those_rows", () => {
  const filters: Filters = {
    ...NO_FILTERS,
    assignee: [excluded(ME)],
    label: [included(label("bug"))],
  };
  expect(iids(filters, "sam")).toEqual([2]);
});

test("none_excluded_means_at_least_one", () => {
  expect(iids({ ...NO_FILTERS, assignee: [excluded(NOBODY)] }, null)).toEqual([1, 2, 4]);
  expect(iids({ ...NO_FILTERS, reviewer: [excluded(NOBODY)] }, null)).toEqual([1, 3]);
  expect(iids({ ...NO_FILTERS, label: [excluded({ kind: "none" })] }, null)).toEqual([1, 2, 4]);
});

test("an_included_and_an_excluded_value_in_one_filter", () => {
  const filters: Filters = {
    ...NO_FILTERS,
    label: [included(label("bug")), excluded(label("ui"))],
  };
  expect(iids(filters, null)).toEqual([1]);
});

test("an excluded value alone keeps every row without it", () => {
  expect(iids({ ...NO_FILTERS, reviewer: [excluded(person("anna"))] }, null)).toEqual([2, 4]);
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

test.each<[string, ChoiceState, boolean, ChoiceState]>([
  ["a click on an off value includes it", "off", false, "included"],
  ["a Shift+click on an off value excludes it", "off", true, "excluded"],
  ["a click on an included value turns it off", "included", false, "off"],
  ["a Shift+click on an included value excludes it", "included", true, "excluded"],
  ["a click on an excluded value turns it off", "excluded", false, "off"],
  ["a Shift+click on an excluded value turns it off", "excluded", true, "off"],
])("rule 7: %s", (_case, before, shift, after) => {
  const held: readonly Held<PersonValue>[] = before === "off" ? [] : [{ value: ME, mode: before }];
  const filters = clicked({ ...NO_FILTERS, reviewer: held }, "reviewer", ME, shift);
  expect(stateOf(filters.reviewer, ME)).toBe(after);
  expect(filters.reviewer.length).toBe(after === "off" ? 0 : 1);
});

test("a new value goes last, a changed one keeps its place", () => {
  const two = clicked(clicked(NO_FILTERS, "reviewer", person("anna"), false), "reviewer", ME, true);
  expect(two.reviewer).toEqual([included(person("anna")), excluded(ME)]);
  expect(clicked(two, "reviewer", person("anna"), true).reviewer).toEqual([
    excluded(person("anna")),
    excluded(ME),
  ]);
  expect(clicked(two, "reviewer", person("anna"), false).reviewer).toEqual([excluded(ME)]);
  expect(two.assignee).toEqual([]);
});

test("stateOf reads off for a value not held, and the held mode otherwise", () => {
  const held = [included(person("anna")), excluded(NOBODY)];
  expect(stateOf(held, person("anna"))).toBe("included");
  expect(stateOf(held, NOBODY)).toBe("excluded");
  expect(stateOf(held, person("sam"))).toBe("off");
});

test("Me and a person named Me are different values", () => {
  const filters = clicked(NO_FILTERS, "assignee", person("Me"), false);
  expect(clicked(filters, "assignee", ME, false).assignee).toEqual([
    included(person("Me")),
    included(ME),
  ]);
});

test("None and a label titled None are different values", () => {
  const filters = clicked(NO_FILTERS, "label", label("None"), false);
  expect(clicked(filters, "label", { kind: "none" }, false).label).toEqual([
    included(label("None")),
    included({ kind: "none" }),
  ]);
});

test("two people with the same name stay two values when clicked", () => {
  const twin: Person = { username: "slee", name: SAM.name };
  const both = clicked(
    clicked(NO_FILTERS, "assignee", person(SAM.username), false),
    "assignee",
    person(twin.username),
    false,
  );
  expect(both.assignee).toEqual([included(person("sam")), included(person("slee"))]);
  expect(clicked(both, "assignee", person("sam"), false).assignee).toEqual([
    included(person("slee")),
  ]);
});

test("two labels stay two values when clicked; a second click removes only its own", () => {
  const both = clicked(
    clicked(NO_FILTERS, "label", label("bug"), false),
    "label",
    label("ui"),
    false,
  );
  expect(clicked(both, "label", label("bug"), false).label).toEqual([included(label("ui"))]);
});

test.each<[ListFilter, PersonValue | LabelValue]>([
  ["label", ME],
  ["label", person("sam")],
  ["assignee", label("bug")],
  ["reviewer", label("bug")],
])("%s ignores a click on %o, a value of the other family", (filter, value) => {
  expect(clicked(NO_FILTERS, filter, value, false)).toBe(NO_FILTERS);
  expect(clicked(NO_FILTERS, filter, value, true)).toBe(NO_FILTERS);
});

test.each<ListFilter>(["label", "assignee", "reviewer"])("%s takes None", (filter) => {
  expect(clicked(NO_FILTERS, filter, { kind: "none" }, false)[filter]).toEqual([
    included({ kind: "none" }),
  ]);
});

test("cleared empties one filter and keeps the others", () => {
  const filters: Filters = {
    assignee: [included(ME)],
    reviewer: [excluded(NOBODY)],
    label: [included({ kind: "none" })],
    draft: "drafts",
    review: null,
  };
  expect(cleared(filters, "reviewer")).toEqual({ ...filters, reviewer: [] });
  expect(cleared(filters, "label")).toEqual({ ...filters, label: [] });
});

test.each<[string, Filters, boolean]>([
  ["nothing set", NO_FILTERS, false],
  ["an assignee", { ...NO_FILTERS, assignee: [included(NOBODY)] }, true],
  ["an excluded reviewer", { ...NO_FILTERS, reviewer: [excluded(ME)] }, true],
  ["a label", { ...NO_FILTERS, label: [included({ kind: "none" })] }, true],
  ["drafts only", withDraft(NO_FILTERS, "drafts"), true],
  ["ready only", withDraft(NO_FILTERS, "ready"), true],
])("isFiltered with %s", (_set, filters, expected) => {
  expect(isFiltered(filters)).toBe(expected);
});

const LABELLED: Filters = {
  assignee: [excluded(ME), included(person("anna"))],
  reviewer: [included(ME), included(person("anna"))],
  label: [included({ kind: "none" }), excluded(label("needs review"))],
  draft: "all",
  review: null,
};

test.each<[ListFilter, Filters, string]>([
  ["assignee", LABELLED, "Assignee: not Me, anna"],
  ["reviewer", LABELLED, "Reviewer: Me, anna"],
  ["label", LABELLED, "Label: None, not needs review"],
  ["assignee", { ...LABELLED, assignee: [excluded(NOBODY)] }, "Assignee: not None"],
  ["reviewer", NO_FILTERS, "Reviewer"],
  ["label", NO_FILTERS, "Label"],
])(
  "filterLabel of %s reads its name alone when unset, its values in held order with not when set",
  (filter, filters, text) => {
    expect(filterLabel(filter, filters)).toBe(text);
  },
);

test("reviewing_replaces_every_filter_with_reviewer_and_ready", () => {
  const anna: ReviewFor = { kind: "person", username: "anna" };
  expect(reviewing(anna)).toEqual({
    assignee: [],
    reviewer: [included(anna)],
    label: [],
    draft: "ready",
    review: anna,
  });
  expect(iids(reviewing(anna), null)).toEqual([1, 3]);
  expect(reviewing({ kind: "me" })).toEqual({
    ...NO_FILTERS,
    reviewer: [included(ME)],
    draft: "ready",
    review: ME,
  });
});

test("a_filter_edit_keeps_the_review_order", () => {
  const anna = reviewing({ kind: "person", username: "anna" });
  const edited = cleared(withDraft(clicked(anna, "label", label("bug"), false), "all"), "reviewer");
  expect(edited).toEqual({
    ...NO_FILTERS,
    label: [included(label("bug"))],
    review: { kind: "person", username: "anna" },
  });
  expect(clicked(anna, "assignee", ME, true).review).toEqual(anna.review);
});

test("no_filters_has_no_review_order", () => {
  expect(NO_FILTERS).toEqual({ assignee: [], reviewer: [], label: [], draft: "all", review: null });
  expect(isFiltered(NO_FILTERS)).toBe(false);
});

test("review_alone_counts_as_filtered", () => {
  expect(isFiltered({ ...NO_FILTERS, review: ME })).toBe(true);
  expect(isFiltered({ ...NO_FILTERS, review: { kind: "person", username: "anna" } })).toBe(true);
  expect(iids({ ...NO_FILTERS, review: ME }, "sam")).toEqual([1, 2, 3, 4]);
});
