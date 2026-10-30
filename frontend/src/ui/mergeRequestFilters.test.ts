import type { StorageLike } from "@vueuse/core";
import { expect, test } from "vitest";
import { shallowRef } from "vue";

import { NO_FILTERS, type Filters } from "../mergeRequests";
import { createRememberedFilters } from "./mergeRequestFilters";

const KEY = "yamt.mergeRequests.filters";
const REPOSITORY = "/home/sam/taskboard/.git";
const OTHER_REPOSITORY = "/home/sam/other/.git";
const FILTERS: Filters = {
  assignee: [{ kind: "me" }],
  reviewer: [{ kind: "person", username: "anna" }],
  label: [{ kind: "none" }],
  draft: "ready",
};
const STORED_FILTERS = {
  assignee: ["me"],
  reviewer: ["user:anna"],
  label: ["none"],
  draft: "ready",
};

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  readonly items: Map<string, string>;
} {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

function stored(storage: { readonly items: Map<string, string> }): unknown {
  const raw = storage.items.get(KEY);
  return raw === undefined ? undefined : JSON.parse(raw);
}

test("no filter at first; set filters are remembered under the repository", () => {
  const storage = memoryStorage();
  const remembered = createRememberedFilters(shallowRef(REPOSITORY), storage);
  expect(remembered.filters.value).toEqual(NO_FILTERS);
  expect(storage.items.get(KEY)).toBeUndefined();

  remembered.set(FILTERS);

  expect(remembered.filters.value).toEqual(FILTERS);
  expect(stored(storage)).toEqual({ [REPOSITORY]: STORED_FILTERS });
});

test("filters written before are read back by a new window", () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ [REPOSITORY]: STORED_FILTERS }) });
  expect(createRememberedFilters(shallowRef(REPOSITORY), storage).filters.value).toEqual(FILTERS);
});

test("another repository's entry survives a write, as written", () => {
  const others = { [OTHER_REPOSITORY]: { label: ["label:bug"] }, "/odd": "not filters" };
  const storage = memoryStorage({ [KEY]: JSON.stringify(others) });
  const repository = shallowRef<string | null>(REPOSITORY);
  const remembered = createRememberedFilters(repository, storage);
  expect(remembered.filters.value).toEqual(NO_FILTERS);

  remembered.set(FILTERS);
  expect(stored(storage)).toEqual({ ...others, [REPOSITORY]: STORED_FILTERS });

  repository.value = OTHER_REPOSITORY;
  expect(remembered.filters.value).toEqual({
    ...NO_FILTERS,
    label: [{ kind: "label", title: "bug" }],
  });
});

test("filters set back to none remove the repository's entry", () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ [OTHER_REPOSITORY]: STORED_FILTERS }) });
  const remembered = createRememberedFilters(shallowRef(REPOSITORY), storage);

  remembered.set(FILTERS);
  remembered.set(NO_FILTERS);

  expect(remembered.filters.value).toEqual(NO_FILTERS);
  expect(stored(storage)).toEqual({ [OTHER_REPOSITORY]: STORED_FILTERS });
});

test("with no repository there are no filters and a set writes nothing", () => {
  const entries = { [REPOSITORY]: STORED_FILTERS, null: STORED_FILTERS };
  const storage = memoryStorage({ [KEY]: JSON.stringify(entries) });
  const remembered = createRememberedFilters(shallowRef(null), storage);

  remembered.set({ ...NO_FILTERS, draft: "drafts" });

  expect(remembered.filters.value).toEqual(NO_FILTERS);
  expect(stored(storage)).toEqual(entries);
});

test.each([
  ["not JSON", "{"],
  ["a list", JSON.stringify([STORED_FILTERS])],
  ["null", "null"],
  ["a text", JSON.stringify("me")],
  ["an entry that is not filters", JSON.stringify({ [REPOSITORY]: ["me"] })],
])("storage holding %s reads as no filter, and a set starts afresh", (_kind, raw) => {
  const storage = memoryStorage({ [KEY]: raw });
  const remembered = createRememberedFilters(shallowRef(REPOSITORY), storage);
  expect(remembered.filters.value).toEqual(NO_FILTERS);

  remembered.set(FILTERS);

  expect(remembered.filters.value).toEqual(FILTERS);
  expect(stored(storage)).toEqual({ [REPOSITORY]: STORED_FILTERS });
});
