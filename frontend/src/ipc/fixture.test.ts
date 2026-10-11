import * as v from "valibot";
import { afterEach, expect, test, vi } from "vitest";

import type { Side, SourceResult } from "./domain";
import { createFixtureSource, loadFixture } from "./fixture";
import { createLog, type Log, type LogEntry } from "./log";

const COMMITTED: Readonly<Record<string, unknown>> = import.meta.glob(
  ["../../fixtures/golden/*.json", "../../fixtures/showcase/*.json"],
  { eager: true, import: "default" },
);

const PATH_AND_CHUNKS = v.object({ path: v.string(), chunks: v.array(v.unknown()) });

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

const CHUNK = {
  id: 0,
  kind: "Conflict",
  base: { start: 0, len: 0 },
  local: { start: 0, len: 1 },
  remote: { start: 0, len: 1 },
};

const WORDS = {
  local: { changed: [{ line: 0, start: 0, len: 1 }], removed_at: [{ line: 0, column: 1 }] },
  remote: { changed: [{ line: 0, start: 1, len: 1 }], removed_at: [] },
};

const DOMAIN_WORDS = {
  local: { changed: [{ line: 0, start: 0, len: 1 }], removedAt: [{ line: 0, column: 1 }] },
  remote: { changed: [{ line: 0, start: 1, len: 1 }], removedAt: [] },
};

function record(
  path: string,
  chunk: Record<string, unknown> = {},
  words: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    path,
    base: "b\n",
    local: "l\n",
    remote: "r\n",
    deleted: null,
    eol: "Lf",
    chunks: [{ ...CHUNK, ...chunk }],
    word_changes: [{ chunk: 0, ...WORDS, ...words }],
  };
}

function loaded(path: string): Record<string, unknown> {
  return {
    path,
    base: "b\n",
    local: "l\n",
    remote: "r\n",
    deleted: null,
    eol: "Lf",
    chunks: [{ ...CHUNK, words: DOMAIN_WORDS }],
  };
}

function without(json: Record<string, unknown>, field: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(json).filter(([key]) => key !== field));
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("the committed fixtures list 11 files, sorted by path, all unresolved", async () => {
  const source = createFixtureSource(quietLog().log);

  const files = valueOf(await source.listFiles());

  expect(files.map((file) => file.path)).toEqual([
    "language-tools-script-setup.ts",
    "nuxt-island-test.ts",
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
    expect(file).toEqual({ path: file.path, status: "Unresolved", unsupported: null });
  }
});

test("each committed fixture loads with its JSON's chunk count", async () => {
  const source = createFixtureSource(quietLog().log);
  const committed = Object.values(COMMITTED);
  expect(committed).toHaveLength(11);
  for (const json of committed) {
    const { path, chunks } = v.parse(PATH_AND_CHUNKS, json);
    const data = valueOf(await source.loadFile(path));
    expect(data.chunks).toHaveLength(chunks.length);
  }
});

test("a conflict of vueuse-use-magic-keys.ts arrives intact, with its words", async () => {
  const source = createFixtureSource(quietLog().log);

  const data = valueOf(await source.loadFile("vueuse-use-magic-keys.ts"));

  expect(data.chunks[8]).toMatchObject({
    id: 8,
    kind: "Conflict",
    base: { start: 128, len: 10 },
    local: { start: 128, len: 8 },
    remote: { start: 140, len: 14 },
  });
  expect(data.local.split("\n")[128]).toBe(
    "  useEventListener(target, 'keydown', (e: KeyboardEvent) => {",
  );
  expect(data.remote.split("\n")[140]).toBe("  if (target) {");
  expect(data).toMatchObject({ path: "vueuse-use-magic-keys.ts", eol: "Lf" });

  const words = data.chunks[8]?.words;
  expect(words?.local.changed).toHaveLength(8);
  expect(words?.local.changed[0]).toEqual({ line: 128, start: 0, len: 2 });
  expect(words?.local.removedAt).toEqual([
    { line: 128, column: 0 },
    { line: 135, column: 17 },
  ]);
  expect(data.local.split("\n")[135]).toBe("  }, { passive })");
  expect(words?.remote).toEqual({
    changed: [
      { line: 150, start: 0, len: 12 },
      { line: 151, start: 0, len: 54 },
      { line: 152, start: 0, len: 55 },
    ],
    removedAt: [],
  });
});

test("in-memory records are listed sorted by path and keep every field", async () => {
  const source = createFixtureSource(quietLog().log, {
    "z.json": record("z.ts"),
    "a.json": { ...record("a.ts"), eol: "CrLf" },
  });

  expect(valueOf(await source.listFiles()).map((file) => file.path)).toEqual(["a.ts", "z.ts"]);
  expect(await source.loadFile("a.ts")).toEqual({
    ok: true,
    value: { ...loaded("a.ts"), eol: "CrLf" },
  });
});

test.each<Side>(["local", "remote"])(
  "a record deleted on the %s side keeps that side",
  async (deleted) => {
    const source = createFixtureSource(quietLog().log, {
      "a.json": { ...record("a.ts"), deleted },
    });

    expect(valueOf(await source.loadFile("a.ts")).deleted).toBe(deleted);
  },
);

test("the fixture source names nothing merged in", async () => {
  expect(await createFixtureSource(quietLog().log).remoteName()).toBeNull();
});

test.each([
  [
    "an unknown chunk kind",
    record("x.ts", { kind: "Mystery" }),
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
  [
    "missing word_changes",
    without(record("x.ts"), "word_changes"),
    'Invalid key: Expected "word_changes"',
  ],
  [
    "a string word column",
    record("x.ts", {}, { local: { changed: [{ line: 0, start: "1", len: 1 }], removed_at: [] } }),
    "word_changes.0.local.changed.0.start",
  ],
  [
    "a string point column",
    record("x.ts", {}, { remote: { changed: [], removed_at: [{ line: 0, column: "1" }] } }),
    "word_changes.0.remote.removed_at.0.column",
  ],
  [
    "the old flat word shape",
    record("x.ts", {}, { local: [], base: [], remote: [] }),
    "word_changes.0.local",
  ],
  ["a string line", record("x.ts", { base: { start: "1", len: 1 } }), "chunks.0.base.start"],
])("a record with %s is rejected naming the file", (_case, json, detail) => {
  expect(() => createFixtureSource(quietLog().log, { "bad.json": json })).toThrow(
    /^fixture bad\.json: /,
  );
  expect(() => createFixtureSource(quietLog().log, { "bad.json": json })).toThrow(detail);
});

test.each([
  ["a negative base line", { base: { start: -1, len: 0 } }, "chunks[0].base.start", -1],
  ["a negative local line", { local: { start: -1, len: 1 } }, "chunks[0].local.start", -1],
  ["a negative remote line", { remote: { start: -2, len: 1 } }, "chunks[0].remote.start", -2],
  ["a non-integer local line", { local: { start: 0.5, len: 1 } }, "chunks[0].local.start", 0.5],
  [
    "an unsafe remote line",
    { remote: { start: 2 ** 53, len: 1 } },
    "chunks[0].remote.start",
    2 ** 53,
  ],
  ["a non-integer len", { base: { start: 0, len: 1.5 } }, "chunks[0].base.len", 1.5],
  ["a negative len", { remote: { start: 0, len: -1 } }, "chunks[0].remote.len", -1],
  ["a negative chunk id", { id: -1 }, "chunks[0].id", -1],
  ["a non-integer chunk id", { id: 0.25 }, "chunks[0].id", 0.25],
])("a record with %s is rejected naming the file and field", (_case, chunk, field, value) => {
  expect(() => createFixtureSource(quietLog().log, { "bad.json": record("x.ts", chunk) })).toThrow(
    `fixture bad.json: ${field} must be a non-negative safe integer, got ${value}`,
  );
});

test.each([
  [
    "fewer word_changes than chunks",
    { ...record("x.ts"), word_changes: [] },
    "word_changes must have one entry per chunk (1), got 0",
  ],
  [
    "more word_changes than chunks",
    {
      ...record("x.ts"),
      word_changes: [
        { chunk: 0, ...WORDS },
        { chunk: 1, ...WORDS },
      ],
    },
    "word_changes must have one entry per chunk (1), got 2",
  ],
  [
    "word_changes of another chunk",
    record("x.ts", {}, { chunk: 1 }),
    "word_changes[0].chunk must be 0, got 1",
  ],
  [
    "a negative word line",
    record("x.ts", {}, { local: { changed: [{ line: -1, start: 0, len: 1 }], removed_at: [] } }),
    "word_changes[0].local.changed[0].line must be a non-negative safe integer, got -1",
  ],
  [
    "a non-integer remote word line",
    record("x.ts", {}, { remote: { changed: [{ line: 0.5, start: 0, len: 1 }], removed_at: [] } }),
    "word_changes[0].remote.changed[0].line must be a non-negative safe integer, got 0.5",
  ],
  [
    "a negative word column",
    record(
      "x.ts",
      {},
      {
        remote: {
          changed: [
            { line: 0, start: 1, len: 1 },
            { line: 0, start: -1, len: 1 },
          ],
          removed_at: [],
        },
      },
    ),
    "word_changes[0].remote.changed[1].start must be a non-negative safe integer, got -1",
  ],
  [
    "an empty word range",
    record("x.ts", {}, { local: { changed: [{ line: 0, start: 0, len: 0 }], removed_at: [] } }),
    "word_changes[0].local.changed[0].len must be a positive safe integer, got 0",
  ],
  [
    "a fractional word length",
    record("x.ts", {}, { local: { changed: [{ line: 0, start: 0, len: 0.5 }], removed_at: [] } }),
    "word_changes[0].local.changed[0].len must be a positive safe integer, got 0.5",
  ],
  [
    "a negative point line",
    record("x.ts", {}, { remote: { changed: [], removed_at: [{ line: -1, column: 0 }] } }),
    "word_changes[0].remote.removed_at[0].line must be a non-negative safe integer, got -1",
  ],
  [
    "a negative point column",
    record(
      "x.ts",
      {},
      {
        local: {
          changed: [],
          removed_at: [
            { line: 0, column: 0 },
            { line: 0, column: -1 },
          ],
        },
      },
    ),
    "word_changes[0].local.removed_at[1].column must be a non-negative safe integer, got -1",
  ],
  [
    "a fractional point column",
    record("x.ts", {}, { local: { changed: [], removed_at: [{ line: 0, column: 0.5 }] } }),
    "word_changes[0].local.removed_at[0].column must be a non-negative safe integer, got 0.5",
  ],
  [
    "an unsafe point column",
    record("x.ts", {}, { remote: { changed: [], removed_at: [{ line: 0, column: 2 ** 53 }] } }),
    `word_changes[0].remote.removed_at[0].column must be a non-negative safe integer, got ${2 ** 53}`,
  ],
])("a record with %s is rejected naming its word_changes entry", (_case, json, message) => {
  expect(() => createFixtureSource(quietLog().log, { "bad.json": json })).toThrow(
    `fixture bad.json: ${message}`,
  );
});

test("an unknown path is an UnknownPath failure naming it, and changes nothing", async () => {
  const { log, entries } = quietLog();
  const source = createFixtureSource(log, { "a.json": record("a.ts") });
  const failure = { ok: false, failure: { kind: "UnknownPath", path: "nope.ts" } };

  expect(await source.loadFile("nope.ts")).toEqual(failure);
  expect(await source.finishFile("nope.ts", "x")).toEqual(failure);
  expect(await source.resetFile("nope.ts")).toEqual(failure);
  expect(await source.describeFile("nope.ts")).toEqual(failure);
  expect(await source.takeSide("nope.ts", "remote")).toEqual(failure);
  expect(valueOf(await source.listFiles())).toEqual([
    { path: "a.ts", status: "Unresolved", unsupported: null },
  ]);
  expect(entries).toEqual([]);
});

test("finish marks the file resolved and logs its text once; reset returns it unresolved", async () => {
  const { log, entries } = quietLog();
  const source = createFixtureSource(log, { "a.json": record("a.ts"), "b.json": record("b.ts") });

  const finished = await source.finishFile("a.ts", "merged\n");

  expect(finished).toEqual({
    ok: true,
    value: [
      { path: "a.ts", status: "Resolved", unsupported: null },
      { path: "b.ts", status: "Unresolved", unsupported: null },
    ],
  });
  expect(entries).toEqual([
    { level: "info", event: "fixture.finish", fields: { path: "a.ts", text: "merged\n" } },
  ]);

  const unresolved = [
    { path: "a.ts", status: "Unresolved", unsupported: null },
    { path: "b.ts", status: "Unresolved", unsupported: null },
  ];
  expect(await source.resetFile("a.ts")).toEqual({ ok: true, value: unresolved });
  expect(valueOf(await source.listFiles())).toEqual(unresolved);
  expect(valueOf(await source.loadFile("a.ts"))).toEqual(loaded("a.ts"));
  expect(entries).toHaveLength(1);
});

test("takeSide marks the file resolved and logs the side; reset returns it unresolved", async () => {
  const { log, entries } = quietLog();
  const source = createFixtureSource(log, { "a.json": record("a.ts"), "b.json": record("b.ts") });

  expect(await source.takeSide("b.ts", "remote")).toEqual({
    ok: true,
    value: [
      { path: "a.ts", status: "Unresolved", unsupported: null },
      { path: "b.ts", status: "Resolved", unsupported: null },
    ],
  });
  expect(entries).toEqual([
    { level: "info", event: "fixture.take", fields: { path: "b.ts", side: "remote" } },
  ]);

  await source.resetFile("b.ts");

  expect(valueOf(await source.listFiles()).map((file) => file.status)).toEqual([
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
  const source = createFixtureSource(log, { "a.json": { ...record("a.ts"), local } });

  expect(await source.describeFile("a.ts")).toEqual({
    ok: true,
    value: {
      path: "a.ts",
      reason: null,
      local: { kind: "Text", lines },
      remote: { kind: "Text", lines: 1 },
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
