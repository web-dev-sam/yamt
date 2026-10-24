import { expect, test } from "vitest";

import { loadCompareFixture, type Difference } from "../../ipc";
import { anchorAt } from "./threadAnchor";

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

test("a left line inside a modified difference is removed", async () => {
  const differences = await differencesOf([
    { left: { start: 2, len: 2 }, right: { start: 2, len: 3 } },
  ]);

  expect(anchorAt(differences, "left", 3)).toEqual({ kind: "removed", left: 3 });
  expect(anchorAt(differences, "left", 2)).toEqual({ kind: "removed", left: 2 });
});

test("an unchanged right line after two differences pairs with its left line", async () => {
  const differences = await differencesOf([
    { left: { start: 1, len: 1 }, right: { start: 1, len: 3 } },
    { left: { start: 5, len: 1 }, right: { start: 7, len: 2 } },
  ]);

  expect(anchorAt(differences, "right", 12)).toEqual({
    kind: "unchangedOnRight",
    left: 9,
    right: 12,
  });
  expect(anchorAt(differences, "left", 9)).toEqual({ kind: "unchangedOnLeft", left: 9, right: 12 });
});

test("a line just past a pure insertion is unchanged, the last inserted line added", async () => {
  const differences = await differencesOf([
    { left: { start: 3, len: 0 }, right: { start: 3, len: 2 } },
  ]);

  expect(anchorAt(differences, "right", 4)).toEqual({ kind: "added", right: 4 });
  expect(anchorAt(differences, "right", 5)).toEqual({
    kind: "unchangedOnRight",
    left: 3,
    right: 5,
  });
  expect(anchorAt(differences, "left", 3)).toEqual({ kind: "unchangedOnLeft", left: 3, right: 5 });
});
