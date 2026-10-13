import type { StorageLike } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";

import { createHiddenButtons, type HiddenButtons } from "./toolbarButtons";

const KEY = "yamt.toolbar.hidden";

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

function hiddenList(buttons: HiddenButtons): string[] {
  return [...buttons.hidden.value];
}

function spyWarnings(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    lines.push(line);
  });
  return lines;
}

test("toggling hides then shows a button and stores the hidden ones in toolbar order", () => {
  const storage = memoryStorage();
  const buttons = createHiddenButtons(storage);
  expect(hiddenList(buttons)).toEqual([]);
  expect(storage.items.get(KEY)).toBeUndefined();

  buttons.toggle("redo");
  expect(hiddenList(buttons)).toEqual(["redo"]);
  expect(storage.items.get(KEY)).toBe('["redo"]');

  buttons.toggle("previous");
  expect([...buttons.hidden.value].sort()).toEqual(["previous", "redo"]);
  expect(storage.items.get(KEY)).toBe('["previous","redo"]');

  buttons.toggle("redo");
  expect(hiddenList(buttons)).toEqual(["previous"]);
  expect(storage.items.get(KEY)).toBe('["previous"]');

  buttons.toggle("previous");
  expect(hiddenList(buttons)).toEqual([]);
  expect(storage.items.get(KEY)).toBe("[]");
});

test("a second start over the same storage hides the same buttons", () => {
  const storage = memoryStorage();
  const first = createHiddenButtons(storage);
  first.toggle("undo");
  first.toggle("next");

  const restarted = createHiddenButtons(storage);

  expect([...restarted.hidden.value].sort()).toEqual(["next", "undo"]);
});

test("stored ids yamt does not know are dropped and duplicates collapse", () => {
  const storage = memoryStorage({ [KEY]: '["redo","save","applyLeft","redo"]' });

  const buttons = createHiddenButtons(storage);

  expect([...buttons.hidden.value].sort()).toEqual(["applyLeft", "redo"]);
});

test.each([
  ["not JSON", "[undo"],
  ["a JSON object", '{"undo":true}'],
  ["a number", "4"],
  ["a string", '"undo"'],
  ["null", "null"],
  ["an array holding a non-string", '["undo",4]'],
])("a stored value that is %s hides nothing", (_name, value) => {
  const buttons = createHiddenButtons(memoryStorage({ [KEY]: value }));

  expect(hiddenList(buttons)).toEqual([]);
});

test("a missing key hides nothing and writes nothing until a toggle", () => {
  const storage = memoryStorage({ other: "x" });

  const buttons = createHiddenButtons(storage);

  expect(hiddenList(buttons)).toEqual([]);
  expect([...storage.items.keys()]).toEqual(["other"]);
});

test("a storage that throws hides nothing, still toggles in memory and logs warnings", () => {
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

  const buttons = createHiddenButtons(failing);
  expect(hiddenList(buttons)).toEqual([]);
  expect(warnings).toEqual([
    '[warn] toolbar.storage_failed {kind: "Unexpected", message: "storage disabled"}',
  ]);

  buttons.toggle("undo");
  expect(hiddenList(buttons)).toEqual(["undo"]);
  expect(warnings).toHaveLength(2);
});

test("a storage that throws only on write keeps the toggle and logs the write's message", () => {
  const warnings = spyWarnings();
  const storage = memoryStorage({ [KEY]: '["undo"]' });
  const buttons = createHiddenButtons({
    ...storage,
    setItem: () => {
      throw new Error("quota exceeded");
    },
  });

  buttons.toggle("redo");

  expect([...buttons.hidden.value].sort()).toEqual(["redo", "undo"]);
  expect(warnings).toEqual([
    '[warn] toolbar.storage_failed {kind: "Unexpected", message: "quota exceeded"}',
  ]);
});
