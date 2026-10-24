import { Text } from "@codemirror/state";
import { expect, test } from "vitest";

import { rowDecorations, type ColumnThreads } from "./threadField";
import type { RowKind, ThreadRow } from "./threadRows";
import { ThreadRowWidget, type RowCells } from "./threadWidget";

function cellsWith(heights: Map<string, number>): RowCells {
  return {
    height: (row) => heights.get(row) ?? 0,
    host: () => undefined,
    addCell: () => {},
    dropCell: () => {},
  };
}

function row(
  key: string,
  place: ThreadRow["place"],
  left: readonly string[],
  kind: RowKind = "changed",
): ThreadRow {
  return { key, place, keys: { left, right: [] }, kind };
}

test("a row widget with the same keys eqs the old one, so its DOM is kept when heights change", () => {
  const heights = new Map([["2:3", 40]]);
  const cells = cellsWith(heights);
  const before = new ThreadRowWidget(row("2:3", { left: 2, right: 3 }, ["a"]), "left", cells);
  heights.set("2:3", 90);
  const grown = new ThreadRowWidget(row("2:3", { left: 2, right: 3 }, ["a"]), "left", cells);
  const added = new ThreadRowWidget(row("2:3", { left: 2, right: 3 }, ["a", "b"]), "left", cells);

  expect(grown.eq(before)).toBe(true);
  expect(grown.estimatedHeight).toBe(90);
  expect(added.eq(before)).toBe(false);
});

test("each row is a block widget after its place's line, in row order; an empty side's rows sit above the next line", () => {
  const doc = Text.of(["one", "two", "three"]);
  const rows = [
    row("0:1", { left: 0, right: 1 }, [], "leftEmpty"),
    row("0:2", { left: 0, right: 2 }, [], "leftEmpty"),
    row("2:3", { left: 2, right: 3 }, [], "unchanged"),
    row("2:4", { left: 2, right: 4 }, [], "leftEmpty"),
    row("3:5", { left: 3, right: 5 }, [], "leftEmpty"),
  ];
  const threads: ColumnThreads = { column: "left", rows, counts: [], cells: cellsWith(new Map()) };
  const placed: unknown[] = [];

  rowDecorations(doc, threads).between(0, doc.length, (from, _to, decoration) => {
    placed.push({ from, side: decoration.spec.side, block: decoration.spec.block });
  });

  expect(placed).toEqual([
    { from: 0, side: -5, block: true },
    { from: 0, side: -4, block: true },
    { from: 7, side: 3, block: true },
    { from: 8, side: -2, block: true },
    { from: 13, side: 5, block: true },
  ]);
});

test("an empty side's rows sit above the next line only in the empty column", () => {
  const doc = Text.of(["one", "two", "three"]);
  const rows = [row("2:2", { left: 2, right: 2 }, [], "leftEmpty")];
  const threads: ColumnThreads = { column: "right", rows, counts: [], cells: cellsWith(new Map()) };
  const placed: number[] = [];

  rowDecorations(doc, threads).between(0, doc.length, (from) => {
    placed.push(from);
  });

  expect(placed).toEqual([7]);
});
