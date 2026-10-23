import { Text } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { expect, test } from "vitest";

import { loadCompareFixture, type Difference } from "../../ipc";
import { columnMarks } from "./compareMarks";

const LEFT = "same\nold word!\ngone\nend\n";
const RIGHT = "same\nnew word\nend\nadded\n";

const CASE = {
  left: LEFT,
  right: RIGHT,
  differences: [
    {
      left: { start: 1, len: 1 },
      right: { start: 1, len: 1 },
      words: {
        left: {
          changed: [
            { line: 1, start: 0, len: 3 },
            { line: 1, start: 8, len: 1 },
          ],
          removals: [],
        },
        right: {
          changed: [{ line: 1, start: 0, len: 3 }],
          removals: [{ at: { line: 1, column: 8 }, text: "!" }],
        },
      },
    },
    {
      left: { start: 2, len: 1 },
      right: { start: 2, len: 0 },
      words: { left: { changed: [], removals: [] }, right: { changed: [], removals: [] } },
    },
    {
      left: { start: 4, len: 0 },
      right: { start: 3, len: 1 },
      words: { left: { changed: [], removals: [] }, right: { changed: [], removals: [] } },
    },
  ],
};

async function differences(): Promise<readonly Difference[]> {
  return (await loadCompareFixture("case", { "case.json": CASE })).comparison.differences;
}

function painted(doc: Text, set: DecorationSet): string[] {
  const found: string[] = [];
  set.between(0, doc.length, (from, to, decoration) => {
    const line = doc.lineAt(from);
    if (decoration.spec.widget === undefined) {
      const text = from < to ? ` ${doc.sliceString(from, to)}` : "";
      found.push(`${line.number} ${String(decoration.spec.class)}${text}`);
    } else {
      const className = String(decoration.spec.widget.className);
      const around = `${doc.sliceString(line.from, from)}|${doc.sliceString(from, line.to)}`;
      found.push(`${line.number} ${className} ${around}`);
    }
  });
  return found;
}

test("an empty left side is inserted and an empty right side deleted, in both columns and their bands", async () => {
  const found = await differences();
  const left = columnMarks(Text.of(LEFT.split("\n")), found, "left");
  const right = columnMarks(Text.of(RIGHT.split("\n")), found, "right");

  expect(left.spans.map(({ tone }) => tone)).toEqual(["modified", "deleted", "inserted"]);
  expect(right.spans.map(({ tone }) => tone)).toEqual(["modified", "deleted", "inserted"]);
  expect(painted(Text.of(LEFT.split("\n")), left.bands)).toEqual([
    "2 chunk-modified chunk-band",
    "3 chunk-deleted chunk-band",
    "5 chunk-marker-inserted chunk-point-above",
  ]);
  expect(painted(Text.of(RIGHT.split("\n")), right.bands)).toEqual([
    "2 chunk-modified chunk-band",
    "3 chunk-marker-deleted chunk-point-above",
    "4 chunk-inserted chunk-band",
  ]);
});

test("each column's spans cover its own lines of every difference", async () => {
  const found = await differences();
  const left = columnMarks(Text.of(LEFT.split("\n")), found, "left");
  const right = columnMarks(Text.of(RIGHT.split("\n")), found, "right");

  expect(left.spans.map(({ from, to }) => LEFT.slice(from, to))).toEqual([
    "old word!\n",
    "gone\n",
    "",
  ]);
  expect(left.spans.at(-1)?.from).toBe(LEFT.length);
  expect(right.spans.map(({ from, to }) => RIGHT.slice(from, to))).toEqual([
    "new word\n",
    "",
    "added\n",
  ]);
  expect(right.spans[1]?.from).toBe(RIGHT.indexOf("end"));
});

test("word marks and removal bars sit on their own words in both columns, in the difference's tone", async () => {
  const found = await differences();
  const left = Text.of(LEFT.split("\n"));
  const right = Text.of(RIGHT.split("\n"));

  expect(painted(left, columnMarks(left, found, "left").words)).toEqual([
    "2 chunk-word-modified old",
    "2 chunk-word-modified !",
  ]);
  expect(painted(right, columnMarks(right, found, "right").words)).toEqual([
    "2 chunk-word-modified new",
    "2 chunk-removal chunk-removal-modified new word|",
  ]);
});

test("no differences leave a column without spans, bands or marks", () => {
  const doc = Text.of(LEFT.split("\n"));
  const marks = columnMarks(doc, [], "left");

  expect(marks.spans).toEqual([]);
  expect(painted(doc, marks.bands)).toEqual([]);
  expect(painted(doc, marks.words)).toEqual([]);
});
