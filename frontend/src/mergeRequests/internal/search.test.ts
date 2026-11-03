import { expect, test } from "vitest";

import { searched } from "../index";

const ROWS = [
  { iid: 630, title: "Snooze a reminder" },
  { iid: 12345, title: "Draft: Show overdue cards in red" },
  { iid: 42, title: "Fix build 630 on CI" },
  { iid: 12, title: "Speed up the board query" },
  { iid: 34, title: "Document the import format" },
  { iid: 123, title: "Move the card menu" },
  { iid: 2, title: "Keep the scroll position" },
  { iid: 1000, title: "Add keyboard shortcuts" },
  { iid: 18, title: "Drop the old export endpoint" },
];

function iids(text: string): number[] {
  return searched(ROWS, text).map((row) => row.iid);
}

test("the title matches in any case, also its Draft prefix (catches a case-sensitive match)", () => {
  expect(iids("OVERDUE cards")).toEqual([12345]);
  expect(iids("draft: show")).toEqual([12345]);
  expect(iids("snooze")).toEqual([630]);
});

test("the text is trimmed before it is matched (catches surrounding spaces matching nothing)", () => {
  expect(iids("  board query \t")).toEqual([12]);
});

test("empty or whitespace-only text matches every row and returns the rows themselves", () => {
  expect(searched(ROWS, "")).toBe(ROWS);
  expect(searched(ROWS, "   \t ")).toBe(ROWS);
});

test.each([
  "!12345",
  "#12345",
  "12345",
  "MR 12345 fix",
  "see !12345,",
  "https://gitlab.example.com/g/p/-/merge_requests/12345",
])("%s names merge request 12345 (catches a number form missed)", (text) => {
  expect(iids(text)).toEqual([12345]);
});

test.each(["v2", "abc123", "12ab", "x34", "34é", "1e3", "0x12"])(
  "%s names no number (catches digits inside a word taken as an iid)",
  (text) => {
    expect(iids(text)).toEqual([]);
  },
);

test("two numbers show both merge requests (catches only the first number read)", () => {
  expect(iids("!12 !34")).toEqual([12, 34]);
});

test("a number shows its merge request and every title containing it", () => {
  expect(iids("630")).toEqual([630, 42]);
});

test("a number matching no iid still lets a title match through", () => {
  expect(iids("build 630")).toEqual([630, 42]);
  expect(iids("fix build")).toEqual([42]);
});

test("leading zeros name the same number: 0042 is 42", () => {
  expect(iids("0042")).toEqual([42]);
});
