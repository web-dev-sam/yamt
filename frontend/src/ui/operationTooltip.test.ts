import { expect, test } from "vitest";

import { tooltipBox } from "./operationTooltip";

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
