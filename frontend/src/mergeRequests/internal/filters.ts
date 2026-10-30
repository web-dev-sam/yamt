export type DraftFilter = "all" | "drafts" | "ready";
export type PersonValue =
  | { readonly kind: "me" }
  | { readonly kind: "none" }
  | { readonly kind: "person"; readonly username: string };
export type LabelValue =
  | { readonly kind: "none" }
  | { readonly kind: "label"; readonly title: string };
export type Filters = {
  readonly assignee: readonly PersonValue[];
  readonly reviewer: readonly PersonValue[];
  readonly label: readonly LabelValue[];
  readonly draft: DraftFilter;
};
export type ListFilter = "assignee" | "reviewer" | "label";

export type Person = { readonly username: string; readonly name: string };
export type ListedRequest = {
  readonly iid: number;
  readonly createdAt: number;
  readonly draft: boolean;
  readonly assignees: readonly Person[];
  readonly reviewers: readonly Person[];
  readonly labels: readonly string[];
};

export const NO_FILTERS: Filters = { assignee: [], reviewer: [], label: [], draft: "all" };

const FILTER_NAMES: Readonly<Record<ListFilter, string>> = {
  assignee: "Assignee",
  reviewer: "Reviewer",
  label: "Label",
};

export function sameValue(a: PersonValue | LabelValue, b: PersonValue | LabelValue): boolean {
  switch (a.kind) {
    case "me":
    case "none":
      return b.kind === a.kind;
    case "person":
      return b.kind === "person" && b.username === a.username;
    case "label":
      return b.kind === "label" && b.title === a.title;
    default: {
      const _exhaustive: never = a;
      return _exhaustive;
    }
  }
}

function personMatches(people: readonly Person[], value: PersonValue, me: string | null): boolean {
  switch (value.kind) {
    case "me":
      return people.some((person) => person.username === me);
    case "none":
      return people.length === 0;
    case "person":
      return people.some((person) => person.username === value.username);
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}

function anyOf<V>(values: readonly V[], matches: (value: V) => boolean): boolean {
  return values.length === 0 || values.some(matches);
}

export function passes(row: ListedRequest, filters: Filters, me: string | null): boolean {
  return (
    anyOf(filters.assignee, (value) => personMatches(row.assignees, value, me)) &&
    anyOf(filters.reviewer, (value) => personMatches(row.reviewers, value, me)) &&
    anyOf(filters.label, (value) =>
      value.kind === "none" ? row.labels.length === 0 : row.labels.includes(value.title),
    ) &&
    (filters.draft === "all" || row.draft === (filters.draft === "drafts"))
  );
}

export function filtered<R extends ListedRequest>(
  rows: readonly R[],
  filters: Filters,
  me: string | null,
): readonly R[] {
  return rows.filter((row) => passes(row, filters, me));
}

function toggledIn<V extends PersonValue | LabelValue>(
  values: readonly V[],
  value: V,
): readonly V[] {
  return values.some((held) => sameValue(held, value))
    ? values.filter((held) => !sameValue(held, value))
    : [...values, value];
}

export function toggled(
  filters: Filters,
  filter: ListFilter,
  value: PersonValue | LabelValue,
): Filters {
  if (filter === "label") {
    return value.kind === "me" || value.kind === "person"
      ? filters
      : { ...filters, label: toggledIn(filters.label, value) };
  }
  return value.kind === "label"
    ? filters
    : { ...filters, [filter]: toggledIn(filters[filter], value) };
}

export function withDraft(filters: Filters, draft: DraftFilter): Filters {
  return { ...filters, draft };
}

export function cleared(filters: Filters, filter: ListFilter): Filters {
  return { ...filters, [filter]: [] };
}

export function isFiltered(filters: Filters): boolean {
  return (
    filters.assignee.length > 0 ||
    filters.reviewer.length > 0 ||
    filters.label.length > 0 ||
    filters.draft !== "all"
  );
}

function valueWord(value: PersonValue | LabelValue): string {
  switch (value.kind) {
    case "me":
      return "Me";
    case "none":
      return "None";
    case "person":
      return value.username;
    case "label":
      return value.title;
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}

export function filterName(filter: ListFilter): string {
  return FILTER_NAMES[filter];
}

export function filterLabel(filter: ListFilter, filters: Filters): string {
  const values: readonly (PersonValue | LabelValue)[] = filters[filter];
  const name = filterName(filter);
  return values.length === 0 ? name : `${name}: ${values.map(valueWord).join(", ")}`;
}
