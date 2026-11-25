import { afterEach, expect, test, vi } from "vitest";

import { isRangeFileId, type RangeFileId, type SourceResult } from "./domain";
import { createFixtureRangeSource } from "./fixtureRange";
import { createLog, type Log, type LogEntry } from "./log";

const KEYS = fileId(3);
const LOGO = fileId(5);
const BOARD = fileId(7);
const NO_WORDS = { left: { changed: [], removals: [] }, right: { changed: [], removals: [] } };

afterEach(() => {
  vi.restoreAllMocks();
});

function fileId(n: number): RangeFileId {
  if (!isRangeFileId(n)) {
    throw new Error(`${n} is no file id`);
  }
  return n;
}

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

function events(entries: readonly LogEntry[]): unknown[] {
  return entries.map(({ event, fields }) => [event, fields]);
}

test("&reviewed=seeded marks keys.md reviewed and board.ts and logo.png changed since review", async () => {
  const source = createFixtureRangeSource(quietLog().log, "?range=review&reviewed=seeded");
  const files = valueOf(await source.openRange()).files;

  expect([KEYS, LOGO, BOARD].map((id) => files[id]?.path)).toEqual([
    "docs/keys.md",
    "public/logo.png",
    "src/board/board.ts",
  ]);
  expect([...valueOf(await source.listReviewed())]).toEqual([
    [KEYS, "reviewed"],
    [LOGO, "changedSinceReview"],
    [BOARD, "changedSinceReview"],
  ]);
});

test("?range alone has no marks and logs no miss", async () => {
  const { log, entries } = quietLog();
  const source = createFixtureRangeSource(log, "?range=review");

  expect(valueOf(await source.listReviewed()).size).toBe(0);
  expect(events(entries)).toEqual([["range.fixture_reviewed", { kind: "list" }]]);
});

test("another reviewed= value logs range.fixture_reviewed_miss and seeds nothing", async () => {
  const { log, entries } = quietLog();
  const source = createFixtureRangeSource(log, "?range=review&reviewed=all");

  expect(valueOf(await source.listReviewed()).size).toBe(0);
  expect(events(entries)).toEqual([
    ["range.fixture_reviewed_miss", { value: "all" }],
    ["range.fixture_reviewed", { kind: "list" }],
  ]);
});

test("board.ts's since reply is its right text without right lines 40 to 42, one difference at line 40", async () => {
  const source = createFixtureRangeSource(quietLog().log, "?range=review&reviewed=seeded");
  const board = valueOf(await source.loadRangeFile(BOARD));
  if (board.kind !== "texts") {
    throw new Error("board.ts is not texts");
  }
  const lines = board.right.split("\n");
  const reviewed = [...lines.slice(0, 40), ...lines.slice(43)].join("\n");

  expect(valueOf(await source.loadSinceReview(BOARD))).toEqual({
    kind: "texts",
    reviewed,
    current: board.right,
    differences: [{ left: { start: 40, len: 0 }, right: { start: 40, len: 3 }, words: NO_WORDS }],
  });
  expect(reviewed.split("\n")).toHaveLength(lines.length - 3);
});

test("logo.png and any other file that is no text answer noText; a text file its right text twice", async () => {
  const source = createFixtureRangeSource(quietLog().log, "?range=review");
  const keys = valueOf(await source.loadRangeFile(KEYS));
  if (keys.kind !== "texts") {
    throw new Error("keys.md is not texts");
  }

  expect(valueOf(await source.loadSinceReview(LOGO))).toEqual({ kind: "noText" });
  expect(valueOf(await source.loadSinceReview(fileId(1)))).toEqual({ kind: "noText" });
  expect(valueOf(await source.loadSinceReview(KEYS))).toEqual({
    kind: "texts",
    reviewed: keys.right,
    current: keys.right,
    differences: [],
  });
});

test("a mark sets reviewed, an unmark deletes it; a list taken before keeps its marks; each call logs", async () => {
  const { log, entries } = quietLog();
  const source = createFixtureRangeSource(log, "?range=review&reviewed=seeded");
  const before = valueOf(await source.listReviewed());

  expect(valueOf(await source.markReviewed(BOARD))).toBeNull();
  expect(valueOf(await source.markReviewed(fileId(0)))).toBeNull();
  expect(valueOf(await source.unmarkReviewed(KEYS))).toBeNull();
  expect(valueOf(await source.loadSinceReview(LOGO))).toEqual({ kind: "noText" });

  expect([...valueOf(await source.listReviewed())]).toEqual([
    [LOGO, "changedSinceReview"],
    [BOARD, "reviewed"],
    [fileId(0), "reviewed"],
  ]);
  expect(before.get(BOARD)).toBe("changedSinceReview");
  expect(before.has(KEYS)).toBe(true);
  expect(events(entries)).toEqual([
    ["range.fixture_reviewed", { kind: "list" }],
    ["range.fixture_reviewed", { kind: "mark", file: BOARD }],
    ["range.fixture_reviewed", { kind: "mark", file: 0 }],
    ["range.fixture_reviewed", { kind: "unmark", file: KEYS }],
    ["range.fixture_reviewed", { kind: "since", file: LOGO }],
    ["range.fixture_reviewed", { kind: "list" }],
  ]);
});

test("an id past the list answers UnknownRangeFile and changes no mark", async () => {
  const source = createFixtureRangeSource(quietLog().log, "?range=review&reviewed=seeded");
  const past = fileId(13);
  const failure = { kind: "UnknownRangeFile", file: past };

  expect(await source.markReviewed(past)).toEqual({ ok: false, failure });
  expect(await source.unmarkReviewed(past)).toEqual({ ok: false, failure });
  expect(await source.loadSinceReview(past)).toEqual({ ok: false, failure });
  expect(valueOf(await source.listReviewed()).size).toBe(3);
});

test("?range=empty with &reviewed=seeded has no marks", async () => {
  const source = createFixtureRangeSource(quietLog().log, "?range=empty&reviewed=seeded");

  expect(valueOf(await source.listReviewed()).size).toBe(0);
});

test("a listed file the case has no reply for answers noText", async () => {
  const side = { label: { kind: "named", name: "main" }, short_id: "1b2cfed", subject: "Start" };
  const lines = { kind: "counted", added: 1, removed: 0 };
  const listed = {
    start: {
      range: "main...feature",
      heading: { kind: "typed" },
      totals: { added: 2, removed: 0 },
      left: side,
      right: side,
      files: [
        { id: 0, path: "a.ts", change: { kind: "added" }, lines },
        { id: 1, path: "b.ts", change: { kind: "added" }, lines },
      ],
    },
    files: [{ kind: "binary" }],
  };
  const source = createFixtureRangeSource(quietLog().log, "?range=review", {
    "../../fixtures/range/review.json": listed,
  });

  expect(valueOf(await source.loadSinceReview(fileId(1)))).toEqual({ kind: "noText" });
});
