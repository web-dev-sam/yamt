import { afterEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { isRangeFileId, type RangeFileId, type SourceResult } from "./domain";
import { createFixtureRangeSource } from "./fixtureRange";
import { createLog, type Log, type LogEntry } from "./log";

const REVIEW: { start: Generated.RangeStart; files: Generated.RangeFile[] } = {
  start: {
    range: "main...feature",
    left: {
      label: { kind: "mergeBase", left: "main", right: "feature" },
      short_id: "1b2cfed",
      subject: "Start",
    },
    right: { label: { kind: "named", name: "feature" }, short_id: "2b3b4b5", subject: "Remind" },
    files: [
      {
        id: 0,
        path: "board.ts",
        change: { kind: "modified" },
        lines: { kind: "counted", added: 1, removed: 1 },
      },
      { id: 1, path: "logo.png", change: { kind: "added" }, lines: { kind: "notCounted" } },
    ],
  },
  files: [
    {
      kind: "texts",
      left: "a\n",
      right: "b\n",
      differences: [
        {
          left: { start: 0, len: 1 },
          right: { start: 0, len: 1 },
          words: { left: { changed: [], removals: [] }, right: { changed: [], removals: [] } },
        },
      ],
      mode: { kind: "same" },
    },
    { kind: "binary" },
  ],
};

const EMPTY: { start: Generated.RangeStart; files: Generated.RangeFile[] } = {
  start: {
    range: "feature..feature",
    left: { label: { kind: "named", name: "feature" }, short_id: "2b3b4b5", subject: "Remind" },
    right: { label: { kind: "named", name: "feature" }, short_id: "2b3b4b5", subject: "Remind" },
    files: [],
  },
  files: [],
};

const FILES: Readonly<Record<string, unknown>> = {
  "../../fixtures/range/empty.json": EMPTY,
  "../../fixtures/range/review.json": REVIEW,
};

const REVIEW_START = {
  range: "main...feature",
  left: {
    label: { kind: "mergeBase", left: "main", right: "feature" },
    shortId: "1b2cfed",
    subject: "Start",
  },
  right: { label: { kind: "named", name: "feature" }, shortId: "2b3b4b5", subject: "Remind" },
  files: [
    {
      id: 0,
      path: "board.ts",
      change: { kind: "modified" },
      lines: { kind: "counted", added: 1, removed: 1 },
    },
    { id: 1, path: "logo.png", change: { kind: "added" }, lines: { kind: "notCounted" } },
  ],
};

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

function fileId(n: number): RangeFileId {
  if (!isRangeFileId(n)) {
    throw new Error(`${n} is no file id`);
  }
  return n;
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("?range=review lists the case's sides and files and loads each file by its id", async () => {
  const { log, entries } = quietLog();
  const source = createFixtureRangeSource(log, "?range=review", FILES);

  expect(valueOf(await source.openRange())).toEqual(REVIEW_START);
  expect(valueOf(await source.loadRangeFile(fileId(0)))).toEqual(REVIEW.files[0]);
  expect(valueOf(await source.loadRangeFile(fileId(1)))).toEqual({ kind: "binary" });
  expect(entries).toEqual([]);
});

test.each(["?range", "?range="])("%s without a case loads review", async (search) => {
  const source = createFixtureRangeSource(quietLog().log, search, FILES);

  expect(valueOf(await source.openRange())).toEqual(REVIEW_START);
});

test("?range=empty loads that case, not review (catches a case name ignored)", async () => {
  const source = createFixtureRangeSource(quietLog().log, "?range=empty", FILES);

  const start = valueOf(await source.openRange());

  expect(start.range).toBe("feature..feature");
  expect(start.files).toEqual([]);
});

test("an unknown case logs range.fixture_miss naming the known ones and lists nothing", async () => {
  const { log, entries } = quietLog();
  const source = createFixtureRangeSource(log, "?range=nope", FILES);

  expect(valueOf(await source.openRange())).toEqual({
    range: "nope",
    left: { label: { kind: "named", name: "HEAD" }, shortId: "0000000", subject: "" },
    right: { label: { kind: "named", name: "HEAD" }, shortId: "0000000", subject: "" },
    files: [],
  });
  expect(entries).toEqual([
    {
      level: "info",
      event: "range.fixture_miss",
      fields: { case: "nope", known: "empty, review" },
    },
  ]);
  expect(await source.loadRangeFile(fileId(0))).toEqual({
    ok: false,
    failure: { kind: "UnknownRangeFile", file: 0 },
  });
});

test("loadRangeFile of an id past the list answers UnknownRangeFile with that id", async () => {
  const source = createFixtureRangeSource(quietLog().log, "?range=review", FILES);

  expect(await source.loadRangeFile(fileId(2))).toEqual({
    ok: false,
    failure: { kind: "UnknownRangeFile", file: 2 },
  });
});

test.each([
  ["a missing start", { files: [] }, 'Invalid key: Expected "start"'],
  ["an unknown file kind", { start: EMPTY.start, files: [{ kind: "nope" }] }, "kind"],
  [
    "a negative file id",
    { start: { ...EMPTY.start, files: [{ ...REVIEW.start.files[0], id: -1 }] }, files: [] },
    "files[0].id must be a non-negative safe integer, got -1",
  ],
])("a case file with %s fails the parse, naming the file", (_case, json, detail) => {
  const files = { "bad.json": json };

  expect(() => createFixtureRangeSource(quietLog().log, "?range=bad", files)).toThrow(
    /^range fixture bad\.json: /,
  );
  expect(() => createFixtureRangeSource(quietLog().log, "?range=bad", files)).toThrow(detail);
});
