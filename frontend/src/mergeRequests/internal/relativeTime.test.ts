import { expect, test } from "vitest";

import { createdAgo } from "../index";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test.each([
  ["0 s", 0, "created just now"],
  ["59 s", 59 * SECOND, "created just now"],
  ["1 min", MINUTE, "created 1 minute ago"],
  ["119 s", 2 * MINUTE - 1, "created 1 minute ago"],
  ["2 min", 2 * MINUTE, "created 2 minutes ago"],
  ["59 min", HOUR - 1, "created 59 minutes ago"],
  ["1 h", HOUR, "created 1 hour ago"],
  ["23 h", 23 * HOUR, "created 23 hours ago"],
  ["1 d", DAY, "created 1 day ago"],
  ["6 d", 6 * DAY, "created 6 days ago"],
  ["7 d", 7 * DAY, "created 1 week ago"],
  ["29 d", 29 * DAY, "created 4 weeks ago"],
  ["30 d", 30 * DAY, "created 1 month ago"],
  ["364 d", 364 * DAY, "created 12 months ago"],
  ["365 d", 365 * DAY, "created 1 year ago"],
  ["800 d", 800 * DAY, "created 2 years ago"],
])("%s old reads %s", (_age, age, text) => {
  expect(createdAgo(NOW - age, NOW)).toBe(text);
});

test("a time ahead of the clock reads as just now", () => {
  expect(createdAgo(NOW + HOUR, NOW)).toBe("created just now");
});
