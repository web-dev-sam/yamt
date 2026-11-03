import { expect, test } from "vitest";

import { agoText, createdAgo } from "../index";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test.each([
  ["0 s", 0, "just now"],
  ["59 s", 59 * SECOND, "just now"],
  ["1 min", MINUTE, "1 minute ago"],
  ["119 s", 2 * MINUTE - 1, "1 minute ago"],
  ["2 min", 2 * MINUTE, "2 minutes ago"],
  ["59 min", HOUR - 1, "59 minutes ago"],
  ["1 h", HOUR, "1 hour ago"],
  ["23 h", 23 * HOUR, "23 hours ago"],
  ["1 d", DAY, "1 day ago"],
  ["6 d", 6 * DAY, "6 days ago"],
  ["7 d", 7 * DAY, "1 week ago"],
  ["29 d", 29 * DAY, "4 weeks ago"],
  ["30 d", 30 * DAY, "1 month ago"],
  ["364 d", 364 * DAY, "12 months ago"],
  ["365 d", 365 * DAY, "1 year ago"],
  ["800 d", 800 * DAY, "2 years ago"],
])("ago_text_uses_the_largest_whole_unit_and_just_now: %s old reads %s", (_age, age, text) => {
  expect(agoText(NOW - age, NOW)).toBe(text);
});

test("ago_text_uses_the_largest_whole_unit_and_just_now: a time ahead of the clock is just now", () => {
  expect(agoText(NOW + HOUR, NOW)).toBe("just now");
});

test("created_ago_keeps_its_words", () => {
  expect(createdAgo(NOW - 30 * SECOND, NOW)).toBe("created just now");
  expect(createdAgo(NOW - 3 * HOUR, NOW)).toBe("created 3 hours ago");
  expect(createdAgo(NOW - 800 * DAY, NOW)).toBe("created 2 years ago");
});
