import type { StorageLike } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";

import { parseStored, storedValue } from "./windowStorage";

const KEY = "yamt.test.value";
const EVENT = "test.storage_failed";
const UPPER = {
  read: (raw: string) => raw.toUpperCase(),
  write: (value: string) => value.toLowerCase(),
};

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

function spyWarnings(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    lines.push(line);
  });
  return lines;
}

test("a missing key gives the fallback and writes nothing", () => {
  const storage = memoryStorage({ other: "x" });

  const value = storedValue(KEY, "FALLBACK", UPPER, EVENT, storage);

  expect(value.value).toBe("FALLBACK");
  expect([...storage.items.entries()]).toEqual([["other", "x"]]);
});

test("a stored value is read through the caller's read", () => {
  expect(storedValue(KEY, "FALLBACK", UPPER, EVENT, memoryStorage({ [KEY]: "tree" })).value).toBe(
    "TREE",
  );
});

test("a change is written through the caller's write before the assignment returns", () => {
  const storage = memoryStorage();
  const value = storedValue(KEY, "FALLBACK", UPPER, EVENT, storage);

  value.value = "Tree";

  expect(storage.items.get(KEY)).toBe("tree");
});

test("a storage that throws gives the fallback and logs under the caller's event name", () => {
  const warnings = spyWarnings();
  const failing: StorageLike = {
    getItem: () => {
      throw new Error("storage disabled");
    },
    setItem: () => {
      throw new Error("quota exceeded");
    },
    removeItem: () => {
      throw new Error("storage disabled");
    },
  };

  const value = storedValue(KEY, "FALLBACK", UPPER, EVENT, failing);
  expect(value.value).toBe("FALLBACK");
  expect(warnings).toEqual([
    '[warn] test.storage_failed {kind: "Unexpected", message: "storage disabled"}',
  ]);

  value.value = "Tree";
  expect(value.value).toBe("Tree");
  expect(warnings).toEqual([
    '[warn] test.storage_failed {kind: "Unexpected", message: "storage disabled"}',
    '[warn] test.storage_failed {kind: "Unexpected", message: "storage disabled"}',
  ]);
});

test("stored JSON is parsed; text that is not JSON gives null", () => {
  expect(parseStored('{"local":0.2,"hidden":[true]}')).toEqual({ local: 0.2, hidden: [true] });
  expect(parseStored("[1]")).toEqual([1]);
  expect(parseStored("{not json")).toBeNull();
  expect(parseStored("")).toBeNull();
});
