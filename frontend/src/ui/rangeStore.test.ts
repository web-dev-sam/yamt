import { setSSRHandler } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";

import { AgentClient, DEFAULT_AGENT_COMMAND, DEFAULT_FIRST_MESSAGE } from "../agent";
import {
  changedThreadLine,
  createFixtureAgentSource,
  createFixtureRangeSource,
  log,
  parseKey,
  type AgentSource,
  type RangeEntry,
  type RangeFileId,
  type RangeSource,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import { COLLAPSE_LABEL, createCollapsing } from "./collapsing";
import type { KeyPress } from "./fileListKey";
import { problemText } from "./problemText";
import {
  askContext,
  createRangeStore,
  MOUNTED_FILES,
  useRangeStore,
  type RangeStore,
} from "./rangeStore";
import { useSettingsStore } from "./settingsStore";
import { listedButtons } from "./toolbarButtons";

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
  const store = createRangeStore({ ...fixture, ...edit(fixture) }, "dark", null);
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
  const store = createRangeStore(source(4), "light", null);

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

test("at start the list shows first, then the threads load and GitLab is checked once", async () => {
  const calls: string[] = [];
  const store = await started(2, (fixture) => ({
    openRange: async () => {
      calls.push("openRange");
      return fixture.openRange();
    },
    listThreads: async () => {
      calls.push("listThreads");
      return fixture.listThreads();
    },
    checkGitLab: async () => {
      calls.push(`checkGitLab shown ${String(useRangeStore().shown.value)}`);
      return fixture.checkGitLab();
    },
  }));

  expect(calls).toEqual(["openRange", "listThreads", `checkGitLab shown ${fileAt(store, 0).id}`]);
  expect(store.gitlab.check.value?.kind).toBe("linedUp");
  expect(store.gitlab.checking.value).toBe(false);
  expect(store.threads.list.value).toEqual({ threads: [] });
});

test("a failed openRange loads no threads and checks nothing", async () => {
  quiet();
  const calls: string[] = [];
  const store = await started(2, () => ({
    openRange: async () => ({ ok: false, failure: UNKNOWN }),
    listThreads: async () => {
      calls.push("listThreads");
      return { ok: true, value: { threads: [] } };
    },
    checkGitLab: async () => {
      calls.push("checkGitLab");
      return { ok: false, failure: UNKNOWN };
    },
  }));

  expect(calls).toEqual([]);
  expect(store.gitlab.check.value).toBeNull();
});

test("a failed thread list is the window's problem", async () => {
  const errors = quiet();
  const store = await started(2, () => ({
    listThreads: async () => ({ ok: false, failure: { kind: "WorkerStopped" } }),
  }));

  expect(store.problem.value).toEqual({
    action: "threads",
    step: "list",
    cause: { kind: "WorkerStopped" },
  });
  expect(errors).toEqual(['[error] store.threads_failed {step: "list", kind: "WorkerStopped"}']);
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

test("the search hands the keyboard back to the shown file's right column", async () => {
  const store = await started(3);
  store.showFile("src/f02.ts");

  store.search.focusShownFile();

  expect(store.search.goTo.value).toEqual({
    id: 1,
    path: "src/f02.ts",
    pane: "right",
    match: null,
  });
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

test("a draft outlives its file's view: 16 other files evict file 0 and the draft is still there", async () => {
  const store = await started(MOUNTED_FILES + 1);
  const first = fileAt(store, 0);
  const line = changedThreadLine("right", 0);
  store.threads.startThread(first.id, line);
  store.threads.writeDraft("draft-0", "Why?");

  for (let index = 1; index <= MOUNTED_FILES; index += 1) {
    store.showFile(fileAt(store, index).path);
  }

  expect(store.visited.value).not.toContain(first);
  expect(store.threads.shownFor(first.id)).toEqual([{ key: "draft-0", line, shown: "draft" }]);
  expect(store.threads.boxOf("draft-0")).toMatchObject({ kind: "draft", draft: { text: "Why?" } });
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

test("without --ai the store has no AI and the window closes without asking", async () => {
  const store = await started(2);

  expect(store.ai).toBeNull();
  expect(await store.mayClose()).toBe(true);
  expect(store.question.value).toBeNull();
});

test("First message's values: the thread's place, the range as typed, both short ids", async () => {
  quiet();
  const store = createRangeStore(
    createFixtureRangeSource(log, "?range=review&threads=seeded"),
    "dark",
    null,
  );
  await store.startUp();
  const start = store.start.value;
  const [removed, added] = store.threads.list.value.threads;
  if (start === null || removed === undefined || added === undefined) {
    throw new Error("the seeded review did not open");
  }
  const custom = { command: null, firstMessage: "Hi {{ MESSAGE }}" };

  expect(askContext(start, { command: null, firstMessage: null }, added)).toEqual({
    template: DEFAULT_FIRST_MESSAGE,
    values: {
      RELATIVE_FILE_PATH_WITH_LINE: "src/board/board.ts:21",
      RANGE: start.range,
      OLD_COMMIT: start.left.shortId,
      NEW_COMMIT: start.right.shortId,
    },
  });
  expect(askContext(start, custom, removed)).toMatchObject({
    template: "Hi {{ MESSAGE }}",
    values: { RELATIVE_FILE_PATH_WITH_LINE: "src/board/board.ts:20" },
  });
  expect(askContext(null, custom, added)).toBeNull();
  expect(askContext({ ...start, files: [] }, custom, added)).toBeNull();
});

async function aiStore(discards: string[]): Promise<RangeStore> {
  const agent = createFixtureAgentSource(log, "?ai-changes");
  const source: AgentSource = {
    ...agent,
    discardCheckout: async () => {
      discards.push("discard");
      return agent.discardCheckout();
    },
  };
  const client = new AgentClient({ source, command: () => DEFAULT_AGENT_COMMAND });
  const store = createRangeStore(createFixtureRangeSource(log, "?range=review"), "dark", {
    source,
    client,
  });
  await store.startUp();
  return store;
}

async function closeQuestion(store: RangeStore): Promise<{ readonly closing: Promise<boolean> }> {
  const closing = store.mayClose();
  await vi.waitFor(() => {
    expect(store.question.value).toMatchObject({ kind: "keepAiChanges", files: ["README.md"] });
  });
  return { closing };
}

test("with --ai a changed checkout asks first: Keep closes, Discard discards then closes, dismiss stays", async () => {
  quiet();
  const discards: string[] = [];
  const store = await aiStore(discards);

  const kept = await closeQuestion(store);
  store.answer(true);
  expect([await kept.closing, discards]).toEqual([true, []]);

  const discarded = await closeQuestion(store);
  store.answer(false);
  expect([await discarded.closing, discards]).toEqual([true, ["discard"]]);

  const dismissed = await closeQuestion(store);
  store.dismissQuestion();
  expect([await dismissed.closing, discards]).toEqual([false, ["discard"]]);
});

test("deleteNote asks first: Cancel and Escape keep the note, Delete removes it and its emptied thread", async () => {
  quiet();
  const store = createRangeStore(
    createFixtureRangeSource(log, "?range=review&threads=seeded"),
    "dark",
    null,
  );
  await store.startUp();
  const [first] = store.threads.list.value.threads;
  const note = first?.messages[0];
  if (first === undefined || note === undefined) {
    throw new Error("no seeded note");
  }
  const { id } = note;
  async function asked(): Promise<{ readonly deleting: Promise<void> }> {
    const deleting = store.deleteNote(id);
    await vi.waitFor(() => {
      expect(store.question.value).toEqual({ kind: "deleteNote" });
    });
    return { deleting };
  }

  const cancelled = await asked();
  store.answer(false);
  await cancelled.deleting;
  const dismissed = await asked();
  store.dismissQuestion();
  await dismissed.deleting;
  expect(store.threads.list.value.threads.map(({ id }) => id)).toEqual([0, 1, 2, 3]);

  const deleted = await asked();
  store.answer(true);
  await deleted.deleting;
  expect(store.threads.list.value.threads.map(({ id }) => id)).toEqual([1, 2, 3]);
  expect(store.threads.counts.value.get(first.file)).toBe(3);
  expect(store.question.value).toBeNull();
});

function withWindowStorage(
  initial: Record<string, string>,
  run: (items: Map<string, string>) => void,
): void {
  const items = new Map(Object.entries(initial));
  setSSRHandler("getDefaultStorage", () => ({
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  }));
  try {
    run(items);
  } finally {
    setSSRHandler("getDefaultStorage", () => undefined);
  }
}

test.each([
  ["missing", {}, true],
  ['"true"', { "yamt.collapse.unchanged": "true" }, true],
  ["garbage", { "yamt.collapse.unchanged": "no" }, true],
  ['"false"', { "yamt.collapse.unchanged": "false" }, false],
])(
  "the collapse choice %s in the window's storage starts the range store as the merge window reads it",
  (_name, initial, on) => {
    withWindowStorage(initial, () => {
      expect(createRangeStore(source(1), "dark", null).collapsing.value).toBe(on);
    });
  },
);

test("toggling in the range store writes the merge window's stored choice (catches a second key)", () => {
  withWindowStorage({}, (items) => {
    const store = createRangeStore(source(1), "dark", null);

    store.toggleCollapsing();

    expect(store.collapsing.value).toBe(false);
    expect([...items]).toEqual([["yamt.collapse.unchanged", "false"]]);
    expect(createCollapsing().collapsing.value).toBe(false);

    store.toggleCollapsing();

    expect(items.get("yamt.collapse.unchanged")).toBe("true");
    expect(createCollapsing().collapsing.value).toBe(true);
  });
});

test("the range toggle's words are the merge toolbar's collapse entry", () => {
  expect(COLLAPSE_LABEL).toBe("Collapse unchanged fragments");
  expect(listedButtons(null).find(({ id }) => id === "collapse")?.label).toBe(COLLAPSE_LABEL);
});
