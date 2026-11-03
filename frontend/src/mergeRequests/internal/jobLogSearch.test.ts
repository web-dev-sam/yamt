import { expect, test } from "vitest";

import {
  NO_RESULTS,
  firstHit,
  firstLineBelow,
  hitCountText,
  placesOnLines,
  steppedHit,
  type HitPlace,
} from "../index";

function placeOn(line: number, offset = 0): HitPlace {
  return { line, start: { run: 0, offset }, end: { run: 0, offset: offset + 1 } };
}

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

test("only_the_places_on_the_lines_asked_for_are_kept", () => {
  const places = [placeOn(0), placeOn(2), placeOn(2, 5), placeOn(3), placeOn(7), placeOn(9)];
  expect(placesOnLines(places, 2, 4)).toEqual([placeOn(2), placeOn(2, 5), placeOn(3)]);
  expect(placesOnLines(places, 1, 3)).toEqual([placeOn(2), placeOn(2, 5)]);
  expect(placesOnLines(places, 0, 1)).toEqual([placeOn(0)]);
  expect(placesOnLines(places, 9, 10)).toEqual([placeOn(9)]);
  expect(placesOnLines(places, 0, 10)).toEqual(places);
  expect(placesOnLines(places, 4, 7)).toEqual([]);
  expect(placesOnLines(places, 10, 20)).toEqual([]);
  expect(placesOnLines([], 0, 5)).toEqual([]);
});

const BOTTOMS = [10, 20, 30, 40, 50];

function bottom(line: number): number {
  return BOTTOMS[line] ?? Infinity;
}

test("the_first_line_below_a_height_is_found_by_its_edge", () => {
  const count = BOTTOMS.length;
  expect(firstLineBelow(count, bottom, 25)).toBe(2);
  expect(firstLineBelow(count, bottom, 20)).toBe(2);
  expect(firstLineBelow(count, bottom, 19)).toBe(1);
  expect(firstLineBelow(count, bottom, 0)).toBe(0);
  expect(firstLineBelow(count, bottom, -5)).toBe(0);
  expect(firstLineBelow(count, bottom, 49)).toBe(4);
  expect(firstLineBelow(count, bottom, 50)).toBe(5);
  expect(firstLineBelow(0, bottom, 0)).toBe(0);
});
