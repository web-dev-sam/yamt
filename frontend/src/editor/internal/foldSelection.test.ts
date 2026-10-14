import { EditorSelection, Text } from "@codemirror/state";
import { expect, test } from "vitest";

import { toDocPos } from "./docPos";
import type { Hidden } from "./foldRuns";
import { leaveAllHidden, leaveHidden, revealKeep } from "./foldSelection";

const DOC = Text.of(Array.from({ length: 12 }, (_, index) => `line ${index + 1}`));

function lines(first: number, last: number): Hidden {
  return { from: toDocPos(DOC.line(first).from), to: toDocPos(DOC.line(last).to) };
}

const OUTER = lines(3, 9);
const INNER = lines(5, 7);
const LEVELS = [OUTER, INNER];

test("a cursor strictly inside hidden lines moves to their start; one on either edge stays", () => {
  expect(leaveHidden(EditorSelection.cursor(OUTER.from + 1), [OUTER])).toEqual(
    EditorSelection.cursor(OUTER.from),
  );
  expect(leaveHidden(EditorSelection.cursor(OUTER.to - 1), [OUTER])).toEqual(
    EditorSelection.cursor(OUTER.from),
  );
  expect(leaveHidden(EditorSelection.cursor(OUTER.from), [OUTER])).toBeNull();
  expect(leaveHidden(EditorSelection.cursor(OUTER.to), [OUTER])).toBeNull();
});

test("a selection with an end inside is dropped: the head inside goes to the start, the head outside stays", () => {
  const before = DOC.line(1).from;
  const below = DOC.line(11).from;

  expect(leaveHidden(EditorSelection.range(before, OUTER.from + 3), [OUTER])).toEqual(
    EditorSelection.cursor(OUTER.from),
  );
  expect(leaveHidden(EditorSelection.range(OUTER.from + 3, below), [OUTER])).toEqual(
    EditorSelection.cursor(below),
  );
  expect(leaveHidden(EditorSelection.range(OUTER.from, OUTER.to), [OUTER])).toEqual(
    EditorSelection.cursor(OUTER.to),
  );
});

test("a selection covering the hidden lines from outside is kept", () => {
  expect(leaveHidden(EditorSelection.range(DOC.line(2).from, DOC.line(10).to), [OUTER])).toBeNull();
  expect(leaveHidden(EditorSelection.range(OUTER.from - 1, OUTER.to + 1), [OUTER])).toBeNull();
});

test("every range of a selection leaves the hidden lines and the main one stays main", () => {
  const outside = EditorSelection.cursor(DOC.line(11).from);
  const selection = EditorSelection.create(
    [EditorSelection.cursor(DOC.line(1).from), EditorSelection.cursor(INNER.from + 1), outside],
    1,
  );

  expect(leaveAllHidden(selection, [OUTER])?.main).toEqual(EditorSelection.cursor(OUTER.from));
  expect(leaveAllHidden(selection, [OUTER])?.ranges).toHaveLength(3);
  expect(leaveAllHidden(EditorSelection.create([outside]), [OUTER])).toBeNull();
  expect(leaveAllHidden(selection, [])).toBeNull();
});

test("no selection left by leaveHidden makes a reveal show the lines again", () => {
  for (let anchor = 0; anchor <= DOC.length; anchor += 1) {
    for (let head = 0; head <= DOC.length; head += 1) {
      const range = EditorSelection.range(anchor, head);
      const left = leaveHidden(range, [OUTER]) ?? range;
      expect(revealKeep(LEVELS, left), `${anchor}→${head}`).toBeNull();
    }
  }
});

test("a reveal keeps hiding only the levels inside the innermost one holding the selection", () => {
  expect(revealKeep(LEVELS, EditorSelection.cursor(INNER.from + 1))).toBe(0);
  expect(revealKeep(LEVELS, EditorSelection.cursor(OUTER.from + 1))).toBe(1);
  expect(revealKeep([null, INNER], EditorSelection.cursor(INNER.from + 1))).toBe(0);
  expect(revealKeep(LEVELS, EditorSelection.cursor(DOC.line(11).from))).toBeNull();
});
