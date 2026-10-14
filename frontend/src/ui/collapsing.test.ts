import type { StorageLike } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";

import { createCollapsing } from "./collapsing";

const KEY = "yamt.collapse.unchanged";

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

test("a missing key collapses and writes nothing until a toggle", () => {
  const storage = memoryStorage({ other: "x" });

  const { collapsing } = createCollapsing(storage);

  expect(collapsing.value).toBe(true);
  expect([...storage.items.keys()]).toEqual(["other"]);
});

test('a stored "false" does not collapse', () => {
  expect(createCollapsing(memoryStorage({ [KEY]: "false" })).collapsing.value).toBe(false);
});

test.each([
  ["true", "true"],
  ["empty", ""],
  ["another word", "no"],
  ["JSON", "[]"],
  ["upper case", "FALSE"],
])("a stored value that is %s collapses", (_name, value) => {
  expect(createCollapsing(memoryStorage({ [KEY]: value })).collapsing.value).toBe(true);
});

test('toggling writes "false", then "true", and a second start reads the choice', () => {
  const storage = memoryStorage();
  const first = createCollapsing(storage);

  first.toggleCollapsing();
  expect(first.collapsing.value).toBe(false);
  expect(storage.items.get(KEY)).toBe("false");
  expect(createCollapsing(storage).collapsing.value).toBe(false);

  first.toggleCollapsing();
  expect(first.collapsing.value).toBe(true);
  expect(storage.items.get(KEY)).toBe("true");
  expect(createCollapsing(storage).collapsing.value).toBe(true);
});

test("a storage that throws collapses, still toggles in memory and logs warnings", () => {
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

  const collapse = createCollapsing(failing);
  expect(collapse.collapsing.value).toBe(true);
  expect(warnings).toEqual([
    '[warn] collapse.storage_failed {kind: "Unexpected", message: "storage disabled"}',
  ]);

  collapse.toggleCollapsing();
  expect(collapse.collapsing.value).toBe(false);
  expect(warnings).toHaveLength(2);
});
