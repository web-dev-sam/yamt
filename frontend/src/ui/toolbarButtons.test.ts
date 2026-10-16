import type { StorageLike } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";

import {
  createHiddenButtons,
  listedButtons,
  shownButtons,
  TOOLBAR_BUTTONS,
  type HiddenButtons,
  type ToolbarButtonId,
} from "./toolbarButtons";

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

function storedDecisions(storage: { readonly items: Map<string, string> }): unknown {
  const raw = storage.items.get(KEY);
  return raw === undefined ? undefined : JSON.parse(raw);
}

test("Abort merge, Undo and Redo start hidden; toggling stores each decided button", () => {
  const storage = memoryStorage();
  const buttons = createHiddenButtons(storage);
  expect(hiddenList(buttons)).toEqual(["abortMerge", "undo", "redo"]);
  expect(storage.items.get(KEY)).toBeUndefined();

  buttons.toggle("redo");
  expect(hiddenList(buttons)).toEqual(["abortMerge", "undo"]);
  expect(storedDecisions(storage)).toEqual({ redo: false });

  buttons.toggle("previous");
  expect(hiddenList(buttons)).toEqual(["abortMerge", "previous", "undo"]);
  expect(storedDecisions(storage)).toEqual({ previous: true, redo: false });

  buttons.toggle("abortMerge");
  expect(hiddenList(buttons)).toEqual(["previous", "undo"]);
  expect(storedDecisions(storage)).toEqual({ abortMerge: false, previous: true, redo: false });

  buttons.toggle("previous");
  expect(hiddenList(buttons)).toEqual(["undo"]);
  expect(storedDecisions(storage)).toEqual({ abortMerge: false, previous: false, redo: false });
});

test("a second start over the same storage keeps the choice, Abort merge shown included", () => {
  const storage = memoryStorage();
  const first = createHiddenButtons(storage);
  first.toggle("undo");
  first.toggle("next");
  first.toggle("abortMerge");

  expect(hiddenList(createHiddenButtons(storage))).toEqual(["next", "redo"]);

  first.toggle("redo");
  first.toggle("next");

  expect(hiddenList(createHiddenButtons(storage))).toEqual([]);
});

test.each([
  ["[]", ["abortMerge"]],
  ['["undo"]', ["abortMerge", "undo"]],
  ['["undo","redo"]', ["abortMerge", "undo", "redo"]],
  ['["next","collapse"]', ["abortMerge", "next", "collapse"]],
])(
  "a hidden list stored before Abort merge existed (%s) keeps the seven decisions and hides Abort merge",
  (stored, hidden) => {
    const storage = memoryStorage({ [KEY]: stored });

    const buttons = createHiddenButtons(storage);

    expect(hiddenList(buttons)).toEqual(hidden);
    expect(storage.items.get(KEY)).toBe(stored);
  },
);

test("a hidden list stored before Abort merge existed is rewritten as decisions at the first toggle", () => {
  const storage = memoryStorage({ [KEY]: '["undo"]' });
  const buttons = createHiddenButtons(storage);

  buttons.toggle("abortMerge");

  expect(hiddenList(buttons)).toEqual(["undo"]);
  expect(storedDecisions(storage)).toEqual({
    abortMerge: false,
    previous: false,
    next: false,
    collapse: false,
    applyLeft: false,
    applyRight: false,
    undo: true,
    redo: false,
  });
  expect(hiddenList(createHiddenButtons(storage))).toEqual(["undo"]);
});

test("a hidden list from before drops ids yamt does not know and collapses duplicates", () => {
  const buttons = createHiddenButtons(
    memoryStorage({ [KEY]: '["redo","save","applyLeft","redo"]' }),
  );

  expect(hiddenList(buttons)).toEqual(["abortMerge", "applyLeft", "redo"]);
});

test("stored decisions drop ids yamt does not know and values that are not true or false", () => {
  const storage = memoryStorage({
    [KEY]: '{"save":true,"undo":false,"next":"yes","abortMerge":false,"redo":null}',
  });

  const buttons = createHiddenButtons(storage);
  expect(hiddenList(buttons)).toEqual(["redo"]);

  buttons.toggle("previous");
  expect(storedDecisions(storage)).toEqual({ abortMerge: false, previous: true, undo: false });
});

test("the toolbar order puts Abort merge first and the collapse toggle after Next change", () => {
  expect(TOOLBAR_BUTTONS).toEqual([
    "abortMerge",
    "previous",
    "next",
    "collapse",
    "applyLeft",
    "applyRight",
    "undo",
    "redo",
  ]);
});

test("the menu lists Abort merge only while git has a merge to abort", () => {
  const withoutAbort = TOOLBAR_BUTTONS.filter((id) => id !== "abortMerge");

  expect(listedButtons("noMerge")).toEqual(withoutAbort);
  expect(listedButtons("ready")).toEqual(TOOLBAR_BUTTONS);
  expect(listedButtons("running")).toEqual(TOOLBAR_BUTTONS);
});

test("the toolbar shows Abort merge only while git has a merge to abort and the user shows it", () => {
  const userHidesUndo = new Set<ToolbarButtonId>(["undo"]);
  const userHidesAbort = new Set<ToolbarButtonId>(["abortMerge", "undo"]);

  expect(shownButtons("ready", userHidesUndo)).toEqual([
    "abortMerge",
    "previous",
    "next",
    "collapse",
    "applyLeft",
    "applyRight",
    "redo",
  ]);
  expect(shownButtons("running", userHidesUndo)[0]).toBe("abortMerge");
  expect(shownButtons("noMerge", userHidesUndo)).not.toContain("abortMerge");
  expect(shownButtons("noMerge", userHidesUndo)).toHaveLength(6);
  expect(shownButtons("ready", userHidesAbort)).not.toContain("abortMerge");
  expect(shownButtons("ready", userHidesAbort)).toHaveLength(6);
});

test.each([
  ["not JSON", "[undo"],
  ["a number", "4"],
  ["a string", '"undo"'],
  ["null", "null"],
  ["an array holding a non-string", '["undo",4]'],
])("a stored value that is %s hides Abort merge, Undo and Redo, as at first", (_name, value) => {
  const warnings = spyWarnings();

  const buttons = createHiddenButtons(memoryStorage({ [KEY]: value }));

  expect(hiddenList(buttons)).toEqual(["abortMerge", "undo", "redo"]);
  expect(warnings).toEqual([]);
});

test("a missing key hides Abort merge, Undo and Redo and writes nothing until a toggle", () => {
  const storage = memoryStorage({ other: "x" });

  const buttons = createHiddenButtons(storage);

  expect(hiddenList(buttons)).toEqual(["abortMerge", "undo", "redo"]);
  expect([...storage.items.keys()]).toEqual(["other"]);
});

test("a storage that throws hides Abort merge, Undo and Redo, still toggles in memory and logs warnings", () => {
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
  expect(hiddenList(buttons)).toEqual(["abortMerge", "undo", "redo"]);
  expect(warnings).toEqual([
    '[warn] toolbar.storage_failed {kind: "Unexpected", message: "storage disabled"}',
  ]);

  buttons.toggle("undo");
  expect(hiddenList(buttons)).toEqual(["abortMerge", "redo"]);
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

  expect(hiddenList(buttons)).toEqual(["abortMerge", "undo", "redo"]);
  expect(warnings).toEqual([
    '[warn] toolbar.storage_failed {kind: "Unexpected", message: "quota exceeded"}',
  ]);
});
