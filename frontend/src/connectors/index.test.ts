import { expect, test } from "vitest";

import { bandPath } from ".";

test("an aligned band is a rectangle drawn with flat curves", () => {
  const band = { left: { top: 0, bottom: 20 }, right: { top: 0, bottom: 20 } };

  expect(bandPath(band, 40)).toBe("M0 0 C20 0 20 0 40 0 L40 20 C20 20 20 20 0 20 Z");
});

test("a band whose right side is lower curves down with control points at half the width", () => {
  const band = { left: { top: 10, bottom: 30 }, right: { top: 50, bottom: 90 } };

  expect(bandPath(band, 40)).toBe("M0 10 C20 10 20 50 40 50 L40 90 C20 90 20 30 0 30 Z");
});

test("an insertion on the left tapers the band to a point on the left edge", () => {
  const band = { left: { top: 40, bottom: 40 }, right: { top: 40, bottom: 100 } };

  expect(bandPath(band, 40)).toBe("M0 40 C20 40 20 40 40 40 L40 100 C20 100 20 40 0 40 Z");
});

test("an insertion on the right tapers to the right edge, at fractional line heights", () => {
  const lineHeight = 18.2;
  const band = {
    left: { top: lineHeight, bottom: lineHeight * 3 },
    right: { top: lineHeight * 2, bottom: lineHeight * 2 },
  };

  expect(bandPath(band, 39)).toBe(
    "M0 18.2 C19.5 18.2 19.5 36.4 39 36.4 L39 36.4 C19.5 36.4 19.5 54.6 0 54.6 Z",
  );
});
