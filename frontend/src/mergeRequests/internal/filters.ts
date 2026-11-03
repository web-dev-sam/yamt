export type DraftFilter = "all" | "drafts" | "ready";
export type PersonValue =
  | { readonly kind: "me" }
  | { readonly kind: "none" }
  | { readonly kind: "person"; readonly username: string };
export type LabelValue =
  | { readonly kind: "none" }
  | { readonly kind: "label"; readonly title: string };
export type Mode = "included" | "excluded";
export type Held<V> = { readonly value: V; readonly mode: Mode };
export type ChoiceState = "off" | Mode;
/** Review mode's reviewer (request-mr-review-mode rule 1): the logged-in user or a person, never "None". */
export type ReviewFor = Exclude<PersonValue, { readonly kind: "none" }>;
export type Filters = {
  readonly assignee: readonly Held<PersonValue>[];
  readonly reviewer: readonly Held<PersonValue>[];
  readonly label: readonly Held<LabelValue>[];
  readonly draft: DraftFilter;
  /** Rules 2–3: whose review order the shown rows follow; null: the normal order. */
  readonly review: ReviewFor | null;
};
export type ListFilter = "assignee" | "reviewer" | "label";

export type ReviewState = "requested" | "reviewed" | "approved" | "changesRequested";
export type Person = { readonly username: string; readonly name: string };
export type Reviewer = { readonly person: Person; readonly state: ReviewState };
export type ListedLabel = { readonly title: string };
export type ListedRequest = {
  readonly iid: number;
  readonly createdAt: number;
  readonly draft: boolean;
  readonly assignees: readonly Person[];
  readonly reviewers: readonly Reviewer[];
  readonly labels: readonly ListedLabel[];
};

export const NO_FILTERS: Filters = {
  assignee: [],
  reviewer: [],
  label: [],
  draft: "all",
  review: null,
};

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

function heldPasses<V>(held: readonly Held<V>[], matches: (value: V) => boolean): boolean {
  const included = held.filter((entry) => entry.mode === "included");
  return (
    (included.length === 0 || included.some((entry) => matches(entry.value))) &&
    !held.some((entry) => entry.mode === "excluded" && matches(entry.value))
  );
}

export function rowPeople(row: ListedRequest, field: "assignees" | "reviewers"): readonly Person[] {
  return field === "reviewers" ? row.reviewers.map((reviewer) => reviewer.person) : row.assignees;
}

export function passes(row: ListedRequest, filters: Filters, me: string | null): boolean {
  const reviewers = rowPeople(row, "reviewers");
  return (
    heldPasses(filters.assignee, (value) => personMatches(row.assignees, value, me)) &&
    heldPasses(filters.reviewer, (value) => personMatches(reviewers, value, me)) &&
    heldPasses(filters.label, (value) =>
      value.kind === "none"
        ? row.labels.length === 0
        : row.labels.some((label) => label.title === value.title),
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

export function stateOf<V extends PersonValue | LabelValue>(
  held: readonly Held<V>[],
  value: V,
): ChoiceState {
  return held.find((entry) => sameValue(entry.value, value))?.mode ?? "off";
}

function stateAfterClick(state: ChoiceState, shift: boolean): ChoiceState {
  switch (state) {
    case "off":
      return shift ? "excluded" : "included";
    case "included":
      return shift ? "excluded" : "off";
    case "excluded":
      return "off";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function clickedIn<V extends PersonValue | LabelValue>(
  held: readonly Held<V>[],
  value: V,
  shift: boolean,
): readonly Held<V>[] {
  const state = stateOf(held, value);
  const mode = stateAfterClick(state, shift);
  if (mode === "off") {
    return held.filter((entry) => !sameValue(entry.value, value));
  }
  if (state === "off") {
    return [...held, { value, mode }];
  }
  return held.map((entry) =>
    sameValue(entry.value, value) ? { value: entry.value, mode } : entry,
  );
}

/** Rule 7: off → included (click) / excluded (shift); included → off (click) / excluded (shift); excluded → off. */
export function clicked(
  filters: Filters,
  filter: ListFilter,
  value: PersonValue | LabelValue,
  shift: boolean,
): Filters {
  if (filter === "label") {
    return value.kind === "me" || value.kind === "person"
      ? filters
      : { ...filters, label: clickedIn(filters.label, value, shift) };
  }
  return value.kind === "label"
    ? filters
    : { ...filters, [filter]: clickedIn(filters[filter], value, shift) };
}

export function withDraft(filters: Filters, draft: DraftFilter): Filters {
  return { ...filters, draft };
}

export function cleared(filters: Filters, filter: ListFilter): Filters {
  return { ...filters, [filter]: [] };
}

/** Rule 2: Reviewer = who (included), Draft = ready, every other filter off, the order for who. */
export function reviewing(who: ReviewFor): Filters {
  return {
    ...NO_FILTERS,
    reviewer: [{ value: who, mode: "included" }],
    draft: "ready",
    review: who,
  };
}

export function isFiltered(filters: Filters): boolean {
  return (
    filters.assignee.length > 0 ||
    filters.reviewer.length > 0 ||
    filters.label.length > 0 ||
    filters.draft !== "all" ||
    filters.review !== null
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
  const held: readonly Held<PersonValue | LabelValue>[] = filters[filter];
  const words = held.map(({ value, mode }) =>
    mode === "excluded" ? `not ${valueWord(value)}` : valueWord(value),
  );
  return held.length === 0 ? filterName(filter) : `${filterName(filter)}: ${words.join(", ")}`;
}
