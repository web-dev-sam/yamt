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
import {
  afterWrite,
  applyDiskChanges,
  claimWrite,
  createSaving,
  dropStop,
  finish,
  reset,
  take,
  whileWriting,
  type Writing,
} from "./saving";
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

type Calls = Partial<
  Pick<ChunkSource, "saveFile" | "finishFile" | "resetFile" | "takeSide" | "loadFile">
>;

type Target = Parameters<typeof finish>[0] &
  Parameters<typeof createSaving>[0] & {
    readonly loads: string[];
    readonly sent: WriteRequest[];
    readonly lists: string[];
  };

function writeTarget(
  files: readonly FileEntry[],
  calls: Calls,
  editors: Readonly<Record<string, Editor>> = {},
): Target {
  const loads: string[] = [];
  const sent: WriteRequest[] = [];
  const lists: string[] = [];
  const source: ChunkSource = {
    listFiles: notUsed,
    loadFile: (path) => {
      loads.push(path);
      return (
        calls.loadFile?.(path) ?? Promise.resolve({ ok: true, value: { ...MAGIC_KEYS, path } })
      );
    },
    finishFile: (request) => {
      sent.push(request);
      return calls.finishFile?.(request) ?? notUsed();
    },
    saveFile: (request) => {
      sent.push(request);
      return calls.saveFile?.(request) ?? notUsed();
    },
    resetFile: (path, diskVersion) => calls.resetFile?.(path, diskVersion) ?? notUsed(),
    describeFile: notUsed,
    takeSide: (path, side, diskVersion) => calls.takeSide?.(path, side, diskVersion) ?? notUsed(),
    sideNames: notUsed,
    abortMerge: notUsed,
    listStop: notUsed,
    continueOperation: notUsed,
    abortOperation: notUsed,
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
    lists,
    files: shallowRef(files),
    opened: shallowRef<readonly FileMergeData[]>([{ ...MAGIC_KEYS, path: "a.ts" }]),
    choices: shallowRef<readonly FileSides[]>([]),
    problem: shallowRef<Problem | null>(null),
    notices: shallowRef<readonly Notice[]>([]),
    taken: shallowRef<ReadonlyMap<string, Taken>>(new Map()),
    formatOutcomes: shallowRef<ReadonlyMap<string, FormatOutcome>>(new Map()),
    guard: {
      unsavedFiles: () =>
        Object.entries(editors)
          .filter(([, editor]) => editor.text !== editor.saved)
          .map(([path]) => path),
    },
    writing: new Map(),
    stop: { dropped: false },
    asking: { ask: () => Promise.resolve("yes") },
    refreshFiles: () => {
      lists.push("list");
      return Promise.resolve();
    },
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
  expect(target.formatOutcomes.value).toEqual(new Map([["a.ts", OXFMT]]));
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
  expect(target.formatOutcomes.value).toEqual(new Map([["a.ts", OXFMT]]));
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
  expect(target.formatOutcomes.value).toEqual(new Map([["a.ts", crashed]]));
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

test("after dropStop a save's and a finish's late replies change nothing, and a new claim on the path outlives the old one", async () => {
  const saves: Answer[] = [];
  const finishes: Answer[] = [];
  const target = writeTarget([entry("a.ts"), entry("b.ts")], {
    saveFile: () => answeredLater(saves),
    finishFile: () => answeredLater(finishes),
  });
  const saving = createSaving(target);
  const a = new Editor("a\n");
  const b = new Editor("b\n");
  a.text = "typed\n";
  const saved = saving.save({ path: "a.ts", diskVersion: VERSION, handle: a.handle() });
  const finished = finish(target, {
    path: "b.ts",
    diskVersion: VERSION,
    summary: NOTHING_LEFT,
    snapshot: b.snapshot(),
  });
  await vi.waitFor(() => {
    expect([saves.length, finishes.length]).toEqual([1, 1]);
  });
  const before = target.files.value;

  dropStop(target);
  expect(target.writing.size).toBe(0);
  const releases: (() => void)[] = [];
  const next = claimWrite(
    target,
    "a.ts",
    () =>
      new Promise<void>((resolve) => {
        releases.push(resolve);
      }),
  );
  saves[0]?.({ ok: false, failure: { kind: "StopMovedOn" } });
  finishes[0]?.(written([resolvedEntry("b.ts")]));

  expect(await finished).toBe(false);
  await saved;
  expect(target.writing.has("a.ts")).toBe(true);
  expect(target.files.value).toBe(before);
  expect(target.problem.value).toBeNull();
  expect([a.marks, b.marks]).toEqual([[], []]);
  releases[0]?.();
  await next;
  expect(target.writing.has("a.ts")).toBe(false);
});

test("claimWrite runs nothing while the path is held; whileWriting joins a held path, and the path is free only once every write ended", async () => {
  const target: Writing = { writing: new Map(), stop: { dropped: false } };
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
  expect(target.formatOutcomes.value).toEqual(new Map([["a.ts", OXFMT]]));
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

  const { stop } = target;
  expect(await afterWrite(target, "a.ts", { kind: "Written", files: [entry("a.ts")] }, stop)).toBe(
    true,
  );
  expect(target.files.value).toEqual([entry("a.ts")]);
  expect(target.loads).toEqual([]);

  expect(await afterWrite(target, "a.ts", { kind: "ChangedOnDisk", files, change }, stop)).toBe(
    false,
  );
  expect(target.files.value).toEqual(files);
  expect(target.loads).toEqual(["a.ts"]);
  expect(target.notices.value).toEqual([
    { kind: "disk", path: "a.ts", result: TWO_LEFT, editsDropped: false, when: "running" },
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
    { kind: "disk", path: "a.ts", result: TWO_LEFT, editsDropped: true, when: "running" },
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

type StartWrite = (target: Target, editor: Editor) => Promise<unknown>;

const WRITES: readonly (readonly [string, StartWrite])[] = [
  [
    "save",
    (target, editor) =>
      createSaving(target).save({ path: "a.ts", diskVersion: VERSION, handle: editor.handle() }),
  ],
  [
    "finish",
    (target, editor) =>
      finish(target, {
        path: "a.ts",
        diskVersion: VERSION,
        summary: NOTHING_LEFT,
        snapshot: editor.snapshot(),
      }),
  ],
  ["take", (target) => take(target, "a.ts", "local", VERSION)],
  ["reset", (target) => reset(target, "a.ts", VERSION)],
];

const LATE_REPLIES: readonly (readonly [string, SourceResult<WriteReply>])[] = [
  ["written", written([resolvedEntry("a.ts")])],
  [
    "changed on disk",
    {
      ok: true,
      value: {
        kind: "ChangedOnDisk",
        files: [resolvedEntry("a.ts")],
        change: { path: "a.ts", result: TWO_LEFT },
      },
    },
  ],
  ["refused", { ok: false, failure: { kind: "Git", message: "refused" } }],
  ["moved on", { ok: false, failure: { kind: "StopMovedOn" } }],
];

function everyWrite(answer: () => Promise<SourceResult<WriteReply>>): Calls {
  return { saveFile: answer, finishFile: answer, resetFile: answer, takeSide: answer };
}

function typedEditor(): Editor {
  const editor = new Editor("a\n");
  editor.text = "typed\n";
  return editor;
}

function shownState(target: Target): Readonly<Record<string, unknown>> {
  return {
    files: target.files.value,
    taken: target.taken.value,
    choices: target.choices.value,
    problem: target.problem.value,
    opened: target.opened.value,
    notices: target.notices.value,
    formatOutcomes: target.formatOutcomes.value,
  };
}

test.each(
  WRITES.flatMap(([write, start]) =>
    LATE_REPLIES.map(([reply, answer]) => [write, reply, start, answer] as const),
  ),
)("a %s answered %s after dropStop changes nothing", async (_write, _reply, start, answer) => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const answers: Answer[] = [];
  const target = writeTarget(
    [entry("a.ts")],
    everyWrite(() => answeredLater(answers)),
  );
  const editor = typedEditor();
  const writing = start(target, editor);
  await vi.waitFor(() => {
    expect(answers).toHaveLength(1);
  });
  const before = shownState(target);

  dropStop(target);
  answers[0]?.(answer);
  await writing;

  const after = shownState(target);
  expect(Object.keys(after).filter((key) => after[key] !== before[key])).toEqual([]);
  expect([editor.marks, target.loads, target.lists]).toEqual([[], [], []]);
});

test("a format answer after dropStop records no format note and writes nothing", async () => {
  const formats: ((outcome: FormatOutcome | null) => void)[] = [];
  const target = writeTarget([entry("a.ts")], everyWrite(notUsed));
  const before = target.formatOutcomes.value;
  const saving = createSaving(target).save({
    path: "a.ts",
    diskVersion: VERSION,
    handle: typedEditor().handle(
      () =>
        new Promise((resolve) => {
          formats.push(resolve);
        }),
    ),
  });

  dropStop(target);
  formats[0]?.(OXFMT);
  await saving;

  expect(target.formatOutcomes.value).toBe(before);
  expect(target.sent).toEqual([]);
});

test.each<[string, SourceResult<FileMergeData>]>([
  ["the fetched view", { ok: true, value: { ...MAGIC_KEYS, path: "a.ts" } }],
  ["a failure", { ok: false, failure: { kind: "StopMovedOn" } }],
])(
  "a reload still waiting when the stop is dropped leaves opened and problem as the new stop has them: %s",
  async (_name, loaded) => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const loads: ((view: SourceResult<FileMergeData>) => void)[] = [];
    const target = writeTarget([entry("a.ts")], {
      loadFile: () =>
        new Promise((resolve) => {
          loads.push(resolve);
        }),
    });
    const change: DiskChange = { path: "a.ts", result: TWO_LEFT };
    const reloading = applyDiskChanges(target, [change], "running", target.stop);
    await vi.waitFor(() => {
      expect(target.loads).toEqual(["a.ts"]);
    });

    dropStop(target);
    target.opened.value = [];
    target.problem.value = null;
    loads[0]?.(loaded);
    await reloading;

    expect([target.opened.value, target.problem.value, target.lists]).toEqual([[], null, []]);
  },
);

test.each(WRITES)(
  "a %s git answers StopMovedOn is reported and lists again, which goes on to the new stop",
  async (_write, start) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const movedOn: SourceResult<WriteReply> = { ok: false, failure: { kind: "StopMovedOn" } };
    const target = writeTarget(
      [entry("a.ts")],
      everyWrite(() => Promise.resolve(movedOn)),
    );

    await start(target, typedEditor());

    const { problem } = target;
    expect(problem.value !== null && "cause" in problem.value ? problem.value.cause : null).toEqual(
      { kind: "StopMovedOn" },
    );
    expect(target.lists).toEqual(["list"]);
  },
);
