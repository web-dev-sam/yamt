import { expect, test } from "vitest";

import { tooltipBox, tooltipPlacement, type Anchor } from "./operationTooltip";

const VIEWPORT = { width: 1600, height: 1000 };

test("the tooltip ends 4 px above the tag and starts on its text", () => {
  expect(tooltipBox({ tagTop: 970, textLeft: 20, viewport: VIEWPORT })).toEqual({
    left: 20,
    bottom: 34,
    maxWidth: 480,
    maxHeight: 966,
  });
});

test("with less than 480 px to the window's right edge the tooltip is narrower", () => {
  expect(tooltipBox({ tagTop: 970, textLeft: 1300, viewport: VIEWPORT }).maxWidth).toBe(300);
  expect(tooltipBox({ tagTop: 970, textLeft: 1120, viewport: VIEWPORT }).maxWidth).toBe(480);
});

test("a text left past the window's right edge leaves no width", () => {
  expect(tooltipBox({ tagTop: 970, textLeft: 1700, viewport: VIEWPORT }).maxWidth).toBe(0);
});

test("its height is at most the room above the tag", () => {
  expect(tooltipBox({ tagTop: 290, textLeft: 20, viewport: { width: 1400, height: 320 } })).toEqual(
    {
      left: 20,
      bottom: 34,
      maxWidth: 480,
      maxHeight: 286,
    },
  );
});

test("a tag closer than 4 px to the window's top leaves no room", () => {
  expect(tooltipBox({ tagTop: 2, textLeft: 20, viewport: VIEWPORT })).toEqual({
    left: 20,
    bottom: 1000,
    maxWidth: 480,
    maxHeight: 0,
  });
});

const TIP = { width: 200, height: 30 };

function anchorAt(top: number, left: number): Anchor {
  return { top, bottom: top + 20, left };
}

test("a_tip_that_fits_above_sits_above_at_the_left_edge", () => {
  expect(tooltipPlacement({ anchor: anchorAt(100, 50), tip: TIP, viewport: VIEWPORT })).toEqual({
    left: 50,
    top: 66,
    maxWidth: 480,
  });
  expect(tooltipPlacement({ anchor: anchorAt(34, 50), tip: TIP, viewport: VIEWPORT }).top).toBe(0);
});

test("a_tip_that_does_not_fit_above_goes_below", () => {
  expect(tooltipPlacement({ anchor: anchorAt(33, 50), tip: TIP, viewport: VIEWPORT })).toEqual({
    left: 50,
    top: 57,
    maxWidth: 480,
  });
});

test("a_tip_near_the_right_edge_moves_left_never_past_0", () => {
  expect(tooltipPlacement({ anchor: anchorAt(100, 1500), tip: TIP, viewport: VIEWPORT }).left).toBe(
    1400,
  );
  expect(tooltipPlacement({ anchor: anchorAt(100, 1400), tip: TIP, viewport: VIEWPORT }).left).toBe(
    1400,
  );
  const narrow = { width: 150, height: 1000 };
  expect(tooltipPlacement({ anchor: anchorAt(100, 100), tip: TIP, viewport: narrow })).toEqual({
    left: 0,
    top: 66,
    maxWidth: 150,
  });
});
