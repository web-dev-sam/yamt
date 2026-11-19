import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { toReviewMarks, toSinceReview } from "./reviewedDomain";

const DIFFERENCE: Generated.Difference = {
  left: { start: 2, len: 0 },
  right: { start: 2, len: 1 },
  words: {
    left: { changed: [], removals: [] },
    right: { changed: [{ line: 2, start: 0, len: 3 }], removals: [] },
  },
};

test("each listed file keeps its mark, by its id", () => {
  const marks = toReviewMarks([
    { file: 4, mark: "reviewed" },
    { file: 0, mark: "changedSinceReview" },
  ]);

  expect([...marks]).toEqual([
    [4, "reviewed"],
    [0, "changedSinceReview"],
  ]);
  expect(toReviewMarks([]).size).toBe(0);
});

test("a negative file id is refused, naming its place", () => {
  expect(() =>
    toReviewMarks([
      { file: 1, mark: "reviewed" },
      { file: -1, mark: "reviewed" },
    ]),
  ).toThrow("[1].file must be a non-negative safe integer, got -1");
});

test("a file listed twice is refused, naming the repeat", () => {
  expect(() =>
    toReviewMarks([
      { file: 2, mark: "reviewed" },
      { file: 2, mark: "changedSinceReview" },
    ]),
  ).toThrow("[1].file 2 is marked twice");
});

test("a texts reply keeps both texts and brands its differences; noText passes as is", () => {
  expect(
    toSinceReview({ kind: "texts", reviewed: "a\n", current: "a\nb\n", differences: [DIFFERENCE] }),
  ).toEqual({ kind: "texts", reviewed: "a\n", current: "a\nb\n", differences: [DIFFERENCE] });
  expect(toSinceReview({ kind: "noText" })).toEqual({ kind: "noText" });
});

test("a texts reply with a negative difference line is refused, naming the field", () => {
  const bad = { ...DIFFERENCE, right: { start: -2, len: 1 } };

  expect(() =>
    toSinceReview({ kind: "texts", reviewed: "", current: "", differences: [bad] }),
  ).toThrow("differences[0].right.start must be a non-negative safe integer, got -2");
});
