import { setSSRHandler } from "@vueuse/core";
import { afterEach, expect, test, vi } from "vitest";

import {
  DEFAULT_KEYS,
  loadFixture,
  parseKey,
  type ChunkSource,
  type ContinueReply,
  type DiskChange,
  type DiskResult,
  type DiskVersion,
  type FileEntry,
  type Listing,
  type FileMergeData,
  type FileSides,
  type Key,
  type SettingsRead,
  type SettingsSource,
  type OperationView,
  type SideNames,
  type SourceFailure,
  type SourceResult,
  type StoredSettings,
  type WriteReply,
} from "../ipc";
import { LanguageServers } from "../lsp";
import { resultLine } from "./choiceText";
import type { FileWork } from "./closeGuard";
import { formatNote } from "./serverText";
import { createAppStore as createStoreWithTheme, useAppStore, type AppStore } from "./store";
import type { FormatOutcome, MergeHandle, ResultSnapshot } from "./useMergeController";

type PendingLoad = {
  readonly path: string;
  readonly resolve: (result: SourceResult<FileMergeData>) => void;
  readonly reject: (error: Error) => void;
};

type FakeView = {
  text: string;
  saved: string;
  readonly work: FileWork;
  snapshot(): ResultSnapshot;
};

const MAGIC_KEYS = "vueuse-use-magic-keys.ts";
const NOTHING_LEFT = { conflicts: 0, changes: 0 };
const NO_SETTINGS: SettingsSource = {
  loadSettings: () => Promise.reject(new Error("not used")),
  setTheme: () => Promise.reject(new Error("not used")),
  setAntialiasing: () => Promise.reject(new Error("not used")),
  setKeys: () => Promise.reject(new Error("not used")),
  moveSettings: () => Promise.reject(new Error("not used")),
  setServerAnswer: () => Promise.reject(new Error("not used")),
  setServerSwitch: () => Promise.reject(new Error("not used")),
  setAddedServers: () => Promise.reject(new Error("not used")),
};
const NO_SERVERS = { repositories: {}, off: {}, added: [] };
const DARK = {
  theme: "dark",
  antialiasing: "subpixel",
  languageServers: NO_SERVERS,
} satisfies Omit<StoredSettings, "keys">;
const LIGHT = {
  theme: "light",
  antialiasing: "subpixel",
  languageServers: NO_SERVERS,
} satisfies Omit<StoredSettings, "keys">;

afterEach(() => {
  vi.restoreAllMocks();
});

function createAppStore(source: ChunkSource): AppStore {
  return createStoreWithTheme(source, "dark", new LanguageServers(null), null);
}

function entry(path: string): FileEntry {
  return { path, status: "Unresolved", unsupported: null };
}

function resolvedEntry(path: string): FileEntry {
  return { ...entry(path), status: "Resolved" };
}

function ok<T>(value: T): SourceResult<T> {
  return { ok: true, value };
}

const MERGING: OperationView = { kind: "Merge", merging: null, into: null };

function listing(
  files: readonly FileEntry[],
  diskChanges: readonly DiskChange[] = [],
): SourceResult<Listing> {
  return ok({
    kind: "Files",
    files,
    diskChanges,
    operation: MERGING,
    sides: { local: null, remote: null },
  });
}

function written(files: FileEntry[]): SourceResult<WriteReply> {
  return ok({ kind: "Written", files });
}

async function versioned(diskVersion: number): Promise<DiskVersion> {
  const record = {
    path: "v.ts",
    middle: { kind: "Stages", text: "" },
    local: "",
    remote: "",
    deleted: null,
    eol: "Lf",
    chunks: [],
    disk_version: diskVersion,
  };
  return (await loadFixture("v.ts", { "v.json": record })).diskVersion;
}

const VERSION_0 = await versioned(0);

async function dataFor(path: string): Promise<FileMergeData> {
  return { ...(await loadFixture(MAGIC_KEYS)), path };
}

function handSource(files: FileEntry[]): { source: ChunkSource; pending: PendingLoad[] } {
  const pending: PendingLoad[] = [];
  const source: ChunkSource = {
    loadFile: (path) =>
      new Promise((resolve, reject) => {
        pending.push({ path, resolve, reject });
      }),
    finishFile: () => Promise.reject(new Error("not used")),
    saveFile: () => Promise.reject(new Error("not used")),
    resetFile: () => Promise.reject(new Error("not used")),
    describeFile: () => Promise.reject(new Error("not used")),
    takeSide: () => Promise.reject(new Error("not used")),
    listStop: () => Promise.resolve(listing(files)),
    continueOperation: () => Promise.reject(new Error("not used")),
    abortOperation: () => Promise.reject(new Error("not used")),
    ...NO_SETTINGS,
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

function shot(text: string): ResultSnapshot {
  return { asShown: () => text, fileText: () => text, unsaved: true, markSaved: () => undefined };
}

function fakeView(store: AppStore, path: string, loaded: string): FakeView {
  const view: FakeView = {
    text: loaded,
    saved: loaded,
    work: { unsaved: () => view.text !== view.saved },
    snapshot: () => {
      const { text } = view;
      return {
        asShown: () => text,
        fileText: () => `${text}(file)`,
        unsaved: text !== view.saved,
        markSaved: () => {
          view.saved = text;
        },
      };
    },
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

  const created = fresh.createAppStore(
    handSource([]).source,
    "dark",
    new LanguageServers(null),
    null,
  );

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
    listStop: () => Promise.reject(new Error("repo gone")),
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

test("re-clicking the shown file keeps the problem and lets a pending load win", async () => {
  spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore(source);
  await openNow(store, pending, "a.ts");
  const failed = store.open("gone.ts");
  pending[1]?.resolve({ ok: false, failure: { kind: "UnknownPath", path: "gone.ts" } });
  await failed;
  const problem = store.problem.value;

  await store.open("a.ts");

  expect(store.problem.value).not.toBeNull();
  expect(store.problem.value).toBe(problem);

  const openC = store.open("c.ts");
  await store.open("a.ts");
  pending[2]?.resolve(ok(await dataFor("c.ts")));
  await openC;

  expect(store.active.value).toBe("c.ts");
  expect(store.opened.value.map((file) => file.path)).toEqual(["a.ts", "c.ts"]);
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

test("a finish with nothing left sends the text without asking, saves it, and opens the next unresolved file", async () => {
  spyConsole();
  const sent: [string, string, DiskVersion][] = [];
  const listed = [entry("0.ts"), resolvedEntry("a.ts"), resolvedEntry("b.ts"), entry("c.ts")];
  const { store, pending } = await openedStore({
    finishFile: ({ path, text, diskVersion }) => {
      sent.push([path, text, diskVersion]);
      return Promise.resolve(written(listed));
    },
  });
  const view = fakeView(store, "a.ts", "loaded\n");
  const failed = store.open("gone.ts");
  pending[1]?.resolve({ ok: false, failure: { kind: "UnknownPath", path: "gone.ts" } });
  await failed;
  const [shownA] = store.opened.value;
  view.text = "merged\r\n";
  expect(store.unsavedFiles()).toEqual(["a.ts"]);

  const finishing = store.finish({
    path: "a.ts",
    snapshot: view.snapshot(),
    summary: NOTHING_LEFT,
    diskVersion: VERSION_0,
  });
  await vi.waitFor(() => {
    expect(pending.map((load) => load.path)).toEqual(["a.ts", "gone.ts", "c.ts"]);
  });
  pending[2]?.resolve(ok(await dataFor("c.ts")));
  await finishing;

  expect(store.question.value).toBeNull();
  expect(sent).toEqual([["a.ts", "merged\r\n", 0]]);
  expect(store.files.value).toEqual(listed);
  expect(store.opened.value[0]).toBe(shownA);
  expect(store.opened.value.map((file) => file.path)).toEqual(["a.ts", "c.ts"]);
  expect(store.active.value).toBe("c.ts");
  expect(store.problem.value).toBeNull();
  expect(view.saved).toBe("merged\r\n");
  expect(store.unsavedFiles()).toEqual([]);

  view.text = "edited again\n";
  expect(store.unsavedFiles()).toEqual(["a.ts"]);
});

test("a finish of a file no longer shown does not switch files", async () => {
  spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore({
    ...source,
    finishFile: () =>
      Promise.resolve(written([resolvedEntry("a.ts"), resolvedEntry("b.ts"), entry("c.ts")])),
  });
  await openNow(store, pending, "a.ts");
  await openNow(store, pending, "b.ts");

  await store.finish({
    path: "a.ts",
    snapshot: shot("a"),
    summary: NOTHING_LEFT,
    diskVersion: VERSION_0,
  });

  expect(store.active.value).toBe("b.ts");
  expect(pending.map((load) => load.path)).toEqual(["a.ts", "b.ts"]);
});

test("settings open and close; picking a file while they show closes them and shows it, the shown file too", async () => {
  spyConsole();
  const { source, pending } = handSource([]);
  const store = createAppStore(source);
  await openNow(store, pending, "a.ts");
  expect(store.screen.value).toEqual({ kind: "files" });

  store.openSettings();
  expect(store.screen.value).toEqual({ kind: "settings" });
  store.closeSettings();
  expect(store.screen.value).toEqual({ kind: "files" });

  store.openSettings();
  const picking = store.pick("b.ts");
  expect(store.screen.value).toEqual({ kind: "files" });
  await vi.waitFor(() => {
    expect(pending.at(-1)?.path).toBe("b.ts");
  });
  pending.at(-1)?.resolve(ok(await dataFor("b.ts")));
  await picking;
  expect(store.active.value).toBe("b.ts");

  store.openSettings();
  await store.pick("b.ts");

  expect(store.screen.value).toEqual({ kind: "files" });
  expect(store.active.value).toBe("b.ts");
  expect(pending).toHaveLength(2);
});

test("screen: a server's log opens from the files or from settings, and Back returns to the files", () => {
  const store = createAppStore(handSource([]).source);

  store.showServerLog("oxlint");
  expect(store.screen.value).toEqual({ kind: "serverLog", name: "oxlint" });
  store.closeServerLog();
  expect(store.screen.value).toEqual({ kind: "files" });

  store.openSettings();
  store.showServerLog("oxfmt");
  expect(store.screen.value).toEqual({ kind: "serverLog", name: "oxfmt" });
  store.closeServerLog();
  expect(store.screen.value).toEqual({ kind: "files" });

  store.showServerLog("oxlint");
  store.openSettings();
  expect(store.screen.value).toEqual({ kind: "settings" });
});

test.each([true, false])(
  "the app's own opens, the first file and the next one after a finish, keep settings as they were (open: %s)",
  async (settingsOpen) => {
    spyConsole();
    const { source, pending } = handSource([entry("a.ts"), entry("b.ts")]);
    const store = createAppStore({
      ...source,
      finishFile: () => Promise.resolve(written([resolvedEntry("a.ts"), entry("b.ts")])),
    });
    if (settingsOpen) {
      store.openSettings();
    }

    const loading = store.loadFiles();
    await vi.waitFor(() => {
      expect(pending.at(-1)?.path).toBe("a.ts");
    });
    pending.at(-1)?.resolve(ok(await dataFor("a.ts")));
    await loading;

    expect(store.active.value).toBe("a.ts");
    expect(store.screen.value.kind === "settings").toBe(settingsOpen);

    const finishing = store.finish({
      path: "a.ts",
      snapshot: shot("a"),
      summary: NOTHING_LEFT,
      diskVersion: VERSION_0,
    });
    await vi.waitFor(() => {
      expect(pending.at(-1)?.path).toBe("b.ts");
    });
    pending.at(-1)?.resolve(ok(await dataFor("b.ts")));
    await finishing;

    expect(store.active.value).toBe("b.ts");
    expect(store.screen.value.kind === "settings").toBe(settingsOpen);
  },
);

const AFTER_ACTION_ON_A = [resolvedEntry("a.ts"), resolvedEntry("b.ts"), entry("c.ts")];

type Answer = (reply: SourceResult<WriteReply>) => void;

function answeredLater(answers: Answer[]): Promise<SourceResult<WriteReply>> {
  return new Promise((resolve) => {
    answers.push(resolve);
  });
}

async function openWhileActing(
  overrides: (answers: Answer[]) => Partial<ChunkSource>,
  act: (store: AppStore) => Promise<void>,
): Promise<{ store: AppStore; pending: PendingLoad[]; acting: Promise<void> }> {
  const answers: Answer[] = [];
  const { source, pending } = handSource([]);
  const store = createAppStore({ ...source, ...overrides(answers) });
  await openNow(store, pending, "a.ts");
  const acting = act(store);
  const opening = store.open("b.ts");
  await vi.waitFor(() => {
    expect(answers).toHaveLength(1);
  });
  answers[0]?.(written(AFTER_ACTION_ON_A));
  await vi.waitFor(() => {
    expect(store.files.value).toEqual(AFTER_ACTION_ON_A);
  });
  pending[1]?.resolve(ok(await dataFor("b.ts")));
  await opening;
  return { store, pending, acting };
}

test("a file the user opens while a finish runs wins over the next file, though still loading", async () => {
  spyConsole();

  const { store, pending, acting } = await openWhileActing(
    (answers) => ({ finishFile: () => answeredLater(answers) }),
    (shown) =>
      shown.finish({
        path: "a.ts",
        snapshot: shot("a"),
        summary: NOTHING_LEFT,
        diskVersion: VERSION_0,
      }),
  );

  expect(pending.map((load) => load.path)).toEqual(["a.ts", "b.ts"]);
  expect(store.active.value).toBe("b.ts");
  await acting;
  expect(store.active.value).toBe("b.ts");
});

test("a file the user opens while a take runs wins over the next file, though still loading", async () => {
  spyConsole();

  const { store, pending, acting } = await openWhileActing(
    (answers) => ({ takeSide: () => answeredLater(answers) }),
    (shown) => shown.takeSide("a.ts", "local", VERSION_0),
  );

  expect(pending.map((load) => load.path)).toEqual(["a.ts", "b.ts", "a.ts"]);
  expect(store.active.value).toBe("b.ts");
  pending[2]?.resolve(ok(await dataFor("a.ts")));
  await acting;
  expect(store.active.value).toBe("b.ts");
  expect(store.taken.value).toEqual(new Map([["a.ts", { by: "side", side: "local" }]]));
});

test("a finish with work left asks; Back writes nothing and stays, Save writes the text", async () => {
  spyConsole();
  const sent: string[] = [];
  const { source, calls } = choiceSource(
    {
      finishFile: ({ text }) => {
        sent.push(text);
        return Promise.resolve(written([resolvedEntry("a.ts"), resolvedEntry("b.ts")]));
      },
    },
    [entry("a.ts"), entry("b.ts")],
  );
  const store = createAppStore(source);
  await store.loadFiles();
  const summary = { conflicts: 1, changes: 2 };

  const back = store.finish({
    path: "a.ts",
    snapshot: shot("first"),
    summary,
    diskVersion: VERSION_0,
  });
  expect(store.question.value).toEqual({ kind: "unprocessed", summary });
  store.answer(false);
  await back;

  expect(store.question.value).toBeNull();
  expect(sent).toEqual([]);
  expect(store.active.value).toBe("a.ts");
  expect(calls).toEqual(["loadFile a.ts"]);

  const save = store.finish({
    path: "a.ts",
    snapshot: shot("second"),
    summary,
    diskVersion: VERSION_0,
  });
  store.answer(true);
  await save;

  expect(sent).toEqual(["second"]);
  expect(store.files.value).toEqual([resolvedEntry("a.ts"), resolvedEntry("b.ts")]);
  expect(store.active.value).toBe("a.ts");
});

test("a failed finish keeps the file shown, the list unresolved and the old saved text; dismissProblem clears it", async () => {
  const lines = spyConsole();
  const git: SourceFailure = { kind: "Git", message: "git add failed: index.lock exists" };
  const { store, pending, a } = await openedStore({
    listStop: () => Promise.resolve(listing([entry("a.ts"), entry("b.ts")])),
    finishFile: () => Promise.resolve({ ok: false, failure: git }),
  });
  const view = fakeView(store, "a.ts", "loaded\n");
  await store.loadFiles();
  expect(pending).toHaveLength(1);
  const before = store.files.value;
  const shown = store.opened.value;
  view.text = "text";

  await store.finish({
    path: "a.ts",
    snapshot: view.snapshot(),
    summary: NOTHING_LEFT,
    diskVersion: VERSION_0,
  });

  expect(store.files.value).toBe(before);
  expect(store.files.value).toEqual([entry("a.ts"), entry("b.ts")]);
  expect(store.active.value).toBe("a.ts");
  expect(pending).toHaveLength(1);
  expect(store.opened.value).toBe(shown);
  expect(store.opened.value).toEqual([a]);
  expect(view.saved).toBe("loaded\n");
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
    store.finish({
      path: "a.ts",
      snapshot: shot("text"),
      summary: NOTHING_LEFT,
      diskVersion: VERSION_0,
    }),
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
    finishFile: () => Promise.resolve(written([])),
  });
  for (const path of ["a.ts", "b.ts", "c.ts", "d.ts"]) {
    await openNow(store, pending, path);
  }
  const a = fakeView(store, "a.ts", "a\n");
  fakeView(store, "b.ts", "b\n");
  const c = fakeView(store, "c.ts", "c\n");
  const d = fakeView(store, "d.ts", "d\n");
  const notOpened = fakeView(store, "z.ts", "z\n");
  notOpened.text = "z edited\n";
  a.text = "a edited\n";
  c.text = "c finished\n";
  await store.finish({
    path: "c.ts",
    snapshot: c.snapshot(),
    summary: NOTHING_LEFT,
    diskVersion: VERSION_0,
  });
  d.text = "d finished\n";
  await store.finish({
    path: "d.ts",
    snapshot: d.snapshot(),
    summary: NOTHING_LEFT,
    diskVersion: VERSION_0,
  });
  d.text = "d\n";

  expect(store.unsavedFiles()).toEqual(["a.ts", "d.ts"]);

  store.untrack("a.ts", { unsaved: () => true });
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

  const dismissed = store.mayClose();
  store.dismissQuestion();
  expect(await dismissed).toBe(false);
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
    finishFile: () => Promise.resolve(written([resolvedEntry("a.ts"), resolvedEntry("b.ts")])),
  });
  expect(store.allResolved.value).toBe(false);

  const loading = store.loadFiles();
  await vi.waitFor(() => {
    expect(pending).toHaveLength(1);
  });
  pending[0]?.resolve(ok(await dataFor("a.ts")));
  await loading;
  expect(store.allResolved.value).toBe(false);

  await store.finish({
    path: "b.ts",
    snapshot: shot("b"),
    summary: NOTHING_LEFT,
    diskVersion: VERSION_0,
  });

  expect(store.allResolved.value).toBe(true);
});

test("reset of A replaces only A in place with a new object and keeps B opened", async () => {
  spyConsole();
  const reset: string[] = [];
  const { source, pending } = handSource([]);
  const store = createAppStore({
    ...source,
    resetFile: (path) => {
      reset.push(path);
      return Promise.resolve(written([entry("a.ts"), entry("b.ts")]));
    },
  });
  await openNow(store, pending, "a.ts");
  await openNow(store, pending, "b.ts");
  await store.open("a.ts");
  const [shownA, shownB] = store.opened.value;
  const a = await dataFor("a.ts");

  const resetting = store.reset("a.ts", VERSION_0);
  await vi.waitFor(() => {
    expect(pending.map((load) => load.path)).toEqual(["a.ts", "b.ts", "a.ts"]);
  });
  expect(store.opened.value).toEqual([shownA, shownB]);
  pending[2]?.resolve(ok(a));
  await resetting;

  expect(reset).toEqual(["a.ts"]);
  expect(store.files.value).toEqual([entry("a.ts"), entry("b.ts")]);
  expect(store.active.value).toBe("a.ts");
  expect(store.opened.value).toHaveLength(2);
  expect(store.opened.value[0]).toEqual(a);
  expect(store.opened.value[0]).not.toBe(a);
  expect(store.opened.value[0]).not.toBe(shownA);
  expect(store.opened.value[1]).toBe(shownB);
});

test("a failed reset keeps the current file and names the path", async () => {
  spyConsole();
  const { store, pending } = await openedStore({
    resetFile: () => Promise.resolve({ ok: false, failure: { kind: "UnknownPath", path: "a.ts" } }),
  });
  const shown = store.opened.value;

  await store.reset("a.ts", VERSION_0);

  expect(pending).toHaveLength(1);
  expect(store.opened.value).toBe(shown);
  expect(store.problem.value).toEqual({
    action: "reset",
    path: "a.ts",
    cause: { kind: "UnknownPath", path: "a.ts" },
  });
});

test("a failed reload after a reset keeps A's old view and reports it as a failed open", async () => {
  const lines = spyConsole();
  const { store, pending } = await openedStore({
    resetFile: () => Promise.resolve(written([entry("a.ts")])),
  });
  const shown = store.opened.value;

  const resetting = store.reset("a.ts", VERSION_0);
  await vi.waitFor(() => {
    expect(pending).toHaveLength(2);
  });
  pending[1]?.reject(new Error("disk gone"));
  await resetting;

  expect(store.files.value).toEqual([entry("a.ts")]);
  expect(store.active.value).toBe("a.ts");
  expect(store.opened.value).toBe(shown);
  expect(store.problem.value).toEqual({
    action: "open",
    path: "a.ts",
    cause: { kind: "Unexpected", message: "disk gone" },
  });
  expect(lines.error).toEqual([
    '[error] store.open_failed {path: "a.ts", kind: "Unexpected", message: "disk gone"}',
  ]);
});

test("reset A, open B, open A, then the reset resolves: A shows its fresh view", async () => {
  spyConsole();
  const resets: ((result: SourceResult<WriteReply>) => void)[] = [];
  const { store, pending, a } = await openedStore({
    resetFile: () =>
      new Promise((resolve) => {
        resets.push(resolve);
      }),
  });
  const b = await dataFor("b.ts");
  const fresh = await dataFor("a.ts");

  const resetting = store.reset("a.ts", VERSION_0);
  const openB = store.open("b.ts");
  pending[1]?.resolve(ok(b));
  await openB;
  await store.open("a.ts");
  resets[0]?.(written([entry("a.ts"), entry("b.ts")]));
  await vi.waitFor(() => {
    expect(pending.map((load) => load.path)).toEqual(["a.ts", "b.ts", "a.ts"]);
  });
  pending[2]?.resolve(ok(fresh));
  await resetting;

  expect(store.active.value).toBe("a.ts");
  expect(store.opened.value).toEqual([fresh, b]);
  expect(store.opened.value[0]).not.toBe(a);

  await store.open("a.ts");

  expect(pending).toHaveLength(3);
  expect(store.active.value).toBe("a.ts");
});

test("a later open wins over a reset that resolves last; the reset file is replaced in place", async () => {
  spyConsole();
  const resets: ((result: SourceResult<WriteReply>) => void)[] = [];
  const { store, pending, a } = await openedStore({
    resetFile: () =>
      new Promise((resolve) => {
        resets.push(resolve);
      }),
  });
  const b = await dataFor("b.ts");
  const fresh = await dataFor("a.ts");

  const resetting = store.reset("a.ts", VERSION_0);
  const openB = store.open("b.ts");
  pending[1]?.resolve(ok(b));
  await openB;
  resets[0]?.(written([entry("a.ts")]));
  await vi.waitFor(() => {
    expect(pending).toHaveLength(3);
  });
  pending[2]?.resolve(ok(fresh));
  await resetting;

  expect(store.active.value).toBe("b.ts");
  expect(store.files.value).toEqual([entry("a.ts")]);
  expect(store.opened.value).toEqual([fresh, b]);
  expect(store.opened.value[0]).not.toBe(a);
});

test("a reset landing in the background keeps another file's problem; a problem about its own file is cleared", async () => {
  spyConsole();
  const resets: ((result: SourceResult<WriteReply>) => void)[] = [];
  const git: SourceFailure = { kind: "Git", message: "index.lock exists" };
  const { store, pending } = await openedStore({
    resetFile: () =>
      new Promise((resolve) => {
        resets.push(resolve);
      }),
    finishFile: () => Promise.resolve({ ok: false, failure: git }),
  });

  const resetting = store.reset("a.ts", VERSION_0);
  const failed = store.open("gone.ts");
  pending[1]?.resolve({ ok: false, failure: { kind: "UnknownPath", path: "gone.ts" } });
  await failed;
  const gone = store.problem.value;
  resets[0]?.(written([entry("a.ts")]));
  await vi.waitFor(() => {
    expect(pending).toHaveLength(3);
  });
  pending[2]?.resolve(ok(await dataFor("a.ts")));
  await resetting;

  expect(store.problem.value).toBe(gone);

  await store.finish({
    path: "a.ts",
    snapshot: shot("text"),
    summary: NOTHING_LEFT,
    diskVersion: VERSION_0,
  });
  expect(store.problem.value).toEqual({ action: "finish", path: "a.ts", cause: git });
  const again = store.reset("a.ts", VERSION_0);
  resets[1]?.(written([entry("a.ts")]));
  await vi.waitFor(() => {
    expect(pending).toHaveLength(4);
  });
  pending[3]?.resolve(ok(await dataFor("a.ts")));
  await again;

  expect(store.problem.value).toBeNull();
});

const LOGO = "assets/logo.bin";
const REMOVED = "docs/removed.md";
const LOGO_ENTRY: FileEntry = { ...entry(LOGO), unsupported: "Binary" };
const REMOVED_ENTRY: FileEntry = { ...entry(REMOVED), unsupported: "RemoteDeleted" };
const LOGO_SIDES: FileSides = {
  path: LOGO,
  reason: "Binary",
  local: { kind: "Binary", bytes: 11 },
  remote: { kind: "Binary", bytes: 12 },
  diskVersion: await versioned(4),
};
const REMOVED_SIDES: FileSides = {
  path: REMOVED,
  reason: "RemoteDeleted",
  local: { kind: "Text", lines: 3 },
  remote: { kind: "Missing" },
  diskVersion: await versioned(5),
};

function choiceSource(
  overrides: Partial<ChunkSource>,
  files: FileEntry[] = [entry("a.ts"), LOGO_ENTRY],
): { source: ChunkSource; calls: string[] } {
  const calls: string[] = [];
  const source: ChunkSource = {
    loadFile: async (path) => {
      calls.push(`loadFile ${path}`);
      return ok(await dataFor(path));
    },
    finishFile: () => Promise.reject(new Error("not used")),
    saveFile: () => Promise.reject(new Error("not used")),
    resetFile: (path) => {
      calls.push(`resetFile ${path}`);
      return Promise.resolve(written(files));
    },
    describeFile: (path) => {
      calls.push(`describeFile ${path}`);
      return Promise.resolve(ok(path === REMOVED ? REMOVED_SIDES : LOGO_SIDES));
    },
    takeSide: (path, side) => {
      calls.push(`takeSide ${path} ${side}`);
      const taken = files.map((file): FileEntry =>
        file.path === path ? { ...file, status: "Resolved" } : file,
      );
      return Promise.resolve(written(taken));
    },
    listStop: () => Promise.resolve(listing(files)),
    continueOperation: () => Promise.reject(new Error("not used")),
    abortOperation: () => Promise.reject(new Error("not used")),
    ...NO_SETTINGS,
    ...overrides,
  };
  return { source, calls };
}

test("a list of files the editor cannot show opens the first one's choice and loads nothing", async () => {
  spyConsole();
  const { source, calls } = choiceSource({
    listStop: () => Promise.resolve(listing([LOGO_ENTRY, REMOVED_ENTRY])),
  });
  const store = createAppStore(source);

  await store.loadFiles();

  expect(calls).toEqual([`describeFile ${LOGO}`]);
  expect(store.active.value).toBe(LOGO);
  expect(store.choices.value).toEqual([LOGO_SIDES]);
  expect(store.taken.value).toEqual(new Map());
  expect(store.opened.value).toEqual([]);
});

test("opening a file the editor cannot show describes it once and never loads it", async () => {
  spyConsole();
  const { source, calls } = choiceSource({});
  const store = createAppStore(source);
  await store.loadFiles();

  await store.open(LOGO);

  expect(calls).toEqual(["loadFile a.ts", `describeFile ${LOGO}`]);
  expect(store.active.value).toBe(LOGO);
  expect(store.choices.value).toEqual([LOGO_SIDES]);
  expect(store.opened.value.map((file) => file.path)).toEqual(["a.ts"]);

  await store.open("a.ts");
  await store.open(LOGO);

  expect(calls).toHaveLength(2);
  expect(store.active.value).toBe(LOGO);
});

test("a failed describe is a failed open of that file and shows no choice", async () => {
  const lines = spyConsole();
  const unknown: SourceFailure = { kind: "UnknownPath", path: LOGO };
  const { source } = choiceSource({
    describeFile: () => Promise.resolve({ ok: false, failure: unknown }),
  });
  const store = createAppStore(source);
  await store.loadFiles();

  await store.open(LOGO);

  expect(store.problem.value).toEqual({ action: "open", path: LOGO, cause: unknown });
  expect(store.active.value).toBe("a.ts");
  expect(store.choices.value).toEqual([]);
  expect(lines.error).toEqual([`[error] store.open_failed {path: "${LOGO}", kind: "UnknownPath"}`]);
});

async function twoChoices(
  overrides: Partial<ChunkSource>,
): Promise<{ store: AppStore; calls: string[]; removed: FileSides | undefined }> {
  const { source, calls } = choiceSource(overrides, [LOGO_ENTRY, REMOVED_ENTRY]);
  const store = createAppStore(source);
  await store.loadFiles();
  await store.open(REMOVED);
  return { store, calls, removed: store.choices.value[1] };
}

test("taking a side updates the list, marks only that file taken, and clears a problem about it", async () => {
  spyConsole();
  const git: SourceFailure = { kind: "Git", message: "index.lock exists" };
  const takes: string[] = [];
  const { store, removed } = await twoChoices({
    takeSide: (path, side) => {
      takes.push(`${path} ${side}`);
      return Promise.resolve(
        takes.length === 1
          ? { ok: false, failure: git }
          : written([{ ...LOGO_ENTRY, status: "Resolved" }, REMOVED_ENTRY]),
      );
    },
  });
  await store.takeSide(LOGO, "remote", LOGO_SIDES.diskVersion);
  expect(store.problem.value).toEqual({ action: "take", path: LOGO, cause: git });

  await store.takeSide(LOGO, "remote", LOGO_SIDES.diskVersion);

  expect(takes).toEqual([`${LOGO} remote`, `${LOGO} remote`]);
  expect(store.files.value).toEqual([{ ...LOGO_ENTRY, status: "Resolved" }, REMOVED_ENTRY]);
  expect(store.choices.value).toEqual([LOGO_SIDES, REMOVED_SIDES]);
  expect(store.taken.value).toEqual(new Map([[LOGO, { by: "side", side: "remote" }]]));
  expect(store.choices.value[1]).toBe(removed);
  expect(store.problem.value).toBeNull();
});

test("a take keeps a problem about another file", async () => {
  spyConsole();
  const unknown: SourceFailure = { kind: "UnknownPath", path: "gone.ts" };
  const { source } = choiceSource(
    { loadFile: () => Promise.resolve({ ok: false, failure: unknown }) },
    [LOGO_ENTRY],
  );
  const store = createAppStore(source);
  await store.loadFiles();
  await store.open("gone.ts");
  const gone = store.problem.value;
  expect(gone).toEqual({ action: "open", path: "gone.ts", cause: unknown });

  await store.takeSide(LOGO, "remote", LOGO_SIDES.diskVersion);

  expect(store.taken.value).toEqual(new Map([[LOGO, { by: "side", side: "remote" }]]));
  expect(store.problem.value).toBe(gone);
});

test("a failed take keeps the list and the choice and names the file", async () => {
  const lines = spyConsole();
  const git: SourceFailure = { kind: "Git", message: "git rm failed" };
  const { source } = choiceSource({
    listStop: () => Promise.resolve(listing([LOGO_ENTRY, REMOVED_ENTRY])),
    takeSide: () => Promise.resolve({ ok: false, failure: git }),
  });
  const store = createAppStore(source);
  await store.loadFiles();
  const files = store.files.value;

  await store.takeSide(LOGO, "local", LOGO_SIDES.diskVersion);

  expect(store.files.value).toBe(files);
  expect(store.choices.value).toEqual([LOGO_SIDES]);
  expect(store.taken.value).toEqual(new Map());
  expect(store.active.value).toBe(LOGO);
  expect(store.problem.value).toEqual({ action: "take", path: LOGO, cause: git });
  expect(lines.error).toEqual([
    `[error] store.take_failed {path: "${LOGO}", kind: "Git", message: "git rm failed"}`,
  ]);
});

function describedLater(): {
  source: ChunkSource;
  calls: string[];
  describes: ((result: SourceResult<FileSides>) => void)[];
} {
  const describes: ((result: SourceResult<FileSides>) => void)[] = [];
  const { source, calls } = choiceSource({}, [LOGO_ENTRY, REMOVED_ENTRY]);
  source.describeFile = (path) => {
    calls.push(`describeFile ${path}`);
    return new Promise((resolve) => {
      describes.push(resolve);
    });
  };
  return { source, calls, describes };
}

const KEPT_TAKEN = new Map([[REMOVED, { by: "side", side: "remote" }]]);

async function takenChoice(): Promise<{
  store: AppStore;
  calls: string[];
  describes: ((result: SourceResult<FileSides>) => void)[];
  removed: FileSides | undefined;
}> {
  const { source, calls, describes } = describedLater();
  const store = createAppStore(source);
  const loading = store.loadFiles();
  await vi.waitFor(() => {
    expect(describes).toHaveLength(1);
  });
  describes[0]?.(ok(LOGO_SIDES));
  await loading;
  await store.takeSide(REMOVED, "remote", REMOVED_SIDES.diskVersion);
  const opening = store.open(REMOVED);
  describes[1]?.(ok(REMOVED_SIDES));
  await opening;
  await store.takeSide(LOGO, "local", LOGO_SIDES.diskVersion);
  return { store, calls, describes, removed: store.choices.value[1] };
}

test("reset of a taken choice forgets only its side at once and describes the file again", async () => {
  spyConsole();
  const { store, calls, describes, removed } = await takenChoice();
  const fresh: FileSides = { ...LOGO_SIDES, local: { kind: "Binary", bytes: 13 } };

  const resetting = store.reset(LOGO, LOGO_SIDES.diskVersion);
  await vi.waitFor(() => {
    expect(describes).toHaveLength(3);
  });

  expect(store.choices.value).toEqual([REMOVED_SIDES]);
  expect(store.taken.value).toEqual(KEPT_TAKEN);
  expect(store.files.value).toEqual([LOGO_ENTRY, REMOVED_ENTRY]);

  describes[2]?.(ok(fresh));
  await resetting;

  expect(calls).toEqual([
    `describeFile ${LOGO}`,
    `takeSide ${REMOVED} remote`,
    `describeFile ${REMOVED}`,
    `takeSide ${LOGO} local`,
    `resetFile ${LOGO}`,
    `describeFile ${LOGO}`,
  ]);
  expect(store.choices.value).toEqual([REMOVED_SIDES, fresh]);
  expect(store.choices.value[0]).toBe(removed);
  expect(store.active.value).toBe(REMOVED);
});

test("a failed describe after a reset is a failed open; opening the file again describes it", async () => {
  spyConsole();
  const { store, describes, removed } = await takenChoice();
  const unknown: SourceFailure = { kind: "UnknownPath", path: LOGO };

  const resetting = store.reset(LOGO, LOGO_SIDES.diskVersion);
  await vi.waitFor(() => {
    expect(describes).toHaveLength(3);
  });
  describes[2]?.({ ok: false, failure: unknown });
  await resetting;

  expect(store.problem.value).toEqual({ action: "open", path: LOGO, cause: unknown });
  expect(store.choices.value).toEqual([REMOVED_SIDES]);
  expect(store.choices.value[0]).toBe(removed);

  const opening = store.open(LOGO);
  describes[3]?.(ok(LOGO_SIDES));
  await opening;

  expect(store.taken.value).toEqual(KEPT_TAKEN);
  expect(store.problem.value).toBeNull();
});

test("choices count toward everything resolved", async () => {
  spyConsole();
  const { source } = choiceSource({}, [LOGO_ENTRY]);
  const store = createAppStore(source);
  await store.loadFiles();
  expect(store.allResolved.value).toBe(false);

  await store.takeSide(LOGO, "remote", LOGO_SIDES.diskVersion);

  expect(store.allResolved.value).toBe(true);
});

test("a take on the shown file opens the next unresolved file, wrapping to the top", async () => {
  spyConsole();
  const files: FileEntry[] = [entry("a.ts"), LOGO_ENTRY, { ...REMOVED_ENTRY, status: "Resolved" }];
  const { source, calls } = choiceSource({}, files);
  const store = createAppStore(source);
  await store.loadFiles();
  await store.open(LOGO);

  await store.takeSide(LOGO, "local", LOGO_SIDES.diskVersion);

  expect(calls).toEqual(["loadFile a.ts", `describeFile ${LOGO}`, `takeSide ${LOGO} local`]);
  expect(store.active.value).toBe("a.ts");
  expect(store.taken.value).toEqual(new Map([[LOGO, { by: "side", side: "local" }]]));
});

const REMOVED_TEXT = "docs/removed-text.md";

test("a deleted-side text file keeps the side taken next to the choices' until its reset, and is loaded again after each", async () => {
  spyConsole();
  const { source, calls } = choiceSource({}, [entry(REMOVED_TEXT)]);
  const store = createAppStore(source);
  await store.loadFiles();
  const [shown] = store.opened.value;

  await store.takeSide(REMOVED_TEXT, "remote", VERSION_0);

  expect(store.taken.value).toEqual(new Map([[REMOVED_TEXT, { by: "side", side: "remote" }]]));
  expect(store.choices.value).toEqual([]);
  expect(store.opened.value).toEqual([shown]);
  expect(store.opened.value[0]).not.toBe(shown);
  expect(store.active.value).toBe(REMOVED_TEXT);

  await store.reset(REMOVED_TEXT, VERSION_0);

  expect(calls).toEqual([
    `loadFile ${REMOVED_TEXT}`,
    `takeSide ${REMOVED_TEXT} remote`,
    `loadFile ${REMOVED_TEXT}`,
    `resetFile ${REMOVED_TEXT}`,
    `loadFile ${REMOVED_TEXT}`,
  ]);
  expect(store.taken.value).toEqual(new Map());
  expect(store.opened.value[0]).not.toBe(shown);
});

test("a list refresh changes the marks only: same file shown, same views, another file's problem kept", async () => {
  spyConsole();
  let listed = [entry("a.ts"), entry("b.ts"), LOGO_ENTRY];
  const unknown: SourceFailure = { kind: "UnknownPath", path: "gone.ts" };
  const { source } = choiceSource({ listStop: () => Promise.resolve(listing(listed)) });
  const store = createAppStore({
    ...source,
    loadFile: async (path) =>
      path === "gone.ts" ? { ok: false, failure: unknown } : ok(await dataFor(path)),
  });
  await store.loadFiles();
  await store.open(LOGO);
  await store.open("gone.ts");
  const { opened, choices, problem } = store;
  const [shownOpened, shownChoices, gone] = [opened.value, choices.value, problem.value];
  listed = [entry("a.ts"), resolvedEntry("b.ts"), { ...LOGO_ENTRY, status: "Resolved" }];

  await store.refreshFiles();

  expect(store.files.value).toEqual(listed);
  expect(store.active.value).toBe(LOGO);
  expect(store.opened.value).toBe(shownOpened);
  expect(store.choices.value).toBe(shownChoices);
  expect(store.problem.value).toBe(gone);
});

test("a failed refresh is a list problem and keeps the marks; the next good one clears only that", async () => {
  const lines = spyConsole();
  const git: SourceFailure = { kind: "Git", message: "git ls-files failed" };
  let answer: SourceResult<Listing> = listing([entry("a.ts")]);
  const { source, pending } = handSource([]);
  const store = createAppStore({ ...source, listStop: () => Promise.resolve(answer) });
  await openNow(store, pending, "a.ts");
  await store.refreshFiles();
  const marks = store.files.value;
  answer = { ok: false, failure: git };

  await store.refreshFiles();

  expect(store.files.value).toBe(marks);
  expect(store.problem.value).toEqual({ action: "list", cause: git });
  expect(lines.error).toEqual([
    '[error] store.list_failed {kind: "Git", message: "git ls-files failed"}',
  ]);

  answer = listing([resolvedEntry("a.ts")]);
  await store.refreshFiles();

  expect(store.files.value).toEqual([resolvedEntry("a.ts")]);
  expect(store.problem.value).toBeNull();
  expect(store.active.value).toBe("a.ts");
});

const STAGED: DiskResult = { kind: "Staged" };
const TWO_LEFT: DiskResult = { kind: "MarkersLeft", conflicts: 2 };

function rebuildingView(store: AppStore, path: string): Omit<FakeView, "snapshot"> {
  let built = store.opened.value.find((file) => file.path === path);
  const view: Omit<FakeView, "snapshot"> = {
    text: "loaded\n",
    saved: "loaded\n",
    work: {
      unsaved: () => {
        const current = store.opened.value.find((file) => file.path === path);
        if (current !== built) {
          built = current;
          view.text = "reloaded\n";
          view.saved = "reloaded\n";
        }
        return view.text !== view.saved;
      },
    },
  };
  store.track(path, view.work);
  return view;
}

test.each([true, false])(
  "a running change to an opened file rebuilds it and drops its side taken (edits: %s)",
  async (edited) => {
    const lines = spyConsole();
    let listed = listing([entry("a.ts"), LOGO_ENTRY]);
    const { source, calls } = choiceSource({ listStop: () => Promise.resolve(listed) });
    const store = createAppStore(source);
    await store.loadFiles();
    await store.takeSide("a.ts", "local", VERSION_0);
    const [shown] = store.opened.value;
    const view = rebuildingView(store, "a.ts");
    if (edited) {
      view.text = "typed\n";
    }
    expect(store.unsavedFiles()).toEqual(edited ? ["a.ts"] : []);
    listed = listing([entry("a.ts"), LOGO_ENTRY], [{ path: "a.ts", result: TWO_LEFT }]);

    await store.refreshFiles();

    expect(calls.filter((call) => call === "loadFile a.ts")).toHaveLength(3);
    expect(store.opened.value).toHaveLength(1);
    expect(store.opened.value[0]).not.toBe(shown);
    expect(store.notices.value).toEqual([
      { kind: "disk", path: "a.ts", result: TWO_LEFT, editsDropped: edited, when: "running" },
    ]);
    expect(store.taken.value).toEqual(new Map());
    expect(store.unsavedFiles()).toEqual([]);
    expect(lines.info).toContain(
      `[info] file.disk_changed {path: "a.ts", result: "MarkersLeft", conflicts: 2, editsDropped: ${edited}, when: "running"}`,
    );
  },
);

test("a change to a file that is not shown gives only its notice and its mark", async () => {
  spyConsole();
  let listed = listing([entry("a.ts"), entry("b.ts")]);
  const { source, calls } = choiceSource({ listStop: () => Promise.resolve(listed) });
  const store = createAppStore(source);
  await store.loadFiles();
  const shown = store.opened.value;
  listed = listing([entry("a.ts"), resolvedEntry("b.ts")], [{ path: "b.ts", result: STAGED }]);

  await store.refreshFiles();

  expect(calls).toEqual(["loadFile a.ts"]);
  expect(store.files.value).toEqual([entry("a.ts"), resolvedEntry("b.ts")]);
  expect(store.opened.value).toBe(shown);
  expect(store.choices.value).toEqual([]);
  expect(store.taken.value).toEqual(new Map());
  expect(store.notices.value).toEqual([
    { kind: "disk", path: "b.ts", result: STAGED, editsDropped: false, when: "running" },
  ]);
  expect(store.problem.value).toBeNull();
});

test("changes reported by the first list are start notices; the file then opens from the disk", async () => {
  spyConsole();
  const { source, calls } = choiceSource({
    listStop: () => Promise.resolve(listing([entry("a.ts")], [{ path: "a.ts", result: TWO_LEFT }])),
  });
  const store = createAppStore(source);

  await store.loadFiles();

  expect(calls).toEqual(["loadFile a.ts"]);
  expect(store.active.value).toBe("a.ts");
  expect(store.notices.value).toEqual([
    { kind: "disk", path: "a.ts", result: TWO_LEFT, editsDropped: false, when: "start" },
  ]);
});

test("a newer change replaces the notice for its path; dismissNotice removes just one", async () => {
  spyConsole();
  const files = [entry("a.ts"), entry("b.ts"), entry("c.ts")];
  const oneLeft: DiskResult = { kind: "MarkersLeft", conflicts: 1 };
  let listed = listing(files, [
    { path: "b.ts", result: TWO_LEFT },
    { path: "c.ts", result: STAGED },
  ]);
  const { source } = choiceSource({ listStop: () => Promise.resolve(listed) });
  const store = createAppStore(source);
  await store.loadFiles();
  listed = listing(files, [{ path: "b.ts", result: oneLeft }]);

  await store.refreshFiles();

  expect(store.notices.value).toEqual([
    { kind: "disk", path: "c.ts", result: STAGED, editsDropped: false, when: "start" },
    { kind: "disk", path: "b.ts", result: oneLeft, editsDropped: false, when: "running" },
  ]);

  store.dismissNotice("disk:c.ts");

  expect(store.notices.value).toEqual([
    { kind: "disk", path: "b.ts", result: oneLeft, editsDropped: false, when: "running" },
  ]);
});

test("a choice staged from the disk is taken by the disk, a deleted-side file is not, and both are shown again", async () => {
  spyConsole();
  const files = [LOGO_ENTRY, entry(REMOVED_TEXT)];
  let listed = listing(files);
  const { source, calls } = choiceSource(
    {
      listStop: () => Promise.resolve(listed),
      loadFile: async (path) => {
        calls.push(`loadFile ${path}`);
        return ok({ ...(await dataFor(path)), deleted: "remote" });
      },
    },
    files,
  );
  const store = createAppStore(source);
  await store.loadFiles();
  await store.open(LOGO);
  await store.takeSide(LOGO, "local", LOGO_SIDES.diskVersion);
  listed = listing(files, [
    { path: LOGO, result: STAGED },
    { path: REMOVED_TEXT, result: STAGED },
  ]);

  await store.refreshFiles();

  expect(store.taken.value).toEqual(new Map([[LOGO, { by: "disk" }]]));
  expect(calls.slice(-2).toSorted()).toEqual([`describeFile ${LOGO}`, `loadFile ${REMOVED_TEXT}`]);
});

test("a choice file staged from the disk before start opens later taken by the disk, so Reset is enabled", async () => {
  spyConsole();
  const { source, calls } = choiceSource({
    listStop: () =>
      Promise.resolve(
        listing(
          [entry("a.ts"), { ...LOGO_ENTRY, status: "Resolved" }],
          [{ path: LOGO, result: STAGED }],
        ),
      ),
  });
  const store = createAppStore(source);
  await store.loadFiles();

  await store.open(LOGO);

  const [sides] = store.choices.value;
  const taken = store.taken.value.get(LOGO) ?? null;
  expect(calls).toEqual(["loadFile a.ts", `describeFile ${LOGO}`]);
  expect(taken).toEqual({ by: "disk" });
  expect(sides === undefined ? null : resultLine(sides, taken)).toBe(
    "Changed on disk — staged as it is.",
  );
  expect(store.notices.value).toEqual([
    { kind: "disk", path: LOGO, result: STAGED, editsDropped: false, when: "start" },
  ]);
});

test("a change git could not stage is a warning notice, not a problem", async () => {
  const warnings: string[] = [];
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    warnings.push(line);
  });
  spyConsole();
  const failed: DiskResult = { kind: "StageFailed", message: "index.lock exists" };
  const { source } = choiceSource({
    listStop: () =>
      Promise.resolve(listing([entry("a.ts"), entry("b.ts")], [{ path: "b.ts", result: failed }])),
  });
  const store = createAppStore(source);

  await store.loadFiles();

  expect(store.problem.value).toBeNull();
  expect(store.notices.value).toEqual([
    { kind: "disk", path: "b.ts", result: failed, editsDropped: false, when: "start" },
  ]);
  expect(warnings).toEqual([
    '[warn] file.disk_changed {path: "b.ts", result: "StageFailed", message: "index.lock exists", editsDropped: false, when: "start"}',
  ]);
});

test("a finish refused because the file changed on disk saves nothing, stays, and shows the disk view", async () => {
  spyConsole();
  const files = [entry("a.ts"), entry("b.ts")];
  const change: DiskChange = { path: "a.ts", result: TWO_LEFT };
  const { source, calls } = choiceSource(
    { finishFile: () => Promise.resolve(ok({ kind: "ChangedOnDisk", files, change })) },
    files,
  );
  const store = createAppStore(source);
  await store.loadFiles();
  const [shown] = store.opened.value;
  const view = fakeView(store, "a.ts", "loaded\n");
  view.text = "merged\n";

  await store.finish({
    path: "a.ts",
    snapshot: view.snapshot(),
    summary: NOTHING_LEFT,
    diskVersion: VERSION_0,
  });

  expect(view.saved).toBe("loaded\n");
  expect(store.active.value).toBe("a.ts");
  expect(calls).toEqual(["loadFile a.ts", "loadFile a.ts"]);
  expect(store.opened.value[0]).not.toBe(shown);
  expect(store.notices.value).toEqual([
    { kind: "disk", path: "a.ts", result: TWO_LEFT, editsDropped: true, when: "running" },
  ]);
  expect(store.problem.value).toBeNull();
});

test.each(["take", "reset"] as const)(
  "a %s refused because the file changed on disk shows the change and the disk view",
  async (action) => {
    spyConsole();
    const files = [entry("a.ts")];
    const change: DiskChange = { path: "a.ts", result: STAGED };
    function changed(): Promise<SourceResult<WriteReply>> {
      return Promise.resolve(ok({ kind: "ChangedOnDisk", files: [resolvedEntry("a.ts")], change }));
    }
    const { source, calls } = choiceSource({ takeSide: changed, resetFile: changed }, files);
    const store = createAppStore(source);
    await store.loadFiles();

    await (action === "take"
      ? store.takeSide("a.ts", "remote", VERSION_0)
      : store.reset("a.ts", VERSION_0));

    expect(calls).toEqual(["loadFile a.ts", "loadFile a.ts"]);
    expect(store.files.value).toEqual([resolvedEntry("a.ts")]);
    expect(store.taken.value).toEqual(new Map());
    expect(store.notices.value).toEqual([
      { kind: "disk", path: "a.ts", result: STAGED, editsDropped: false, when: "running" },
    ]);
  },
);

test("finish, take and reset forward the disk version they are given", async () => {
  spyConsole();
  const seven = await versioned(7);
  const sent: string[] = [];
  const files = [entry("a.ts"), LOGO_ENTRY];
  const { source } = choiceSource(
    {
      finishFile: ({ path, diskVersion }) => {
        sent.push(`finish ${path} ${diskVersion}`);
        return Promise.resolve(written(files));
      },
      takeSide: (path, side, diskVersion) => {
        sent.push(`take ${path} ${side} ${diskVersion}`);
        return Promise.resolve(written(files));
      },
      resetFile: (path, diskVersion) => {
        sent.push(`reset ${path} ${diskVersion}`);
        return Promise.resolve(written(files));
      },
    },
    files,
  );
  const store = createAppStore(source);
  await store.loadFiles();
  await store.open(LOGO);

  await store.finish({
    path: "a.ts",
    snapshot: shot("a"),
    summary: NOTHING_LEFT,
    diskVersion: seven,
  });
  await store.takeSide("a.ts", "local", seven);
  await store.reset(LOGO, LOGO_SIDES.diskVersion);

  expect(sent).toEqual(["finish a.ts 7", "take a.ts local 7", `reset ${LOGO} 4`]);
});

test("a take on a deleted-side file shown from the disk shows yamt's view again", async () => {
  spyConsole();
  let middle: FileMergeData["middle"] = { kind: "DiskNotText", found: "Deleted" };
  const { source, calls } = choiceSource(
    {
      loadFile: async (path) => {
        calls.push(`loadFile ${path}`);
        return ok({ ...(await dataFor(path)), deleted: "remote", middle });
      },
    },
    [entry(REMOVED_TEXT)],
  );
  const store = createAppStore(source);
  await store.loadFiles();
  middle = { kind: "Stages", text: "kept\n" };

  await store.takeSide(REMOVED_TEXT, "local", VERSION_0);

  expect(calls).toEqual([
    `loadFile ${REMOVED_TEXT}`,
    `takeSide ${REMOVED_TEXT} local`,
    `loadFile ${REMOVED_TEXT}`,
  ]);
  expect(store.opened.value[0]?.middle).toEqual({ kind: "Stages", text: "kept\n" });
  expect(store.taken.value).toEqual(new Map([[REMOVED_TEXT, { by: "side", side: "local" }]]));
});

const SETTINGS_PATH = "/home/me/.config/yamt/settings.json";

function read(stored: StoredSettings): SourceResult<SettingsRead> {
  return ok({ path: SETTINGS_PATH, defaultPath: SETTINGS_PATH, stored });
}

function parsed(text: string): Key {
  const key = parseKey(text);
  if (key === null) {
    throw new Error(`${text} does not parse`);
  }
  return key;
}

function settingsSource(overrides: Partial<ChunkSource>): {
  source: ChunkSource;
  sent: unknown[][];
} {
  const sent: unknown[][] = [];
  const { source } = handSource([]);
  const recorded: ChunkSource = {
    ...source,
    loadSettings: (current) => {
      sent.push(["loadSettings", current]);
      return overrides.loadSettings?.(current) ?? Promise.resolve(read(current));
    },
    setTheme: (current, theme) => {
      sent.push(["setTheme", current, theme]);
      return overrides.setTheme?.(current, theme) ?? Promise.resolve(read({ ...current, theme }));
    },
    setAntialiasing: (current, antialiasing) => {
      sent.push(["setAntialiasing", current, antialiasing]);
      return (
        overrides.setAntialiasing?.(current, antialiasing) ??
        Promise.resolve(read({ ...current, antialiasing }))
      );
    },
    setKeys: (current, changes) => {
      sent.push(["setKeys", current, changes]);
      const keys = { ...current.keys };
      for (const { action, keys: texts } of changes) {
        if (texts === null) {
          delete keys[action];
        } else {
          keys[action] = texts;
        }
      }
      return overrides.setKeys?.(current, changes) ?? Promise.resolve(read({ ...current, keys }));
    },
    moveSettings: (current, path) => {
      sent.push(["moveSettings", current, path]);
      return overrides.moveSettings?.(current, path) ?? Promise.resolve(read(current));
    },
  };
  return { source: recorded, sent };
}

test("settings start with the start theme and the default keys, before any file is read", () => {
  const store = createStoreWithTheme(
    handSource([]).source,
    "light",
    new LanguageServers(null),
    null,
  );

  expect(store.settings.value).toEqual({
    read: null,
    theme: "light",
    antialiasing: "subpixel",
    keys: { bindings: DEFAULT_KEYS, problems: [] },
    languageServers: NO_SERVERS,
  });
  expect(store.preferences.value).toEqual({ theme: "light", keys: DEFAULT_KEYS });
});

test("a load on focus applies a file changed by hand since the last load", async () => {
  const files = [
    read({ ...DARK, keys: {} }),
    read({ ...LIGHT, keys: { apply: ["a"], "later-action": ["Mod-q"] } }),
  ];
  const { source, sent } = settingsSource({
    loadSettings: () => Promise.resolve(files.shift() ?? read({ ...DARK, keys: {} })),
  });
  const store = createAppStore(source);

  await store.loadSettings();
  expect(store.settings.value.theme).toBe("dark");

  await store.loadSettings();

  expect(store.settings.value.theme).toBe("light");
  expect(store.preferences.value.keys.apply).toEqual([parsed("a")]);
  expect(sent).toEqual([
    ["loadSettings", { ...DARK, keys: {} }],
    ["loadSettings", { ...DARK, keys: {} }],
  ]);
});

test("start-up loads the file list and the settings; focus loads both again", async () => {
  const { source, sent } = settingsSource({
    loadSettings: () => Promise.resolve(read({ ...LIGHT, keys: {} })),
  });
  const lists = vi.fn(() => source.listStop());
  const store = createAppStore({ ...source, listStop: lists });

  await store.startUp();

  expect(lists).toHaveBeenCalledTimes(1);
  expect(store.settings.value.theme).toBe("light");

  await store.refocus();

  expect(lists).toHaveBeenCalledTimes(2);
  expect(sent.map(([call]) => call)).toEqual(["loadSettings", "loadSettings"]);
});

test("a loaded file sets the theme and keys every opened file follows", async () => {
  const { source } = settingsSource({
    loadSettings: () => Promise.resolve(read({ ...LIGHT, keys: { apply: ["a"] } })),
  });
  const store = createAppStore(source);

  await store.loadSettings();

  expect(store.settings.value.read?.path).toBe(SETTINGS_PATH);
  expect(store.preferences.value.theme).toBe("light");
  expect(store.preferences.value.keys.apply).toEqual([parsed("a")]);
  expect(store.preferences.value.keys.ignore).toEqual(DEFAULT_KEYS.ignore);
  expect(store.problem.value).toBeNull();
});

test("a failed load or change keeps the settings in use and shows a settings problem", async () => {
  spyConsole();
  const broken: SourceFailure = { kind: "SettingsBroken", path: SETTINGS_PATH, message: "x" };
  const failed: SourceResult<SettingsRead> = { ok: false, failure: broken };
  const loads = [read({ ...LIGHT, keys: {} }), failed];
  const { source } = settingsSource({
    loadSettings: () => Promise.resolve(loads.shift() ?? read({ ...DARK, keys: {} })),
    setTheme: () => Promise.resolve({ ok: false, failure: broken }),
    setKeys: () => Promise.reject(new Error("ipc down")),
  });
  const store = createAppStore(source);
  await store.loadSettings();
  const inUse = store.settings.value;

  await store.loadSettings();
  expect(store.settings.value).toBe(inUse);
  expect(store.problem.value).toEqual({ action: "settings", cause: broken });

  await store.setTheme("dark");
  await store.removeAllKeys("undo");

  expect(store.settings.value).toBe(inUse);
  expect(store.problem.value).toEqual({
    action: "settings",
    cause: { kind: "Unexpected", message: "ipc down" },
  });
});

test("key problems in the file show one settings problem, which a clean read clears", async () => {
  spyConsole();
  const loads = [
    read({ ...DARK, keys: { redo: ["Ctrl+Q"], indent: ["Mod-f"] } }),
    read({ ...DARK, keys: {} }),
  ];
  const { source } = settingsSource({
    loadSettings: () => Promise.resolve(loads.shift() ?? read({ ...DARK, keys: {} })),
  });
  const store = createAppStore(source);

  await store.loadSettings();

  expect(store.problem.value).toEqual({
    action: "settings",
    cause: {
      kind: "Keys",
      path: SETTINGS_PATH,
      problems: [
        { kind: "unreadable", action: "redo", text: "Ctrl+Q" },
        { kind: "twice", key: parsed("Mod-f"), actions: ["find", "indent"] },
      ],
    },
  });
  expect(store.preferences.value.keys.redo).toEqual(DEFAULT_KEYS.redo);

  await store.loadSettings();

  expect(store.problem.value).toBeNull();
});

test("setTheme sends the settings in use and applies the reply", async () => {
  const { source, sent } = settingsSource({});
  const store = createAppStore(source);

  await store.setTheme("light");

  expect(sent).toEqual([["setTheme", { ...DARK, keys: {} }, "light"]]);
  expect(store.settings.value.theme).toBe("light");
});

test("setAntialiasing sends the settings in use with the new value and applies the reply", async () => {
  const { source, sent } = settingsSource({});
  const store = createAppStore(source);

  await store.setAntialiasing("greyscale");

  expect(sent).toEqual([["setAntialiasing", { ...DARK, keys: {} }, "greyscale"]]);
  expect(store.settings.value.antialiasing).toBe("greyscale");

  await store.setTheme("light");

  expect(sent.at(-1)).toEqual([
    "setTheme",
    { ...DARK, antialiasing: "greyscale", keys: {} },
    "light",
  ]);
});

test("a load whose only difference is the antialiasing is adopted", async () => {
  const loads = [
    read({ ...DARK, keys: {} }),
    read({ ...DARK, antialiasing: "greyscale", keys: {} }),
  ];
  const { source } = settingsSource({
    loadSettings: () => Promise.resolve(loads.shift() ?? read({ ...DARK, keys: {} })),
  });
  const store = createAppStore(source);
  await store.loadSettings();
  const before = store.settings.value;

  await store.loadSettings();

  expect(before.antialiasing).toBe("subpixel");
  expect(store.settings.value.antialiasing).toBe("greyscale");
  expect(store.settings.value.read?.stored.antialiasing).toBe("greyscale");
});

test("a key another action holds asks; Move writes both changes in one call", async () => {
  const { source, sent } = settingsSource({});
  const store = createAppStore(source);

  const adding = store.addKey("undo", parsed("Mod-f"));
  await vi.waitFor(() => {
    expect(store.question.value).toEqual({
      kind: "clash",
      key: parsed("Mod-f"),
      action: "undo",
      owner: "find",
    });
  });
  store.answer(true);
  await adding;

  expect(sent).toEqual([
    [
      "setKeys",
      { ...DARK, keys: {} },
      [
        { action: "undo", keys: ["Mod-z", "Mod-f"] },
        { action: "find", keys: [] },
      ],
    ],
  ]);
  expect(store.preferences.value.keys.find).toEqual([]);
  expect(store.preferences.value.keys.undo).toEqual([parsed("Mod-z"), parsed("Mod-f")]);
});

test("Cancel on the clash question writes nothing", async () => {
  const { source, sent } = settingsSource({});
  const store = createAppStore(source);

  const adding = store.changeKey("find", parsed("Mod-f"), parsed("Mod-z"));
  await vi.waitFor(() => {
    expect(store.question.value?.kind).toBe("clash");
  });
  store.answer(false);
  await adding;

  expect(sent).toEqual([]);
  expect(store.preferences.value.keys).toEqual(DEFAULT_KEYS);
});

test("each key edit sends only the changed actions, as key texts", async () => {
  const { source, sent } = settingsSource({});
  const store = createAppStore(source);

  await store.addKey("apply", parsed("a"));
  await store.removeKey("redo", parsed("Mod-y"));
  await store.resetKeys("apply");
  await store.removeKey("apply", parsed("q"));

  expect(sent).toEqual([
    ["setKeys", { ...DARK, keys: {} }, [{ action: "apply", keys: ["Enter", "Space", "a"] }]],
    [
      "setKeys",
      { ...DARK, keys: { apply: ["Enter", "Space", "a"] } },
      [{ action: "redo", keys: ["Mod-Shift-z"] }],
    ],
    [
      "setKeys",
      { ...DARK, keys: { apply: ["Enter", "Space", "a"], redo: ["Mod-Shift-z"] } },
      [{ action: "apply", keys: null }],
    ],
  ]);
});

test("an identical load keeps the settings object and does not show the same key problems again", async () => {
  const lines = spyConsole();
  const broken = { ...DARK, keys: { redo: ["Ctrl+Q"] } } satisfies StoredSettings;
  const { source } = settingsSource({
    loadSettings: () => Promise.resolve(read(broken)),
    setTheme: (_current, theme) => Promise.resolve(read({ ...broken, theme })),
  });
  const store = createAppStore(source);
  await store.loadSettings();
  const inUse = store.settings.value;
  const preferences = store.preferences.value;
  store.dismissProblem();

  await store.loadSettings();

  expect(store.problem.value).toBeNull();
  expect(store.settings.value).toBe(inUse);
  expect(store.preferences.value).toBe(preferences);

  await store.setTheme("light");

  expect(store.preferences.value.theme).toBe("light");
  expect(store.problem.value).toBeNull();
  expect(lines.error).toHaveLength(1);
});

test("a key problem shown again replaces a settings failure the file no longer has", async () => {
  spyConsole();
  const broken: SourceFailure = { kind: "SettingsBroken", path: SETTINGS_PATH, message: "x" };
  const unreadable = read({ ...DARK, keys: { redo: ["Ctrl+Q"] } });
  const loads: SourceResult<SettingsRead>[] = [unreadable, { ok: false, failure: broken }];
  const { source } = settingsSource({
    loadSettings: () => Promise.resolve(loads.shift() ?? unreadable),
  });
  const store = createAppStore(source);
  await store.loadSettings();
  await store.loadSettings();
  expect(store.problem.value).toEqual({ action: "settings", cause: broken });

  await store.loadSettings();

  expect(store.problem.value).toEqual({
    action: "settings",
    cause: {
      kind: "Keys",
      path: SETTINGS_PATH,
      problems: [{ kind: "unreadable", action: "redo", text: "Ctrl+Q" }],
    },
  });
});

test("a move to a file with the same broken keys names the new path in the Keys problem", async () => {
  spyConsole();
  const broken = { ...DARK, keys: { redo: ["Ctrl+Q"] } } satisfies StoredSettings;
  const elsewhere = "/elsewhere.json";
  const { source } = settingsSource({
    loadSettings: () => Promise.resolve(read(broken)),
    moveSettings: () =>
      Promise.resolve(ok({ path: elsewhere, defaultPath: SETTINGS_PATH, stored: broken })),
  });
  const store = createAppStore(source);
  await store.loadSettings();

  await store.moveSettings(elsewhere);

  expect(store.problem.value).toEqual({
    action: "settings",
    cause: {
      kind: "Keys",
      path: elsewhere,
      problems: [{ kind: "unreadable", action: "redo", text: "Ctrl+Q" }],
    },
  });
});

test("a load that started before a change and answers after it does not put the old file back", async () => {
  const lines = spyConsole();
  const loads: ((result: SourceResult<SettingsRead>) => void)[] = [];
  const { source } = settingsSource({
    loadSettings: () =>
      new Promise((resolve) => {
        loads.push(resolve);
      }),
  });
  const store = createAppStore(source);

  const loading = store.loadSettings();
  const failing = store.loadSettings();
  await store.setTheme("light");
  loads[0]?.(read({ ...DARK, keys: {} }));
  loads[1]?.({ ok: false, failure: { kind: "SettingsBroken", path: SETTINGS_PATH, message: "x" } });
  await loading;
  await failing;

  expect(store.settings.value.theme).toBe("light");
  expect(store.problem.value).toBeNull();
  expect(lines.error).toHaveLength(1);
});

test("Move after a reload freed the key sends the edit planned on the bindings now in use", async () => {
  const { source, sent } = settingsSource({
    loadSettings: () => Promise.resolve(read({ ...DARK, keys: { find: ["Mod-g"] } })),
  });
  const store = createAppStore(source);

  const adding = store.addKey("undo", parsed("Mod-f"));
  await vi.waitFor(() => {
    expect(store.question.value?.kind).toBe("clash");
  });
  await store.loadSettings();
  store.answer(true);
  await adding;

  expect(sent.at(-1)).toEqual([
    "setKeys",
    { ...DARK, keys: { find: ["Mod-g"] } },
    [{ action: "undo", keys: ["Mod-z", "Mod-f"] }],
  ]);
  expect(store.preferences.value.keys.find).toEqual([parsed("Mod-g")]);
});

test("moveSettings sends the path with the settings in use and uses the file found there", async () => {
  const moved: SettingsRead = {
    path: "/elsewhere.json",
    defaultPath: SETTINGS_PATH,
    stored: { ...LIGHT, keys: {} },
  };
  const { source, sent } = settingsSource({ moveSettings: () => Promise.resolve(ok(moved)) });
  const store = createAppStore(source);

  await store.moveSettings("/elsewhere.json");

  expect(sent).toEqual([["moveSettings", { ...DARK, keys: {} }, "/elsewhere.json"]]);
  expect(store.settings.value.read).toEqual(moved);
  expect(store.settings.value.theme).toBe("light");
});

const LINUX = "Linux x86_64";
const MAC = "MacIntel";

type Held = {
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
  readonly prevented?: boolean;
};

type FakePress = Parameters<AppStore["fileListKey"]>[0] & { readonly prevents: () => number };

function press(key: string, held: Held = {}): FakePress {
  let prevents = 0;
  return {
    key,
    code: `Key${key.toUpperCase()}`,
    ctrlKey: held.ctrl ?? false,
    metaKey: held.meta ?? false,
    altKey: held.alt ?? false,
    shiftKey: held.shift ?? false,
    defaultPrevented: held.prevented ?? false,
    preventDefault: () => {
      prevents += 1;
    },
    prevents: () => prevents,
  };
}

test("the file list is shown at start, and Ctrl+B on Linux hides and shows it, taking each press", () => {
  const store = createAppStore(handSource([]).source);
  expect(store.fileListShown.value).toBe(true);

  const hide = press("b", { ctrl: true });
  store.fileListKey(hide, LINUX);
  expect(store.fileListShown.value).toBe(false);
  expect(hide.prevents()).toBe(1);

  const show = press("b", { ctrl: true });
  store.fileListKey(show, LINUX);
  expect(store.fileListShown.value).toBe(true);
  expect(show.prevents()).toBe(1);
});

test("⌘B on macOS toggles the list; ⌃B on macOS and other B keys on Linux leave the press alone", () => {
  const store = createAppStore(handSource([]).source);
  const others: [FakePress, string][] = [
    [press("b", { ctrl: true }), MAC],
    [press("B", { ctrl: true, shift: true }), LINUX],
    [press("b", { alt: true }), LINUX],
    [press("b"), LINUX],
    [press("b", { meta: true }), LINUX],
  ];

  for (const [other, platform] of others) {
    store.fileListKey(other, platform);
    expect(store.fileListShown.value).toBe(true);
    expect(other.prevents()).toBe(0);
  }

  const command = press("b", { meta: true });
  store.fileListKey(command, MAC);
  expect(store.fileListShown.value).toBe(false);
  expect(command.prevents()).toBe(1);
});

test("a key press another handler already took does not toggle the list", () => {
  const store = createAppStore(handSource([]).source);
  const taken = press("b", { ctrl: true, prevented: true });

  store.fileListKey(taken, LINUX);

  expect(store.fileListShown.value).toBe(true);
  expect(taken.prevents()).toBe(0);
});

test("while a question waits the key does nothing; once answered it toggles again", async () => {
  const { source } = settingsSource({});
  const store = createAppStore(source);
  const adding = store.addKey("undo", parsed("Mod-f"));
  await vi.waitFor(() => {
    expect(store.question.value?.kind).toBe("clash");
  });

  const asked = press("b", { ctrl: true });
  store.fileListKey(asked, LINUX);
  expect(store.fileListShown.value).toBe(true);
  expect(asked.prevents()).toBe(0);

  store.answer(false);
  await adding;
  store.fileListKey(press("b", { ctrl: true }), LINUX);
  expect(store.fileListShown.value).toBe(false);
});

test("a re-bound toggle-file-list key toggles the list at once, and Ctrl+B no longer does", async () => {
  const { source } = settingsSource({
    loadSettings: () =>
      Promise.resolve(read({ ...DARK, keys: { "toggle-file-list": ["Mod-Shift-l"] } })),
  });
  const store = createAppStore(source);
  await store.loadSettings();

  const old = press("b", { ctrl: true });
  store.fileListKey(old, LINUX);
  expect(store.fileListShown.value).toBe(true);
  expect(old.prevents()).toBe(0);

  const bound = press("L", { ctrl: true, shift: true });
  store.fileListKey(bound, LINUX);
  expect(store.fileListShown.value).toBe(false);
  expect(bound.prevents()).toBe(1);
});

test("an empty toggle-file-list binding leaves Ctrl+B and a plain b alone", async () => {
  const { source } = settingsSource({
    loadSettings: () => Promise.resolve(read({ ...DARK, keys: { "toggle-file-list": [] } })),
  });
  const store = createAppStore(source);
  await store.loadSettings();

  for (const unbound of [press("b", { ctrl: true }), press("b")]) {
    store.fileListKey(unbound, LINUX);
    expect(store.fileListShown.value).toBe(true);
    expect(unbound.prevents()).toBe(0);
  }
});

test("with two toggle-file-list keys, each one toggles the list", async () => {
  const { source } = settingsSource({
    loadSettings: () =>
      Promise.resolve(read({ ...DARK, keys: { "toggle-file-list": ["Mod-b", "Mod-Shift-l"] } })),
  });
  const store = createAppStore(source);
  await store.loadSettings();

  const first = press("b", { ctrl: true });
  store.fileListKey(first, LINUX);
  expect(store.fileListShown.value).toBe(false);
  expect(first.prevents()).toBe(1);

  const second = press("L", { ctrl: true, shift: true });
  store.fileListKey(second, LINUX);
  expect(store.fileListShown.value).toBe(true);
  expect(second.prevents()).toBe(1);
});

test("toggleCollapsing flips collapsing and keeps the choice in the window's storage", () => {
  const items = new Map<string, string>();
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
    const store = createAppStore(handSource([]).source);
    expect(store.collapsing.value).toBe(true);

    store.toggleCollapsing();

    expect(store.collapsing.value).toBe(false);
    expect(items.get("yamt.collapse.unchanged")).toBe("false");
    expect(createAppStore(handSource([]).source).collapsing.value).toBe(false);
  } finally {
    setSSRHandler("getDefaultStorage", () => undefined);
  }
});

type SaveCall = [path: string, text: string, diskVersion: DiskVersion];

function savingSource(
  files: FileEntry[],
  reply: (call: SaveCall) => Promise<SourceResult<WriteReply>>,
): { source: ChunkSource; saves: SaveCall[]; calls: string[] } {
  const saves: SaveCall[] = [];
  const { source, calls } = choiceSource(
    {
      saveFile: ({ path, text, diskVersion }) => {
        saves.push([path, text, diskVersion]);
        return reply([path, text, diskVersion]);
      },
    },
    files,
  );
  return { source, saves, calls };
}

function editorHandle(
  view: FakeView,
  format: () => Promise<FormatOutcome | null> = () => Promise.resolve(null),
): Pick<MergeHandle, "format" | "snapshot"> {
  return { format, snapshot: () => view.snapshot() };
}

test.each(["reset", "finish"] as const)(
  "a save while a %s of the same file runs is ignored",
  async (action) => {
    spyConsole();
    const answers: Answer[] = [];
    const { source: base, saves } = savingSource([entry("a.ts")], () =>
      Promise.resolve(written([entry("a.ts")])),
    );
    const source: ChunkSource = {
      ...base,
      resetFile: () => answeredLater(answers),
      finishFile: () => answeredLater(answers),
    };
    const store = createAppStore(source);
    await store.loadFiles();
    const view = fakeView(store, "a.ts", "a\n");
    view.text = "typed\n";
    const writing =
      action === "reset"
        ? store.reset("a.ts", VERSION_0)
        : store.finish({
            path: "a.ts",
            snapshot: shot("typed\n"),
            summary: NOTHING_LEFT,
            diskVersion: VERSION_0,
          });
    await vi.waitFor(() => {
      expect(answers).toHaveLength(1);
    });

    await store.save({ path: "a.ts", diskVersion: VERSION_0, handle: editorHandle(view) });
    expect(saves).toEqual([]);
    answers[0]?.(written([entry("a.ts")]));
    await writing;
    await store.save({ path: "a.ts", diskVersion: VERSION_0, handle: editorHandle(view) });

    expect(saves).toEqual([["a.ts", "typed\n(file)", 0]]);
  },
);

test.each(["reset", "finish"] as const)(
  "a save whose formatting still runs when a %s of the same file lands writes nothing",
  async (action) => {
    spyConsole();
    const { source: base, saves } = savingSource([entry("a.ts")], () =>
      Promise.resolve(written([entry("a.ts")])),
    );
    const source: ChunkSource = {
      ...base,
      finishFile: () => Promise.resolve(written([resolvedEntry("a.ts")])),
    };
    const store = createAppStore(source);
    await store.loadFiles();
    const view = fakeView(store, "a.ts", "a\n");
    view.text = "typed\n";
    const formats: ((outcome: FormatOutcome | null) => void)[] = [];
    function format(): Promise<FormatOutcome | null> {
      return new Promise((resolve) => {
        formats.push(resolve);
      });
    }

    const saving = store.save({
      path: "a.ts",
      diskVersion: VERSION_0,
      handle: editorHandle(view, format),
    });
    await (action === "reset"
      ? store.reset("a.ts", VERSION_0)
      : store.finish({
          path: "a.ts",
          snapshot: shot("finished\n"),
          summary: NOTHING_LEFT,
          diskVersion: VERSION_0,
        }));
    formats[0]?.(null);
    await saving;

    expect(saves).toEqual([]);
  },
);

test("the format note: shown after a Save for the four refusals, hidden for the three others, replaced by the next Save", async () => {
  spyConsole();
  const { source } = savingSource([entry("a.ts")], () => Promise.resolve(written([entry("a.ts")])));
  const store = createAppStore(source);
  await store.loadFiles();
  const view = fakeView(store, "a.ts", "a\n");
  const outcomes: [FormatOutcome, string | null][] = [
    [
      { kind: "notRunning", server: "oxfmt", state: { kind: "stopped" } },
      "Not formatted: oxfmt is not running",
    ],
    [{ kind: "formatted", server: "oxfmt" }, null],
    [{ kind: "failed", server: "oxfmt", message: "boom" }, "Not formatted: oxfmt failed: boom"],
    [{ kind: "unchanged", server: "oxfmt" }, null],
    [{ kind: "timedOut", server: "oxfmt" }, "Not formatted: oxfmt did not answer in time"],
    [{ kind: "noFormatter" }, null],
    [
      { kind: "changedMeanwhile", server: "oxfmt" },
      "Not formatted: the Result changed while oxfmt was formatting",
    ],
  ];
  expect(formatNote(store.formatOutcomes.value.get("a.ts"))).toBeNull();

  for (const [outcome, note] of outcomes) {
    view.text = `${outcome.kind}\n`;
    await store.save({
      path: "a.ts",
      diskVersion: VERSION_0,
      handle: editorHandle(view, () => Promise.resolve(outcome)),
    });

    expect(formatNote(store.formatOutcomes.value.get("a.ts"))).toBe(note);
  }
});

test("a focus list that finds git moved on outside drops the old stop, names the dropped edits, and opens the new stop's first file", async () => {
  spyConsole();
  const rebase: OperationView = {
    kind: "Rebase",
    branch: "feature",
    onto: null,
    replaying: null,
    progress: { step: 1, total: 3 },
    editor_steps_ahead: false,
  };
  const sides: SideNames = { local: { kind: "Branch", name: "x" }, remote: null };
  const answers: SourceResult<Listing>[] = [
    ok({ kind: "Files", files: [entry("a.ts")], diskChanges: [], operation: rebase, sides }),
    ok({ kind: "MovedOn" }),
    ok({
      kind: "Files",
      files: [entry("c.ts")],
      diskChanges: [],
      operation: { ...rebase, progress: { step: 2, total: 3 } },
      sides: { local: null, remote: null },
    }),
  ];
  const { source, calls } = choiceSource({
    listStop: () => Promise.resolve(answers.shift() ?? ok({ kind: "MovedOn" })),
  });
  const store = createAppStore(source);
  await store.loadFiles();
  const view = fakeView(store, "a.ts", "loaded\n");
  view.text = "typed\n";
  expect(store.operation.value).toBe(rebase);

  await store.refreshFiles();

  expect(calls).toEqual(["loadFile a.ts", "loadFile c.ts"]);
  expect(store.opened.value.map((file) => file.path)).toEqual(["c.ts"]);
  expect(store.active.value).toBe("c.ts");
  expect(store.operation.value?.kind === "Rebase" && store.operation.value.progress).toEqual({
    step: 2,
    total: 3,
  });
  expect(store.sideNames.value).toEqual({ local: null, remote: null });
  expect(store.notices.value).toEqual([{ kind: "movedOn", operation: "Rebase", files: ["a.ts"] }]);
  store.dismissNotice("movedOn");
  expect(store.notices.value).toEqual([]);
});

test("Continue answered Stopped runs the store's own nextStop: the old stop is dropped and the new stop listed and opened", async () => {
  spyConsole();
  const rebase: OperationView = {
    kind: "Rebase",
    branch: "feature",
    onto: null,
    replaying: null,
    progress: { step: 1, total: 3 },
    editor_steps_ahead: false,
  };
  const step2: OperationView = { ...rebase, progress: { step: 2, total: 3 } };
  const sides: SideNames = { local: null, remote: null };
  const answers: SourceResult<Listing>[] = [
    ok({
      kind: "Files",
      files: [resolvedEntry("a.ts")],
      diskChanges: [],
      operation: rebase,
      sides,
    }),
    ok({ kind: "Files", files: [entry("c.ts")], diskChanges: [], operation: step2, sides }),
  ];
  const { source, calls } = choiceSource({
    listStop: () => {
      calls.push("listStop");
      return Promise.resolve(answers.shift() ?? ok({ kind: "MovedOn" }));
    },
    continueOperation: () => {
      calls.push("continueOperation");
      return Promise.resolve(ok({ kind: "Stopped", message: "CONFLICT in c.ts" }));
    },
  });
  const store = createAppStore(source);
  await store.loadFiles();
  expect(store.continueState.value).toBe("ready");

  await store.continueOperation();

  expect(calls).toEqual([
    "listStop",
    "loadFile a.ts",
    "continueOperation",
    "listStop",
    "loadFile c.ts",
  ]);
  expect(store.files.value).toEqual([entry("c.ts")]);
  expect(store.operation.value).toBe(step2);
  expect(store.opened.value.map((file) => file.path)).toEqual(["c.ts"]);
  expect(store.active.value).toBe("c.ts");
  expect(store.problem.value).toBeNull();
  expect(store.continueState.value).toBe("filesLeft");
});

test("a take git refuses stays on the file: no move to the next unresolved one", async () => {
  spyConsole();
  const refused: SourceFailure = { kind: "Git", message: "index.lock exists" };
  const { source, calls } = choiceSource({
    listStop: () => Promise.resolve(listing([LOGO_ENTRY, REMOVED_ENTRY])),
    takeSide: (path, side) => {
      calls.push(`takeSide ${path} ${side}`);
      return Promise.resolve({ ok: false, failure: refused });
    },
  });
  const store = createAppStore(source);
  await store.loadFiles();
  expect(store.active.value).toBe(LOGO);

  await store.takeSide(LOGO, "local", LOGO_SIDES.diskVersion);

  expect(calls).toEqual([`describeFile ${LOGO}`, `takeSide ${LOGO} local`]);
  expect(store.active.value).toBe(LOGO);
  expect(store.problem.value).toEqual({ action: "take", path: LOGO, cause: refused });
});

type HeldGit = {
  readonly store: AppStore;
  readonly aborts: ((reply: SourceResult<null>) => void)[];
  readonly continues: ((reply: SourceResult<ContinueReply>) => void)[];
};

async function heldGit(
  files: readonly FileEntry[],
  stopped: readonly FileEntry[],
): Promise<HeldGit> {
  const aborts: HeldGit["aborts"] = [];
  const continues: HeldGit["continues"] = [];
  let listed = files;
  const { source } = choiceSource({
    listStop: () => Promise.resolve(listing(listed)),
    abortOperation: () =>
      new Promise((resolve) => {
        aborts.push(resolve);
      }),
    continueOperation: () =>
      new Promise((resolve) => {
        listed = stopped;
        continues.push(resolve);
      }),
  });
  const store = createAppStore(source);
  await store.loadFiles();
  return { store, aborts, continues };
}

test("an Abort git has not answered yet makes Continue running and refuses the close", async () => {
  spyConsole();
  const { store, aborts } = await heldGit([resolvedEntry("a.ts")], []);

  const aborting = store.abortOperation();
  store.answer(true);
  await vi.waitFor(() => {
    expect(aborts).toHaveLength(1);
  });

  expect(store.continueState.value).toBe("running");
  expect(await store.mayClose()).toBe(false);
  expect(store.problem.value).toEqual({ action: "close" });
  aborts[0]?.({ ok: false, failure: { kind: "Git", message: "no" } });
  await aborting;
  expect(store.continueState.value).toBe("ready");
});

test("a Continue git has not answered yet makes Abort running and refuses the close", async () => {
  spyConsole();
  const { store, continues } = await heldGit([resolvedEntry("a.ts")], [resolvedEntry("a.ts")]);

  const continuing = store.continueOperation();
  await vi.waitFor(() => {
    expect(continues).toHaveLength(1);
  });

  expect(store.abortState.value).toEqual({ kind: "running", operation: MERGING });
  expect(await store.mayClose()).toBe(false);
  expect(store.problem.value).toEqual({ action: "close" });
  continues[0]?.({ ok: false, failure: { kind: "Git", message: "no" } });
  await continuing;
  expect(store.abortState.value).toEqual({ kind: "ready", operation: MERGING });
});

test("a stop without files shows git's message in the stop view, not the bar; settings hide it and later problems keep it", async () => {
  spyConsole();
  const { store, aborts, continues } = await heldGit([resolvedEntry("a.ts")], []);
  const continuing = store.continueOperation();
  await vi.waitFor(() => {
    expect(continues).toHaveLength(1);
  });
  continues[0]?.(ok({ kind: "Stopped", message: "Could not apply 1a2b3c4... add c\n" }));
  await continuing;

  const stopView = { message: "Could not apply 1a2b3c4... add c" };
  expect(store.emptyStop.value).toEqual({ stopView, barProblem: null });
  store.openSettings();
  expect(store.emptyStop.value).toEqual({ stopView: null, barProblem: null });
  store.closeSettings();

  const aborting = store.abortOperation();
  store.answer(true);
  await vi.waitFor(() => {
    expect(aborts).toHaveLength(1);
  });
  await store.mayClose();
  expect(store.emptyStop.value).toEqual({ stopView, barProblem: { action: "close" } });
  aborts[0]?.({ ok: false, failure: { kind: "Git", message: "no" } });
  await aborting;
  expect(store.emptyStop.value.stopView).toEqual(stopView);
  expect(store.emptyStop.value.barProblem?.action).toBe("abort");
});
