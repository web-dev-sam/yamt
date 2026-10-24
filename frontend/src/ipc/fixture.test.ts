import * as v from "valibot";
import { afterEach, expect, test, vi } from "vitest";

import type { ChunkSource } from "./ChunkSource";
import { createFixtureSource, loadFixture, parsedCases } from "./fixture";
import type { DiskChange, DiskVersion, FileEntry, Side, SourceResult } from "./index";
import { createLog, type Log, type LogEntry } from "./log";

const COMMITTED: Readonly<Record<string, unknown>> = import.meta.glob(
  ["../../fixtures/golden/*.json", "../../fixtures/showcase/*.json"],
  { eager: true, import: "default" },
);

const PATH_AND_CHUNKS = v.object({ path: v.string(), chunks: v.array(v.unknown()) });

const NO_QUERY = "";

const REMEMBERED = "remembered.ts";

function quietLog(): { log: Log; entries: LogEntry[] } {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const entries: LogEntry[] = [];
  const log = createLog((entry) => {
    entries.push(entry);
  });
  return { log, entries };
}

function valueOf<T>(result: SourceResult<T>): T {
  if (!result.ok) {
    throw new Error(`expected a value, got ${JSON.stringify(result.failure)}`);
  }
  return result.value;
}

type Listed = { files: readonly FileEntry[]; diskChanges: readonly DiskChange[] };

async function listedBy(source: ChunkSource): Promise<Listed> {
  const listing = valueOf(await source.listStop());
  if (listing.kind !== "Files") {
    throw new Error("expected files, got MovedOn");
  }
  return { files: listing.files, diskChanges: listing.diskChanges };
}

async function versionOf(
  path: string,
  files: Readonly<Record<string, unknown>>,
): Promise<DiskVersion> {
  return (await loadFixture(path, files)).diskVersion;
}

const CHUNK = {
  id: 0,
  kind: "Conflict",
  base: { start: 5, len: 0 },
  local: { start: 0, len: 1 },
  remote: { start: 0, len: 1 },
};

const MIDDLE_RANGE = { start: 0, len: 0 };

const WORDS = {
  local: {
    changed: [{ line: 0, start: 0, len: 1 }],
    removals: [{ at: { line: 0, column: 1 }, text: "b, " }],
  },
  remote: { changed: [{ line: 0, start: 1, len: 1 }], removals: [] },
};

const DOMAIN_WORDS = {
  local: {
    changed: [{ line: 0, start: 0, len: 1 }],
    removals: [{ at: { line: 0, column: 1 }, text: "b, " }],
  },
  remote: { changed: [{ line: 0, start: 1, len: 1 }], removals: [] },
};

const WAITING = {
  kind: "Markers",
  open: "<<<<<<< ours",
  first: "local",
  between: ["||||||| base", "b", "======="],
  close: ">>>>>>> theirs",
};

type Overrides = {
  readonly chunk?: Record<string, unknown>;
  readonly words?: Record<string, unknown>;
  readonly merged?: Record<string, unknown>;
  readonly waiting?: unknown;
};

function record(path: string, overrides: Overrides = {}): Record<string, unknown> {
  return {
    path,
    middle: { kind: "Stages", text: "b\n" },
    local: "l\n",
    remote: "r\n",
    deleted: null,
    eol: "Lf",
    disk_version: 0,
    chunks: [
      {
        chunk: { ...CHUNK, ...overrides.chunk },
        middle: MIDDLE_RANGE,
        words: { chunk: 0, ...WORDS, ...overrides.words },
        waiting: "waiting" in overrides ? overrides.waiting : WAITING,
        ...overrides.merged,
      },
    ],
  };
}

function loaded(path: string): Record<string, unknown> {
  return {
    path,
    middle: { kind: "Stages", text: "b\n" },
    local: "l\n",
    remote: "r\n",
    deleted: null,
    eol: "Lf",
    diskVersion: 0,
    chunks: [
      {
        id: 0,
        kind: "Conflict",
        middle: MIDDLE_RANGE,
        local: CHUNK.local,
        remote: CHUNK.remote,
        words: DOMAIN_WORDS,
        waiting: WAITING,
      },
    ],
  };
}

function without(json: Record<string, unknown>, field: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(json).filter(([key]) => key !== field));
}

function withoutMiddleRange(path: string): Record<string, unknown> {
  const { chunks: _chunks, ...rest } = record(path);
  return {
    ...rest,
    chunks: [{ chunk: CHUNK, words: { chunk: 0, ...WORDS }, waiting: WAITING }],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("the committed fixtures list 12 files, sorted by path, the remembered one remembered, the rest unresolved, with no disk changes", async () => {
  const { files, diskChanges } = await listedBy(createFixtureSource(quietLog().log, NO_QUERY));

  expect(files.map((file) => file.path)).toEqual([
    "language-tools-script-setup.ts",
    "nuxt-island-test.ts",
    "remembered.ts",
    "tanstack-query-persist-provider.tsx",
    "tanstack-query-svelte-base-query.ts",
    "vite-modulepreload-polyfill.ts",
    "vue-core-compiler-von.ts",
    "vue-core-playground-app.vue",
    "vue-core-script-context.ts",
    "vue-router-playground-app.vue",
    "vueuse-use-magic-keys.ts",
    "word-marks.ts",
  ]);
  for (const file of files) {
    const status = file.path === REMEMBERED ? "Remembered" : "Unresolved";
    expect(file).toEqual({ path: file.path, status, unsupported: null });
  }
  expect(diskChanges).toEqual([]);
});

test("each committed fixture loads with its JSON's chunk count, its stages middle (the remembered one its disk text) and version 0", async () => {
  const source = createFixtureSource(quietLog().log, NO_QUERY);
  const committed = Object.values(COMMITTED);
  expect(committed).toHaveLength(12);
  for (const json of committed) {
    const { path, chunks } = v.parse(PATH_AND_CHUNKS, json);
    const data = valueOf(await source.loadFile(path));
    expect(data.chunks).toHaveLength(chunks.length);
    expect(data.middle.kind).toBe(path === REMEMBERED ? "Disk" : "Stages");
    expect(data.diskVersion).toBe(0);
  }
});

test("each unresolved committed fixture's conflicts wait as markers and its other changes as side lines", async () => {
  const source = createFixtureSource(quietLog().log, NO_QUERY);
  const unresolved = (await listedBy(source)).files.filter((file) => file.status === "Unresolved");
  let conflicts = 0;
  for (const { path } of unresolved) {
    for (const { kind, waiting } of valueOf(await source.loadFile(path)).chunks) {
      if (kind !== "Conflict") {
        expect(waiting).toEqual({ kind: "SideLines" });
        continue;
      }
      if (waiting.kind !== "Markers") {
        throw new Error(`${path}: a conflict waits as ${waiting.kind}`);
      }
      conflicts += 1;
      expect(waiting.open).toMatch(/^<<<<<<< /);
      expect(waiting.between.at(-1)).toBe("=======");
      expect(waiting.close).toMatch(/^>>>>>>> /);
    }
  }
  expect(conflicts).toBeGreaterThanOrEqual(11);
});

test("the remembered fixture shows rerere's text with each block git wrote waiting as remembered, until finished; reset makes it remembered again", async () => {
  const source = createFixtureSource(quietLog().log, NO_QUERY);
  const data = valueOf(await source.loadFile(REMEMBERED));
  const write = { path: REMEMBERED, text: "", diskVersion: data.diskVersion };

  expect(data.middle).toEqual({
    kind: "Disk",
    text: expect.stringContaining('"backlog" | "todo" | "doing" | "done"'),
  });
  expect(data.chunks.map(({ kind, waiting, middle }) => ({ kind, waiting, middle }))).toEqual([
    { kind: "Conflict", waiting: { kind: "Remembered" }, middle: { start: 0, len: 1 } },
    { kind: "Conflict", waiting: { kind: "Remembered" }, middle: { start: 2, len: 1 } },
  ]);
  const finished = valueOf(await source.finishFile(write)).files;
  expect(finished.find((file) => file.path === REMEMBERED)?.status).toBe("Resolved");
  const reset = valueOf(await source.resetFile(REMEMBERED, data.diskVersion)).files;
  expect(reset.find((file) => file.path === REMEMBERED)?.status).toBe("Remembered");
});

test("a conflict of vueuse-use-magic-keys.ts arrives intact, with its words", async () => {
  const source = createFixtureSource(quietLog().log, NO_QUERY);

  const data = valueOf(await source.loadFile("vueuse-use-magic-keys.ts"));

  expect(data.chunks[8]).toMatchObject({
    id: 8,
    kind: "Conflict",
    middle: { start: 128, len: 10 },
    local: { start: 128, len: 8 },
    remote: { start: 140, len: 14 },
    waiting: {
      kind: "Markers",
      open: "<<<<<<< ours",
      first: "local",
      between: ["======="],
      close: ">>>>>>> theirs",
    },
  });
  expect(data.chunks[8]).not.toHaveProperty("base");
  expect(data.local.split("\n")[128]).toBe(
    "  useEventListener(target, 'keydown', (e: KeyboardEvent) => {",
  );
  expect(data.remote.split("\n")[140]).toBe("  if (target) {");
  expect(data).toMatchObject({ path: "vueuse-use-magic-keys.ts", eol: "Lf" });

  const words = data.chunks[8]?.words;
  expect(words?.local.changed).toHaveLength(8);
  expect(words?.local.changed[0]).toEqual({ line: 128, start: 0, len: 2 });
  expect(words?.local.removals).toEqual([
    { at: { line: 128, column: 0 }, text: "  if (target) {\n" },
    { at: { line: 135, column: 17 }, text: "\n  }" },
  ]);
  expect(data.local.split("\n")[135]).toBe("  }, { passive })");
  expect(words?.remote).toEqual({
    changed: [
      { line: 150, start: 0, len: 12 },
      { line: 151, start: 0, len: 54 },
      { line: 152, start: 0, len: 55 },
    ],
    removals: [],
  });
});

test("in-memory records are listed sorted by path and keep every field", async () => {
  const files = {
    "z.json": record("z.ts"),
    "a.json": { ...record("a.ts"), eol: "CrLf" },
  };
  const source = createFixtureSource(quietLog().log, NO_QUERY, files);

  expect((await listedBy(source)).files.map((file) => file.path)).toEqual(["a.ts", "z.ts"]);
  expect(await source.loadFile("a.ts")).toEqual({
    ok: true,
    value: { ...loaded("a.ts"), eol: "CrLf" },
  });
});

test.each([{ kind: "SideLines" }, { kind: "AsShown" }, { kind: "Remembered" }, WAITING])(
  "a chunk waiting as %j arrives as it is",
  async (waiting) => {
    const source = createFixtureSource(quietLog().log, NO_QUERY, {
      "a.json": record("a.ts", { waiting }),
    });

    expect(valueOf(await source.loadFile("a.ts")).chunks[0]?.waiting).toEqual(waiting);
  },
);

test("a middle from the disk, or not text on disk, and its disk version arrive as they are", async () => {
  const files = {
    "d.json": { ...record("d.ts"), middle: { kind: "Disk", text: "d\n" }, disk_version: 3 },
    "n.json": { ...record("n.ts"), middle: { kind: "DiskNotText", found: "Link" }, chunks: [] },
  };
  const source = createFixtureSource(quietLog().log, NO_QUERY, files);

  expect(valueOf(await source.loadFile("d.ts"))).toMatchObject({
    middle: { kind: "Disk", text: "d\n" },
    diskVersion: 3,
  });
  expect(valueOf(await source.loadFile("n.ts"))).toMatchObject({
    middle: { kind: "DiskNotText", found: "Link" },
    chunks: [],
  });
  expect(valueOf(await source.describeFile("d.ts")).diskVersion).toBe(3);
});

test.each<Side>(["local", "remote"])(
  "a record deleted on the %s side keeps that side",
  async (deleted) => {
    const source = createFixtureSource(quietLog().log, NO_QUERY, {
      "a.json": { ...record("a.ts"), deleted },
    });

    expect(valueOf(await source.loadFile("a.ts")).deleted).toBe(deleted);
  },
);

test.each([
  [
    "an unknown chunk kind",
    record("x.ts", { chunk: { kind: "Mystery" } }),
    "expected one of LocalOnly, RemoteOnly, BothSame, Conflict",
  ],
  ["an unknown eol", { ...record("x.ts"), eol: "Cr" }, "expected one of Lf, CrLf, Mixed"],
  [
    "an unknown deleted side",
    { ...record("x.ts"), deleted: "base" },
    "expected one of local, remote",
  ],
  ["missing deleted", without(record("x.ts"), "deleted"), 'Invalid key: Expected "deleted"'],
  ["missing chunks", without(record("x.ts"), "chunks"), 'Invalid key: Expected "chunks"'],
  ["missing middle", without(record("x.ts"), "middle"), 'Invalid key: Expected "middle"'],
  [
    "missing disk_version",
    without(record("x.ts"), "disk_version"),
    'Invalid key: Expected "disk_version"',
  ],
  ["a missing middle range", withoutMiddleRange("x.ts"), "chunks.0.middle"],
  ["an unknown middle kind", { ...record("x.ts"), middle: { kind: "Base", text: "" } }, "middle"],
  [
    "an unknown not-text reason",
    { ...record("x.ts"), middle: { kind: "DiskNotText", found: "Fifo" } },
    "expected one of Deleted, Binary, NonUtf8, TooLarge, Link, Directory",
  ],
  [
    "a string word column",
    record("x.ts", {
      words: { local: { changed: [{ line: 0, start: "1", len: 1 }], removals: [] } },
    }),
    "chunks.0.words.local.changed.0.start",
  ],
  [
    "a string point column",
    record("x.ts", {
      words: { remote: { changed: [], removals: [{ at: { line: 0, column: "1" }, text: "x" }] } },
    }),
    "chunks.0.words.remote.removals.0.at.column",
  ],
  [
    "a removal without a place",
    record("x.ts", { words: { remote: { changed: [], removals: [{ text: "x" }] } } }),
    'Invalid key: Expected "at"',
  ],
  [
    "a number removal text",
    record("x.ts", {
      words: { local: { changed: [], removals: [{ at: { line: 0, column: 0 }, text: 1 }] } },
    }),
    "chunks.0.words.local.removals.0.text",
  ],
  [
    "the old flat word shape",
    record("x.ts", { words: { local: [], base: [], remote: [] } }),
    "chunks.0.words.local",
  ],
  [
    "a string line",
    record("x.ts", { chunk: { local: { start: "1", len: 1 } } }),
    "chunks.0.chunk.local.start",
  ],
  [
    "a string middle line",
    record("x.ts", { merged: { middle: { start: "1", len: 1 } } }),
    "chunks.0.middle.start",
  ],
  [
    "a waiting of unknown kind",
    record("x.ts", { waiting: { kind: "Ours" } }),
    "chunks.0.waiting.kind",
  ],
  [
    "markers without their close line",
    record("x.ts", {
      waiting: { kind: "Markers", open: "<<<<<<< ours", first: "local", between: [] },
    }),
    "chunks.0.waiting.close",
  ],
  [
    "markers whose between is one string",
    record("x.ts", {
      waiting: {
        kind: "Markers",
        open: "<<<<<<< ours",
        first: "local",
        between: "=======",
        close: ">>>>>>>",
      },
    }),
    "chunks.0.waiting.between",
  ],
  [
    "markers whose first section is no side",
    record("x.ts", {
      waiting: {
        kind: "Markers",
        open: "<<<<<<< ours",
        first: "ours",
        between: ["======="],
        close: ">>>>>>>",
      },
    }),
    "chunks.0.waiting.first",
  ],
  ["a missing waiting", record("x.ts", { waiting: undefined }), "chunks.0.waiting"],
])("a record with %s is rejected naming the file", (_case, json, detail) => {
  expect(() => createFixtureSource(quietLog().log, NO_QUERY, { "bad.json": json })).toThrow(
    /^fixture bad\.json: /,
  );
  expect(() => createFixtureSource(quietLog().log, NO_QUERY, { "bad.json": json })).toThrow(detail);
});

test.each([
  [
    "a negative middle line",
    { merged: { middle: { start: -1, len: 0 } } },
    "chunks[0].middle.start",
    -1,
  ],
  [
    "a negative middle len",
    { merged: { middle: { start: 0, len: -1 } } },
    "chunks[0].middle.len",
    -1,
  ],
  [
    "a negative local line",
    { chunk: { local: { start: -1, len: 1 } } },
    "chunks[0].chunk.local.start",
    -1,
  ],
  [
    "a negative remote line",
    { chunk: { remote: { start: -2, len: 1 } } },
    "chunks[0].chunk.remote.start",
    -2,
  ],
  [
    "a non-integer local line",
    { chunk: { local: { start: 0.5, len: 1 } } },
    "chunks[0].chunk.local.start",
    0.5,
  ],
  [
    "an unsafe remote line",
    { chunk: { remote: { start: 2 ** 53, len: 1 } } },
    "chunks[0].chunk.remote.start",
    2 ** 53,
  ],
  [
    "a non-integer len",
    { merged: { middle: { start: 0, len: 1.5 } } },
    "chunks[0].middle.len",
    1.5,
  ],
  [
    "a negative len",
    { chunk: { remote: { start: 0, len: -1 } } },
    "chunks[0].chunk.remote.len",
    -1,
  ],
  ["a negative chunk id", { chunk: { id: -1 } }, "chunks[0].chunk.id", -1],
  ["a non-integer chunk id", { chunk: { id: 0.25 } }, "chunks[0].chunk.id", 0.25],
])("a record with %s is rejected naming the file and field", (_case, overrides, field, value) => {
  expect(() =>
    createFixtureSource(quietLog().log, NO_QUERY, { "bad.json": record("x.ts", overrides) }),
  ).toThrow(`fixture bad.json: ${field} must be a non-negative safe integer, got ${value}`);
});

test.each([-1, 0.5, 2 ** 53])("a record with disk version %s is rejected", (version) => {
  expect(() =>
    createFixtureSource(quietLog().log, NO_QUERY, {
      "bad.json": { ...record("x.ts"), disk_version: version },
    }),
  ).toThrow(`fixture bad.json: disk_version must be a non-negative safe integer, got ${version}`);
});

test.each([
  [
    "words of another chunk",
    record("x.ts", { words: { chunk: 1 } }),
    "chunks[0].words.chunk must be 0, got 1",
  ],
  [
    "a negative word line",
    record("x.ts", {
      words: { local: { changed: [{ line: -1, start: 0, len: 1 }], removals: [] } },
    }),
    "chunks[0].words.local.changed[0].line must be a non-negative safe integer, got -1",
  ],
  [
    "a non-integer remote word line",
    record("x.ts", {
      words: { remote: { changed: [{ line: 0.5, start: 0, len: 1 }], removals: [] } },
    }),
    "chunks[0].words.remote.changed[0].line must be a non-negative safe integer, got 0.5",
  ],
  [
    "a negative word column",
    record("x.ts", {
      words: {
        remote: {
          changed: [
            { line: 0, start: 1, len: 1 },
            { line: 0, start: -1, len: 1 },
          ],
          removals: [],
        },
      },
    }),
    "chunks[0].words.remote.changed[1].start must be a non-negative safe integer, got -1",
  ],
  [
    "an empty word range",
    record("x.ts", {
      words: { local: { changed: [{ line: 0, start: 0, len: 0 }], removals: [] } },
    }),
    "chunks[0].words.local.changed[0].len must be a positive safe integer, got 0",
  ],
  [
    "a fractional word length",
    record("x.ts", {
      words: { local: { changed: [{ line: 0, start: 0, len: 0.5 }], removals: [] } },
    }),
    "chunks[0].words.local.changed[0].len must be a positive safe integer, got 0.5",
  ],
  [
    "a negative point line",
    record("x.ts", {
      words: { remote: { changed: [], removals: [{ at: { line: -1, column: 0 }, text: "x" }] } },
    }),
    "chunks[0].words.remote.removals[0].at.line must be a non-negative safe integer, got -1",
  ],
  [
    "a negative point column",
    record("x.ts", {
      words: {
        local: {
          changed: [],
          removals: [
            { at: { line: 0, column: 0 }, text: "x" },
            { at: { line: 0, column: -1 }, text: "x" },
          ],
        },
      },
    }),
    "chunks[0].words.local.removals[1].at.column must be a non-negative safe integer, got -1",
  ],
  [
    "a fractional point column",
    record("x.ts", {
      words: { local: { changed: [], removals: [{ at: { line: 0, column: 0.5 }, text: "x" }] } },
    }),
    "chunks[0].words.local.removals[0].at.column must be a non-negative safe integer, got 0.5",
  ],
  [
    "an unsafe point column",
    record("x.ts", {
      words: {
        remote: { changed: [], removals: [{ at: { line: 0, column: 2 ** 53 }, text: "x" }] },
      },
    }),
    `chunks[0].words.remote.removals[0].at.column must be a non-negative safe integer, got ${2 ** 53}`,
  ],
  [
    "an empty removal text",
    record("x.ts", {
      words: {
        local: {
          changed: [],
          removals: [
            { at: { line: 0, column: 0 }, text: "x" },
            { at: { line: 0, column: 3 }, text: "" },
          ],
        },
      },
    }),
    "chunks[0].words.local.removals[1].text must not be empty",
  ],
])("a record with %s is rejected naming its words", (_case, json, message) => {
  expect(() => createFixtureSource(quietLog().log, NO_QUERY, { "bad.json": json })).toThrow(
    `fixture bad.json: ${message}`,
  );
});

test("an unknown path is an UnknownPath failure naming it, and changes nothing", async () => {
  const { log, entries } = quietLog();
  const files = { "a.json": record("a.ts") };
  const source = createFixtureSource(log, NO_QUERY, files);
  const version = await versionOf("a.ts", files);
  const failure = { ok: false, failure: { kind: "UnknownPath", path: "nope.ts" } };

  expect(await source.loadFile("nope.ts")).toEqual(failure);
  expect(await source.finishFile({ path: "nope.ts", text: "x", diskVersion: version })).toEqual(
    failure,
  );
  expect(await source.resetFile("nope.ts", version)).toEqual(failure);
  expect(await source.describeFile("nope.ts")).toEqual(failure);
  expect(await source.takeSide("nope.ts", "remote", version)).toEqual(failure);
  expect(await listedBy(source)).toEqual({
    files: [{ path: "a.ts", status: "Unresolved", unsupported: null }],
    diskChanges: [],
  });
  expect(entries).toEqual([]);
});

test("finish marks the file resolved and logs its text once; reset returns it unresolved", async () => {
  const { log, entries } = quietLog();
  const files = { "a.json": record("a.ts"), "b.json": record("b.ts") };
  const source = createFixtureSource(log, NO_QUERY, files);
  const version = await versionOf("a.ts", files);

  const finished = await source.finishFile({
    path: "a.ts",
    text: "merged\n",
    diskVersion: version,
  });

  expect(finished).toEqual({
    ok: true,
    value: {
      kind: "Written",
      files: [
        { path: "a.ts", status: "Resolved", unsupported: null },
        { path: "b.ts", status: "Unresolved", unsupported: null },
      ],
    },
  });
  expect(entries).toEqual([
    { level: "info", event: "fixture.finish", fields: { path: "a.ts", text: "merged\n" } },
  ]);

  const unresolved = [
    { path: "a.ts", status: "Unresolved", unsupported: null },
    { path: "b.ts", status: "Unresolved", unsupported: null },
  ];
  expect(await source.resetFile("a.ts", version)).toEqual({
    ok: true,
    value: { kind: "Written", files: unresolved },
  });
  expect(await listedBy(source)).toEqual({ files: unresolved, diskChanges: [] });
  expect(valueOf(await source.loadFile("a.ts"))).toEqual(loaded("a.ts"));
  expect(entries).toHaveLength(1);
});

test("save writes the file, logs its text, length and lines, and leaves it unresolved", async () => {
  const { log, entries } = quietLog();
  const files = { "a.json": record("a.ts"), "b.json": record("b.ts") };
  const source = createFixtureSource(log, NO_QUERY, files);
  const version = await versionOf("a.ts", files);
  const unresolved = [
    { path: "a.ts", status: "Unresolved", unsupported: null },
    { path: "b.ts", status: "Unresolved", unsupported: null },
  ];

  expect(
    await source.saveFile({ path: "a.ts", text: "one\ntwo\nthree", diskVersion: version }),
  ).toEqual({ ok: true, value: { kind: "Written", files: unresolved } });
  expect(await source.saveFile({ path: "nope.ts", text: "x", diskVersion: version })).toEqual({
    ok: false,
    failure: { kind: "UnknownPath", path: "nope.ts" },
  });

  expect(entries).toEqual([
    {
      level: "info",
      event: "fixture.save",
      fields: { path: "a.ts", text: "one\ntwo\nthree", length: 13, lines: 3 },
    },
  ]);
  expect((await listedBy(source)).files).toEqual(unresolved);
});

test("takeSide marks the file resolved and logs the side; reset returns it unresolved", async () => {
  const { log, entries } = quietLog();
  const files = { "a.json": record("a.ts"), "b.json": record("b.ts") };
  const source = createFixtureSource(log, NO_QUERY, files);
  const version = await versionOf("b.ts", files);

  expect(await source.takeSide("b.ts", "remote", version)).toEqual({
    ok: true,
    value: {
      kind: "Written",
      files: [
        { path: "a.ts", status: "Unresolved", unsupported: null },
        { path: "b.ts", status: "Resolved", unsupported: null },
      ],
    },
  });
  expect(entries).toEqual([
    { level: "info", event: "fixture.take", fields: { path: "b.ts", side: "remote" } },
  ]);

  await source.resetFile("b.ts", version);

  expect((await listedBy(source)).files.map((file) => file.status)).toEqual([
    "Unresolved",
    "Unresolved",
  ]);
});

test.each([
  ["", 0],
  ["one", 1],
  ["one\n", 1],
  ["one\ntwo", 2],
  ["one\r\ntwo\r\n", 2],
  ["one\n\n", 2],
])("describeFile counts %j as %i lines, like the app", async (local, lines) => {
  const { log } = quietLog();
  const source = createFixtureSource(log, NO_QUERY, { "a.json": { ...record("a.ts"), local } });

  expect(await source.describeFile("a.ts")).toEqual({
    ok: true,
    value: {
      path: "a.ts",
      reason: null,
      local: { kind: "Text", lines },
      remote: { kind: "Text", lines: 1 },
      diskVersion: 0,
    },
  });
});

test("loadFixture reads a committed or an in-memory record and rejects an unknown path", async () => {
  expect((await loadFixture("word-marks.ts")).path).toBe("word-marks.ts");
  expect(await loadFixture("a.ts", { "a.json": record("a.ts") })).toEqual(loaded("a.ts"));
  await expect(loadFixture("nope.ts", { "a.json": record("a.ts") })).rejects.toThrow(
    "no fixture for nope.ts",
  );
});

test("parsedCases names each case by its file name without the last .json", () => {
  const cases = parsedCases(v.string(), "case", { "../a.json/v1.jsonc.json": "x" }, (text) => text);

  expect([...cases]).toEqual([["v1.jsonc", "x"]]);
});

test("parsedCases names the file in a parse failure", () => {
  expect(() => parsedCases(v.string(), "range fixture", { "bad.json": 1 }, (text) => text)).toThrow(
    /^range fixture bad\.json: /,
  );
});
