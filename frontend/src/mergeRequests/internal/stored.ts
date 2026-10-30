import {
  NO_FILTERS,
  type DraftFilter,
  type Filters,
  type LabelValue,
  type PersonValue,
} from "./filters";

export type StoredFilters = {
  readonly assignee: readonly string[];
  readonly reviewer: readonly string[];
  readonly label: readonly string[];
  readonly draft: DraftFilter;
};

const USER_PREFIX = "user:";
const LABEL_PREFIX = "label:";

function storedPerson(value: PersonValue): string {
  return value.kind === "person" ? `${USER_PREFIX}${value.username}` : value.kind;
}

function storedLabel(value: LabelValue): string {
  return value.kind === "label" ? `${LABEL_PREFIX}${value.title}` : value.kind;
}

function personFrom(word: string): readonly PersonValue[] {
  if (word === "me" || word === "none") {
    return [{ kind: word }];
  }
  const username = word.startsWith(USER_PREFIX) ? word.slice(USER_PREFIX.length) : "";
  return username === "" ? [] : [{ kind: "person", username }];
}

function labelFrom(word: string): readonly LabelValue[] {
  if (word === "none") {
    return [{ kind: "none" }];
  }
  const title = word.startsWith(LABEL_PREFIX) ? word.slice(LABEL_PREFIX.length) : "";
  return title === "" ? [] : [{ kind: "label", title }];
}

function wordsOf(entry: object, field: keyof StoredFilters): readonly string[] {
  const words: unknown = Reflect.get(entry, field);
  if (!Array.isArray(words)) {
    return [];
  }
  const items: readonly unknown[] = words;
  return items.filter((word): word is string => typeof word === "string");
}

export function filtersFrom(stored: unknown): Filters {
  if (typeof stored !== "object" || stored === null) {
    return NO_FILTERS;
  }
  const draft: unknown = Reflect.get(stored, "draft");
  return {
    assignee: wordsOf(stored, "assignee").flatMap(personFrom),
    reviewer: wordsOf(stored, "reviewer").flatMap(personFrom),
    label: wordsOf(stored, "label").flatMap(labelFrom),
    draft: draft === "drafts" || draft === "ready" ? draft : "all",
  };
}

export function storedFilters(filters: Filters): StoredFilters {
  return {
    assignee: filters.assignee.map(storedPerson),
    reviewer: filters.reviewer.map(storedPerson),
    label: filters.label.map(storedLabel),
    draft: filters.draft,
  };
}
