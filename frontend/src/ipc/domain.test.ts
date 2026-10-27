import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import {
  isColumnVersion,
  isLeftLine,
  nextColumnVersion,
  toDomain,
  toRange,
  toSides,
  toStartReply,
  type ColumnVersion,
} from "./domain";

const MERGE_CHUNK: Generated.MergeChunk = {
  chunk: {
    id: 3,
    kind: "Conflict",
    base: { start: 0, len: 1 },
    local: { start: 1, len: 1 },
    remote: { start: 2, len: 1 },
  },
  middle: { start: 4, len: 1 },
  words: {
    chunk: 3,
    local: { changed: [], removals: [] },
    remote: { changed: [], removals: [] },
  },
  waiting: { kind: "SideLines" },
};

function mergeData(chunk: Generated.MergeChunk, diskVersion: number): Generated.FileMergeData {
  return {
    path: "a.ts",
    middle: { kind: "Stages", text: "" },
    local: "",
    remote: "",
    deleted: null,
    eol: "Lf",
    chunks: [chunk],
    disk_version: diskVersion,
  };
}

function columnVersion(n: number): ColumnVersion {
  if (!isColumnVersion(n)) {
    throw new Error(`${n} is no column version`);
  }
  return n;
}

test("toDomain brands the chunk id, its ranges and the disk version", () => {
  const data = toDomain(mergeData(MERGE_CHUNK, 2));

  expect(data.diskVersion).toBe(2);
  expect(data.chunks[0]).toMatchObject({
    id: 3,
    middle: { start: 4, len: 1 },
    local: { start: 1, len: 1 },
    remote: { start: 2, len: 1 },
  });
});

test.each<[string, Generated.FileMergeData, string]>([
  [
    "a bad chunk id",
    mergeData({ ...MERGE_CHUNK, chunk: { ...MERGE_CHUNK.chunk, id: -1 } }, 0),
    "chunks[0].chunk.id must be a non-negative safe integer, got -1",
  ],
  [
    "a bad middle start",
    mergeData({ ...MERGE_CHUNK, middle: { start: 0.5, len: 1 } }, 0),
    "chunks[0].middle.start must be a non-negative safe integer, got 0.5",
  ],
  [
    "a bad disk version",
    mergeData(MERGE_CHUNK, -2),
    "disk_version must be a non-negative safe integer, got -2",
  ],
])("toDomain refuses %s, naming the field", (_case, dto, message) => {
  expect(() => toDomain(dto)).toThrow(message);
});

test("toRange checks the start before the length", () => {
  expect(() =>
    toRange({ range: { start: -1, len: -1 }, isLine: isLeftLine, field: "left" }),
  ).toThrow("left.start must be a non-negative safe integer, got -1");
  expect(() =>
    toRange({ range: { start: 0, len: -1 }, isLine: isLeftLine, field: "left" }),
  ).toThrow("left.len must be a non-negative safe integer, got -1");
});

test("toSides brands the disk version and refuses a bad one", () => {
  const sides: Generated.FileSides = {
    path: "a.png",
    reason: "Binary",
    local: { kind: "Binary", bytes: 1 },
    remote: { kind: "Binary", bytes: 2 },
    disk_version: 5,
  };

  expect(toSides(sides).diskVersion).toBe(5);
  expect(() => toSides({ ...sides, disk_version: -5 })).toThrow(
    "disk_version must be a non-negative safe integer, got -5",
  );
});

test("toStartReply brands the run and refuses a bad one; other replies pass through", () => {
  expect(toStartReply({ kind: "Started", run: 7 })).toEqual({ kind: "Started", run: 7 });
  expect(() => toStartReply({ kind: "Started", run: -7 })).toThrow(
    "run must be a non-negative safe integer, got -7",
  );
  const notFound: Generated.StartReply = { kind: "NotFound", program: "x", searched: [] };
  expect(toStartReply(notFound)).toBe(notFound);
});

test("nextColumnVersion refuses to pass the largest safe integer", () => {
  expect(nextColumnVersion(columnVersion(41))).toBe(42);
  expect(() => nextColumnVersion(columnVersion(Number.MAX_SAFE_INTEGER))).toThrow(
    `version must be a non-negative safe integer, got ${Number.MAX_SAFE_INTEGER + 1}`,
  );
});
