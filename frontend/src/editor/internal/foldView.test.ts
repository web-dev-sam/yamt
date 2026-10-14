import { Text, type RangeSet, type RangeValue } from "@codemirror/state";
import { expect, test } from "vitest";

import { toDocPos } from "./docPos";
import type { Fold, Hidden } from "./foldRuns";
import { foldDecorations } from "./foldView";

const DOC = Text.of(Array.from({ length: 60 }, (_, index) => `line ${index + 1}`));

function lines(first: number, last: number): Hidden {
  return { from: toDocPos(DOC.line(first).from), to: toDocPos(DOC.line(last).to) };
}

function ranges<T extends RangeValue>(set: RangeSet<T>): string[] {
  const found: string[] = [];
  set.between(0, DOC.length, (from, to) => {
    found.push(`${DOC.lineAt(from).number}-${DOC.lineAt(to).number}`);
  });
  return found;
}

const FOLDS: readonly Fold[] = [
  {
    hidden: [
      { left: lines(1, 10), center: lines(1, 12), right: null },
      { left: lines(1, 6), center: lines(1, 8), right: null },
    ],
  },
  {
    hidden: [
      { left: null, center: lines(30, 40), right: lines(30, 40) },
      { left: lines(33, 37), center: lines(33, 37), right: lines(33, 37) },
    ],
  },
  { hidden: [] },
  { hidden: [{ left: null, center: lines(55, 60), right: null }] },
];

test("each run replaces its outermost hidden lines with one wave line", () => {
  const set = foldDecorations(FOLDS, "center");
  const widgets: string[] = [];
  set.between(0, DOC.length, (from, to, decoration) => {
    widgets.push(
      `${from === DOC.lineAt(from).from} ${to === DOC.lineAt(to).to} ${decoration.point}`,
    );
  });

  expect(ranges(set)).toEqual(["1-12", "30-40", "55-60"]);
  expect(widgets).toEqual(["true true true", "true true true", "true true true"]);
});

test("a pane without a range at the outer level shows the next level that has one", () => {
  expect(ranges(foldDecorations(FOLDS, "left"))).toEqual(["1-10", "33-37"]);
  expect(ranges(foldDecorations(FOLDS, "right"))).toEqual(["30-40"]);
});

test("a run with no level left has no wave", () => {
  expect(ranges(foldDecorations([{ hidden: [] }, { hidden: [] }], "center"))).toEqual([]);
});
