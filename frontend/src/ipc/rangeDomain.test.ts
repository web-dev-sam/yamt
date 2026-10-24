import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { isRangeFileId } from "./domain";
import { toRangeFile, toRangeStart } from "./rangeDomain";

const DIFFERENCE: Generated.Difference = {
  left: { start: 0, len: 1 },
  right: { start: 0, len: 2 },
  words: {
    left: { changed: [{ line: 0, start: 4, len: 3 }], removals: [] },
    right: { changed: [], removals: [{ at: { line: 1, column: 2 }, text: "x" }] },
  },
};

const START: Generated.RangeStart = {
  range: "main...feature",
  left: {
    label: { kind: "mergeBase", left: "main", right: "feature" },
    short_id: "1b2cfed",
    subject: "Start the board",
  },
  right: { label: { kind: "named", name: "feature" }, short_id: "2b3b4b5", subject: "Reminders" },
  files: [
    {
      id: 0,
      path: "a.ts",
      change: { kind: "added" },
      lines: { kind: "counted", added: 3, removed: 0 },
    },
    {
      id: 1,
      path: "b.ts",
      change: { kind: "modified" },
      lines: { kind: "counted", added: 1, removed: 2 },
    },
    { id: 2, path: "c.png", change: { kind: "deleted" }, lines: { kind: "notCounted" } },
    {
      id: 3,
      path: "new/d.ts",
      change: { kind: "renamed", old_path: "old/d.ts" },
      lines: { kind: "counted", added: 0, removed: 0 },
    },
  ],
};

test("a start converts both sides and every change, camelCased, keeping the merge-base label", () => {
  expect(toRangeStart(START)).toEqual({
    range: "main...feature",
    left: {
      label: { kind: "mergeBase", left: "main", right: "feature" },
      shortId: "1b2cfed",
      subject: "Start the board",
    },
    right: { label: { kind: "named", name: "feature" }, shortId: "2b3b4b5", subject: "Reminders" },
    files: [
      {
        id: 0,
        path: "a.ts",
        change: { kind: "added" },
        lines: { kind: "counted", added: 3, removed: 0 },
      },
      {
        id: 1,
        path: "b.ts",
        change: { kind: "modified" },
        lines: { kind: "counted", added: 1, removed: 2 },
      },
      { id: 2, path: "c.png", change: { kind: "deleted" }, lines: { kind: "notCounted" } },
      {
        id: 3,
        path: "new/d.ts",
        change: { kind: "renamed", oldPath: "old/d.ts" },
        lines: { kind: "counted", added: 0, removed: 0 },
      },
    ],
  });
});

test.each([-1, 0.5])("a file id of %s is refused by the brand, naming the field", (bad) => {
  const [first] = START.files;
  if (first === undefined) {
    throw new Error("the start lost its files");
  }

  expect(isRangeFileId(bad)).toBe(false);
  expect(isRangeFileId(0)).toBe(true);
  expect(() => toRangeStart({ ...START, files: [first, { ...first, id: bad }] })).toThrow(
    `files[1].id must be a non-negative safe integer, got ${bad}`,
  );
});

test("a texts reply converts its differences with both columns' words and keeps the mode", () => {
  const mode = { kind: "changed", old: "file", new: "executable" } as const;

  expect(
    toRangeFile({ kind: "texts", left: "a\n", right: "b\nc\n", differences: [DIFFERENCE], mode }),
  ).toEqual({
    kind: "texts",
    left: "a\n",
    right: "b\nc\n",
    differences: [
      {
        left: { start: 0, len: 1 },
        right: { start: 0, len: 2 },
        words: {
          left: { changed: [{ line: 0, start: 4, len: 3 }], removals: [] },
          right: { changed: [], removals: [{ at: { line: 1, column: 2 }, text: "x" }] },
        },
      },
    ],
    mode,
  });
  expect(
    toRangeFile({ kind: "texts", left: "", right: "x\n", differences: [], mode: { kind: "same" } }),
  ).toEqual({ kind: "texts", left: "", right: "x\n", differences: [], mode: { kind: "same" } });
});

test("a bad line in a texts reply's differences is refused, naming the field", () => {
  const bad = { ...DIFFERENCE, right: { start: -1, len: 1 } };

  expect(() =>
    toRangeFile({ kind: "texts", left: "", right: "", differences: [bad], mode: { kind: "same" } }),
  ).toThrow("differences[0].right.start must be a non-negative safe integer, got -1");
});

test.each<Generated.RangeFile>([
  { kind: "binary" },
  { kind: "tooLarge", limit: 8_388_608 },
  { kind: "notUtf8", sides: "both" },
  { kind: "modeOnly", old: "file", new: "executable" },
  { kind: "kindChanged", old: "file", new: "link" },
  { kind: "submodule", old: null, new: "3c4d5e6f" },
])("a $kind reply carries its fields unchanged", (reply) => {
  expect(toRangeFile(reply)).toEqual(reply);
});
