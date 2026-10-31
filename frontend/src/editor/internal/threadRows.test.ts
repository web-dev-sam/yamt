import { expect, test } from "vitest";

import {
  changedThreadLine,
  diffLineOf,
  loadCompareFixture,
  onePlace,
  unchangedThreadLine,
  type Difference,
} from "../../ipc";
import { rowHeight, threadRows, type ShownThread, type ThreadRow } from "./threadRows";

type Lines = { readonly start: number; readonly len: number };

const NO_WORDS = { changed: [], removals: [] };

async function differencesOf(
  ranges: readonly { readonly left: Lines; readonly right: Lines }[],
): Promise<readonly Difference[]> {
  const differences = ranges.map((range) => ({
    ...range,
    words: { left: NO_WORDS, right: NO_WORDS },
  }));
  const files = { "case.json": { left: "", right: "", differences } };
  return (await loadCompareFixture("case", files)).comparison.differences;
}

function places(rows: readonly ThreadRow[]): unknown[] {
  return rows.map(({ place, keys, kind }) => ({ place, keys, kind }));
}

test("a removed line's gap sits after the difference's right lines", async () => {
  const differences = await differencesOf([
    { left: { start: 1, len: 2 }, right: { start: 1, len: 4 } },
  ]);
  const threads: ShownThread[] = [
    { key: "removed", place: onePlace(changedThreadLine("left", 1)), shown: "open" },
    { key: "added", place: onePlace(changedThreadLine("right", 2)), shown: "open" },
  ];

  expect(places(threadRows(differences, threads))).toEqual([
    { place: { left: 2, right: 5 }, keys: { left: ["removed"], right: [] }, kind: "changed" },
    { place: { left: 3, right: 3 }, keys: { left: [], right: ["added"] }, kind: "changed" },
  ]);
});

test("a removed line that no difference holds places its row after its partner line", async () => {
  const differences = await differencesOf([
    { left: { start: 1, len: 1 }, right: { start: 1, len: 3 } },
  ]);
  const threads: ShownThread[] = [
    { key: "outdated", place: onePlace(changedThreadLine("left", 5)), shown: "open" },
  ];

  expect(places(threadRows(differences, threads))).toEqual([
    { place: { left: 6, right: 8 }, keys: { left: ["outdated"], right: [] }, kind: "changed" },
  ]);
});

test("an unchanged line's threads from both columns share one row", async () => {
  const differences = await differencesOf([
    { left: { start: 1, len: 1 }, right: { start: 1, len: 3 } },
  ]);
  const lines = { left: 7, right: 9 };
  const threads: ShownThread[] = [
    { key: "on-left", place: onePlace(unchangedThreadLine("left", lines)), shown: "open" },
    { key: "on-right", place: onePlace(unchangedThreadLine("right", lines)), shown: "draft" },
    { key: "second", place: onePlace(unchangedThreadLine("left", lines)), shown: "open" },
  ];

  const rows = threadRows(differences, threads);

  expect(places(rows)).toEqual([
    {
      place: { left: 8, right: 10 },
      keys: { left: ["on-left", "second"], right: ["on-right"] },
      kind: "unchanged",
    },
  ]);
});

test("rows at one place keep their order by the other column's place", async () => {
  const differences = await differencesOf([
    { left: { start: 3, len: 0 }, right: { start: 3, len: 3 } },
  ]);
  const threads: ShownThread[] = [
    { key: "later", place: onePlace(changedThreadLine("right", 5)), shown: "open" },
    { key: "earlier", place: onePlace(changedThreadLine("right", 3)), shown: "open" },
  ];

  expect(places(threadRows(differences, threads))).toEqual([
    { place: { left: 3, right: 4 }, keys: { left: [], right: ["earlier"] }, kind: "leftEmpty" },
    { place: { left: 3, right: 6 }, keys: { left: [], right: ["later"] }, kind: "leftEmpty" },
  ]);
});

test("collapsed threads place no row, drafts do", async () => {
  const differences = await differencesOf([]);
  const threads: ShownThread[] = [
    {
      key: "collapsed",
      place: onePlace(unchangedThreadLine("left", { left: 0, right: 0 })),
      shown: "collapsed",
    },
    {
      key: "draft",
      place: onePlace(unchangedThreadLine("right", { left: 4, right: 4 })),
      shown: "draft",
    },
  ];

  expect(places(threadRows(differences, threads))).toEqual([
    { place: { left: 5, right: 5 }, keys: { left: [], right: ["draft"] }, kind: "unchanged" },
  ]);
});

test("a removed line in a pure deletion places its row on the right's empty side", async () => {
  const differences = await differencesOf([
    { left: { start: 3, len: 2 }, right: { start: 3, len: 0 } },
  ]);
  const threads: ShownThread[] = [
    { key: "removed", place: onePlace(changedThreadLine("left", 4)), shown: "open" },
    {
      key: "before",
      place: onePlace(unchangedThreadLine("left", { left: 2, right: 2 })),
      shown: "open",
    },
  ];

  expect(places(threadRows(differences, threads))).toEqual([
    { place: { left: 3, right: 3 }, keys: { left: ["before"], right: [] }, kind: "unchanged" },
    { place: { left: 5, right: 3 }, keys: { left: ["removed"], right: [] }, kind: "rightEmpty" },
  ]);
});

test("a range's row sits under its end line, not its start; two ranges ending on one line share it", async () => {
  const differences = await differencesOf([
    { left: { start: 3, len: 1 }, right: { start: 3, len: 2 } },
  ]);
  const end = changedThreadLine("right", 4);
  const threads: ShownThread[] = [
    {
      key: "from-unchanged",
      place: { start: diffLineOf(unchangedThreadLine("left", { left: 1, right: 1 })), end },
      shown: "open",
    },
    {
      key: "from-removed",
      place: { start: diffLineOf(changedThreadLine("left", 3)), end },
      shown: "draft",
    },
  ];

  expect(places(threadRows(differences, threads))).toEqual([
    {
      place: { left: 4, right: 5 },
      keys: { left: [], right: ["from-unchanged", "from-removed"] },
      kind: "changed",
    },
  ]);
});

test("a row's height is the larger column's sum", () => {
  const heights: Readonly<Record<string, number>> = { a: 30, b: 40, c: 50 };
  const row: ThreadRow = {
    key: "1:1",
    place: { left: 1, right: 1 },
    keys: { left: ["a", "b"], right: ["c"] },
    kind: "unchanged",
  };

  expect(rowHeight(row, (key) => heights[key] ?? 0)).toBe(70);
});
