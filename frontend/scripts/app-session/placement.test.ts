import { expect, test } from "vitest";

import {
  parsePlacement,
  screenPoint,
  scrollDelta,
  viewportPoint,
  type Placement,
} from "./placement";

const PLACED: Placement = {
  x: 100.4,
  y: 20.6,
  screenX: 0,
  screenY: 0,
  chromeWidth: 0,
  chromeHeight: 0,
  scrollTop: 40,
  scrollHeight: 1115,
  clientHeight: 990,
};

test("the viewport point is the rounded centre", () => {
  expect(viewportPoint(PLACED)).toEqual({ x: 100, y: 21 });
});

test("the screen point adds the window position and its frame: borders at the sides, the rest on top", () => {
  expect(screenPoint(PLACED)).toEqual({ x: 100, y: 21 });
  expect(
    screenPoint({ ...PLACED, screenX: 300, screenY: 50, chromeWidth: 2, chromeHeight: 38 }),
  ).toEqual({
    x: 401,
    y: 108,
  });
});

test("scroll deltas reach the top, the last scroll position, or a pixel offset", () => {
  expect(scrollDelta({ kind: "top" }, PLACED)).toBe(-40);
  expect(scrollDelta({ kind: "bottom" }, PLACED)).toBe(85);
  expect(scrollDelta({ kind: "px", px: 100 }, PLACED)).toBe(60);
  expect(scrollDelta({ kind: "px", px: 40 }, PLACED)).toBe(0);
});

test("parsePlacement rejects a reply without a number", () => {
  expect(parsePlacement({ ...PLACED })).toEqual(PLACED);
  expect(() => parsePlacement({ ...PLACED, scrollTop: null })).toThrow(/field "scrollTop"/);
});
