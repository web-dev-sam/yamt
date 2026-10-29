import { expect, test } from "vitest";

import { farTop } from "./exactScroll";
import { movedFarTop } from "./exactScroll";

const PADDING_PX = 4;
const HEIGHT_PX = 600;
const RENDERED = { top: 1000, bottom: 2000 };

function at(scrollTop: number): number | null {
  return farTop({ scrollTop, clientHeight: HEIGHT_PX, paddingTop: PADDING_PX }, RENDERED);
}

test("a visible span that ends where the rendered lines start is far, measured below the padding", () => {
  expect(at(404)).toBe(400);
});

test("one pixel of the rendered lines' top in view is not far", () => {
  expect(at(405)).toBeNull();
});

test("a visible span that starts where the rendered lines end is far, measured below the padding", () => {
  expect(at(2004)).toBe(2000);
});

test("one pixel of the rendered lines' bottom in view is not far", () => {
  expect(at(2003)).toBeNull();
});

test("a visible span inside the rendered lines is not far", () => {
  expect(at(1200)).toBeNull();
});

test("a jump fully above or fully below the rendered lines places its visible top", () => {
  expect(at(100)).toBe(96);
  expect(at(2552)).toBe(2548);
});

function movedTo(scrollTop: number, seenTop: number): number | null {
  return movedFarTop(
    seenTop,
    { scrollTop, clientHeight: HEIGHT_PX, paddingTop: PADDING_PX },
    RENDERED,
  );
}

test("a scroll event at the scrollTop seen last places nothing, though the rendered lines moved away", () => {
  expect(movedTo(0, 0)).toBeNull();
  expect(movedTo(2552, 2552)).toBeNull();
});

test("a scrollTop moved away from the rendered lines places its visible top", () => {
  expect(movedTo(2552, 0)).toBe(2548);
  expect(movedTo(100, 1200)).toBe(96);
});

test("a scrollTop moved inside the rendered lines places nothing", () => {
  expect(movedTo(1200, 0)).toBeNull();
});
