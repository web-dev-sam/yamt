import { expect, test } from "vitest";

import { applyEdits } from "./edits";

function edit(
  start: [line: number, character: number],
  end: [line: number, character: number],
  newText: string,
) {
  return {
    range: {
      start: { line: start[0], character: start[1] },
      end: { line: end[0], character: end[1] },
    },
    newText,
  };
}

test("positions count UTF-16 code units: an emoji before the edit is two", () => {
  const text = "const a = '😀';let b=1\n";

  expect(applyEdits(text, [edit([0, 15], [0, 15], "\n")])).toEqual({
    kind: "applied",
    text: "const a = '😀';\nlet b=1\n",
  });
});

test("a multi-line edit replaces whole lines across CRLF breaks", () => {
  const text = "a\r\nbb\r\nccc\r\nd";

  expect(applyEdits(text, [edit([0, 1], [2, 2], "X\r\nY")])).toEqual({
    kind: "applied",
    text: "aX\r\nYc\r\nd",
  });
});

test("edits apply against the original text, whatever order they come in", () => {
  const text = "one\ntwo\nthree\n";

  expect(applyEdits(text, [edit([2, 0], [2, 5], "3"), edit([0, 0], [0, 3], "1")])).toEqual({
    kind: "applied",
    text: "1\ntwo\n3\n",
  });
});

test("two inserts at one position keep their order", () => {
  expect(applyEdits("ab", [edit([0, 1], [0, 1], "x"), edit([0, 1], [0, 1], "y")])).toEqual({
    kind: "applied",
    text: "axyb",
  });
});

test("adjacent edits are not overlapping", () => {
  expect(applyEdits("abcd", [edit([0, 0], [0, 2], "X"), edit([0, 2], [0, 4], "Y")])).toEqual({
    kind: "applied",
    text: "XY",
  });
});

test("overlapping edits are rejected", () => {
  expect(applyEdits("abcd", [edit([0, 0], [0, 3], "X"), edit([0, 2], [0, 4], "Y")])).toEqual({
    kind: "overlapping",
  });
});

test("a range whose end is before its start is rejected", () => {
  expect(applyEdits("abcd", [edit([0, 3], [0, 1], "X")])).toEqual({ kind: "overlapping" });
});

test("a character past the line end means the line end; a line past the last means the end", () => {
  const text = "ab\ncd";

  expect(applyEdits(text, [edit([0, 99], [1, 0], "")])).toEqual({ kind: "applied", text: "abcd" });
  expect(applyEdits(text, [edit([5, 0], [6, 0], "!")])).toEqual({
    kind: "applied",
    text: "ab\ncd!",
  });
});

test("a lone CR is a line break", () => {
  expect(applyEdits("a\rb", [edit([1, 0], [1, 1], "B")])).toEqual({
    kind: "applied",
    text: "a\rB",
  });
});

test("no edits leave the text as it is", () => {
  expect(applyEdits("same", [])).toEqual({ kind: "applied", text: "same" });
});
