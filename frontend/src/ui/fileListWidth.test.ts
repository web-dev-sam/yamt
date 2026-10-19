import type { StorageLike } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";

import { createFileListWidth, FILE_LIST_BOUNDS } from "./fileListWidth";

const KEY = "yamt.files.width";

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

test("a missing key gives the starting width and writes nothing", () => {
  const storage = memoryStorage({ other: "x" });

  expect(createFileListWidth(storage).width.value).toBeNull();
  expect([...storage.items.entries()]).toEqual([["other", "x"]]);
});

test.each([
  ["the minimum", "160", 160],
  ["a wide list", "612.5", 612.5],
])("a stored width that is %s is read back", (_name, raw, px) => {
  expect(createFileListWidth(memoryStorage({ [KEY]: raw })).width.value).toBe(px);
});

test.each([
  ["empty", ""],
  ["a word", "wide"],
  ["JSON", "{}"],
  ["under the minimum", "159.5"],
  ["zero", "0"],
  ["negative", "-300"],
  ["infinite", "Infinity"],
])("a stored width that is %s gives the starting width without a warning", (_name, raw) => {
  const warnings = spyWarnings();

  expect(createFileListWidth(memoryStorage({ [KEY]: raw })).width.value).toBeNull();
  expect(warnings).toEqual([]);
});

test("a set width is written and a second start reads it", () => {
  const storage = memoryStorage();
  const first = createFileListWidth(storage);

  first.setWidth(300, 1600);

  expect(first.width.value).toBe(300);
  expect(storage.items.get(KEY)).toBe("300");
  expect(createFileListWidth(storage).width.value).toBe(300);
});

test("a width is clamped to 160 px at the narrow end and half the window at the wide end", () => {
  const list = createFileListWidth(memoryStorage());

  list.setWidth(100, 1600);
  expect(list.width.value).toBe(160);
  list.setWidth(900, 1600);
  expect(list.width.value).toBe(800);
  list.setWidth(700, 1600);
  expect(list.width.value).toBe(700);
});

test("the CSS bounds are the clamp's: 160 px and half the window", () => {
  const list = createFileListWidth(memoryStorage());

  expect(FILE_LIST_BOUNDS).toEqual({ minWidth: "160px", maxWidth: "50vw" });
  list.setWidth(0, 1000);
  expect(`${list.width.value}px`).toBe(FILE_LIST_BOUNDS.minWidth);
  list.setWidth(5000, 1000);
  expect(`${((list.width.value ?? 0) / 1000) * 100}vw`).toBe(FILE_LIST_BOUNDS.maxWidth);
});

test("in a window narrower than two minimums the width is the minimum", () => {
  const list = createFileListWidth(memoryStorage());

  list.setWidth(250, 300);

  expect(list.width.value).toBe(160);
});

test("reset goes back to the starting width and removes the key", () => {
  const storage = memoryStorage();
  const list = createFileListWidth(storage);
  list.setWidth(400, 1600);

  list.resetWidth();

  expect(list.width.value).toBeNull();
  expect(storage.items.has(KEY)).toBe(false);
  expect(createFileListWidth(storage).width.value).toBeNull();
});

test("a storage that throws gives the starting width, still sets it in memory, and warns", () => {
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

  const list = createFileListWidth(failing);
  expect(list.width.value).toBeNull();
  expect(warnings).toEqual([
    '[warn] files.width_storage_failed {kind: "Unexpected", message: "storage disabled"}',
  ]);

  list.setWidth(320, 1600);
  expect(list.width.value).toBe(320);
  expect(warnings).toHaveLength(2);
});
