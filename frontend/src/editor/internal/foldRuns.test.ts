import type { Text } from "@codemirror/state";
import { expect, test } from "vitest";

import { loadFixture, type FileMergeData } from "../../ipc";
import { toDocPos } from "./docPos";
import { displayed, foldRuns, type Fold, type Hidden } from "./foldRuns";
import type { Pane } from "./geometry";
import { paneDocs } from "./paneDocs";

type Range = [start: number, len: number];
type ChunkRanges = { middle: Range; local: Range; remote: Range };

function numbered(count: number): string {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}\n`).join("");
}

function lineRange([start, len]: Range): { start: number; len: number } {
  return { start, len };
}

async function synthetic(
  texts: { middle: string; local: string; remote: string },
  chunks: readonly ChunkRanges[],
): Promise<FileMergeData> {
  const { middle, ...sides } = texts;
  const record = {
    path: "synthetic.ts",
    deleted: null,
    middle: { kind: "Stages", text: middle },
    ...sides,
    eol: "Lf",
    disk_version: 0,
    chunks: chunks.map((chunk, id) => {
      return {
        chunk: {
          id,
          kind: "Conflict",
          base: lineRange(chunk.middle),
          local: lineRange(chunk.local),
          remote: lineRange(chunk.remote),
        },
        middle: lineRange(chunk.middle),
        words: {
          chunk: id,
          local: { changed: [], removed_at: [] },
          remote: { changed: [], removed_at: [] },
        },
      };
    }),
  };
  return loadFixture("synthetic.ts", { "synthetic.json": record });
}

function same(range: Range): ChunkRanges {
  return { middle: range, local: range, remote: range };
}

async function runsOf(
  lineCounts: Readonly<Record<"middle" | "local" | "remote", number>>,
  chunks: readonly ChunkRanges[],
): Promise<{ runs: Fold[]; docs: Readonly<Record<Pane, Text>> }> {
  const data = await synthetic(
    {
      middle: numbered(lineCounts.middle),
      local: numbered(lineCounts.local),
      remote: numbered(lineCounts.remote),
    },
    chunks,
  );
  const docs = paneDocs(data);
  return { runs: foldRuns(data.chunks, docs), docs };
}

function lines(doc: Text, hidden: Hidden | null): string {
  return hidden === null
    ? "-"
    : `${doc.lineAt(hidden.from).number}-${doc.lineAt(hidden.to).number}`;
}

function levelLines(runs: readonly Fold[], docs: Readonly<Record<Pane, Text>>, pane: Pane) {
  return runs.map((fold) => fold.hidden.map((level) => lines(docs[pane], level[pane])));
}

const ALL = { middle: 100, local: 100, remote: 100 };

test("each run keeps 4, then 8, then 16 lines next to each change", async () => {
  const { runs, docs } = await runsOf(ALL, [same([20, 1]), same([80, 1])]);

  expect(levelLines(runs, docs, "center")[1]).toEqual(["26-76", "30-72", "38-64"]);
  expect(levelLines(runs, docs, "left")[1]).toEqual(["26-76", "30-72", "38-64"]);
});

test("nothing is kept at the file's top or bottom", async () => {
  const { runs, docs } = await runsOf(ALL, [same([50, 2])]);

  expect(levelLines(runs, docs, "center")).toEqual([
    ["1-46", "1-42", "1-34"],
    ["57-101", "61-101", "69-101"],
  ]);
});

test("a file without changes has one run with one level hiding each whole pane", async () => {
  const { runs, docs } = await runsOf({ middle: 30, local: 10, remote: 0 }, []);

  expect(levelLines(runs, docs, "center")).toEqual([["1-31"]]);
  expect(levelLines(runs, docs, "left")).toEqual([["1-11"]]);
  expect(levelLines(runs, docs, "right")).toEqual([["-"]]);
});

test("a run of 9 lines hides nothing, a run of 10 hides its 2 middle lines once", async () => {
  const nine = await runsOf(ALL, [same([10, 1]), same([20, 1])]);
  const ten = await runsOf(ALL, [same([10, 1]), same([21, 1])]);

  expect(nine.runs[1]?.hidden).toEqual([]);
  expect(levelLines(ten.runs, ten.docs, "center")[1]).toEqual(["16-17"]);
});

test("an empty document hides nothing in its pane", async () => {
  const data = await synthetic({ middle: numbered(40), local: "", remote: numbered(40) }, [
    { middle: [20, 1], local: [0, 0], remote: [20, 1] },
  ]);
  const docs = paneDocs(data);
  const runs = foldRuns(data.chunks, docs);

  expect(runs.flatMap((fold) => fold.hidden.map((level) => level.left))).toEqual(
    runs.flatMap((fold) => fold.hidden.map(() => null)),
  );
  expect(runs.flatMap((fold) => fold.hidden).length).toBeGreaterThan(0);
});

test("a run long only in the middle still makes its levels, null in the sides", async () => {
  const { runs, docs } = await runsOf({ middle: 100, local: 40, remote: 40 }, [
    { middle: [10, 1], local: [10, 1], remote: [10, 1] },
    { middle: [60, 1], local: [16, 1], remote: [16, 1] },
  ]);

  expect(levelLines(runs, docs, "center")[1]).toEqual(["16-56", "20-52", "28-44"]);
  expect(levelLines(runs, docs, "left")[1]).toEqual(["-", "-", "-"]);
});

test("a level that differs from the one outside it in one pane only is kept", async () => {
  const { runs, docs } = await runsOf({ middle: 100, local: 100, remote: 100 }, [
    { middle: [10, 1], local: [10, 1], remote: [10, 1] },
    { middle: [23, 1], local: [60, 1], remote: [23, 1] },
  ]);

  expect(levelLines(runs, docs, "center")[1]).toEqual(["16-19", "-", "-"]);
  expect(levelLines(runs, docs, "left")[1]).toEqual(["16-56", "20-52", "28-44"]);
  expect(levelLines(runs, docs, "right")[1]).toEqual(["16-19", "-", "-"]);
});

test("a hidden range runs from its first line's start to its last line's end", async () => {
  const { runs, docs } = await runsOf(ALL, [same([50, 2])]);
  const hidden = runs[0] === undefined ? null : displayed(runs[0], "center");

  expect(hidden).toEqual({ from: 0, to: docs.center.line(46).to });
  expect(docs.center.sliceString(hidden?.from ?? 0, hidden?.to ?? 0).endsWith("line 46")).toBe(
    true,
  );
});

test("a pane shows the first level that hides anything in it", () => {
  const range = { from: toDocPos(0), to: toDocPos(10) };
  const fold: Fold = {
    hidden: [
      { left: range, center: null, right: null },
      { left: range, center: range, right: null },
    ],
  };

  expect(displayed(fold, "center")).toBe(range);
  expect(displayed(fold, "left")).toBe(range);
  expect(displayed(fold, "right")).toBeNull();
});
