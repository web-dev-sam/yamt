import { afterEach, expect, test, vi } from "vitest";

import {
  loadFixture,
  type ChunkSource,
  type FileEntry,
  type FileMergeData,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import { createAppStore, useAppStore, type AppStore, type FileWork } from "./store";

type PendingLoad = {
  readonly path: string;
  readonly resolve: (result: SourceResult<FileMergeData>) => void;
  readonly reject: (error: Error) => void;
};

type FakeView = { text: string; readonly work: FileWork };

const MAGIC_KEYS = "vueuse-use-magic-keys.ts";
const NOTHING_LEFT = { conflicts: 0, changes: 0 };

afterEach(() => {
  vi.restoreAllMocks();
});

function entry(path: string): FileEntry {
  return { path, status: "Unresolved", unsupported: null };
}

function resolvedEntry(path: string): FileEntry {
  return { ...entry(path), status: "Resolved" };
}

function ok<T>(value: T): SourceResult<T> {
  return { ok: true, value };
}

async function dataFor(path: string): Promise<FileMergeData> {
  return { ...(await loadFixture(MAGIC_KEYS)), path };
}

function handSource(files: FileEntry[]): { source: ChunkSource; pending: PendingLoad[] } {
  const pending: PendingLoad[] = [];
  const source: ChunkSource = {
    listFiles: () => Promise.resolve(files),
    loadFile: (path) =>
      new Promise((resolve, reject) => {
        pending.push({ path, resolve, reject });
      }),
    finishFile: () => Promise.reject(new Error("not used")),
    resetFile: () => Promise.reject(new Error("not used")),
  };
  return { source, pending };
}

function spyConsole(): { info: string[]; error: string[] } {
  const lines = { info: new Array<string>(), error: new Array<string>() };
  vi.spyOn(console, "info").mockImplementation((line: string) => {
    lines.info.push(line);
  });
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    lines.error.push(line);
  });
  return lines;
}

function fakeView(store: AppStore, path: string, loaded: string): FakeView {
  const view: FakeView = {
    text: loaded,
    work: { resultText: () => view.text, loadedText: () => loaded },
  };
  store.track(path, view.work);
  return view;
}

async function openNow(store: AppStore, pending: PendingLoad[], path: string): Promise<void> {
  const opening = store.open(path);
  await vi.waitFor(() => {
    expect(pending.at(-1)?.path).toBe(path);
  });
  pending.at(-1)?.resolve(ok(await dataFor(path)));
  await opening;
}

test("useAppStore throws before createAppStore, then returns the created store", async () => {
  // The singleton is module state; only a fresh module instance has never seen createAppStore.
  vi.resetModules();
  const fresh = await import("./store");
  expect(() => fresh.useAppStore()).toThrow("useAppStore() called before createAppStore()");

  const created = fresh.createAppStore(handSource([]).source);

  expect(fresh.useAppStore()).toBe(created);
});

test("loading the list opens the first file the editor can show and logs file.loaded", async () => {
  const lines = spyConsole();
  const logo: FileEntry = { ...entry("logo.bin"), unsupported: "Binary" };
  const { source, pending } = handSource([logo, entry("a.ts"), entry("b.ts")]);
  const store = createAppStore(source);
  expect(useAppStore()).toBe(store);

  const loading = store.loadFiles();
  await vi.waitFor(() => {
    expect(pending.map((load) => load.path)).toEqual(["a.ts"]);
  });
  const a = await dataFor("a.ts");
  pending[0]?.resolve(ok(a));
  await loading;

  expect(store.files.value).toEqual([logo, entry("a.ts"), entry("b.ts")]);
  expect(store.active.value).toBe("a.ts");
  expect(store.opened.value).toEqual([a]);
  expect(store.problem.value).toBeNull();
  expect(lines.info).toEqual([`[info] file.loaded {path: "a.ts", chunks: ${a.chunks.length}}`]);
});

test("an empty list opens nothing", async () => {
  const { source, pending } = handSource([]);
  const store = createAppStore(source);

  await store.loadFiles();

  expect(pending).toEqual([]);
  expect(store.active.value).toBeNull();
  expect(store.opened.value).toEqual([]);
});

test("a rejected list opens nothing, resolves, and shows an Unexpected list problem", async () => {
  const lines = spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore({
    ...source,
    listFiles: () => Promise.reject(new Error("repo gone")),
  });

  await expect(store.loadFiles()).resolves.toBeUndefined();

  expect(pending).toEqual([]);
  expect(store.files.value).toEqual([]);
  expect(store.opened.value).toEqual([]);
  expect(store.problem.value).toEqual({
    action: "list",
    cause: { kind: "Unexpected", message: "repo gone" },
  });
  expect(lines.info).toEqual([]);
  expect(lines.error).toEqual([
    '[error] store.list_failed {kind: "Unexpected", message: "repo gone"}',
  ]);
});

test("opening A, B, then A again loads each once and keeps both; re-clicking the shown file loads nothing", async () => {
  spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore(source);

  await openNow(store, pending, "a.ts");
  await openNow(store, pending, "b.ts");
  const [a, b] = store.opened.value;
  await store.open("a.ts");

  expect(pending.map((load) => load.path)).toEqual(["a.ts", "b.ts"]);
  expect(store.active.value).toBe("a.ts");
  expect(store.opened.value).toHaveLength(2);
  expect(store.opened.value[0]).toBe(a);
  expect(store.opened.value[1]).toBe(b);

  await store.open("a.ts");

  expect(pending).toHaveLength(2);
  expect(store.active.value).toBe("a.ts");
});

test("switching to an opened file wins over a load that resolves later and clears the problem", async () => {
  const lines = spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore(source);
  await openNow(store, pending, "a.ts");
  await openNow(store, pending, "b.ts");
  const failed = store.open("gone.ts");
  pending[2]?.resolve({ ok: false, failure: { kind: "UnknownPath", path: "gone.ts" } });
  await failed;
  expect(store.problem.value).not.toBeNull();

  const openC = store.open("c.ts");
  await store.open("a.ts");
  pending[3]?.resolve(ok(await dataFor("c.ts")));
  await openC;

  expect(store.active.value).toBe("a.ts");
  expect(store.problem.value).toBeNull();
  expect(store.opened.value.map((file) => file.path)).toEqual(["a.ts", "b.ts"]);
  expect(lines.info).toHaveLength(2);
});

test("a later open wins when the earlier load resolves last", async () => {
  const lines = spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore(source);
  const a = await dataFor("a.ts");
  const b = await dataFor("b.ts");

  const openA = store.open("a.ts");
  const openB = store.open("b.ts");
  pending[1]?.resolve(ok(b));
  await openB;
  pending[0]?.resolve(ok(a));
  await openA;

  expect(store.active.value).toBe("b.ts");
  expect(store.opened.value).toEqual([b]);
  expect(lines.info).toEqual([`[info] file.loaded {path: "b.ts", chunks: ${b.chunks.length}}`]);
});

test("a stale failed open is logged but shows no problem", async () => {
  const lines = spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore(source);
  const b = await dataFor("b.ts");

  const openA = store.open("a.ts");
  const openB = store.open("b.ts");
  pending[1]?.resolve(ok(b));
  await openB;
  pending[0]?.resolve({ ok: false, failure: { kind: "UnknownPath", path: "a.ts" } });
  await openA;

  expect(store.active.value).toBe("b.ts");
  expect(store.problem.value).toBeNull();
  expect(lines.error).toEqual(['[error] store.open_failed {path: "a.ts", kind: "UnknownPath"}']);
});

async function openedStore(
  overrides: Partial<ChunkSource>,
): Promise<{ store: AppStore; pending: PendingLoad[]; a: FileMergeData }> {
  const { source, pending } = handSource([]);
  const store = createAppStore({ ...source, ...overrides });
  const a = await dataFor("a.ts");
  const opening = store.open("a.ts");
  pending[0]?.resolve(ok(a));
  await opening;
  return { store, pending, a };
}

test("a failed open names the file and cause, keeps the previous file; a later open clears it", async () => {
  const lines = spyConsole();
  const { store, pending } = await openedStore({});
  const shown = store.opened.value;
  const logo: SourceFailure = { kind: "Unsupported", path: "logo.bin", reason: "Binary" };

  const openLogo = store.open("logo.bin");
  pending[1]?.resolve({ ok: false, failure: logo });
  await openLogo;

  expect(store.problem.value).toEqual({ action: "open", path: "logo.bin", cause: logo });
  expect(store.active.value).toBe("a.ts");
  expect(store.opened.value).toBe(shown);
  expect(lines.error).toEqual([
    '[error] store.open_failed {path: "logo.bin", kind: "Unsupported", reason: "Binary"}',
  ]);

  const openB = store.open("b.ts");
  pending[2]?.resolve(ok(await dataFor("b.ts")));
  await openB;

  expect(store.problem.value).toBeNull();
  expect(store.active.value).toBe("b.ts");
});

test("a rejected load is an Unexpected problem and keeps the previous file", async () => {
  const lines = spyConsole();
  const { store, pending } = await openedStore({});
  const shown = store.opened.value;

  const openB = store.open("b.ts");
  pending[1]?.reject(new Error("disk gone"));
  await expect(openB).resolves.toBeUndefined();

  expect(store.opened.value).toBe(shown);
  expect(store.active.value).toBe("a.ts");
  expect(store.problem.value).toEqual({
    action: "open",
    path: "b.ts",
    cause: { kind: "Unexpected", message: "disk gone" },
  });
  expect(lines.error).toEqual([
    '[error] store.open_failed {path: "b.ts", kind: "Unexpected", message: "disk gone"}',
  ]);
});

test("a finish with nothing left sends the text without asking, keeps the file opened and saved", async () => {
  spyConsole();
  const sent: [string, string][] = [];
  const { store, pending } = await openedStore({
    finishFile: (path, text) => {
      sent.push([path, text]);
      return Promise.resolve(ok([resolvedEntry("a.ts"), entry("b.ts")]));
    },
  });
  const view = fakeView(store, "a.ts", "loaded\n");
  const failed = store.open("gone.ts");
  pending[1]?.resolve({ ok: false, failure: { kind: "UnknownPath", path: "gone.ts" } });
  await failed;
  const shown = store.opened.value;
  view.text = "merged\r\n";
  expect(store.unsavedFiles()).toEqual(["a.ts"]);

  await store.finish({ path: "a.ts", text: "merged\r\n", summary: NOTHING_LEFT });

  expect(store.question.value).toBeNull();
  expect(sent).toEqual([["a.ts", "merged\r\n"]]);
  expect(store.files.value).toEqual([resolvedEntry("a.ts"), entry("b.ts")]);
  expect(store.opened.value).toBe(shown);
  expect(store.active.value).toBe("a.ts");
  expect(store.problem.value).toBeNull();
  expect(store.unsavedFiles()).toEqual([]);

  view.text = "edited again\n";
  expect(store.unsavedFiles()).toEqual(["a.ts"]);
});

test("a finish with work left asks; Back writes nothing, Save writes the text", async () => {
  spyConsole();
  const sent: string[] = [];
  const { store } = await openedStore({
    finishFile: (_path, text) => {
      sent.push(text);
      return Promise.resolve(ok([resolvedEntry("a.ts")]));
    },
  });
  const summary = { conflicts: 1, changes: 2 };

  const back = store.finish({ path: "a.ts", text: "first", summary });
  expect(store.question.value).toEqual({ kind: "unprocessed", summary });
  store.answer(false);
  await back;

  expect(store.question.value).toBeNull();
  expect(sent).toEqual([]);

  const save = store.finish({ path: "a.ts", text: "second", summary });
  store.answer(true);
  await save;

  expect(sent).toEqual(["second"]);
  expect(store.files.value).toEqual([resolvedEntry("a.ts")]);
});

test("a failed finish keeps the list unresolved and the old saved text; dismissProblem clears it", async () => {
  const lines = spyConsole();
  const git: SourceFailure = { kind: "Git", message: "git add failed: index.lock exists" };
  const { store, pending, a } = await openedStore({
    listFiles: () => Promise.resolve([entry("a.ts")]),
    finishFile: () => Promise.resolve({ ok: false, failure: git }),
  });
  const view = fakeView(store, "a.ts", "loaded\n");
  await store.loadFiles();
  expect(pending).toHaveLength(1);
  const before = store.files.value;
  const shown = store.opened.value;
  view.text = "text";

  await store.finish({ path: "a.ts", text: "text", summary: NOTHING_LEFT });

  expect(store.files.value).toBe(before);
  expect(store.files.value).toEqual([entry("a.ts")]);
  expect(store.opened.value).toBe(shown);
  expect(store.opened.value).toEqual([a]);
  expect(store.unsavedFiles()).toEqual(["a.ts"]);
  expect(store.problem.value).toEqual({ action: "finish", path: "a.ts", cause: git });
  expect(lines.error).toEqual([
    '[error] store.finish_failed {path: "a.ts", kind: "Git", message: "git add failed: index.lock exists"}',
  ]);

  store.dismissProblem();

  expect(store.problem.value).toBeNull();
});

test("a rejected finish is an Unexpected problem", async () => {
  spyConsole();
  const { store } = await openedStore({
    finishFile: () => Promise.reject(new Error("ipc down")),
  });

  await expect(
    store.finish({ path: "a.ts", text: "text", summary: NOTHING_LEFT }),
  ).resolves.toBeUndefined();

  expect(store.problem.value).toEqual({
    action: "finish",
    path: "a.ts",
    cause: { kind: "Unexpected", message: "ipc down" },
  });
});

test("the unsaved list names exactly the opened files whose text differs from loaded or finished", async () => {
  spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore({
    ...source,
    finishFile: () => Promise.resolve(ok([])),
  });
  for (const path of ["a.ts", "b.ts", "c.ts", "d.ts"]) {
    await openNow(store, pending, path);
  }
  const a = fakeView(store, "a.ts", "a\n");
  fakeView(store, "b.ts", "b\n");
  const c = fakeView(store, "c.ts", "c\n");
  const d = fakeView(store, "d.ts", "d\n");
  a.text = "a edited\n";
  c.text = "c finished\n";
  await store.finish({ path: "c.ts", text: "c finished\n", summary: NOTHING_LEFT });
  d.text = "d finished\n";
  await store.finish({ path: "d.ts", text: "d finished\n", summary: NOTHING_LEFT });
  d.text = "d\n";

  expect(store.unsavedFiles()).toEqual(["a.ts", "d.ts"]);

  store.untrack("a.ts", { resultText: () => "other", loadedText: () => "other" });
  expect(store.unsavedFiles()).toEqual(["a.ts", "d.ts"]);
  store.untrack("a.ts", a.work);
  expect(store.unsavedFiles()).toEqual(["d.ts"]);
});

test("closing asks only with unsaved work and answers with the choice", async () => {
  spyConsole();
  const { store } = await openedStore({});
  const view = fakeView(store, "a.ts", "a\n");

  expect(await store.mayClose()).toBe(true);
  expect(store.question.value).toBeNull();

  view.text = "a typed\n";
  const cancelled = store.mayClose();
  expect(store.question.value).toEqual({ kind: "exit", files: ["a.ts"] });
  expect(await store.mayClose()).toBe(false);
  store.answer(false);
  expect(await cancelled).toBe(false);
  expect(store.question.value).toBeNull();

  const exited = store.mayClose();
  store.answer(true);
  expect(await exited).toBe(true);
});

test("everything is resolved only when every listed file is", async () => {
  spyConsole();
  const { source, pending } = handSource([resolvedEntry("a.ts"), entry("b.ts")]);
  const store = createAppStore({
    ...source,
    finishFile: () => Promise.resolve(ok([resolvedEntry("a.ts"), resolvedEntry("b.ts")])),
  });
  expect(store.allResolved.value).toBe(false);

  const loading = store.loadFiles();
  await vi.waitFor(() => {
    expect(pending).toHaveLength(1);
  });
  pending[0]?.resolve(ok(await dataFor("a.ts")));
  await loading;
  expect(store.allResolved.value).toBe(false);

  await store.finish({ path: "b.ts", text: "b", summary: NOTHING_LEFT });

  expect(store.allResolved.value).toBe(true);
});

test("reset of A reloads only A as a new object and keeps B opened", async () => {
  spyConsole();
  const reset: string[] = [];
  const { source, pending } = handSource([]);
  const store = createAppStore({
    ...source,
    resetFile: (path) => {
      reset.push(path);
      return Promise.resolve(ok([entry("a.ts"), entry("b.ts")]));
    },
    finishFile: () => Promise.resolve(ok([])),
  });
  await openNow(store, pending, "a.ts");
  await openNow(store, pending, "b.ts");
  await store.open("a.ts");
  const [shownA, shownB] = store.opened.value;
  const view = fakeView(store, "a.ts", "a\n");
  view.text = "finished\n";
  await store.finish({ path: "a.ts", text: "finished\n", summary: NOTHING_LEFT });
  const a = await dataFor("a.ts");

  const resetting = store.reset("a.ts");
  await vi.waitFor(() => {
    expect(pending.map((load) => load.path)).toEqual(["a.ts", "b.ts", "a.ts"]);
  });
  pending[2]?.resolve(ok(a));
  await resetting;

  expect(reset).toEqual(["a.ts"]);
  expect(store.files.value).toEqual([entry("a.ts"), entry("b.ts")]);
  expect(store.active.value).toBe("a.ts");
  expect(store.opened.value).toHaveLength(2);
  expect(store.opened.value).toContain(shownB);
  expect(store.opened.value).not.toContain(shownA);
  const reloaded = store.opened.value.find((file) => file.path === "a.ts");
  expect(reloaded).toEqual(a);
  expect(reloaded).not.toBe(a);
  expect(store.unsavedFiles()).toEqual(["a.ts"]);
});

test("a failed reset keeps the current file and names the path", async () => {
  spyConsole();
  const { store, pending } = await openedStore({
    resetFile: () => Promise.resolve({ ok: false, failure: { kind: "UnknownPath", path: "a.ts" } }),
  });
  const shown = store.opened.value;

  await store.reset("a.ts");

  expect(pending).toHaveLength(1);
  expect(store.opened.value).toBe(shown);
  expect(store.problem.value).toEqual({
    action: "reset",
    path: "a.ts",
    cause: { kind: "UnknownPath", path: "a.ts" },
  });
});

test("a later open wins over a reset that resolves last, and the reset file is dropped", async () => {
  spyConsole();
  const resets: ((result: SourceResult<FileEntry[]>) => void)[] = [];
  const { store, pending } = await openedStore({
    resetFile: () =>
      new Promise((resolve) => {
        resets.push(resolve);
      }),
  });
  const b = await dataFor("b.ts");

  const resetting = store.reset("a.ts");
  const openB = store.open("b.ts");
  pending[1]?.resolve(ok(b));
  await openB;
  resets[0]?.(ok([entry("a.ts")]));
  await resetting;

  expect(pending).toHaveLength(2);
  expect(store.active.value).toBe("b.ts");
  expect(store.files.value).toEqual([entry("a.ts")]);
  expect(store.opened.value).toEqual([b]);
});
