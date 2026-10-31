import { expect, test } from "vitest";

import {
  changedThreadLine,
  diffLineOf,
  loadCompareFixture,
  onePlace,
  sameDiffLine,
  unchangedThreadLine,
  type Difference,
  type DiffLine,
  type ThreadLine,
} from "../../ipc";
import {
  lineAtIndex,
  orderIndex,
  placeBetween,
  placeSpans,
  shownEnd,
  unchangedRuns,
} from "./diffOrder";

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

function removed(left: number): DiffLine {
  return diffLineOf(changedThreadLine("left", left));
}

function added(right: number): DiffLine {
  return diffLineOf(changedThreadLine("right", right));
}

function unchanged(left: number, right: number): DiffLine {
  return diffLineOf(unchangedThreadLine("left", { left, right }));
}

function onLeft(left: number, right: number): ThreadLine {
  return unchangedThreadLine("left", { left, right });
}

function onRight(left: number, right: number): ThreadLine {
  return unchangedThreadLine("right", { left, right });
}

const ADDED_FIRST = await differencesOf([
  { left: { start: 0, len: 0 }, right: { start: 0, len: 2 } },
  { left: { start: 3, len: 2 }, right: { start: 5, len: 1 } },
  { left: { start: 9, len: 1 }, right: { start: 10, len: 0 } },
]);
const ADDED_FIRST_ORDER: readonly DiffLine[] = [
  added(0),
  added(1),
  unchanged(0, 2),
  unchanged(1, 3),
  unchanged(2, 4),
  removed(3),
  removed(4),
  added(5),
  unchanged(5, 6),
  unchanged(6, 7),
  unchanged(7, 8),
  unchanged(8, 9),
  removed(9),
];

const REMOVED_FIRST = await differencesOf([
  { left: { start: 0, len: 1 }, right: { start: 0, len: 0 } },
  { left: { start: 4, len: 0 }, right: { start: 3, len: 2 } },
  { left: { start: 6, len: 0 }, right: { start: 7, len: 1 } },
]);
const REMOVED_FIRST_ORDER: readonly DiffLine[] = [
  removed(0),
  unchanged(1, 0),
  unchanged(2, 1),
  unchanged(3, 2),
  added(3),
  added(4),
  unchanged(4, 5),
  unchanged(5, 6),
  added(7),
];

test.each([
  ["an addition at the first line", ADDED_FIRST, ADDED_FIRST_ORDER],
  ["a removal at the first line", REMOVED_FIRST, REMOVED_FIRST_ORDER],
] as const)(
  "with %s, the order lists an unchanged line once and a change's removed lines before its added ones, to the last line",
  (_, differences, order) => {
    expect(order.map((_line, index) => lineAtIndex(differences, index))).toEqual(order);
    expect(order.map((line) => orderIndex(differences, line))).toEqual(
      order.map((_, index) => index),
    );
  },
);

test.each([
  ["an addition at the first line", ADDED_FIRST, ADDED_FIRST_ORDER],
  ["a removal at the first line", REMOVED_FIRST, REMOVED_FIRST_ORDER],
] as const)("with %s, lineAtIndex inverts orderIndex for every line", (_, differences, order) => {
  for (const line of order) {
    expect(sameDiffLine(lineAtIndex(differences, orderIndex(differences, line)), line)).toBe(true);
  }
});

test("board.ts numbers lines as GitLab's one column does", async () => {
  const board = await differencesOf([
    { left: { start: 19, len: 1 }, right: { start: 19, len: 2 } },
    { left: { start: 179, len: 0 }, right: { start: 180, len: 3 } },
    { left: { start: 199, len: 1 }, right: { start: 203, len: 1 } },
  ]);

  expect(orderIndex(board, unchanged(196, 200))).toBe(201);
  expect(orderIndex(board, unchanged(198, 202))).toBe(203);
  expect(orderIndex(board, removed(199))).toBe(204);
  expect(orderIndex(board, added(203))).toBe(205);
});

test("a drag gives one place dragged down or up, and press = pointer gives the press's one-line place", () => {
  const top = onLeft(2, 4);
  const bottom = onLeft(6, 7);

  expect(placeBetween(ADDED_FIRST, top, bottom)).toEqual({ start: unchanged(2, 4), end: bottom });
  expect(placeBetween(ADDED_FIRST, bottom, top)).toEqual({ start: unchanged(2, 4), end: bottom });
  expect(placeBetween(ADDED_FIRST, top, top)).toEqual(onePlace(top));
  expect(placeBetween(ADDED_FIRST, onRight(2, 4), top)).toEqual(onePlace(onRight(2, 4)));
});

test("the end keeps the column it was picked in: unchangedOnLeft vs unchangedOnRight", () => {
  expect(placeBetween(ADDED_FIRST, onLeft(2, 4), onRight(6, 7)).end).toEqual(onRight(6, 7));
  expect(placeBetween(ADDED_FIRST, onRight(6, 7), onLeft(2, 4)).end).toEqual(onRight(6, 7));
  expect(placeBetween(ADDED_FIRST, onLeft(6, 7), onRight(2, 4)).end).toEqual(onLeft(6, 7));
});

test("a one-column drag from an unchanged line to an added line spans the change's removed lines", () => {
  const place = placeBetween(ADDED_FIRST, onRight(2, 4), changedThreadLine("right", 5));

  expect(place).toEqual({ start: unchanged(2, 4), end: { kind: "added", right: 5 } });
  expect(placeSpans(ADDED_FIRST, place)).toEqual({
    left: [
      { start: 2, len: 1 },
      { start: 3, len: 2 },
    ],
    right: [
      { start: 4, len: 1 },
      { start: 5, len: 1 },
    ],
  });
});

test("going down, the end stops at the last shown line before a hidden stretch, in the pointer's column", () => {
  const hidden = [
    { start: 0, len: 2 },
    { start: 6, len: 2 },
  ];
  const press = changedThreadLine("left", 3);

  expect(shownEnd(ADDED_FIRST, hidden, press, onRight(8, 9))).toEqual(onRight(5, 6));
  expect(shownEnd(ADDED_FIRST, hidden, press, onLeft(8, 9))).toEqual(onLeft(5, 6));
  expect(shownEnd(ADDED_FIRST, hidden, press, onRight(5, 6))).toEqual(onRight(5, 6));
  expect(shownEnd(ADDED_FIRST, [{ start: 5, len: 2 }], press, onLeft(8, 9))).toEqual({
    kind: "added",
    right: 5,
  });
});

test("going up, the end stops at the first shown line after a hidden stretch", () => {
  const hidden = [
    { start: 0, len: 2 },
    { start: 6, len: 2 },
  ];
  const press = changedThreadLine("left", 4);

  expect(shownEnd(ADDED_FIRST, hidden, press, changedThreadLine("right", 1))).toEqual(
    onRight(2, 4),
  );
  expect(shownEnd(ADDED_FIRST, hidden, press, onLeft(2, 4))).toEqual(onLeft(2, 4));
  expect(shownEnd(ADDED_FIRST, [{ start: 2, len: 1 }], press, onRight(1, 3))).toEqual({
    kind: "removed",
    left: 3,
  });
});

test("a pointer on a hidden line clamps the same way, going down and going up", () => {
  const hidden = [
    { start: 0, len: 2 },
    { start: 6, len: 2 },
  ];

  expect(shownEnd(ADDED_FIRST, hidden, changedThreadLine("left", 3), onLeft(7, 8))).toEqual(
    onLeft(5, 6),
  );
  expect(shownEnd(ADDED_FIRST, hidden, changedThreadLine("left", 3), onLeft(1, 3))).toEqual(
    onLeft(2, 4),
  );
});

test("a both-sides place tints removed lines on the left, added on the right, unchanged in both, split at the change", () => {
  const place = { start: removed(3), end: onLeft(6, 7) };

  expect(placeSpans(ADDED_FIRST, place)).toEqual({
    left: [
      { start: 3, len: 2 },
      { start: 5, len: 2 },
    ],
    right: [
      { start: 5, len: 1 },
      { start: 6, len: 2 },
    ],
  });
  expect(unchangedRuns(ADDED_FIRST, place)).toEqual([
    { left: { start: 5, len: 2 }, right: { start: 6, len: 2 } },
  ]);
});

test("an in-column place across a change splits its spans and its unchanged runs at the change", () => {
  const place = { start: unchanged(1, 3), end: onRight(6, 7) };

  expect(placeSpans(ADDED_FIRST, place)).toEqual({
    left: [
      { start: 1, len: 2 },
      { start: 3, len: 2 },
      { start: 5, len: 2 },
    ],
    right: [
      { start: 3, len: 2 },
      { start: 5, len: 1 },
      { start: 6, len: 2 },
    ],
  });
  expect(unchangedRuns(ADDED_FIRST, place)).toEqual([
    { left: { start: 1, len: 2 }, right: { start: 3, len: 2 } },
    { left: { start: 5, len: 2 }, right: { start: 6, len: 2 } },
  ]);
});

test("a one-line place tints its own line only", () => {
  expect(placeSpans(REMOVED_FIRST, onePlace(changedThreadLine("right", 4)))).toEqual({
    left: [],
    right: [{ start: 4, len: 1 }],
  });
  expect(placeSpans(REMOVED_FIRST, onePlace(onLeft(4, 5)))).toEqual({
    left: [{ start: 4, len: 1 }],
    right: [{ start: 5, len: 1 }],
  });
});
