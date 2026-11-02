import type { StorageLike } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";
import { shallowRef } from "vue";

import { isMergeRequestIid, type MergeRequestIid } from "../ipc";
import type { CalendarDay } from "../mergeRequests";
import { createDueDates } from "./mergeRequestDueDates";

const KEY = "yamt.mergeRequests.dueDates";
const REPOSITORY = "/home/sam/taskboard/.git";
const OTHER_REPOSITORY = "/home/sam/other/.git";
const NOV_5: CalendarDay = { year: 2026, month: 11, day: 5 };
const DEC_24: CalendarDay = { year: 2026, month: 12, day: 24 };

type MemoryStorage = StorageLike & { readonly items: Map<string, string> };

afterEach(() => {
  vi.restoreAllMocks();
});

function memoryStorage(initial: Record<string, unknown> = {}): MemoryStorage {
  const items = new Map<string, string>(
    Object.keys(initial).length === 0 ? [] : [[KEY, JSON.stringify(initial)]],
  );
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

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`${value} is not an iid`);
  }
  return value;
}

function stored(storage: MemoryStorage): string | undefined {
  return storage.items.get(KEY);
}

test("a date is set, changed and cleared, and the storage holds exactly the dates as YYYY-MM-DD per repository", () => {
  const storage = memoryStorage();
  const due = createDueDates(shallowRef(REPOSITORY), storage);
  expect(due.dates.value).toEqual(new Map());

  due.set(iid(12), NOV_5);
  expect(due.dates.value).toEqual(new Map([[12, NOV_5]]));
  expect(stored(storage)).toBe(JSON.stringify({ [REPOSITORY]: { "12": "2026-11-05" } }));

  due.set(iid(7), DEC_24);
  due.set(iid(12), DEC_24);
  expect(due.dates.value).toEqual(
    new Map([
      [7, DEC_24],
      [12, DEC_24],
    ]),
  );
  expect(stored(storage)).toBe(
    JSON.stringify({ [REPOSITORY]: { "7": "2026-12-24", "12": "2026-12-24" } }),
  );

  due.set(iid(7), null);
  expect(due.dates.value).toEqual(new Map([[12, DEC_24]]));
  due.set(iid(12), null);
  expect(due.dates.value).toEqual(new Map());
  expect(stored(storage)).toBe("{}");
});

test("a_date_survives_a_new_instance_over_the_same_storage (the reload)", () => {
  const storage = memoryStorage();
  createDueDates(shallowRef(REPOSITORY), storage).set(iid(640), NOV_5);
  expect(createDueDates(shallowRef(REPOSITORY), storage).dates.value).toEqual(
    new Map([[640, NOV_5]]),
  );
});

test("keep_only_drops_the_others_and_keeps_other_repositories", () => {
  const storage = memoryStorage({
    [REPOSITORY]: { "1": "2026-11-05", "2": "2026-12-24", "3": "2026-11-05" },
    [OTHER_REPOSITORY]: { "1": "2026-12-24" },
  });
  const due = createDueDates(shallowRef(REPOSITORY), storage);

  due.keepOnly(new Set([iid(2), iid(9)]));

  expect(due.dates.value).toEqual(new Map([[2, DEC_24]]));
  expect(stored(storage)).toBe(
    JSON.stringify({
      [OTHER_REPOSITORY]: { "1": "2026-12-24" },
      [REPOSITORY]: { "2": "2026-12-24" },
    }),
  );
});

test("keeping none of a repository's dates removes its entry", () => {
  const storage = memoryStorage({
    [REPOSITORY]: { "1": "2026-11-05" },
    [OTHER_REPOSITORY]: { "1": "2026-12-24" },
  });
  createDueDates(shallowRef(REPOSITORY), storage).keepOnly(new Set());
  expect(stored(storage)).toBe(JSON.stringify({ [OTHER_REPOSITORY]: { "1": "2026-12-24" } }));
});

test("keeping every date writes nothing (catches a write per load)", () => {
  const raw = { [REPOSITORY]: { "1": "2026-11-05", x: "2026-11-05" } };
  const storage = memoryStorage(raw);
  createDueDates(shallowRef(REPOSITORY), storage).keepOnly(new Set([iid(1)]));
  expect(stored(storage)).toBe(JSON.stringify(raw));
});

test.each<[string, unknown]>([
  [
    "an iid that is not a decimal",
    {
      x: "2026-11-05",
      "1.5": "2026-11-05",
      "-1": "2026-11-05",
      "": "2026-11-05",
      " 4": "2026-11-05",
    },
  ],
  [
    "a day that is not a calendar day",
    { "4": "2026-02-30", "5": "05/11/2026", "6": 20261105, "7": null, "8": ["2026-11-05"] },
  ],
  ["an entry that is not an object", "2026-11-05"],
  ["an entry that is null", null],
])("unreadable entries are dropped: %s", (_kind, entry) => {
  const storage = memoryStorage({ [REPOSITORY]: entry });
  const due = createDueDates(shallowRef(REPOSITORY), storage);
  expect(due.dates.value).toEqual(new Map());

  due.set(iid(8), NOV_5);
  expect(stored(storage)).toBe(JSON.stringify({ [REPOSITORY]: { "8": "2026-11-05" } }));
});

test("a readable date beside unreadable ones is kept", () => {
  const storage = memoryStorage({ [REPOSITORY]: { "3": "2026-11-05", "4": "soon" } });
  expect(createDueDates(shallowRef(REPOSITORY), storage).dates.value).toEqual(
    new Map([[3, NOV_5]]),
  );
});

test("with no repository there are no dates and writes are ignored; the dates follow the repository", () => {
  const storage = memoryStorage({
    [REPOSITORY]: { "3": "2026-11-05" },
    null: { "4": "2026-11-05" },
  });
  const repository = shallowRef<string | null>(null);
  const due = createDueDates(repository, storage);
  expect(due.dates.value).toEqual(new Map());

  due.set(iid(1), DEC_24);
  due.keepOnly(new Set());
  expect(stored(storage)).toBe(
    JSON.stringify({ [REPOSITORY]: { "3": "2026-11-05" }, null: { "4": "2026-11-05" } }),
  );

  repository.value = REPOSITORY;
  expect(due.dates.value).toEqual(new Map([[3, NOV_5]]));
  repository.value = OTHER_REPOSITORY;
  expect(due.dates.value).toEqual(new Map());
});

test("a storage that throws on write keeps the date in memory and logs under the due dates' event", () => {
  const warnings: string[] = [];
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    warnings.push(line);
  });
  const due = createDueDates(shallowRef(REPOSITORY), {
    ...memoryStorage(),
    setItem: () => {
      throw new Error("quota exceeded");
    },
  });

  due.set(iid(5), NOV_5);

  expect(due.dates.value).toEqual(new Map([[5, NOV_5]]));
  expect(warnings).toEqual([
    '[warn] mergeRequests.due_dates_storage_failed {kind: "Unexpected", message: "quota exceeded"}',
  ]);
});
