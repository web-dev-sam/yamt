import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import {
  toColumnVersions,
  toComparison,
  toCompareStart,
  toTabList,
  toTabTexts,
} from "./compareDomain";
import { nextColumnVersion } from "./domain";

const DIFFERENCE: Generated.Difference = {
  left: { start: 2, len: 1 },
  right: { start: 3, len: 0 },
  words: {
    left: { changed: [{ line: 2, start: 4, len: 3 }], removals: [] },
    right: { changed: [], removals: [{ at: { line: 3, column: 1 }, text: "x" }] },
  },
};

const LIST: Generated.TabList = {
  tabs: [
    { id: 1, name: "Compare 1", language: { kind: "auto" }, holds_text: true },
    { id: 4, name: "json", language: { kind: "picked", name: "JSON" }, holds_text: false },
  ],
  shown: 4,
};

const TEXTS: Generated.TabTexts = {
  left: "a\n",
  right: "b\n",
  comparison: { versions: { left: 3, right: 7 }, differences: [DIFFERENCE] },
};

test("a start and a tab's texts convert every field, camelCased, with both columns' words", () => {
  expect(toCompareStart({ list: LIST, column_limit: 8_388_608 })).toEqual({
    list: {
      tabs: [
        { id: 1, name: "Compare 1", language: { kind: "auto" }, holdsText: true },
        { id: 4, name: "json", language: { kind: "picked", name: "JSON" }, holdsText: false },
      ],
      shown: 4,
    },
    columnLimit: 8_388_608,
  });
  expect(toTabTexts(TEXTS)).toEqual({
    left: "a\n",
    right: "b\n",
    comparison: {
      versions: { left: 3, right: 7 },
      differences: [
        {
          left: { start: 2, len: 1 },
          right: { start: 3, len: 0 },
          words: {
            left: { changed: [{ line: 2, start: 4, len: 3 }], removals: [] },
            right: { changed: [], removals: [{ at: { line: 3, column: 1 }, text: "x" }] },
          },
        },
      ],
    },
  });
});

test.each([-1, 0.5])("a tab id or the shown tab of %s is refused, naming the field", (bad) => {
  const [first, second] = LIST.tabs;
  if (first === undefined || second === undefined) {
    throw new Error("the list lost its tabs");
  }
  expect(() => toTabList({ ...LIST, tabs: [first, { ...second, id: bad }] })).toThrow(
    `tabs[1].id must be a non-negative safe integer, got ${bad}`,
  );
  expect(() => toTabList({ ...LIST, shown: bad })).toThrow(
    `shown must be a non-negative safe integer, got ${bad}`,
  );
});

test.each([-1, 0.5])("a column limit of %s is refused", (bad) => {
  expect(() => toCompareStart({ list: LIST, column_limit: bad })).toThrow(
    `column_limit must be a non-negative safe integer, got ${bad}`,
  );
});

test.each([-1, 0.5])("a column version of %s is refused on either column", (bad) => {
  expect(() => toColumnVersions({ left: bad, right: 0 })).toThrow(
    `versions.left must be a non-negative safe integer, got ${bad}`,
  );
  expect(() => toColumnVersions({ left: 0, right: bad })).toThrow(
    `versions.right must be a non-negative safe integer, got ${bad}`,
  );
});

function comparison(difference: Generated.Difference): Generated.Comparison {
  return { versions: { left: 0, right: 0 }, differences: [DIFFERENCE, difference] };
}

test.each([-1, 0.5])("a line of %s is refused in either column's range or words", (bad) => {
  expect(() => toComparison(comparison({ ...DIFFERENCE, left: { start: bad, len: 1 } }))).toThrow(
    `differences[1].left.start must be a non-negative safe integer, got ${bad}`,
  );
  expect(() => toComparison(comparison({ ...DIFFERENCE, right: { start: bad, len: 0 } }))).toThrow(
    `differences[1].right.start must be a non-negative safe integer, got ${bad}`,
  );
  const leftWords = { changed: [{ line: bad, start: 0, len: 1 }], removals: [] };
  expect(() =>
    toComparison(comparison({ ...DIFFERENCE, words: { ...DIFFERENCE.words, left: leftWords } })),
  ).toThrow(`differences[1].words.left.changed[0].line must be a non-negative safe integer`);
  const rightWords = { changed: [], removals: [{ at: { line: bad, column: 0 }, text: "x" }] };
  expect(() =>
    toComparison(comparison({ ...DIFFERENCE, words: { ...DIFFERENCE.words, right: rightWords } })),
  ).toThrow(`differences[1].words.right.removals[0].at.line must be a non-negative safe integer`);
});

test("nextColumnVersion adds one", () => {
  const { left, right } = toColumnVersions({ left: 0, right: 41 });

  expect(nextColumnVersion(left)).toBe(1);
  expect(nextColumnVersion(right)).toBe(42);
});
