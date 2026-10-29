import { expect, test } from "vitest";

import {
  emptyResults,
  filePlaces,
  listRows,
  matcherOf,
  MAX_ROWS,
  withFile,
  type Layout,
  type ListRow,
} from "../search";
import { stepSearchList } from "./searchListKeys";

type Pane = "only";

const LAYOUT: Layout<Pane> = { panes: ["only"], lead: "only" };

function rowsOf(
  files: Readonly<Record<string, string>>,
  closed: readonly string[] = [],
): readonly ListRow<Pane>[] {
  const query = { text: "x", matchCase: false };
  const matcher = matcherOf(query);
  if (matcher === null) {
    throw new Error("no matcher");
  }
  let results = emptyResults<Pane>(query);
  for (const [rank, [path, text]] of Object.entries(files).entries()) {
    const file = { path, texts: { only: text }, changes: [] };
    results = withFile(results, { path, rank, ...filePlaces(file, matcher, LAYOUT, MAX_ROWS) });
  }
  return listRows(results, new Set(LAYOUT.panes), new Set(closed));
}

const TWO_GROUPS = rowsOf({ "a.ts": "x\nx", "b.ts": "x" });

test("Down and Up step one row, start at the top without an active row and stop at both ends", () => {
  expect(stepSearchList(TWO_GROUPS, null, "ArrowDown")).toEqual({ kind: "activate", index: 0 });
  expect(stepSearchList(TWO_GROUPS, null, "ArrowUp")).toEqual({ kind: "activate", index: 0 });
  expect(stepSearchList(TWO_GROUPS, 1, "ArrowDown")).toEqual({ kind: "activate", index: 2 });
  expect(stepSearchList(TWO_GROUPS, 1, "ArrowUp")).toEqual({ kind: "activate", index: 0 });
  expect(stepSearchList(TWO_GROUPS, 4, "ArrowDown")).toEqual({ kind: "activate", index: 4 });
  expect(stepSearchList(TWO_GROUPS, 0, "ArrowUp")).toEqual({ kind: "activate", index: 0 });
});

test("an empty list takes no step", () => {
  for (const key of ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter"]) {
    expect(stepSearchList([], null, key)).toEqual({ kind: "ignore" });
  }
});

test("Left closes an open group and moves a place row to its group; on a closed group it does nothing", () => {
  expect(stepSearchList(TWO_GROUPS, 0, "ArrowLeft")).toEqual({ kind: "toggle", path: "a.ts" });
  expect(stepSearchList(TWO_GROUPS, 2, "ArrowLeft")).toEqual({ kind: "activate", index: 0 });
  expect(stepSearchList(TWO_GROUPS, 4, "ArrowLeft")).toEqual({ kind: "activate", index: 3 });
  const closed = rowsOf({ "a.ts": "x", "b.ts": "x" }, ["a.ts"]);
  expect(stepSearchList(closed, 0, "ArrowLeft")).toEqual({ kind: "ignore" });
});

test("Right opens a closed group, enters an open one's first place and does nothing on a place", () => {
  const closed = rowsOf({ "a.ts": "x", "b.ts": "x" }, ["b.ts"]);
  expect(stepSearchList(closed, 2, "ArrowRight")).toEqual({ kind: "toggle", path: "b.ts" });
  expect(stepSearchList(TWO_GROUPS, 3, "ArrowRight")).toEqual({ kind: "activate", index: 4 });
  expect(stepSearchList(TWO_GROUPS, 1, "ArrowRight")).toEqual({ kind: "ignore" });
});

test("Enter presses the active row; without an active row Enter, Left and Right do nothing", () => {
  expect(stepSearchList(TWO_GROUPS, 2, "Enter")).toEqual({ kind: "press", index: 2 });
  for (const key of ["Enter", "ArrowLeft", "ArrowRight"]) {
    expect(stepSearchList(TWO_GROUPS, null, key)).toEqual({ kind: "ignore" });
  }
});

test("another key is left alone", () => {
  expect(stepSearchList(TWO_GROUPS, 0, "a")).toEqual({ kind: "ignore" });
  expect(stepSearchList(TWO_GROUPS, 0, "Tab")).toEqual({ kind: "ignore" });
});
