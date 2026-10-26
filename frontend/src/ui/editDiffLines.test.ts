import { expect, test } from "vitest";

import type { Difference } from "../ipc";
import { createdFileLines, editDiffLines, MAX_DIFF_ROWS, type DiffRow } from "./editDiffLines";

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
        return `-${row.old} ${row.text}`;
      case "added":
        return `+${row.new} ${row.text}`;
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

test("a text without a final newline keeps its last line; no differences show nothing", () => {
  expect(shape(editDiffLines("a\nb", "a\nc", [placed([1, 1, 1, 1])]))).toEqual([
    " 1:1 a",
    "-2 b",
    "+2 c",
  ]);
  expect(editDiffLines("a\n", "a\n", [])).toEqual([]);
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
  expect(rows.at(-1)).toEqual({ kind: "added", new: MAX_DIFF_ROWS, text: `line ${MAX_DIFF_ROWS}` });
});

test("a created file is every line added, capped like a diff", () => {
  expect(shape(createdFileLines("a\nb\n"))).toEqual(["+1 a", "+2 b"]);
  expect(shape(createdFileLines(numbered(MAX_DIFF_ROWS + 5)).slice(-1))).toEqual(["more 5"]);
  expect(createdFileLines("")).toEqual([]);
});
