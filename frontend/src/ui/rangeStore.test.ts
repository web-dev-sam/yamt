import { afterEach, expect, test, vi } from "vitest";

import {
  createFixtureRangeSource,
  log,
  parseKey,
  type RangeEntry,
  type RangeFileId,
  type RangeSource,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import type { KeyPress } from "./fileListKey";
import { problemText } from "./problemText";
import { createRangeStore, MOUNTED_FILES, useRangeStore, type RangeStore } from "./rangeStore";
import { useSettingsStore } from "./settingsStore";

type Edit = (fixture: RangeSource) => Partial<RangeSource>;

const LINUX = "Linux x86_64";
const SIDE = { label: { kind: "named", name: "main" }, short_id: "1b2cfed", subject: "Start" };
const UNKNOWN: SourceFailure = { kind: "UnknownRangeFile", file: 3 };
const MICROTASKS = 10;

afterEach(() => {
  vi.restoreAllMocks();
});

function quiet(): string[] {
  const errors: string[] = [];
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    errors.push(line);
  });
  return errors;
}

function rangeCase(count: number): unknown {
  const paths = Array.from(
    { length: count },
    (_, index) => `src/f${String(index).padStart(2, "0")}.ts`,
  );
  return {
    start: {
      range: "main...feature",
      left: SIDE,
      right: { ...SIDE, label: { kind: "named", name: "feature" }, short_id: "2b3b4b5" },
      files: paths.map((path, id) => ({
        id,
        path,
        change: { kind: "modified" },
        lines: { kind: "counted", added: 1, removed: 1 },
      })),
    },
    files: paths.map((path) => ({
      kind: "texts",
      left: `${path}\n`,
      right: `${path}!\n`,
      differences: [],
      mode: { kind: "same" },
    })),
  };
}

function source(count: number): RangeSource {
  return createFixtureRangeSource(log, "?range=review", {
    "../../fixtures/range/review.json": rangeCase(count),
  });
}

async function started(count: number, edit: Edit = () => ({})): Promise<RangeStore> {
  const fixture = source(count);
  const store = createRangeStore({ ...fixture, ...edit(fixture) }, "dark");
  await store.startUp();
  return store;
}

function files(store: RangeStore): readonly RangeEntry[] {
  return store.start.value?.files ?? [];
}

function fileAt(store: RangeStore, index: number): RangeEntry {
  const entry = files(store)[index];
  if (entry === undefined) {
    throw new Error(`no file at ${index}`);
  }
  return entry;
}

function visitedIndexes(store: RangeStore): number[] {
  return store.visited.value.map((entry) => files(store).indexOf(entry));
}

function failed(failure: SourceFailure): Promise<SourceResult<never>> {
  return Promise.resolve({ ok: false, failure });
}

test("the window's components get no store before the root creates one", () => {
  expect(() => useRangeStore()).toThrow("useRangeStore() called before createRangeStore()");
});

test("the first file is shown at start and is the one file mounted (catches an empty main area at start)", async () => {
  const store = await started(3);

  expect(useRangeStore()).toBe(store);
  expect(useSettingsStore()).toBe(store);
  expect(store.shown.value).toBe(fileAt(store, 0).id);
  expect(store.shownPath.value).toBe("src/f00.ts");
  expect(visitedIndexes(store)).toEqual([0]);
  expect(store.screen.value).toEqual({ kind: "files" });
  expect(store.problem.value).toBeNull();
});

test("an empty range shows no file and mounts none", async () => {
  const store = await started(0);

  expect(store.start.value?.files).toEqual([]);
  expect(store.shown.value).toBeNull();
  expect(store.shownPath.value).toBeNull();
  expect(store.visited.value).toEqual([]);
});

test("before openRange answers: the files screen, the start theme's preferences, no file to show", async () => {
  quiet();
  const other = await started(4);
  const store = createRangeStore(source(4), "light");

  expect(store.screen.value).toEqual({ kind: "files" });
  expect(store.preferences.value.theme).toBe("light");
  store.showFile("src/f00.ts");
  expect([store.shown.value, store.visited.value]).toEqual([null, []]);

  expect(await store.loadFile(fileAt(other, 3))).toMatchObject({ kind: "texts" });
});

test("a failed openRange reports the range and shows nothing", async () => {
  const errors = quiet();
  const store = await started(3, () => ({
    openRange: () => Promise.reject(new Error("the app is gone")),
  }));

  expect(store.start.value).toBeNull();
  expect(store.shown.value).toBeNull();
  expect(store.problem.value).toEqual({
    action: "openRange",
    cause: { kind: "Unexpected", message: "the app is gone" },
  });
  expect(store.problem.value === null ? null : problemText(store.problem.value, LINUX)).toBe(
    "Could not open the range: the app is gone",
  );
  expect(errors).toEqual([
    '[error] store.openRange_failed {kind: "Unexpected", message: "the app is gone"}',
  ]);
});

test("showFile from the settings screen shows the file and returns the screen to files", async () => {
  const store = await started(3);
  store.openSettings();
  expect(store.screen.value).toEqual({ kind: "settings" });

  store.showFile("src/f02.ts");

  expect(store.screen.value).toEqual({ kind: "files" });
  expect(store.shown.value).toBe(fileAt(store, 2).id);
  expect(store.shownPath.value).toBe("src/f02.ts");
  expect(visitedIndexes(store)).toEqual([0, 2]);
});

test("closeSettings returns to the files; a path not in the range changes nothing", async () => {
  const store = await started(3);
  store.openSettings();
  store.closeSettings();
  expect(store.screen.value).toEqual({ kind: "files" });

  store.openSettings();
  store.showFile("src/missing.ts");

  expect(store.screen.value).toEqual({ kind: "settings" });
  expect(store.shown.value).toBe(fileAt(store, 0).id);
  expect(visitedIndexes(store)).toEqual([0]);
});

test("showing a visited file again keeps the mounted order (catches a moved view losing its scroll)", async () => {
  const store = await started(3);
  store.showFile("src/f01.ts");
  store.showFile("src/f02.ts");

  store.showFile("src/f00.ts");

  expect(store.shown.value).toBe(fileAt(store, 0).id);
  expect(visitedIndexes(store)).toEqual([0, 1, 2]);
});

test("the 17th file drops the least recently shown and keeps the others' order", async () => {
  const store = await started(MOUNTED_FILES + 2);
  for (let index = 1; index < MOUNTED_FILES; index += 1) {
    store.showFile(fileAt(store, index).path);
  }
  store.showFile(fileAt(store, 0).path);
  expect(store.visited.value).toHaveLength(MOUNTED_FILES);

  store.showFile(fileAt(store, MOUNTED_FILES).path);

  const kept = Array.from({ length: MOUNTED_FILES - 2 }, (_, index) => index + 2);
  expect(visitedIndexes(store)).toEqual([0, ...kept, MOUNTED_FILES]);

  store.showFile(fileAt(store, MOUNTED_FILES + 1).path);

  expect(visitedIndexes(store)).toEqual([0, ...kept.slice(1), MOUNTED_FILES, MOUNTED_FILES + 1]);
});

test("a failed load reports open with its path and leaves visited; a later success clears the problem", async () => {
  const errors = quiet();
  let refusing = true;
  const store = await started(3, (fixture) => ({
    loadRangeFile: (file: RangeFileId) =>
      refusing ? failed(UNKNOWN) : fixture.loadRangeFile(file),
  }));
  const second = fileAt(store, 1);
  store.showFile(second.path);
  expect(visitedIndexes(store)).toEqual([0, 1]);

  expect(await store.loadFile(second)).toBeNull();

  expect(store.problem.value).toEqual({ action: "open", path: "src/f01.ts", cause: UNKNOWN });
  expect(visitedIndexes(store)).toEqual([0]);
  expect(store.shown.value).toBe(second.id);
  expect(errors).toHaveLength(1);

  refusing = false;
  expect(await store.loadFile(fileAt(store, 0))).toMatchObject({ kind: "texts" });
  expect(store.problem.value).toEqual({ action: "open", path: "src/f01.ts", cause: UNKNOWN });

  store.showFile(second.path);
  expect(visitedIndexes(store)).toEqual([0, 1]);
  expect(await store.loadFile(second)).toEqual({
    kind: "texts",
    left: "src/f01.ts\n",
    right: "src/f01.ts!\n",
    differences: [],
    mode: { kind: "same" },
  });
  expect(store.problem.value).toBeNull();
});

test("a failed file leaves the eviction order too: the next eviction drops the least recent mounted file", async () => {
  quiet();
  const store = await started(MOUNTED_FILES + 2, (fixture) => ({
    loadRangeFile: (file: RangeFileId) =>
      file === 0 ? failed(UNKNOWN) : fixture.loadRangeFile(file),
  }));
  for (let index = 1; index < MOUNTED_FILES; index += 1) {
    store.showFile(fileAt(store, index).path);
  }
  await store.loadFile(fileAt(store, 0));
  expect(store.visited.value).toHaveLength(MOUNTED_FILES - 1);

  store.showFile(fileAt(store, MOUNTED_FILES).path);
  store.showFile(fileAt(store, MOUNTED_FILES + 1).path);

  const rest = Array.from({ length: MOUNTED_FILES - 2 }, (_, index) => index + 2);
  expect(visitedIndexes(store)).toEqual([...rest, MOUNTED_FILES, MOUNTED_FILES + 1]);
});

test("dismissProblem clears the shown problem", async () => {
  quiet();
  const store = await started(2, () => ({ loadRangeFile: () => failed(UNKNOWN) }));
  await store.loadFile(fileAt(store, 0));
  expect(store.problem.value).not.toBeNull();

  store.dismissProblem();

  expect(store.problem.value).toBeNull();
});

test("the bound key toggles the file list, never while a question waits", async () => {
  const store = await started(2);
  let prevents = 0;
  const ctrlB: KeyPress = {
    key: "b",
    code: "KeyB",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
    preventDefault: () => {
      prevents += 1;
    },
  };

  store.fileListKey(ctrlB, LINUX);
  expect([store.fileListShown.value, prevents]).toEqual([false, 1]);

  const key = parseKey("Mod-f");
  if (key === null) {
    throw new Error("Mod-f does not parse");
  }
  const adding = store.addKey("undo", key);
  await vi.waitFor(() => {
    expect(store.question.value?.kind).toBe("clash");
  });
  store.fileListKey(ctrlB, LINUX);
  expect([store.fileListShown.value, prevents]).toEqual([false, 1]);
  store.dismissQuestion();
  await adding;

  store.fileListKey(ctrlB, LINUX);
  expect([store.fileListShown.value, prevents]).toEqual([true, 2]);
});

test("answer settles the waiting question", async () => {
  const store = await started(1);
  const key = parseKey("Mod-f");
  if (key === null) {
    throw new Error("Mod-f does not parse");
  }
  const adding = store.addKey("undo", key);
  await vi.waitFor(() => {
    expect(store.question.value).not.toBeNull();
  });

  store.answer(false);
  await adding;
  for (let tick = 0; tick < MICROTASKS; tick += 1) {
    await Promise.resolve();
  }

  expect(store.question.value).toBeNull();
});
