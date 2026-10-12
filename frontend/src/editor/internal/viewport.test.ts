import { expect, test } from "vitest";

import { revealScrollTop } from "./viewport";

const LINE_PX = 20;
const FIND_SPACE_PX = 29;
const PANE = { area: { top: 1000, bottom: 1500 }, lineHeight: LINE_PX, paddingTop: 0 };

test("a change fully on screen, or a zero-line change on screen, does not move the view", () => {
  expect(revealScrollTop({ top: 1100, bottom: 1200 }, PANE)).toBeNull();
  expect(revealScrollTop({ top: 1000, bottom: 1500 }, PANE)).toBeNull();
  expect(revealScrollTop({ top: 1200, bottom: 1200 }, PANE)).toBeNull();
});

test("a change below the view lands a third of the way down", () => {
  expect(revealScrollTop({ top: 2000, bottom: 2100 }, PANE)).toBeCloseTo(2000 - 500 / 3);
  expect(revealScrollTop({ top: 1450, bottom: 1550 }, PANE)).toBeCloseTo(1450 - 500 / 3);
  expect(revealScrollTop({ top: 2000, bottom: 2100 }, { ...PANE, paddingTop: 4 })).toBeCloseTo(
    2004 - 500 / 3,
  );
});

test("a change that fits only lower than a third ends two lines above the bottom", () => {
  expect(revealScrollTop({ top: 2000, bottom: 2400 }, PANE)).toBe(2000 - (500 - 2 * LINE_PX - 400));
});

test("a change taller than the pane minus two gaps starts two lines below the top", () => {
  expect(revealScrollTop({ top: 3000, bottom: 3450 }, PANE)).toBe(3000 - 2 * LINE_PX);
  expect(revealScrollTop({ top: 3000, bottom: 4000 }, PANE)).toBe(3000 - 2 * LINE_PX);
});

test("a change near line 1 clamps at 0, keeping the space above line 1 in view", () => {
  expect(revealScrollTop({ top: 20, bottom: 40 }, PANE)).toBe(0);
  expect(revealScrollTop({ top: 20, bottom: 40 }, { ...PANE, paddingTop: FIND_SPACE_PX })).toBe(0);
});
