import type { StorageLike } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";

import { createFileListMode } from "./fileListMode";

const KEY = "yamt.files.view";

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

test("starts as the list, toggles to the tree and back, storing the plain name", () => {
  const storage = memoryStorage({ other: "x" });
  const view = createFileListMode(storage);

  expect(view.mode.value).toBe("list");
  expect([...storage.items.keys()]).toEqual(["other"]);

  view.toggle();
  expect(view.mode.value).toBe("tree");
  expect(storage.items.get(KEY)).toBe("tree");

  view.toggle();
  expect(view.mode.value).toBe("list");
  expect(storage.items.get(KEY)).toBe("list");
});

test("a second start over the same storage keeps the tree", () => {
  const storage = memoryStorage();
  createFileListMode(storage).toggle();

  expect(createFileListMode(storage).mode.value).toBe("tree");
});

test.each([
  ["upper case", "TREE"],
  ["empty", ""],
  ["JSON", "[]"],
  ["quoted", '"tree"'],
  ["the list", "list"],
])("a stored value that is %s starts the list", (_name, value) => {
  expect(createFileListMode(memoryStorage({ [KEY]: value })).mode.value).toBe("list");
});

test("a storage that throws starts the list, still toggles in memory and logs warnings", () => {
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

  const view = createFileListMode(failing);
  expect(view.mode.value).toBe("list");
  expect(warnings).toEqual([
    '[warn] files.view_storage_failed {kind: "Unexpected", message: "storage disabled"}',
  ]);

  expect(() => {
    view.toggle();
  }).not.toThrow();
  expect(view.mode.value).toBe("tree");
  expect(warnings).toHaveLength(2);
});

test("a storage that throws only on write keeps the toggle and logs the write's message", () => {
  const warnings = spyWarnings();
  const storage = memoryStorage();
  const view = createFileListMode({
    ...storage,
    setItem: () => {
      throw new Error("quota exceeded");
    },
  });

  view.toggle();

  expect(view.mode.value).toBe("tree");
  expect(warnings).toEqual([
    '[warn] files.view_storage_failed {kind: "Unexpected", message: "quota exceeded"}',
  ]);
});
