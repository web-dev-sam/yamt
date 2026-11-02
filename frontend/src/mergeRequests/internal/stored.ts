import {
  NO_FILTERS,
  sameValue,
  type DraftFilter,
  type Filters,
  type Held,
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
const EXCLUDED_PREFIX = "not:";

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

function heldFrom<V extends PersonValue | LabelValue>(
  words: readonly string[],
  valueFrom: (word: string) => readonly V[],
): readonly Held<V>[] {
  const held: Held<V>[] = [];
  for (const word of words) {
    const excluded = word.startsWith(EXCLUDED_PREFIX);
    for (const value of valueFrom(excluded ? word.slice(EXCLUDED_PREFIX.length) : word)) {
      if (!held.some((entry) => sameValue(entry.value, value))) {
        held.push({ value, mode: excluded ? "excluded" : "included" });
      }
    }
  }
  return held;
}

function storedWords<V>(held: readonly Held<V>[], word: (value: V) => string): readonly string[] {
  return held.map(({ value, mode }) =>
    mode === "excluded" ? `${EXCLUDED_PREFIX}${word(value)}` : word(value),
  );
}

export function filtersFrom(stored: unknown): Filters {
  if (typeof stored !== "object" || stored === null) {
    return NO_FILTERS;
  }
  const draft: unknown = Reflect.get(stored, "draft");
  return {
    assignee: heldFrom(wordsOf(stored, "assignee"), personFrom),
    reviewer: heldFrom(wordsOf(stored, "reviewer"), personFrom),
    label: heldFrom(wordsOf(stored, "label"), labelFrom),
    draft: draft === "drafts" || draft === "ready" ? draft : "all",
  };
}

export function storedFilters(filters: Filters): StoredFilters {
  return {
    assignee: storedWords(filters.assignee, storedPerson),
    reviewer: storedWords(filters.reviewer, storedPerson),
    label: storedWords(filters.label, storedLabel),
    draft: filters.draft,
  };
}
