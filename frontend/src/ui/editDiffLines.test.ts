import { expect, test } from "vitest";

import type { Difference } from "../ipc";
import {
  createdFileLines,
  diffRowCells,
  editDiffLines,
  MAX_DIFF_ROWS,
  type DiffRow,
} from "./editDiffLines";

type Placed = Pick<Difference, "left" | "right">;
type LeftLine = Difference["left"]["start"];
type RightLine = Difference["right"]["start"];

function isLeft(_line: number): _line is LeftLine {
  return true;
}

function isRight(_line: number): _line is RightLine {
  return true;
}

/** `[oldStart, oldLen, newStart, newLen]`, 0-based as Rust's reply. */
function placed([oldStart, oldLen, newStart, newLen]: readonly [
  number,
  number,
  number,
  number,
]): Placed {
  if (!isLeft(oldStart) || !isRight(newStart)) {
    throw new Error("unreachable");
  }
  return { left: { start: oldStart, len: oldLen }, right: { start: newStart, len: newLen } };
}

function numbered(count: number, prefix = "line"): string {
  return Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}\n`).join("");
}

function shape(rows: readonly DiffRow[]): string[] {
  return rows.map((row) => {
    switch (row.kind) {
      case "context":
        return ` ${row.old}:${row.new} ${row.text}`;
      case "removed":
        return `-${row.old} ${row.text}${row.ending === null ? "" : ` [${row.ending}]`}`;
      case "added":
        return `+${row.new} ${row.text}${row.ending === null ? "" : ` [${row.ending}]`}`;
      case "noNewline":
        return "\\";
      case "skipped":
        return `… ${row.lines}`;
      case "more":
        return `more ${row.lines}`;
      default: {
        const _exhaustive: never = row;
        return _exhaustive;
      }
    }
  });
}

test("a change in the middle shows 3 unchanged lines on each side and skips the rest, with both line numbers", () => {
  const old = numbered(20);
  const next = old.replace("line 10\n", "ten\n");

  expect(shape(editDiffLines(old, next, [placed([9, 1, 9, 1])]))).toEqual([
    "… 6",
    " 7:7 line 7",
    " 8:8 line 8",
    " 9:9 line 9",
    "-10 line 10",
    "+10 ten",
    " 11:11 line 11",
    " 12:12 line 12",
    " 13:13 line 13",
    "… 7",
  ]);
});

test("after an inserted line the new numbers run one ahead of the old (catches a shift taken from the wrong side)", () => {
  const old = numbered(10);
  const next = old.replace("line 5\n", "line 5\nnew\n");

  expect(shape(editDiffLines(old, next, [placed([5, 0, 5, 1])]))).toEqual([
    "… 2",
    " 3:3 line 3",
    " 4:4 line 4",
    " 5:5 line 5",
    "+6 new",
    " 6:7 line 6",
    " 7:8 line 7",
    " 8:9 line 8",
    "… 2",
  ]);
});

test("two changes 6 unchanged lines apart are one hunk; 7 apart are two with the line between skipped", () => {
  const old = numbered(30);
  const joined = editDiffLines(old, old, [placed([5, 1, 5, 1]), placed([12, 1, 12, 1])]);
  const split = editDiffLines(old, old, [placed([5, 1, 5, 1]), placed([13, 1, 13, 1])]);

  expect(shape(joined).filter((row) => row.startsWith("…"))).toEqual(["… 2", "… 14"]);
  expect(shape(joined).filter((row) => row.startsWith(" "))).toHaveLength(12);
  expect(shape(split).filter((row) => row.startsWith("…"))).toEqual(["… 2", "… 1", "… 13"]);
  expect(shape(split).slice(8, 12)).toEqual([
    " 9:9 line 9",
    "… 1",
    " 11:11 line 11",
    " 12:12 line 12",
  ]);
});

test("a change at the first and last line shows no skipped rows and nothing beyond the text", () => {
  const old = "a\nb\nc\n";
  const next = "A\nb\nC\n";

  expect(shape(editDiffLines(old, next, [placed([0, 1, 0, 1]), placed([2, 1, 2, 1])]))).toEqual([
    "-1 a",
    "+1 A",
    " 2:2 b",
    "-3 c",
    "+3 C",
  ]);
});

test("a side without a final newline gets git's marker after its last line, wherever that row is", () => {
  expect(shape(editDiffLines("a\nb", "a\nc", [placed([1, 1, 1, 1])]))).toEqual([
    " 1:1 a",
    "-2 b",
    "\\",
    "+2 c",
    "\\",
  ]);
  expect(shape(editDiffLines("a\nb", "a\nb\nc", [placed([1, 1, 1, 2])]))).toEqual([
    " 1:1 a",
    "-2 b",
    "\\",
    "+2 b",
    "+3 c",
    "\\",
  ]);
  expect(shape(editDiffLines("a\nb\nc", "A\nb\nc", [placed([0, 1, 0, 1])]))).toEqual([
    "-1 a",
    "+1 A",
    " 2:2 b",
    " 3:3 c",
    "\\",
  ]);
  expect(editDiffLines("a\n", "a\n", [])).toEqual([]);
});

test("a pair differing only by a carriage return is marked with each side's line ending, the \\r never shown", () => {
  expect(shape(editDiffLines("ab\r\ncd\r\n", "ab\ncd\n", [placed([0, 2, 0, 2])]))).toEqual([
    "-1 ab [crlf]",
    "-2 cd [crlf]",
    "+1 ab [lf]",
    "+2 cd [lf]",
  ]);
  expect(shape(editDiffLines("x\r\ny\r\nz\r\n", "x\r\nY\nz\r\n", [placed([1, 1, 1, 1])]))).toEqual([
    " 1:1 x",
    "-2 y",
    "+2 Y",
    " 3:3 z",
  ]);
  expect(shape(editDiffLines("a\nb\n", "a\r\n", [placed([0, 2, 0, 1])]))).toEqual([
    "-1 a [lf]",
    "-2 b",
    "+1 a [crlf]",
  ]);
});

test("a last line without a line break claims no ending; its pair keeps its own", () => {
  expect(shape(editDiffLines("a\r\n", "a", [placed([0, 1, 0, 1])]))).toEqual([
    "-1 a [crlf]",
    "+1 a",
    "\\",
  ]);
  expect(shape(editDiffLines("a", "a\r\n", [placed([0, 1, 0, 1])]))).toEqual([
    "-1 a",
    "\\",
    "+1 a [crlf]",
  ]);
});

test("an unpaired changed line is never paired with the unchanged line after the change", () => {
  expect(shape(editDiffLines("a\r\nc\r\nc\n", "a\nc\n", [placed([0, 2, 0, 1])]))).toEqual([
    "-1 a [crlf]",
    "-2 c",
    "+1 a [lf]",
    " 3:2 c",
  ]);
  expect(shape(editDiffLines("a\nc\n", "a\r\nc\r\nc\n", [placed([0, 1, 0, 2])]))).toEqual([
    "-1 a [lf]",
    "+1 a [crlf]",
    "+2 c",
    " 2:3 c",
  ]);
});

test("rows stop at 2,000 and a last row counts the changed and unchanged lines not shown", () => {
  const old = numbered(1500, "old");
  const next = numbered(1500, "new");

  const rows = editDiffLines(old, next, [placed([0, 1500, 0, 1500])]);

  expect(rows).toHaveLength(MAX_DIFF_ROWS + 1);
  expect(shape(rows).slice(MAX_DIFF_ROWS - 1)).toEqual(["+500 new 500", "more 1000"]);
});

test("exactly 2,000 rows need no more row (catches a cap one row early)", () => {
  const rows = createdFileLines(numbered(MAX_DIFF_ROWS));

  expect(rows).toHaveLength(MAX_DIFF_ROWS);
  expect(rows.at(-1)).toEqual({
    kind: "added",
    new: MAX_DIFF_ROWS,
    text: `line ${MAX_DIFF_ROWS}`,
    ending: null,
  });
});

test("a created file is every line added, capped like a diff; its marker is not a line", () => {
  expect(shape(createdFileLines("a\r\nb"))).toEqual(["+1 a", "+2 b", "\\"]);
  expect(shape(createdFileLines(numbered(MAX_DIFF_ROWS + 5)).slice(-1))).toEqual(["more 5"]);
  expect(shape(createdFileLines(`${numbered(MAX_DIFF_ROWS + 4)}last`).slice(-1))).toEqual([
    "more 5",
  ]);
  expect(createdFileLines("")).toEqual([]);
});

test("past the cap a skipped run counts none of its lines: only context and changed lines are counted", () => {
  const old = numbered(2100);
  const next = numbered(1100, "new") + old.slice(old.indexOf("line 1101\n"));

  const rows = editDiffLines(old, next, [placed([0, 1100, 0, 1100]), placed([1990, 1, 1990, 1])]);

  expect(rows).toHaveLength(MAX_DIFF_ROWS + 1);
  expect(shape(rows).slice(MAX_DIFF_ROWS - 1)).toEqual(["+900 new 900", "more 211"]);
});

test("each row kind fills its own cells; words come from the AI text", () => {
  const cells: readonly DiffRow[] = [
    { kind: "context", old: 4, new: 5, text: "same" },
    { kind: "removed", old: 6, text: "gone", ending: null },
    { kind: "added", new: 7, text: "came", ending: "lf" },
    { kind: "noNewline" },
    { kind: "skipped", lines: 3 },
    { kind: "more", lines: 1 },
  ];

  expect(cells.map(diffRowCells)).toEqual([
    { old: "4", new: "5", sign: " ", text: "same", note: "" },
    { old: "6", new: "", sign: "−", text: "gone", note: "" },
    { old: "", new: "7", sign: "+", text: "came", note: "LF line ending" },
    { old: "", new: "", sign: "", text: "\\ No newline at end of file", note: "" },
    { old: "", new: "", sign: "", text: "⋯ 3 unchanged lines", note: "" },
    { old: "", new: "", sign: "", text: "1 more line not shown", note: "" },
  ]);
  expect(diffRowCells({ kind: "removed", old: 1, text: "a", ending: "crlf" }).note).toBe(
    "CRLF line ending",
  );
  expect(diffRowCells({ kind: "added", new: 1, text: "a", ending: null }).note).toBe("");
});
