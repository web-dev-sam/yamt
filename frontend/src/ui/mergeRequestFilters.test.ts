import type { StorageLike } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";
import { nextTick, shallowRef } from "vue";

import type { DiscussionDetails } from "../ipc";
import { NO_FILTERS, type Filters, type ReviewFor } from "../mergeRequests";
import { choicesOf, createRememberedFilters, filterActions } from "./mergeRequestFilters";

const KEY = "yamt.mergeRequests.filters";
const REPOSITORY = "/home/sam/taskboard/.git";
const OTHER_REPOSITORY = "/home/sam/other/.git";
const FILTERS: Filters = {
  assignee: [{ value: { kind: "me" }, mode: "included" }],
  reviewer: [{ value: { kind: "person", username: "anna" }, mode: "included" }],
  label: [{ value: { kind: "none" }, mode: "included" }],
  draft: "ready",
  review: null,
};
const STORED_FILTERS = {
  assignee: ["me"],
  reviewer: ["user:anna"],
  label: ["none"],
  draft: "ready",
};

function full(): boolean {
  return true;
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
  const remembered = createRememberedFilters(shallowRef(REPOSITORY), full, storage);
  expect(remembered.filters.value).toEqual(NO_FILTERS);
  expect(storage.items.get(KEY)).toBeUndefined();

  remembered.set(FILTERS);

  expect(remembered.filters.value).toEqual(FILTERS);
  expect(stored(storage)).toEqual({ [REPOSITORY]: STORED_FILTERS });
});

test("filters written before are read back by a new window: today's stored JSON reads as included", () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ [REPOSITORY]: STORED_FILTERS }) });
  expect(createRememberedFilters(shallowRef(REPOSITORY), full, storage).filters.value).toEqual(
    FILTERS,
  );
});

test("an excluded value is stored with not: and read back excluded beside included ones", () => {
  const storage = memoryStorage();
  const excluded: Filters = {
    ...FILTERS,
    assignee: [{ value: { kind: "me" }, mode: "excluded" }],
    label: [
      { value: { kind: "label", title: "frontend" }, mode: "included" },
      { value: { kind: "none" }, mode: "excluded" },
    ],
  };
  createRememberedFilters(shallowRef(REPOSITORY), full, storage).set(excluded);

  expect(storage.items.get(KEY)).toBe(
    JSON.stringify({
      [REPOSITORY]: {
        assignee: ["not:me"],
        reviewer: ["user:anna"],
        label: ["label:frontend", "not:none"],
        draft: "ready",
      },
    }),
  );
  expect(createRememberedFilters(shallowRef(REPOSITORY), full, storage).filters.value).toEqual(
    excluded,
  );
});

test("another repository's entry survives a write, as written", () => {
  const others = { [OTHER_REPOSITORY]: { label: ["label:bug"] }, "/odd": "not filters" };
  const storage = memoryStorage({ [KEY]: JSON.stringify(others) });
  const repository = shallowRef<string | null>(REPOSITORY);
  const remembered = createRememberedFilters(repository, full, storage);
  expect(remembered.filters.value).toEqual(NO_FILTERS);

  remembered.set(FILTERS);
  expect(stored(storage)).toEqual({ ...others, [REPOSITORY]: STORED_FILTERS });

  repository.value = OTHER_REPOSITORY;
  expect(remembered.filters.value).toEqual({
    ...NO_FILTERS,
    label: [{ value: { kind: "label", title: "bug" }, mode: "included" }],
  });
});

test("filters set back to none remove the repository's entry", () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ [OTHER_REPOSITORY]: STORED_FILTERS }) });
  const remembered = createRememberedFilters(shallowRef(REPOSITORY), full, storage);

  remembered.set(FILTERS);
  remembered.set(NO_FILTERS);

  expect(remembered.filters.value).toEqual(NO_FILTERS);
  expect(stored(storage)).toEqual({ [OTHER_REPOSITORY]: STORED_FILTERS });
});

test("with no repository there are no filters and a set writes nothing", () => {
  const entries = { [REPOSITORY]: STORED_FILTERS, null: STORED_FILTERS };
  const storage = memoryStorage({ [KEY]: JSON.stringify(entries) });
  const remembered = createRememberedFilters(shallowRef(null), full, storage);

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
  const remembered = createRememberedFilters(shallowRef(REPOSITORY), full, storage);
  expect(remembered.filters.value).toEqual(NO_FILTERS);

  remembered.set(FILTERS);

  expect(remembered.filters.value).toEqual(FILTERS);
  expect(stored(storage)).toEqual({ [REPOSITORY]: STORED_FILTERS });
});

test("a storage that throws on write keeps the filters in memory and logs under the filters' event", () => {
  const warnings: string[] = [];
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    warnings.push(line);
  });
  const remembered = createRememberedFilters(shallowRef(REPOSITORY), full, {
    ...memoryStorage(),
    setItem: () => {
      throw new Error("quota exceeded");
    },
  });

  remembered.set(FILTERS);

  expect(remembered.filters.value).toEqual(FILTERS);
  expect(warnings).toEqual([
    '[warn] mergeRequests.filters_storage_failed {kind: "Unexpected", message: "quota exceeded"}',
  ]);
});

const ANNA_REVIEW: ReviewFor = { kind: "person", username: "anna" };
const STORED_REVIEW = {
  assignee: [],
  reviewer: ["user:anna"],
  label: [],
  draft: "ready",
  review: "user:anna",
};

function reviewRig(entries: Record<string, unknown>, initial: DiscussionDetails = "full") {
  const storage = memoryStorage({ [KEY]: JSON.stringify(entries) });
  const mode = shallowRef<DiscussionDetails>(initial);
  const remembered = createRememberedFilters(
    shallowRef(REPOSITORY),
    () => mode.value === "full",
    storage,
  );
  return { storage, mode, remembered };
}

test("leaving_load_fully_turns_the_review_order_off_and_keeps_its_filters", async () => {
  const others = { [OTHER_REPOSITORY]: STORED_REVIEW };
  const { storage, mode, remembered } = reviewRig({ ...others, [REPOSITORY]: STORED_REVIEW });
  expect(remembered.filters.value.review).toEqual(ANNA_REVIEW);

  mode.value = "lazy";
  await nextTick();

  const { review: _off, ...kept } = STORED_REVIEW;
  expect(stored(storage)).toEqual({ ...others, [REPOSITORY]: kept });
  expect(remembered.filters.value).toEqual({
    ...NO_FILTERS,
    reviewer: [{ value: ANNA_REVIEW, mode: "included" }],
    draft: "ready",
  });

  mode.value = "full";
  await nextTick();
  mode.value = "off";
  await nextTick();

  expect(remembered.filters.value.review).toBeNull();
  expect(stored(storage)).toEqual({ ...others, [REPOSITORY]: kept });
});

test("leaving_load_fully_without_a_review_order_leaves_the_entry_as_written", async () => {
  const entries = { [REPOSITORY]: { ...STORED_FILTERS, label: ["none", "junk"], later: 1 } };
  const { storage, mode } = reviewRig(entries);

  mode.value = "off";
  await nextTick();

  expect(stored(storage)).toEqual(entries);
});

test("turning_to_load_fully_writes_nothing_and_shows_a_stored_review_order", async () => {
  const entries = { [REPOSITORY]: { ...STORED_REVIEW, later: 1 } };
  const { storage, mode, remembered } = reviewRig(entries, "lazy");
  expect(remembered.filters.value.review).toBeNull();

  mode.value = "full";
  await nextTick();

  expect(stored(storage)).toEqual(entries);
  expect(remembered.filters.value.review).toEqual(ANNA_REVIEW);
});

test("the_review_order_reads_as_off_while_details_are_not_full", () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ [REPOSITORY]: STORED_REVIEW }) });
  const remembered = createRememberedFilters(shallowRef(REPOSITORY), () => false, storage);

  expect(remembered.filters.value).toEqual({
    ...NO_FILTERS,
    reviewer: [{ value: ANNA_REVIEW, mode: "included" }],
    draft: "ready",
  });
  expect(
    createRememberedFilters(shallowRef(REPOSITORY), full, storage).filters.value.review,
  ).toEqual(ANNA_REVIEW);
});

test("review_sets_reviewer_and_ready_and_stores_the_review_word", () => {
  const { storage, remembered } = reviewRig({ [REPOSITORY]: STORED_FILTERS });
  const actions = filterActions(remembered);

  actions.review(ANNA_REVIEW);

  expect(stored(storage)).toEqual({ [REPOSITORY]: STORED_REVIEW });
  expect(remembered.filters.value).toEqual({
    ...NO_FILTERS,
    reviewer: [{ value: ANNA_REVIEW, mode: "included" }],
    draft: "ready",
    review: ANNA_REVIEW,
  });

  actions.review({ kind: "me" });
  expect(stored(storage)).toEqual({
    [REPOSITORY]: { ...STORED_REVIEW, reviewer: ["me"], review: "me" },
  });

  actions.clearAll();
  expect(stored(storage)).toEqual({});
  expect(remembered.filters.value).toEqual(NO_FILTERS);
});

test("the picker's choices are the reviewer choices without None, the review included", () => {
  const choices = choicesOf([], { ...NO_FILTERS, review: { kind: "me" } }, "sam");
  expect(choices.reviewer.map((choice) => choice.label)).toEqual(["Me", "None"]);
  expect(choices.review).toEqual([
    { value: { kind: "me" }, label: "Me", count: 0, state: "included" },
  ]);
});
