import { afterEach, expect, test, vi } from "vitest";

import {
  loadFixture,
  type ChunkSource,
  type FileEntry,
  type FileMergeData,
  type SourceFailure,
  type SourceResult,
} from "../ipc";
import { createAppStore, useAppStore, type AppStore } from "./store";

type PendingLoad = {
  readonly path: string;
  readonly resolve: (result: SourceResult<FileMergeData>) => void;
  readonly reject: (error: Error) => void;
};

const MAGIC_KEYS = "vueuse-use-magic-keys.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

function entry(path: string): FileEntry {
  return { path, status: "Unresolved", unsupported: null };
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
  expect(store.data.value).toEqual(a);
  expect(store.problem.value).toBeNull();
  expect(lines.info).toEqual([`[info] file.loaded {path: "a.ts", chunks: ${a.chunks.length}}`]);
});

test("an empty list opens nothing", async () => {
  const { source, pending } = handSource([]);
  const store = createAppStore(source);

  await store.loadFiles();

  expect(pending).toEqual([]);
  expect(store.active.value).toBeNull();
  expect(store.data.value).toBeNull();
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
  expect(store.data.value).toBeNull();
  expect(store.problem.value).toEqual({
    action: "list",
    cause: { kind: "Unexpected", message: "repo gone" },
  });
  expect(lines.info).toEqual([]);
  expect(lines.error).toEqual([
    '[error] store.list_failed {kind: "Unexpected", message: "repo gone"}',
  ]);
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
  expect(store.data.value).toEqual(b);
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
  const shown = store.data.value;
  const logo: SourceFailure = { kind: "Unsupported", path: "logo.bin", reason: "Binary" };

  const openLogo = store.open("logo.bin");
  pending[1]?.resolve({ ok: false, failure: logo });
  await openLogo;

  expect(store.problem.value).toEqual({ action: "open", path: "logo.bin", cause: logo });
  expect(store.active.value).toBe("a.ts");
  expect(store.data.value).toBe(shown);
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
  const shown = store.data.value;

  const openB = store.open("b.ts");
  pending[1]?.reject(new Error("disk gone"));
  await expect(openB).resolves.toBeUndefined();

  expect(store.data.value).toBe(shown);
  expect(store.problem.value).toEqual({
    action: "open",
    path: "b.ts",
    cause: { kind: "Unexpected", message: "disk gone" },
  });
  expect(lines.error).toEqual([
    '[error] store.open_failed {path: "b.ts", kind: "Unexpected", message: "disk gone"}',
  ]);
});

test("finish sends the open file's text, shows the returned list and clears the problem", async () => {
  spyConsole();
  const sent: [string, string][] = [];
  const resolved: FileEntry = { ...entry("a.ts"), status: "Resolved" };
  const { store, pending } = await openedStore({
    finishFile: (path, text) => {
      sent.push([path, text]);
      return Promise.resolve(ok([resolved, entry("b.ts")]));
    },
  });
  const failed = store.open("gone.ts");
  pending[1]?.resolve({ ok: false, failure: { kind: "UnknownPath", path: "gone.ts" } });
  await failed;
  const shown = store.data.value;

  await store.finish("merged\r\n");

  expect(sent).toEqual([["a.ts", "merged\r\n"]]);
  expect(store.files.value).toEqual([resolved, entry("b.ts")]);
  expect(store.data.value).toBe(shown);
  expect(store.problem.value).toBeNull();
});

test("finish and reset without an open file call nothing", async () => {
  const lines = spyConsole();
  const { source } = handSource([]);
  const store = createAppStore(source);

  await store.finish("text");
  await store.reset();

  expect(store.data.value).toBeNull();
  expect(store.problem.value).toBeNull();
  expect(lines.error).toEqual([]);
});

test("a failed finish keeps the list unresolved, names the path; dismissProblem clears it", async () => {
  const lines = spyConsole();
  const git: SourceFailure = { kind: "Git", message: "git add failed: index.lock exists" };
  const { store, pending, a } = await openedStore({
    listFiles: () => Promise.resolve([entry("a.ts")]),
    finishFile: () => Promise.resolve({ ok: false, failure: git }),
  });
  const listing = store.loadFiles();
  await vi.waitFor(() => {
    expect(pending).toHaveLength(2);
  });
  pending[1]?.resolve(ok(a));
  await listing;
  const before = store.files.value;
  const shown = store.data.value;

  await store.finish("text");

  expect(store.files.value).toBe(before);
  expect(store.files.value).toEqual([entry("a.ts")]);
  expect(store.data.value).toBe(shown);
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

  await expect(store.finish("text")).resolves.toBeUndefined();

  expect(store.problem.value).toEqual({
    action: "finish",
    path: "a.ts",
    cause: { kind: "Unexpected", message: "ipc down" },
  });
});

test("reset takes the list from its result and reloads the file as a new object", async () => {
  spyConsole();
  const reset: string[] = [];
  const { store, pending, a } = await openedStore({
    resetFile: (path) => {
      reset.push(path);
      return Promise.resolve(ok([entry("a.ts"), entry("b.ts")]));
    },
    listFiles: () => Promise.reject(new Error("not used")),
  });
  const shown = store.data.value;

  const resetting = store.reset();
  await vi.waitFor(() => {
    expect(pending.map((load) => load.path)).toEqual(["a.ts", "a.ts"]);
  });
  pending[1]?.resolve(ok(a));
  await resetting;

  expect(reset).toEqual(["a.ts"]);
  expect(store.files.value).toEqual([entry("a.ts"), entry("b.ts")]);
  expect(store.data.value).toEqual(a);
  expect(store.data.value).not.toBe(a);
  expect(store.data.value).not.toBe(shown);
});

test("a failed reset keeps the current file and names the path", async () => {
  spyConsole();
  const { store, pending } = await openedStore({
    resetFile: () => Promise.resolve({ ok: false, failure: { kind: "UnknownPath", path: "a.ts" } }),
  });
  const shown = store.data.value;

  await store.reset();

  expect(pending).toHaveLength(1);
  expect(store.data.value).toBe(shown);
  expect(store.problem.value).toEqual({
    action: "reset",
    path: "a.ts",
    cause: { kind: "UnknownPath", path: "a.ts" },
  });
});

test("a later open wins over a reset that resolves last", async () => {
  spyConsole();
  const resets: ((result: SourceResult<FileEntry[]>) => void)[] = [];
  const { store, pending } = await openedStore({
    resetFile: () =>
      new Promise((resolve) => {
        resets.push(resolve);
      }),
  });
  const b = await dataFor("b.ts");

  const resetting = store.reset();
  const openB = store.open("b.ts");
  pending[1]?.resolve(ok(b));
  await openB;
  resets[0]?.(ok([entry("a.ts")]));
  await resetting;

  expect(pending).toHaveLength(2);
  expect(store.active.value).toBe("b.ts");
  expect(store.files.value).toEqual([entry("a.ts")]);
});
