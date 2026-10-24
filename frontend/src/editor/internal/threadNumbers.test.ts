import { expect, test } from "vitest";

import { changedThreadLine, unchangedThreadLine } from "../../ipc";
import { lineCounts, numberPress } from "./threadNumbers";
import type { ShownThread } from "./threadRows";

test("the count mark counts open and collapsed threads shown in this column, not drafts", () => {
  const unchanged = { left: 5, right: 6 };
  const threads: ShownThread[] = [
    { key: "open", line: changedThreadLine("left", 2), shown: "open" },
    { key: "collapsed", line: changedThreadLine("left", 2), shown: "collapsed" },
    { key: "draft", line: changedThreadLine("left", 2), shown: "draft" },
    { key: "added", line: changedThreadLine("right", 2), shown: "open" },
    { key: "on-right", line: unchangedThreadLine("right", unchanged), shown: "open" },
    { key: "on-left", line: unchangedThreadLine("left", unchanged), shown: "collapsed" },
  ];

  expect(lineCounts(threads, "left")).toEqual([
    { line: 2, keys: ["open", "collapsed"] },
    { line: 5, keys: ["on-left"] },
  ]);
  expect(lineCounts(threads, "right")).toEqual([
    { line: 2, keys: ["added"] },
    { line: 6, keys: ["on-right"] },
  ]);
});

test("a press on the badge reports the line's keys; a press on the number starts a thread", () => {
  const press = {
    differences: [],
    column: "left",
    line: 2,
    counts: [{ line: 2, keys: ["a", "b"] }],
  } as const;

  expect(numberPress({ ...press, onBadge: true })).toEqual({ kind: "toggle", keys: ["a", "b"] });
  expect(numberPress({ ...press, onBadge: false })).toEqual({
    kind: "start",
    line: { kind: "unchangedOnLeft", left: 2, right: 2 },
  });
});
