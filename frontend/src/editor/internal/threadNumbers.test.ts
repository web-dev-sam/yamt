import { Text } from "@codemirror/state";
import { expect, test } from "vitest";

import { changedThreadLine, diffLineOf, onePlace, unchangedThreadLine } from "../../ipc";
import { lineCounts, numberPress, pressedLine } from "./threadNumbers";
import type { ShownThread } from "./threadRows";

test("the count mark counts open and collapsed threads shown in this column, not drafts", () => {
  const unchanged = { left: 5, right: 6 };
  const threads: ShownThread[] = [
    { key: "open", place: onePlace(changedThreadLine("left", 2)), shown: "open" },
    { key: "collapsed", place: onePlace(changedThreadLine("left", 2)), shown: "collapsed" },
    { key: "draft", place: onePlace(changedThreadLine("left", 2)), shown: "draft" },
    { key: "added", place: onePlace(changedThreadLine("right", 2)), shown: "open" },
    { key: "on-right", place: onePlace(unchangedThreadLine("right", unchanged)), shown: "open" },
    { key: "on-left", place: onePlace(unchangedThreadLine("left", unchanged)), shown: "collapsed" },
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

test("a range is counted on its end line in its end's column, not on its start", () => {
  const range: ShownThread = {
    key: "range",
    place: {
      start: diffLineOf(changedThreadLine("left", 3)),
      end: changedThreadLine("right", 7),
    },
    shown: "open",
  };

  expect(lineCounts([range], "right")).toEqual([{ line: 7, keys: ["range"] }]);
  expect(lineCounts([range], "left")).toEqual([]);
});

test("a press on the badge reports the line's keys; a press on the number starts a drag", () => {
  const press = {
    differences: [],
    column: "left",
    line: 2,
    counts: [{ line: 2, keys: ["a", "b"] }],
  } as const;

  expect(numberPress({ ...press, onBadge: true })).toEqual({ kind: "toggle", keys: ["a", "b"] });
  expect(numberPress({ ...press, onBadge: false })).toEqual({
    kind: "drag",
    line: { kind: "unchangedOnLeft", left: 2, right: 2 },
  });
});

test("a press on the empty line after a text's last newline is no line of the file", () => {
  const doc = Text.of(["a", "b", ""]);

  expect(pressedLine(doc, doc.line(2).from)).toBe(1);
  expect(pressedLine(doc, doc.line(3).from)).toBeNull();
});

test("a text without a last newline keeps its last line pressable", () => {
  const doc = Text.of(["a", "b"]);

  expect(pressedLine(doc, doc.line(2).from)).toBe(1);
});

test("an added file's empty left column has no line to press", () => {
  expect(pressedLine(Text.of([""]), 0)).toBeNull();
});
