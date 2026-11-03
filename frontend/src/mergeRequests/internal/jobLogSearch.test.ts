import { expect, test } from "vitest";

import { NO_RESULTS, firstHit, hitCountText, steppedHit } from "../index";

test("the_first_current_match_is_the_last", () => {
  expect(firstHit(17)).toBe(16);
  expect(firstHit(1)).toBe(0);
  expect(firstHit(0)).toBeNull();
});

test("steps_wrap_both_ways", () => {
  expect(steppedHit(0, 3, false)).toBe(1);
  expect(steppedHit(1, 3, false)).toBe(2);
  expect(steppedHit(2, 3, false)).toBe(0);
  expect(steppedHit(2, 3, true)).toBe(1);
  expect(steppedHit(1, 3, true)).toBe(0);
  expect(steppedHit(0, 3, true)).toBe(2);
  expect(steppedHit(0, 1, false)).toBe(0);
  expect(steppedHit(0, 1, true)).toBe(0);
});

test("the_count_reads_one_based", () => {
  expect(hitCountText(2, 17)).toBe("3 of 17");
  expect(hitCountText(0, 1)).toBe("1 of 1");
  expect(NO_RESULTS).toBe("No results");
});
