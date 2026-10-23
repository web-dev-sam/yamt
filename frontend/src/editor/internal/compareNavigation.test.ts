import { Text } from "@codemirror/state";
import { expect, test } from "vitest";

import type { DiffSpan } from "./compareMarks";
import { nextDifference } from "./compareNavigation";
import { toDocPos } from "./docPos";

const DOC = Text.of(["aaaa", "bbbbbbbbb", "cccc", "ddd", "eeeeeeee", ""]);
const FIRST: DiffSpan = { from: toDocPos(5), to: toDocPos(15), tone: "modified" };
const SECOND: DiffSpan = { from: toDocPos(15), to: toDocPos(20), tone: "deleted" };
const LAST: DiffSpan = { from: toDocPos(24), to: toDocPos(24), tone: "inserted" };
const SPANS = [FIRST, SECOND, LAST];

test("down goes to the first difference starting after the cursor", () => {
  expect(nextDifference(DOC, SPANS, toDocPos(0), "down")).toBe(FIRST);
  expect(nextDifference(DOC, SPANS, toDocPos(5), "down")).toBe(SECOND);
  expect(nextDifference(DOC, SPANS, toDocPos(10), "down")).toBe(SECOND);
  expect(nextDifference(DOC, SPANS, toDocPos(15), "down")).toBe(LAST);
});

test("up goes to the last difference ending before the cursor, never the one the cursor is in", () => {
  expect(nextDifference(DOC, SPANS, toDocPos(24), "up")).toBe(SECOND);
  expect(nextDifference(DOC, SPANS, toDocPos(18), "up")).toBe(FIRST);
  expect(nextDifference(DOC, SPANS, toDocPos(15), "up")).toBe(FIRST);
  expect(nextDifference(DOC, SPANS, toDocPos(30), "up")).toBe(LAST);
});

test("past the last or before the first difference there is nowhere to go: no wrap", () => {
  expect(nextDifference(DOC, SPANS, toDocPos(24), "down")).toBeNull();
  expect(nextDifference(DOC, SPANS, toDocPos(5), "up")).toBeNull();
  expect(nextDifference(DOC, SPANS, toDocPos(10), "up")).toBeNull();
  expect(nextDifference(DOC, [], toDocPos(0), "down")).toBeNull();
});

test("up from the end of a text without a final line break skips the last-line difference the cursor is in", () => {
  const doc = Text.of(["a", "b", "last"]);
  const earlier: DiffSpan = { from: toDocPos(0), to: toDocPos(2), tone: "modified" };
  const lastLine: DiffSpan = { from: toDocPos(4), to: toDocPos(doc.length), tone: "modified" };
  const end = toDocPos(doc.length);

  expect(nextDifference(doc, [earlier, lastLine], end, "up")).toBe(earlier);
  expect(nextDifference(doc, [lastLine], end, "up")).toBeNull();
});
