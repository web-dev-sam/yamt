import { afterEach, expect, test, vi } from "vitest";

import {
  createFixtureSource,
  log,
  type ChunkSource,
  type FileEntry,
  type FileMergeData,
} from "../ipc";
import { createAppStore, useAppStore } from "./store";

type PendingLoad = {
  readonly path: string;
  readonly resolve: (data: FileMergeData) => void;
  readonly reject: (error: Error) => void;
};

const MAGIC_KEYS = "vueuse-use-magic-keys.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

function entry(path: string): FileEntry {
  return { path, status: "Unresolved", unsupported: null };
}

async function dataFor(path: string): Promise<FileMergeData> {
  const real = await createFixtureSource(log).loadFile(MAGIC_KEYS);
  return { ...real, path };
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

test("loading the list opens the first file and logs file.loaded", async () => {
  const lines = spyConsole();
  const { source, pending } = handSource([entry("a.ts"), entry("b.ts")]);
  const store = createAppStore(source);
  expect(useAppStore()).toBe(store);

  const loading = store.loadFiles();
  await vi.waitFor(() => {
    expect(pending.map((load) => load.path)).toEqual(["a.ts"]);
  });
  const a = await dataFor("a.ts");
  pending[0]?.resolve(a);
  await loading;

  expect(store.files.value).toEqual([entry("a.ts"), entry("b.ts")]);
  expect(store.active.value).toBe("a.ts");
  expect(store.data.value).toBe(a);
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

test("a rejected list opens nothing, resolves, and logs store.list_failed once", async () => {
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
  expect(lines.info).toEqual([]);
  expect(lines.error).toEqual(['[error] store.list_failed {reason: "repo gone"}']);
});

test("a later open wins when the earlier load resolves last", async () => {
  const lines = spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore(source);
  const a = await dataFor("a.ts");
  const b = await dataFor("b.ts");

  const openA = store.open("a.ts");
  const openB = store.open("b.ts");
  pending[1]?.resolve(b);
  await openB;
  pending[0]?.resolve(a);
  await openA;

  expect(store.active.value).toBe("b.ts");
  expect(store.data.value).toBe(b);
  expect(lines.info).toEqual([`[info] file.loaded {path: "b.ts", chunks: ${b.chunks.length}}`]);
});

test("a rejected load keeps the previous file and logs store.load_failed", async () => {
  const lines = spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore(source);
  const a = await dataFor("a.ts");
  const openA = store.open("a.ts");
  pending[0]?.resolve(a);
  await openA;

  const openB = store.open("b.ts");
  pending[1]?.reject(new Error("disk gone"));
  await openB;

  expect(store.active.value).toBe("a.ts");
  expect(store.data.value).toBe(a);
  expect(lines.error).toEqual(['[error] store.load_failed {path: "b.ts", reason: "disk gone"}']);
});
