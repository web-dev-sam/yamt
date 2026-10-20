import { afterEach, expect, test, vi } from "vitest";
import { shallowRef } from "vue";

import {
  loadFixture,
  type ChunkSource,
  type DiskChange,
  type DiskResult,
  type FileEntry,
  type FileMergeData,
  type FileSides,
  type SourceFailure,
  type SourceResult,
  type WriteReply,
  type WriteRequest,
} from "../ipc";
import type { Notice } from "./noticeText";
import type { Problem } from "./problem";
import { problemText } from "./problemText";
import { afterWrite, claimWrite, createSaving, finish, whileWriting, type Writing } from "./saving";
import type { Taken } from "./sides";
import type { FormatOutcome, MergeHandle, ResultSnapshot } from "./useMergeController";

type Written = Parameters<ResultSnapshot["markSaved"]>[0];

type Answer = (reply: SourceResult<WriteReply>) => void;

const MAGIC_KEYS = await loadFixture("vueuse-use-magic-keys.ts");
const VERSION = MAGIC_KEYS.diskVersion;
const NOTHING_LEFT = { conflicts: 0, changes: 0 };
const OXFMT: FormatOutcome = { kind: "formatted", server: "oxfmt" };
const TWO_LEFT: DiskResult = { kind: "MarkersLeft", conflicts: 2 };

afterEach(() => {
  vi.restoreAllMocks();
});

function entry(path: string): FileEntry {
  return { path, status: "Unresolved", unsupported: null };
}

function resolvedEntry(path: string): FileEntry {
  return { ...entry(path), status: "Resolved" };
}

function written(files: FileEntry[]): SourceResult<WriteReply> {
  return { ok: true, value: { kind: "Written", files } };
}

function notUsed(): Promise<never> {
  return Promise.reject(new Error("not used"));
}

function answeredLater(answers: Answer[]): Promise<SourceResult<WriteReply>> {
  return new Promise((resolve) => {
    answers.push(resolve);
  });
}

class Editor {
  text: string;
  saved: string;
  readonly marks: Written[] = [];

  constructor(text: string) {
    this.text = text;
    this.saved = text;
  }

  snapshot(): ResultSnapshot {
    const { text } = this;
    return {
      asShown: () => text,
      fileText: () => `${text}(file)`,
      unsaved: text !== this.saved,
      markSaved: (sent) => {
        this.saved = text;
        this.marks.push(sent);
      },
    };
  }

  handle(
    format: () => Promise<FormatOutcome | null> = () => Promise.resolve(null),
  ): Pick<MergeHandle, "format" | "snapshot"> {
    return { format, snapshot: () => this.snapshot() };
  }
}

function writeTarget(
  files: readonly FileEntry[],
  writes: Pick<ChunkSource, "saveFile" | "finishFile">,
  editors: Readonly<Record<string, Editor>> = {},
): Parameters<typeof finish>[0] & { readonly loads: string[]; readonly sent: WriteRequest[] } {
  const loads: string[] = [];
  const sent: WriteRequest[] = [];
  const source: ChunkSource = {
    listFiles: notUsed,
    loadFile: (path) => {
      loads.push(path);
      return Promise.resolve({ ok: true, value: { ...MAGIC_KEYS, path } });
    },
    finishFile: (request) => {
      sent.push(request);
      return writes.finishFile(request);
    },
    saveFile: (request) => {
      sent.push(request);
      return writes.saveFile(request);
    },
    resetFile: notUsed,
    describeFile: notUsed,
    takeSide: notUsed,
    sideNames: notUsed,
    abortMerge: notUsed,
    loadSettings: notUsed,
    setTheme: notUsed,
    setAntialiasing: notUsed,
    setKeys: notUsed,
    moveSettings: notUsed,
    setServerAnswer: notUsed,
    setServerSwitch: notUsed,
    setAddedServers: notUsed,
  };
  return {
    source,
    loads,
    sent,
    files: shallowRef(files),
    opened: shallowRef<readonly FileMergeData[]>([{ ...MAGIC_KEYS, path: "a.ts" }]),
    choices: shallowRef<readonly FileSides[]>([]),
    problem: shallowRef<Problem | null>(null),
    notices: shallowRef<readonly Notice[]>([]),
    taken: shallowRef<ReadonlyMap<string, Taken>>(new Map()),
    guard: {
      unsavedFiles: () =>
        Object.entries(editors)
          .filter(([, editor]) => editor.text !== editor.saved)
          .map(([path]) => path),
    },
    writing: new Map(),
    asking: { ask: () => Promise.resolve("yes") },
  };
}

function texts(sent: readonly WriteRequest[]): [string, string][] {
  return sent.map(({ path, text }) => [path, text]);
}

test("save: Written sends the file text, marks it saved as the file text, takes git's list and records the format outcome", async () => {
  const after = [entry("a.ts"), resolvedEntry("b.ts")];
  const target = writeTarget([entry("a.ts"), entry("b.ts")], {
    saveFile: () => Promise.resolve(written(after)),
    finishFile: notUsed,
  });
  const saving = createSaving(target);
  const editor = new Editor("loaded\n");
  editor.text = "typed\n";
  const handle = editor.handle(() => {
    editor.text = "formatted\n";
    return Promise.resolve(OXFMT);
  });

  await saving.save({ path: "a.ts", diskVersion: VERSION, handle });

  expect(target.sent).toEqual([{ path: "a.ts", text: "formatted\n(file)", diskVersion: VERSION }]);
  expect(editor.saved).toBe("formatted\n");
  expect(editor.marks).toEqual(["fileText"]);
  expect(target.files.value).toEqual(after);
  expect(saving.formatOutcomes.value).toEqual(new Map([["a.ts", OXFMT]]));
  expect(target.problem.value).toBeNull();
});

test.each([
  ["git lists only it, as resolved", [resolvedEntry("a.ts")], "typed\n", "asShown"],
  ["another file is resolved", [entry("a.ts"), resolvedEntry("b.ts")], "typed\n(file)", "fileText"],
  [
    "it is resolved and another is not",
    [resolvedEntry("a.ts"), entry("b.ts")],
    "typed\n",
    "asShown",
  ],
] as const)(
  "save writes the Result as shown only for a file git lists as resolved (plan §2 #69): %s",
  async (_name, files, text, mark) => {
    const target = writeTarget(files, {
      saveFile: () => Promise.resolve(written([...files])),
      finishFile: notUsed,
    });
    const editor = new Editor("loaded\n");
    editor.text = "typed\n";

    await createSaving(target).save({
      path: "a.ts",
      diskVersion: VERSION,
      handle: editor.handle(),
    });

    expect(texts(target.sent)).toEqual([["a.ts", text]]);
    expect(editor.marks).toEqual([mark]);
  },
);

test("save without unsaved work formats but sends nothing", async () => {
  const target = writeTarget([entry("a.ts")], { saveFile: notUsed, finishFile: notUsed });
  const saving = createSaving(target);
  const format = vi.fn(() => Promise.resolve(OXFMT));

  await saving.save({
    path: "a.ts",
    diskVersion: VERSION,
    handle: new Editor("a\n").handle(format),
  });
  await saving.save({
    path: "a.ts",
    diskVersion: VERSION,
    handle: { format, snapshot: () => null },
  });

  expect(format).toHaveBeenCalledTimes(2);
  expect(target.sent).toEqual([]);
  expect(saving.formatOutcomes.value).toEqual(new Map([["a.ts", OXFMT]]));
});

test("save goes on whatever formatting answers, and an editor without an outcome records none", async () => {
  const files = [entry("a.ts"), entry("b.ts")];
  const target = writeTarget(files, {
    saveFile: () => Promise.resolve(written(files)),
    finishFile: notUsed,
  });
  const saving = createSaving(target);
  const a = new Editor("a\n");
  const b = new Editor("b\n");
  a.text = "a typed\n";
  b.text = "b typed\n";
  const crashed: FormatOutcome = { kind: "failed", server: "oxfmt", message: "crashed" };

  await saving.save({
    path: "a.ts",
    diskVersion: VERSION,
    handle: a.handle(() => Promise.resolve(crashed)),
  });
  await saving.save({ path: "b.ts", diskVersion: VERSION, handle: b.handle() });

  expect(texts(target.sent)).toEqual([
    ["a.ts", "a typed\n(file)"],
    ["b.ts", "b typed\n(file)"],
  ]);
  expect([a.saved, b.saved]).toEqual(["a typed\n", "b typed\n"]);
  expect(saving.formatOutcomes.value).toEqual(new Map([["a.ts", crashed]]));
});

test("a save while a save of the same file runs is ignored; typing during the write keeps the dot", async () => {
  const files = [entry("a.ts"), entry("b.ts")];
  const answers: Answer[] = [];
  const target = writeTarget(files, {
    saveFile: () => answeredLater(answers),
    finishFile: notUsed,
  });
  const saving = createSaving(target);
  const a = new Editor("a\n");
  const b = new Editor("b\n");
  a.text = "first\n";
  b.text = "other file\n";
  const format = vi.fn(() => Promise.resolve(null));

  const first = saving.save({ path: "a.ts", diskVersion: VERSION, handle: a.handle() });
  await vi.waitFor(() => {
    expect(answers).toHaveLength(1);
  });
  a.text = "typed meanwhile\n";
  await saving.save({ path: "a.ts", diskVersion: VERSION, handle: a.handle(format) });
  const other = saving.save({ path: "b.ts", diskVersion: VERSION, handle: b.handle() });
  await vi.waitFor(() => {
    expect(answers).toHaveLength(2);
  });
  answers[0]?.(written(files));
  answers[1]?.(written(files));
  await Promise.all([first, other]);

  expect(format).not.toHaveBeenCalled();
  expect(texts(target.sent)).toEqual([
    ["a.ts", "first\n(file)"],
    ["b.ts", "other file\n(file)"],
  ]);
  expect(a.saved).toBe("first\n");
  expect(a.snapshot().unsaved).toBe(true);

  const again = saving.save({ path: "a.ts", diskVersion: VERSION, handle: a.handle() });
  await vi.waitFor(() => {
    expect(answers).toHaveLength(3);
  });
  answers[2]?.(written(files));
  await again;

  expect(target.sent.at(-1)?.text).toBe("typed meanwhile\n(file)");
  expect(a.snapshot().unsaved).toBe(false);
});

test("claimWrite runs nothing while the path is held; whileWriting joins a held path, and the path is free only once every write ended", async () => {
  const target: Writing = { writing: new Map() };
  const ran: string[] = [];
  const releases: (() => void)[] = [];
  function held(name: string): () => Promise<void> {
    return () => {
      ran.push(name);
      return new Promise((resolve) => {
        releases.push(resolve);
      });
    };
  }

  const saving = claimWrite(target, "a.ts", held("save"));
  const resetting = whileWriting(target, "a.ts", held("reset"));
  await claimWrite(target, "a.ts", held("second save"));
  const other = claimWrite(target, "b.ts", held("other file"));
  releases[0]?.();
  await saving;
  await claimWrite(target, "a.ts", held("save during the reset"));
  releases[1]?.();
  await resetting;
  const after = claimWrite(target, "a.ts", held("save after"));
  releases[2]?.();
  releases[3]?.();
  await Promise.all([other, after]);

  expect(ran).toEqual(["save", "reset", "other file", "save after"]);
  expect(target.writing).toEqual(new Map());
});

test("a finish that ends while a save of the same file runs leaves that save's claim in place", async () => {
  const answers: Answer[] = [];
  const target = writeTarget([entry("a.ts")], {
    saveFile: () => answeredLater(answers),
    finishFile: () => Promise.resolve(written([entry("a.ts")])),
  });
  const saving = createSaving(target);
  const editor = new Editor("a\n");
  editor.text = "typed\n";

  const first = saving.save({ path: "a.ts", diskVersion: VERSION, handle: editor.handle() });
  await vi.waitFor(() => {
    expect(answers).toHaveLength(1);
  });
  await finish(target, {
    path: "a.ts",
    snapshot: new Editor("typed\n").snapshot(),
    summary: NOTHING_LEFT,
    diskVersion: VERSION,
  });
  editor.text = "typed again\n";
  await saving.save({ path: "a.ts", diskVersion: VERSION, handle: editor.handle() });
  answers[0]?.(written([entry("a.ts")]));
  await first;

  expect(texts(target.sent)).toEqual([
    ["a.ts", "typed\n(file)"],
    ["a.ts", "typed\n"],
  ]);
});

test("a save whose formatting still runs when another write of the same file starts writes nothing", async () => {
  const target = writeTarget([entry("a.ts")], {
    saveFile: () => Promise.resolve(written([entry("a.ts")])),
    finishFile: notUsed,
  });
  const saving = createSaving(target);
  const editor = new Editor("a\n");
  editor.text = "typed\n";
  const formats: ((outcome: FormatOutcome | null) => void)[] = [];
  function format(): Promise<FormatOutcome | null> {
    return new Promise((resolve) => {
      formats.push(resolve);
    });
  }

  const first = saving.save({ path: "a.ts", diskVersion: VERSION, handle: editor.handle(format) });
  await whileWriting(target, "a.ts", () => Promise.resolve());
  formats[0]?.(OXFMT);
  await first;

  expect(target.sent).toEqual([]);
  expect(editor.snapshot().unsaved).toBe(true);
  expect(saving.formatOutcomes.value).toEqual(new Map([["a.ts", OXFMT]]));
});

test("finish writes the Result as shown and marks it saved as shown", async () => {
  const target = writeTarget([entry("a.ts")], {
    saveFile: notUsed,
    finishFile: () => Promise.resolve(written([resolvedEntry("a.ts")])),
  });
  const editor = new Editor("a\n");
  editor.text = "merged\n";

  const landed = await finish(target, {
    path: "a.ts",
    snapshot: editor.snapshot(),
    summary: NOTHING_LEFT,
    diskVersion: VERSION,
  });

  expect(landed).toBe(true);
  expect(texts(target.sent)).toEqual([["a.ts", "merged\n"]]);
  expect(editor.marks).toEqual(["asShown"]);
  expect(target.files.value).toEqual([resolvedEntry("a.ts")]);
});

test("afterWrite takes git's list and says whether the write landed; a disk change gives its notice and reloads the file", async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const files = [entry("a.ts"), entry("b.ts")];
  const change: DiskChange = { path: "a.ts", result: TWO_LEFT };
  const target = writeTarget(files, { saveFile: notUsed, finishFile: notUsed });

  expect(await afterWrite(target, "a.ts", { kind: "Written", files: [entry("a.ts")] })).toBe(true);
  expect(target.files.value).toEqual([entry("a.ts")]);
  expect(target.loads).toEqual([]);

  expect(await afterWrite(target, "a.ts", { kind: "ChangedOnDisk", files, change })).toBe(false);
  expect(target.files.value).toEqual(files);
  expect(target.loads).toEqual(["a.ts"]);
  expect(target.notices.value).toEqual([
    { path: "a.ts", result: TWO_LEFT, editsDropped: false, when: "running" },
  ]);
});

test("a save refused because the file changed on disk marks nothing saved and shows the disk view", async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const files = [entry("a.ts"), entry("b.ts")];
  const change: DiskChange = { path: "a.ts", result: TWO_LEFT };
  const editor = new Editor("loaded\n");
  const target = writeTarget(
    files,
    {
      saveFile: () =>
        Promise.resolve({ ok: true, value: { kind: "ChangedOnDisk", files, change } }),
      finishFile: notUsed,
    },
    { "a.ts": editor },
  );
  const [shown] = target.opened.value;
  editor.text = "typed\n";

  await createSaving(target).save({ path: "a.ts", diskVersion: VERSION, handle: editor.handle() });

  expect(editor.saved).toBe("loaded\n");
  expect(target.loads).toEqual(["a.ts"]);
  expect(target.opened.value[0]).not.toBe(shown);
  expect(target.notices.value).toEqual([
    { path: "a.ts", result: TWO_LEFT, editsDropped: true, when: "running" },
  ]);
  expect(target.problem.value).toBeNull();
});

test("a failed save keeps the dot, is reported in words, and the next save clears it", async () => {
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    errors.push(line);
  });
  const failure: SourceFailure = { kind: "WriteFailed", path: "a.ts", message: "disk full" };
  const replies = [Promise.resolve<SourceResult<WriteReply>>({ ok: false, failure })];
  const target = writeTarget([entry("a.ts")], {
    saveFile: () => replies.shift() ?? Promise.resolve(written([entry("a.ts")])),
    finishFile: notUsed,
  });
  const saving = createSaving(target);
  const editor = new Editor("loaded\n");
  editor.text = "typed\n";

  await saving.save({ path: "a.ts", diskVersion: VERSION, handle: editor.handle() });

  expect(editor.saved).toBe("loaded\n");
  expect(target.problem.value).toEqual({ action: "save", path: "a.ts", cause: failure });
  expect(problemText({ action: "save", path: "a.ts", cause: failure }, "Linux x86_64")).toBe(
    "Could not save a.ts: writing a.ts failed: disk full",
  );
  expect(errors).toEqual([
    '[error] store.save_failed {path: "a.ts", kind: "WriteFailed", message: "disk full"}',
  ]);

  await saving.save({ path: "a.ts", diskVersion: VERSION, handle: editor.handle() });

  expect(target.problem.value).toBeNull();
  expect(editor.saved).toBe("typed\n");
});
